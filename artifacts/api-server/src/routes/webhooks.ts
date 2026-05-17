import { Router } from "express";
import twilio from "twilio";
import { eq, and, or } from "drizzle-orm";
import { db, usersTable, childrenTable, attendanceTable, familiesTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

const MessagingResponse = twilio.twiml.MessagingResponse;

function validateTwilioSignature(req: Parameters<typeof twilio.validateRequest>[2] extends infer R ? any : any): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
  if (!authToken) return true;
  const signature = (req.headers["x-twilio-signature"] as string) ?? "";
  const proto = (req.headers["x-forwarded-proto"] as string) ?? "https";
  const host = (req.headers["x-forwarded-host"] as string) ?? (req.headers["host"] as string) ?? "";
  const url = `${proto}://${host}${req.originalUrl}`;
  return twilio.validateRequest(authToken, signature, url, req.body as Record<string, string>);
}

function buildReply(message: string): string {
  const twiml = new MessagingResponse();
  twiml.message(message);
  return twiml.toString();
}

const MENU = `*Shepherd Connect* - RCCG City of David

Reply with:
*CHECKIN* - Check-in status
*CHILDREN* - Your children's info
*HELP* - Show this menu`;

router.post("/webhooks/whatsapp", async (req, res): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    if (!validateTwilioSignature(req)) {
      logger.warn({ path: req.path }, "Invalid Twilio signature rejected");
      res.status(403).send("Forbidden");
      return;
    }
  }

  const body = req.body as Record<string, string>;
  const from = body["From"] ?? "";
  const msgBody = (body["Body"] ?? "").trim().toUpperCase();

  logger.info({ from, msgBody }, "WhatsApp webhook received");

  res.set("Content-Type", "text/xml");

  // Extract phone number from "whatsapp:+2348012345678" format
  const phone = from.replace("whatsapp:", "").replace(/\s/g, "");

  try {
    if (msgBody === "HELP" || msgBody === "START" || msgBody === "HI" || msgBody === "HELLO" || msgBody === "") {
      res.send(buildReply(MENU));
      return;
    }

    // Find parent by phone number
    const [user] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.phone, phone), eq(usersTable.role, "parent"), eq(usersTable.isActive, true)))
      .limit(1);

    if (!user) {
      res.send(buildReply(
        `Welcome to *Shepherd Connect*! 👋\n\nWe couldn't find your number in our system.\n\nPlease register at your church or contact the admin.\n\nReply *HELP* for options.`
      ));
      return;
    }

    const userName = `${user.firstName} ${user.lastName}`;

    const getFamily = async () =>
      db
        .select()
        .from(familiesTable)
        .where(
          or(
            eq(familiesTable.parent1Id, user.id),
            eq(familiesTable.parent2Id, user.id),
          )!,
        )
        .limit(1)
        .then((r) => r[0] ?? null);

    if (msgBody === "CHECKIN" || msgBody === "CHECK-IN" || msgBody === "STATUS") {
      const family = await getFamily();

      if (!family) {
        res.send(buildReply(`Hi ${userName}! Your family hasn't been registered yet. Please contact your church admin.`));
        return;
      }

      const checkedIn = await db
        .select({ firstName: childrenTable.firstName, lastName: childrenTable.lastName })
        .from(attendanceTable)
        .innerJoin(childrenTable, eq(attendanceTable.childId, childrenTable.id))
        .where(
          and(
            eq(childrenTable.familyId, family.id),
            or(
              eq(attendanceTable.status, "dropped_off"),
              eq(attendanceTable.status, "in_transit"),
              eq(attendanceTable.status, "in_class"),
            )!,
          ),
        );

      if (checkedIn.length === 0) {
        res.send(buildReply(`Hi ${userName}! ✅\n\nNo children from your family are currently checked in.`));
      } else {
        const names = checkedIn.map((c) => `• ${c.firstName} ${c.lastName}`).join("\n");
        res.send(buildReply(`Hi ${userName}! ✅\n\n*Currently checked in:*\n${names}\n\nReply *HELP* for more options.`));
      }
      return;
    }

    if (msgBody === "CHILDREN" || msgBody === "CHILD") {
      const family = await getFamily();

      if (!family) {
        res.send(buildReply(`Hi ${userName}! Your family record hasn't been set up yet. Please speak to your church admin.`));
        return;
      }

      const children = await db
        .select({ firstName: childrenTable.firstName, lastName: childrenTable.lastName })
        .from(childrenTable)
        .where(eq(childrenTable.familyId, family.id))
        .limit(10);

      if (children.length === 0) {
        res.send(buildReply(`Hi ${userName}! No children are registered under your family yet. Contact your admin to add them.`));
        return;
      }

      const list = children.map((c) => `• ${c.firstName} ${c.lastName} ✅`).join("\n");
      res.send(buildReply(`Hi ${userName}! 👨‍👩‍👧‍👦\n\n*Your children:*\n${list}\n\nReply *CHECKIN* to see who's here today.`));
      return;
    }

    if (msgBody === "FEEDBACK") {
      res.send(buildReply(
        `Hi ${userName}! 💬\n\nWe'd love to hear your thoughts on today's service.\n\nPlease open the Shepherd Connect app or visit your church portal to submit feedback.\n\nThank you for helping us grow! 🙏`
      ));
      return;
    }

    // Default
    res.send(buildReply(`Hi ${userName}! I didn't understand that.\n\n${MENU}`));
  } catch (err) {
    logger.error({ err }, "WhatsApp webhook error");
    res.send(buildReply("Sorry, something went wrong. Please try again or contact the church admin."));
  }
});

export default router;
