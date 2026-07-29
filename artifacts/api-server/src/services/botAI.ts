/**
 * Bot AI Engine — Shepherd Connect WhatsApp Bot
 *
 * Handles:
 *  1. Natural language intent classification (gpt-5-nano — fast & cheap)
 *  2. General church Q&A answers
 *  3. Proactive message scheduling (reminders, attendance notifications)
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import {
  usersTable,
  familiesTable,
  childrenTable,
  attendanceTable,
  notificationsTable,
  botSessionsTable,
} from "@workspace/db/schema";
import { eq, or, and, gte, lt, isNotNull, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendWhatsAppToJid } from "./whatsapp";

// ── Intent types ──────────────────────────────────────────────────────────────

export type Intent =
  | "CHECK_STATUS"      // attendance / where is my child
  | "GET_OTP"           // delegate pickup codes
  | "MY_CHILDREN"       // list children and classes
  | "NOTIFICATIONS"     // recent notifications
  | "SUBMIT_CONCERN"    // concern / feedback / complaint
  | "SUPPORT_REQUEST"   // check-in / check-out help
  | "SUBSTITUTE_REQUEST" // teacher requests a substitute (can't make it)
  | "MY_SCHEDULE"       // teacher views today's class schedule / allocations
  | "GENERAL_QUESTION"  // anything about the church
  | "MENU"              // show menu
  | "SWITCH"            // switch account/role
  | "FAREWELL"          // goodbye / good night / bye
  | "UNKNOWN";          // couldn't determine

export interface ClassifiedIntent {
  intent: Intent;
  answer?: string;   // populated for GENERAL_QUESTION
  confidence: number; // 0 – 1
}

// ── Church knowledge for the AI ───────────────────────────────────────────────

const CHURCH_SYSTEM_PROMPT = `
You are the friendly WhatsApp assistant for Shepherd Connect — the children's ministry
platform of RCCG City of David.

Your job: understand what parents and teachers want, and either:
  (a) classify it into one of the known intents, OR
  (b) answer general questions about the church / children's ministry.

Known intents (return as "intent" field):
  CHECK_STATUS         — wants to know if their child is checked in / where child is
  GET_OTP              — wants delegate pickup OTP codes
  MY_CHILDREN          — wants to see their children and class info
  NOTIFICATIONS        — wants to see recent notifications
  SUBMIT_CONCERN       — wants to submit a concern, complaint, compliment, or feedback
  SUPPORT_REQUEST      — wants help with check-in, check-out, or delegate pickup
  SUBSTITUTE_REQUEST   — teacher can't make it, needs a substitute (illness, emergency, etc.)
  MY_SCHEDULE          — teacher wants to see today's class schedule / allocations
  MENU                 — wants to see the main menu
  SWITCH               — wants to switch to a different account or role
  GENERAL_QUESTION     — question about the church (answer it kindly and concisely)
  UNKNOWN              — cannot determine intent (politely say so in "answer" field)

Church facts you know:
  - Church: RCCG City of David
  - Platform: Shepherd Connect
  - Children's services: Sundays at 7:00 AM and 10:30 AM
  - Ages: Babies (0–2), Toddlers (2–4), Kindergarten (4–6), Primary (6–12)
  - Check-in is at the Children's Ministry desk with a QR code or staff name
  - Parents can add pickup delegates in the app (My Family → Delegates)
  - OTPs are valid for 24 hours
  - For emergencies contact the admin at the church desk

Reply with ONLY valid JSON — no explanation, no markdown:
{
  "intent": "<intent>",
  "answer": "<optional: a warm 1–3 sentence reply for GENERAL_QUESTION or UNKNOWN>",
  "confidence": <0.0 – 1.0>
}
`.trim();

// ── Intent classifier ─────────────────────────────────────────────────────────

export async function classifyIntent(
  message: string,
  role: "parent" | "teacher" | "support" | "admin" | "super_admin" | "attendant",
  childNames: string[],
): Promise<ClassifiedIntent> {
  const context = childNames.length
    ? `This user's children: ${childNames.join(", ")}.`
    : "";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      max_completion_tokens: 256,
      messages: [
        { role: "system", content: CHURCH_SYSTEM_PROMPT },
        {
          role: "user",
          content: `User role: ${role}\n${context}\nMessage: "${message}"`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "{}";

    // Strip markdown code fences if model adds them
    const clean = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(clean) as ClassifiedIntent;

    return {
      intent: parsed.intent ?? "UNKNOWN",
      answer: parsed.answer,
      confidence: Number(parsed.confidence ?? 0.5),
    };
  } catch (err) {
    logger.warn({ err: String(err) }, "botAI: intent classification failed");
    return { intent: "UNKNOWN", confidence: 0 };
  }
}

// ── Fuzzy keyword pre-classifier (no AI cost for obvious inputs) ──────────────

const KEYWORD_MAP: Array<[RegExp, Intent]> = [
  [/\b(bye|goodbye|good.?night|good.?eve|see.?you|later|cya|take.?care|night|peace.?out|signing.?off|ttyl)\b/i, "FAREWELL"],
  [/\b(status|where|check.?in|attend|present|class|son|daughter|child)\b/i, "CHECK_STATUS"],
  [/\b(otp|code|delegate|pickup|collect)\b/i, "GET_OTP"],
  [/\b(children|child|kids?|my.?kid|my.?child)\b/i, "MY_CHILDREN"],
  [/\b(notif|notify|message|alert|news)\b/i, "NOTIFICATIONS"],
  [/\b(concern|complaint|complain|feedback|compliment|issue|problem|report)\b/i, "SUBMIT_CONCERN"],
  [/\b(substitute|sub|can.?t.?make|can.?t.?come|unavailable|sick|ill|emergency|won.?t.?be|not.?coming)\b/i, "SUBSTITUTE_REQUEST"],
  [/\b(schedule|allocation|roster|my.?class|assigned|timetable|slot)\b/i, "MY_SCHEDULE"],
  [/\b(request|support|help|assist|check.?in|check.?out)\b/i, "SUPPORT_REQUEST"],
  [/\b(menu|home|main|start|options?|back)\b/i, "MENU"],
  [/\b(switch|change.?account|change.?role)\b/i, "SWITCH"],
];

export function fuzzyClassify(message: string): Intent | null {
  for (const [pattern, intent] of KEYWORD_MAP) {
    if (pattern.test(message)) return intent;
  }
  return null;
}

// ── Proactive message scheduler ───────────────────────────────────────────────

function phoneToWaJid(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const norm = digits.startsWith("0")
    ? "234" + digits.slice(1)
    : digits.startsWith("+") ? digits.slice(1) : digits;
  return norm + "@s.whatsapp.net";
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Send pre-service reminder to all active parents */
async function sendServiceReminders(slotLabel: string): Promise<void> {
  logger.info({ slotLabel }, "Bot: sending pre-service reminders");
  const parents = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.role, "parent"), eq(usersTable.isActive, true)));

  let sent = 0;
  for (const parent of parents) {
    if (!parent.phone) continue;
    try {
      await sendWhatsAppToJid(
        phoneToWaJid(parent.phone),
        `🌟 *${timeGreeting()}, ${parent.firstName}!*\n\n` +
        `A reminder that the *${slotLabel} children's service* starts soon at RCCG City of David.\n\n` +
        `📋 You can check your child's attendance any time by texting *1* here.\n` +
        `🔑 Pickup OTPs: text *2*\n\n` +
        `_Shepherd Connect — Safe. Known. Celebrated._`,
      );
      sent++;
    } catch (err) {
      logger.warn({ userId: parent.id, err: String(err) }, "Bot: reminder send failed");
    }
  }
  logger.info({ sent, total: parents.length }, "Bot: pre-service reminders sent");
}

