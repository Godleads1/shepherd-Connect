/**
 * Shepherd Connect WhatsApp Bot
 *
 * Handles inbound WhatsApp messages via Baileys.
 * Only registered parents (phone number matches a user in the DB) can use it.
 *
 * Conversation flows:
 *   HELP / 0       → Main menu
 *   1 / STATUS     → Child attendance status today
 *   2 / OTP        → Pickup delegate OTP codes
 *   3 / CONCERN    → Submit a safeguarding concern / feedback
 */

import { db } from "@workspace/db";
import {
  usersTable,
  familiesTable,
  childrenTable,
  attendanceTable,
  pickupDelegatesTable,
  parentConcernsTable,
  classesTable,
} from "@workspace/db/schema";
import { eq, or, and } from "drizzle-orm";
import { logger } from "../lib/logger";

// ── Session state ─────────────────────────────────────────────────────────────

type Step =
  | "idle"
  | "concern_select_type"
  | "concern_enter_desc";

interface Session {
  step: Step;
  data: Record<string, string>;
  expiresAt: number;
}

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes idle timeout

function getSession(jid: string): Session {
  const existing = sessions.get(jid);
  if (existing && existing.expiresAt > Date.now()) {
    existing.expiresAt = Date.now() + SESSION_TTL_MS;
    return existing;
  }
  const fresh: Session = { step: "idle", data: {}, expiresAt: Date.now() + SESSION_TTL_MS };
  sessions.set(jid, fresh);
  return fresh;
}

function resetSession(jid: string): Session {
  const s: Session = { step: "idle", data: {}, expiresAt: Date.now() + SESSION_TTL_MS };
  sessions.set(jid, s);
  return s;
}

// ── Phone normalisation ───────────────────────────────────────────────────────

function jidToPhone(jid: string): string {
  // Baileys JIDs look like "2348012345678@s.whatsapp.net"
  return jid.split("@")[0]!;
}

function normalisePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("0")) return "234" + d.slice(1);
  if (d.startsWith("+")) return d.slice(1);
  return d;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function findParentByPhone(jid: string) {
  const phone = jidToPhone(jid);
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "parent"));

  // Match normalised phone
  return rows.find(u => u.phone && normalisePhone(u.phone) === phone) ?? null;
}

async function getParentChildren(userId: number) {
  const [family] = await db
    .select()
    .from(familiesTable)
    .where(or(eq(familiesTable.parent1Id, userId), eq(familiesTable.parent2Id, userId)));

  if (!family) return [];

  const children = await db
    .select({
      id: childrenTable.id,
      firstName: childrenTable.firstName,
      lastName: childrenTable.lastName,
      className: classesTable.name,
    })
    .from(childrenTable)
    .leftJoin(classesTable, eq(childrenTable.currentClassId, classesTable.id))
    .where(eq(childrenTable.familyId, family.id));

  return children;
}

async function getTodayAttendance(childIds: number[]) {
  if (childIds.length === 0) return [];
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .select({
      childId: attendanceTable.childId,
      status: attendanceTable.status,
      serviceSlot: attendanceTable.serviceSlot,
      checkInTime: attendanceTable.checkInTime,
      checkOutTime: attendanceTable.checkOutTime,
    })
    .from(attendanceTable)
    .where(eq(attendanceTable.serviceDate, today));

  return rows.filter(r => childIds.includes(r.childId));
}

async function getDelegates(childIds: number[]) {
  if (childIds.length === 0) return [];
  const all = await db.select().from(pickupDelegatesTable);
  return all.filter(d => childIds.includes(d.childId));
}

function generateRef(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `SC-${year}-${rand}`;
}

// ── Message builders ──────────────────────────────────────────────────────────

function menuText(firstName: string): string {
  return (
    `👋 Hi ${firstName}! Welcome to *Shepherd Connect*.\n\n` +
    `What would you like to do?\n\n` +
    `*1* — 📋 Check attendance status\n` +
    `*2* — 🔑 Get pickup delegate OTP\n` +
    `*3* — 💬 Submit a concern or feedback\n\n` +
    `Reply with a number or type *HELP* at any time to see this menu.`
  );
}

function unknownText(): string {
  return (
    `👋 Hello! I'm the *Shepherd Connect* assistant.\n\n` +
    `I'm sorry, I don't recognise this number. Only registered parents can use this service.\n\n` +
    `Please register on the Shepherd Connect app first:\n` +
    `🌐 https://sherpherdconnect.name.ng\n\n` +
    `If you believe this is an error, please contact the church admin.`
  );
}

function statusText(
  children: Awaited<ReturnType<typeof getParentChildren>>,
  attendance: Awaited<ReturnType<typeof getTodayAttendance>>,
): string {
  if (children.length === 0) {
    return `ℹ️ You don't have any children registered yet. Please add them via the Shepherd Connect app.`;
  }

  const statusLabel: Record<string, string> = {
    dropped_off:  "🟡 Dropped off (not yet in class)",
    in_transit:   "🟠 In transit to classroom",
    in_class:     "🟢 In class",
    picked_up:    "✅ Picked up",
  };

  const lines = children.map(c => {
    const att = attendance.find(a => a.childId === c.id);
    const name = `${c.firstName} ${c.lastName}`;
    const cls  = c.className ? ` (${c.className})` : "";
    if (!att) return `👦 *${name}*${cls}\n   ⚪ Not checked in today`;
    const st = statusLabel[att.status] ?? att.status;
    const slot = att.serviceSlot === "7am" ? "7:00 AM" : "10:30 AM";
    return `👦 *${name}*${cls}\n   ${st}\n   ⏰ ${slot} service`;
  });

  return `📋 *Today's Attendance*\n\n${lines.join("\n\n")}`;
}

