import { Router } from "express";
import twilio from "twilio";
import { eq, and } from "drizzle-orm";
import { db, usersTable, childrenTable, attendanceTable, familiesTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

const MessagingResponse = twilio.twiml.MessagingResponse;

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

    if (msgBody === "CHECKIN" || msgBody === "CHECK-IN" || msgBody === "STATUS") {
      const family = user.familyId
        ? await db.select().from(familiesTable).where(eq(familiesTable.id, user.familyId)).limit(1).then((r) => r[0])
        : null;

      if (!family) {
        res.send(buildReply(`Hi ${user.name}! Your family hasn't been registered yet. Please contact your church admin.`));
        return;
      }

      const checkedIn = await db
        .select({ name: childrenTable.name })
        .from(attendanceTable)
        .innerJoin(childrenTable, eq(attendanceTable.childId, childrenTable.id))
        .where(
          and(
            eq(childrenTable.familyId, family.id),
            eq(attendanceTable.status, "checked_in")
          )
        );

      if (checkedIn.length === 0) {
        res.send(buildReply(`Hi ${user.name}! ✅\n\nNo children from your family are currently checked in.`));
      } else {
        const names = checkedIn.map((c) => `• ${c.name}`).join("\n");
        res.send(buildReply(`Hi ${user.name}! ✅\n\n*Currently checked in:*\n${names}\n\nReply *HELP* for more options.`));
      }
      return;
    }

    if (msgBody === "CHILDREN" || msgBody === "CHILD") {
      const family = user.familyId
        ? await db.select().from(familiesTable).where(eq(familiesTable.id, user.familyId)).limit(1).then((r) => r[0])
        : null;

      if (!family) {
        res.send(buildReply(`Hi ${user.name}! Your family record hasn't been set up yet. Please speak to your church admin.`));
        return;
      }

      const children = await db
        .select({ name: childrenTable.name, isActive: childrenTable.isActive })
        .from(childrenTable)
        .where(eq(childrenTable.familyId, family.id))
        .limit(10);

      if (children.length === 0) {
        res.send(buildReply(`Hi ${user.name}! No children are registered under your family yet. Contact your admin to add them.`));
        return;
      }

      const list = children.map((c) => `• ${c.name} ${c.isActive ? "✅" : "⏸️"}`).join("\n");
      res.send(buildReply(`Hi ${user.name}! 👨‍👩‍👧‍👦\n\n*Your children:*\n${list}\n\nReply *CHECKIN* to see who's here today.`));
      return;
    }

    if (msgBody === "FEEDBACK") {
      res.send(buildReply(
        `Hi ${user.name}! 💬\n\nWe'd love to hear your thoughts on today's service.\n\nPlease open the Shepherd Connect app or visit your church portal to submit feedback.\n\nThank you for helping us grow! 🙏`
      ));
      return;
    }

    // Default
    res.send(buildReply(`Hi ${user.name}! I didn't understand that.\n\n${MENU}`));
  } catch (err) {
    logger.error({ err }, "WhatsApp webhook error");
    res.send(buildReply("Sorry, something went wrong. Please try again or contact the church admin."));
  }
});

export default router;