/** Notify parent when their child is checked in or out */
export async function notifyParentAttendanceChange(
  childId: number,
  childName: string,
  action: "checked_in" | "checked_out",
  slot?: string,
): Promise<void> {
  try {
    const [child] = await db
      .select({ familyId: childrenTable.familyId })
      .from(childrenTable)
      .where(eq(childrenTable.id, childId));
    if (!child) return;

    const [family] = await db
      .select()
      .from(familiesTable)
      .where(eq(familiesTable.id, child.familyId));
    if (!family) return;

    const parentIds = [family.parent1Id, family.parent2Id].filter(Boolean) as number[];
    const parents = await db
      .select()
      .from(usersTable)
      .where(
        parentIds.length === 2
          ? or(eq(usersTable.id, parentIds[0]!), eq(usersTable.id, parentIds[1]!))
          : eq(usersTable.id, parentIds[0]!),
      );

    const emoji = action === "checked_in" ? "🟢" : "✅";
    const verb  = action === "checked_in" ? "checked in" : "checked out";
    const slotText = slot ? ` (${slot === "7am" ? "7:00 AM" : "10:30 AM"} service)` : "";

    for (const parent of parents) {
      if (!parent.phone) continue;
      try {
        await sendWhatsAppToJid(
          phoneToWaJid(parent.phone),
          `${emoji} *${childName} has been ${verb}*${slotText}\n\n` +
          `📅 ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}\n\n` +
          `_Reply *1* to check live status — Shepherd Connect_`,
        );
      } catch (err) {
        logger.warn({ userId: parent.id, err: String(err) }, "Bot: attendance notify failed");
      }
    }
  } catch (err) {
    logger.warn({ childId, err: String(err) }, "Bot: notifyParentAttendanceChange failed");
  }
}