function otpText(
  children: Awaited<ReturnType<typeof getParentChildren>>,
  delegates: Awaited<ReturnType<typeof getDelegates>>,
): string {
  if (children.length === 0) return `ℹ️ No children found on your account.`;
  if (delegates.length === 0) {
    return (
      `ℹ️ You haven't added any pickup delegates yet.\n\n` +
      `Add delegates via the app under *Pickup Delegates*.`
    );
  }

  const now = new Date();
  const lines = children.flatMap(c => {
    const childDels = delegates.filter(d => d.childId === c.id);
    if (childDels.length === 0) return [];
    return [`👦 *${c.firstName} ${c.lastName}*`, ...childDels.map(d => {
      const valid = d.otpCode && d.otpExpiresAt && d.otpExpiresAt > now;
      const otp = valid ? `*${d.otpCode}*` : "_(expired — regenerate in app)_";
      return `   👤 ${d.name}: ${otp}`;
    })];
  });

  if (lines.length === 0) return `ℹ️ No delegates found.`;

  return `🔑 *Pickup Delegate OTPs*\n\n${lines.join("\n")}\n\n_Show the OTP to the attendant at pickup._`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleInboundMessage(
  fromJid: string,
  text: string,
  reply: (msg: string) => Promise<void>,
): Promise<void> {
  const input = text.trim().toLowerCase();

  // Look up parent
  const parent = await findParentByPhone(fromJid);
  if (!parent) {
    await reply(unknownText());
    return;
  }

  const session = getSession(fromJid);

  // Global escape commands
  if (["0", "menu", "help", "hi", "hello", "start"].includes(input)) {
    resetSession(fromJid);
    await reply(menuText(parent.firstName));
    return;
  }

  // ── Step-based conversation ──────────────────────────────────────────────

  if (session.step === "concern_select_type") {
    const typeMap: Record<string, string> = {
      "1": "safeguarding_concern",
      "2": "complaint",
      "3": "compliment",
      "4": "general_feedback",
    };
    const concernType = typeMap[input];
    if (!concernType) {
      await reply(`Please reply with *1*, *2*, *3*, or *4* to select the type.\n\nOr type *0* to go back to the main menu.`);
      return;
    }
    session.step = "concern_enter_desc";
    session.data.concernType = concernType;
    const labels: Record<string, string> = {
      safeguarding_concern: "Safeguarding Concern",
      complaint: "Complaint",
      compliment: "Compliment",
      general_feedback: "General Feedback",
    };
    await reply(`✏️ You selected: *${labels[concernType]}*\n\nPlease type your message now. Be as detailed as possible.\n\n_Type *0* to cancel._`);
    return;
  }

  if (session.step === "concern_enter_desc") {
    if (text.trim().length < 10) {
      await reply(`Please provide a bit more detail (at least 10 characters).\n\nType *0* to cancel.`);
      return;
    }

    // Submit concern
    let ref = generateRef();
    const [clash] = await db.select().from(parentConcernsTable).where(eq(parentConcernsTable.referenceNumber, ref));
    if (clash) ref = generateRef();

    await db.insert(parentConcernsTable).values({
      referenceNumber: ref,
      parentUserId: parent.id,
      type: session.data.concernType as any,
      description: text.trim(),
      status: "open",
    });

    resetSession(fromJid);
    logger.info({ userId: parent.id, ref }, "WhatsApp bot: concern submitted");

    await reply(
      `✅ *Concern submitted successfully!*\n\n` +
      `Your reference number is:\n*${ref}*\n\n` +
      `Please keep this number. The safeguarding team will review your submission and respond via the app.\n\n` +
      `Type *0* to return to the main menu.`,
    );
    return;
  }

  // ── Idle menu selections ─────────────────────────────────────────────────

  if (input === "1" || input === "status") {
    const children = await getParentChildren(parent.id);
    const attendance = await getTodayAttendance(children.map(c => c.id));
    await reply(statusText(children, attendance));
    return;
  }

  if (input === "2" || input === "otp") {
    const children = await getParentChildren(parent.id);
    const delegates = await getDelegates(children.map(c => c.id));
    await reply(otpText(children, delegates));
    return;
  }

  if (input === "3" || input === "concern") {
    session.step = "concern_select_type";
    await reply(
      `💬 *Submit a Concern or Feedback*\n\n` +
      `What type of submission is this?\n\n` +
      `*1* — 🛡️ Safeguarding Concern\n` +
      `*2* — ⚠️ Complaint\n` +
      `*3* — 👍 Compliment\n` +
      `*4* — 💬 General Feedback\n\n` +
      `_Type *0* to cancel._`,
    );
    return;
  }

  // Unrecognised input — show menu
  await reply(menuText(parent.firstName));
}