/** Personalised greeting line */
export function greetingLine(firstName: string): string {
  const h = new Date().getHours();
  const greeting =
    h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const day = new Date().toLocaleDateString("en-GB", { weekday: "long" });
  return `${greeting}, *${firstName}*! Happy ${day} 🌟`;
}

/** Send "are you there?" nudge to sessions idle for > 20 minutes */
async function sendIdleNudges(): Promise<void> {
  try {
    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000);
    const idleSessions = await db
      .select()
      .from(botSessionsTable)
      .where(
        and(
          eq(botSessionsTable.step, "idle"),
          lt(botSessionsTable.updatedAt, twentyMinAgo),
          sql`${botSessionsTable.expiresAt} > NOW()`,
          isNotNull(botSessionsTable.activeUserId),
        ),
      );

    for (const s of idleSessions) {
      if (!s.activeUserId) continue;
      const [user] = await db
        .select({ firstName: usersTable.firstName })
        .from(usersTable)
        .where(eq(usersTable.id, s.activeUserId));
      if (!user) continue;

      try {
        await sendWhatsAppToJid(
          s.jid,
          `👋 *Hey ${user.firstName}!*\n\n` +
          `Are you still there? Is there anything I can help you with today?\n\n` +
          `Reply *Yes* if you need something, or *No* to end our chat. 😊`,
        );
        // Flip step to awaiting_nudge WITHOUT touching updatedAt
        // (so the next cron run won't nudge them again)
        await db
          .update(botSessionsTable)
          .set({ step: "awaiting_nudge" })
          .where(eq(botSessionsTable.jid, s.jid));
      } catch (err) {
        logger.warn({ jid: s.jid, err: String(err) }, "Bot: idle nudge send failed");
      }
    }

    if (idleSessions.length) {
      logger.info({ count: idleSessions.length }, "Bot: idle nudges sent");
    }
  } catch (err) {
    logger.warn({ err: String(err) }, "Bot: sendIdleNudges error");
  }
}

/** Start scheduled reminders using node-cron */
export function startBotScheduler(): void {
  // Dynamically import node-cron to avoid build issues if not available
  import("node-cron").then(({ default: cron }) => {
    // Sunday 6:30 AM — 7am service reminder
    cron.schedule("30 6 * * 0", () => { void sendServiceReminders("7:00 AM"); }, { timezone: "Africa/Lagos" });
    // Sunday 10:00 AM — 10:30am service reminder
    cron.schedule("0 10 * * 0", () => { void sendServiceReminders("10:30 AM"); }, { timezone: "Africa/Lagos" });
    // Every 10 minutes — nudge sessions idle for > 20 min
    cron.schedule("*/10 * * * *", () => { void sendIdleNudges(); });
    logger.info("Bot: proactive scheduler started (Sun reminders + 10-min idle nudges)");
  }).catch(err => {
    logger.warn({ err: String(err) }, "Bot: scheduler not started (node-cron unavailable)");
  });
}
