/**
 * Shepherd Connect WhatsApp Bot — Smart Edition
 *
 * ✦ Natural language: type anything — AI understands it
 * ✦ AI replies: answers general church questions
 * ✦ Proactive messages: check-in/out notifications + Sunday reminders
 * ✦ Smarter menus: personalised greetings, last-action shortcuts
 * ✦ Typo-tolerant: fuzzy keywords + AI fallback catch everything
 *
 * All state in PostgreSQL — survives restarts, works with PM2 clustering.
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
  notificationsTable,
  teachersTable,
  teacherAllocationsTable,
  supportRequestsTable,
  botSessionsTable,
  botLidCacheTable,
  botPendingApprovalsTable,
  botPhotoPendingTable,
} from "@workspace/db/schema";
import { eq, or, desc, and, inArray, lt, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendWhatsAppToJid, sendWhatsAppImageToJid } from "./whatsapp";
import {
  classifyIntent,
  fuzzyClassify,
  greetingLine,
  startBotScheduler,
  type Intent,
} from "./botAI";

// ── Start proactive scheduler once on module load ─────────────────────────────
startBotScheduler();

// ── Types ─────────────────────────────────────────────────────────────────────

type UserRole = "parent" | "teacher" | "admin" | "super_admin" | "attendant" | "support";

type Step =
  | "idle"
  | "lid_verify_phone"
  | "role_select"
  | "concern_select_type"
  | "concern_enter_desc"
  | "request_select_type"
  | "request_select_child"
  | "awaiting_photo";

interface SessionData {
  candidates?: string;
  concernType?: string;
  requestType?: string;
  childList?: string;
  lastAction?: string;   // e.g. "CHECK_STATUS"
  [key: string]: string | undefined;
}

interface Session {
  step: Step;
  activeUserId?: number;
  data: SessionData;
}

interface RelayData {
  parentJid: string;
  supportJid: string;
  childName: string;
  requestType: "checkin" | "checkout" | "delegate_pickup";
  childId: number;
  parentUserId: number;
  assignedSupportId: number;
}

// ── Round-robin counter (per-process; resets on restart — acceptable) ─────────
let supportRoundRobinIdx = 0;

// ── Session TTL ───────────────────────────────────────────────────────────────
const SESSION_TTL_MS = 15 * 60 * 1000;
const PHOTO_TTL_MS   = 10 * 60 * 1000;

// ── DB cleanup every 10 minutes ───────────────────────────────────────────────
setInterval(async () => {
  try {
    const now = new Date();
    await db.delete(botSessionsTable).where(lt(botSessionsTable.expiresAt, now));
    await db.delete(botPhotoPendingTable).where(lt(botPhotoPendingTable.expiresAt, now));
  } catch (err) {
    logger.warn({ err: String(err) }, "Bot DB cleanup error");
  }
}, 10 * 60 * 1000).unref();

// ── Session DB helpers ────────────────────────────────────────────────────────

async function getSession(jid: string): Promise<Session> {
  const [row] = await db
    .select()
    .from(botSessionsTable)
    .where(and(eq(botSessionsTable.jid, jid), sql`${botSessionsTable.expiresAt} > NOW()`));

  if (!row) return { step: "idle", data: {} };
  return {
    step: row.step as Step,
    activeUserId: row.activeUserId ?? undefined,
    data: JSON.parse(row.dataJson) as SessionData,
  };
}

async function saveSession(jid: string, session: Session): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db
    .insert(botSessionsTable)
    .values({ jid, step: session.step, activeUserId: session.activeUserId ?? null, dataJson: JSON.stringify(session.data), expiresAt, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: botSessionsTable.jid,
      set: { step: session.step, activeUserId: session.activeUserId ?? null, dataJson: JSON.stringify(session.data), expiresAt, updatedAt: new Date() },
    });
}

async function resetSession(jid: string, keepUserId?: number, keepLastAction?: string): Promise<Session> {
  const session: Session = { step: "idle", activeUserId: keepUserId, data: keepLastAction ? { lastAction: keepLastAction } : {} };
  await saveSession(jid, session);
  return session;
}

// ── LID cache helpers ─────────────────────────────────────────────────────────

async function getLidUserId(jid: string): Promise<number | null> {
  const [row] = await db.select().from(botLidCacheTable).where(eq(botLidCacheTable.jid, jid));
  return row?.userId ?? null;
}

async function setLidUserId(jid: string, userId: number): Promise<void> {
  await db.insert(botLidCacheTable).values({ jid, userId })
    .onConflictDoUpdate({ target: botLidCacheTable.jid, set: { userId } });
}

// ── Pending approval helpers ──────────────────────────────────────────────────

async function getPendingApproval(ref: string): Promise<RelayData | null> {
  const [row] = await db.select().from(botPendingApprovalsTable).where(eq(botPendingApprovalsTable.refNumber, ref));
  if (!row) return null;
  return { parentJid: row.parentJid, supportJid: row.supportJid, childName: row.childName, requestType: row.requestType as RelayData["requestType"], childId: row.childId, parentUserId: row.parentUserId, assignedSupportId: row.assignedSupportId };
}

async function setPendingApproval(ref: string, data: RelayData): Promise<void> {
  await db.insert(botPendingApprovalsTable)
    .values({ refNumber: ref, parentJid: data.parentJid, supportJid: data.supportJid, childName: data.childName, requestType: data.requestType, childId: data.childId, parentUserId: data.parentUserId, assignedSupportId: data.assignedSupportId })
    .onConflictDoUpdate({ target: botPendingApprovalsTable.refNumber, set: { parentJid: data.parentJid, supportJid: data.supportJid } });
}

async function deletePendingApproval(ref: string): Promise<void> {
  await db.delete(botPendingApprovalsTable).where(eq(botPendingApprovalsTable.refNumber, ref));
}

// ── Photo-pending helpers ─────────────────────────────────────────────────────

async function getPhotoPendingRef(supportJid: string): Promise<string | null> {
  const [row] = await db.select().from(botPhotoPendingTable)
    .where(and(eq(botPhotoPendingTable.supportJid, supportJid), sql`${botPhotoPendingTable.expiresAt} > NOW()`));
  return row?.refNumber ?? null;
}

async function setPhotoPending(supportJid: string, ref: string): Promise<void> {
  const expiresAt = new Date(Date.now() + PHOTO_TTL_MS);
  await db.insert(botPhotoPendingTable).values({ supportJid, refNumber: ref, expiresAt })
    .onConflictDoUpdate({ target: botPhotoPendingTable.supportJid, set: { refNumber: ref, expiresAt } });
}

async function deletePhotoPending(supportJid: string): Promise<void> {
  await db.delete(botPhotoPendingTable).where(eq(botPhotoPendingTable.supportJid, supportJid));
}

// ── Phone helpers ─────────────────────────────────────────────────────────────

function phoneVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  const core = digits.startsWith("234") ? digits.slice(3)
    : digits.startsWith("0") ? digits.slice(1)
    : digits;
  return [`0${core}`, `+234${core}`, `234${core}`, core];
}

function phoneToWaJid(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const norm = digits.startsWith("0") ? "234" + digits.slice(1)
    : digits.startsWith("+") ? digits.slice(1) : digits;
  return norm + "@s.whatsapp.net";
}

function isLidJid(jid: string) { return jid.endsWith("@lid"); }
function phoneFromWaJid(jid: string) { return jid.split("@")[0]!.split(":")[0]!; }

// ── DB data helpers ───────────────────────────────────────────────────────────

async function findUsersByPhone(phone: string) {
  return db.select().from(usersTable).where(inArray(usersTable.phone, phoneVariants(phone.trim())));
}

async function findUserById(id: number) {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return u ?? null;
}

async function getActiveSupportUsers() {
  return db.select().from(usersTable).where(and(eq(usersTable.role, "support"), eq(usersTable.isActive, true)));
}

async function getParentChildren(userId: number) {
  const [family] = await db.select().from(familiesTable)
    .where(or(eq(familiesTable.parent1Id, userId), eq(familiesTable.parent2Id, userId)));
  if (!family) return [];
  return db.select({ id: childrenTable.id, firstName: childrenTable.firstName, lastName: childrenTable.lastName, className: classesTable.name, currentClassId: childrenTable.currentClassId })
    .from(childrenTable)
    .leftJoin(classesTable, eq(childrenTable.currentClassId, classesTable.id))
    .where(eq(childrenTable.familyId, family.id));
}

async function getTodayAttendance(childIds: number[]) {
  if (!childIds.length) return [];
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select().from(attendanceTable).where(eq(attendanceTable.serviceDate, today));
  return rows.filter(r => childIds.includes(r.childId));
}

async function getDelegates(childIds: number[]) {
  if (!childIds.length) return [];
  return db.select().from(pickupDelegatesTable).where(inArray(pickupDelegatesTable.childId, childIds));
}

async function getRecentNotifications(userId: number, limit = 5) {
  return db.select().from(notificationsTable).where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt)).limit(limit);
}

async function getTeacherRecord(userId: number) {
  const [t] = await db.select().from(teachersTable).where(eq(teachersTable.userId, userId));
  return t ?? null;
}

async function getTodayAllocationForTeacher(teacherId: number) {
  const today = new Date().toISOString().slice(0, 10);
  const allRows = await db.select().from(teacherAllocationsTable).where(eq(teacherAllocationsTable.teacherId, teacherId));
  const row = allRows.find(r => String(r.serviceDate).slice(0, 10) === today);
  if (!row) return null;
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, row.classId));
  return { ...row, className: cls?.name ?? "Unknown class" };
}

async function getClassChildren(classId: number) {
  return db.select({ id: childrenTable.id, firstName: childrenTable.firstName, lastName: childrenTable.lastName, gender: childrenTable.gender })
    .from(childrenTable).where(eq(childrenTable.currentClassId, classId));
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

function generateRef(prefix = "SC-REQ"): string {
  return `${prefix}-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
}
function todayDate() { return new Date().toISOString().slice(0, 10); }
function todaySlot() { return new Date().getHours() < 9 ? "7am" : "10:30am"; }
function typeLabel(t: string) {
  return t === "checkin" ? "Check-in" : t === "checkout" ? "Check-out" : "Delegate Pickup";
}
function roleLabel(role: UserRole): string {
  const m: Record<UserRole, string> = { parent: "👨‍👩‍👧 Parent", teacher: "👩‍🏫 Teacher", admin: "🛠️ Admin", super_admin: "⭐ Super Admin", attendant: "🔖 Attendant", support: "🤝 Support" };
  return m[role] ?? role;
}

function lastActionShortcut(lastAction: string | undefined): string {
  if (!lastAction) return "";
  const map: Record<string, string> = {
    CHECK_STATUS: "📋 _Last: attendance status (type *1* to check again)_",
    GET_OTP: "🔑 _Last: pickup OTPs (type *2* to view again)_",
    MY_CHILDREN: "👶 _Last: my children (type *3* to view again)_",
    NOTIFICATIONS: "🔔 _Last: notifications (type *4* to view again)_",
    SUBMIT_CONCERN: "💬 _Last: concern/feedback (type *5* to submit another)_",
    SUPPORT_REQUEST: "🆘 _Last: support request (type *6* to request again)_",
  };
  return map[lastAction] ? "\n" + map[lastAction] : "";
}

// ── Message builders ──────────────────────────────────────────────────────────

function parentMenuText(firstName: string, lastAction?: string) {
  return (
    `${greetingLine(firstName)}\n\n` +
    `*1* — 📋 Check attendance status\n` +
    `*2* — 🔑 Get pickup delegate OTP\n` +
    `*3* — 👶 My children & classes\n` +
    `*4* — 🔔 Recent notifications\n` +
    `*5* — 💬 Submit a concern or feedback\n` +
    `*6* — 🆘 Request support (check-in / check-out)\n` +
    lastActionShortcut(lastAction) +
    `\n\nOr just *type what you need* — I'll understand! 💬`
  );
}

function teacherMenuText(firstName: string, lastAction?: string) {
  return (
    `${greetingLine(firstName)}\n\n` +
    `*1* — 🏫 My class roster today\n` +
    `*2* — 📋 Today's attendance summary\n` +
    `*3* — 🔔 Recent notifications\n` +
    lastActionShortcut(lastAction) +
    `\n\nOr just *type what you need* — I'll understand! 💬`
  );
}

function supportMenuText(firstName: string) {
  return (
    `${greetingLine(firstName)}\n\n` +
    `You are logged in as *Support Staff*.\n\n` +
    `To handle a photo request:\n` +
    `1. Wait for a parent request notification\n` +
    `2. When the person arrives, type: *PHOTO SC-REQ-XXXX*\n` +
    `3. Then send the photo immediately\n\n` +
    `Type *HELP* or *0* to see this message again.`
  );
}

function attendanceStatusText(
  children: Awaited<ReturnType<typeof getParentChildren>>,
  attendance: Awaited<ReturnType<typeof getTodayAttendance>>,
) {
  if (!children.length) return `ℹ️ No children registered yet. Add them via the app.`;
  const label: Record<string, string> = { dropped_off: "🟡 Dropped off", in_transit: "🟠 In transit", in_class: "🟢 In class", picked_up: "✅ Picked up" };
  const lines = children.map(c => {
    const att  = attendance.find(a => a.childId === c.id);
    const name = `${c.firstName} ${c.lastName}`;
    const cls  = c.className ? ` (${c.className})` : "";
    if (!att) return `👦 *${name}*${cls}\n   ⚪ Not checked in today`;
    const slot = att.serviceSlot === "7am" ? "7:00 AM" : "10:30 AM";
    return `👦 *${name}*${cls}\n   ${label[att.status] ?? att.status}\n   ⏰ ${slot} service`;
  });
  return `📋 *Today's Attendance*\n\n${lines.join("\n\n")}\n\n_Updates automatically as your child moves through check-in._`;
}

function otpText(
  children: Awaited<ReturnType<typeof getParentChildren>>,
  delegates: Awaited<ReturnType<typeof getDelegates>>,
) {
  if (!children.length) return `ℹ️ No children on your account.`;
  if (!delegates.length) return `ℹ️ No pickup delegates added yet. Add them via the app.\n\n_Go to: My Family → Delegates → Add Delegate_`;
  const now = new Date();
  const lines = children.flatMap(c => {
    const dels = delegates.filter(d => d.childId === c.id);
    if (!dels.length) return [];
    return [
      `👦 *${c.firstName} ${c.lastName}*`,
      ...dels.map(d => {
        const valid = d.otpCode && d.otpExpiresAt && d.otpExpiresAt > now;
        return `   👤 ${d.name}: ${valid ? `*${d.otpCode}*` : "_(expired — regenerate in app)_"}`;
      }),
    ];
  });
  return !lines.length ? `ℹ️ No delegates found.`
    : `🔑 *Pickup Delegate OTPs*\n\n${lines.join("\n")}\n\n_Show OTP to the attendant at pickup. Valid 24 hours._`;
}

function notificationsText(notifs: Awaited<ReturnType<typeof getRecentNotifications>>) {
  if (!notifs.length) return `🔔 No recent notifications.\n\n_Open the app to adjust notification settings._`;
  const lines = notifs.map(n => {
    const dot  = n.readStatus ? "" : "🔵 ";
    const date = new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${dot}*${n.title}*\n_${date}_ — ${n.message}`;
  });
  return `🔔 *Recent Notifications*\n\n${lines.join("\n\n")}\n\n_Open the app to see all._`;
}

// ── Intent → action map ───────────────────────────────────────────────────────

async function executeParentIntent(
  intent: Intent,
  aiAnswer: string | undefined,
  userId: number,
  firstName: string,
  fromJid: string,
  session: Session,
  reply: (msg: string) => Promise<void>,
): Promise<boolean> {
  switch (intent) {
    case "CHECK_STATUS": {
      const ch = await getParentChildren(userId);
      const at = await getTodayAttendance(ch.map(c => c.id));
      await reply(attendanceStatusText(ch, at));
      return true;
    }
    case "GET_OTP": {
      const ch = await getParentChildren(userId);
      const dl = await getDelegates(ch.map(c => c.id));
      await reply(otpText(ch, dl));
      return true;
    }
    case "MY_CHILDREN": {
      const ch = await getParentChildren(userId);
      if (!ch.length) { await reply(`ℹ️ No children registered. Add them via the app.`); return true; }
      const lines = ch.map((c, i) => `${i + 1}. *${c.firstName} ${c.lastName}*\n   📚 ${c.className ?? "No class assigned"}`);
      await reply(`👶 *My Children*\n\n${lines.join("\n\n")}`);
      return true;
    }
    case "NOTIFICATIONS": {
      const n = await getRecentNotifications(userId);
      await reply(notificationsText(n));
      return true;
    }
    case "SUBMIT_CONCERN": {
      session.step = "concern_select_type";
      await saveSession(fromJid, session);
      await reply(
        `💬 *Submit a Concern or Feedback*\n\n` +
        `*1* — 🛡️ Safeguarding Concern\n*2* — ⚠️ Complaint\n*3* — 👍 Compliment\n*4* — 💬 General Feedback\n\n_Type *0* to cancel._`
      );
      return true;
    }
    case "SUPPORT_REQUEST": {
      session.step = "request_select_type";
      await saveSession(fromJid, session);
      await reply(
        `🆘 *Request Support*\n\n` +
        `*1* — 🟢 Check-in (bring child in)\n*2* — 🔴 Check-out (pick up child)\n*3* — 👤 Delegate Pickup\n\n_Type *0* to cancel._`
      );
      return true;
    }
    case "MENU": {
      await resetSession(fromJid, userId, session.data.lastAction);
      await reply(parentMenuText(firstName, session.data.lastAction));
      return true;
    }
    case "GENERAL_QUESTION": {
      if (aiAnswer) {
        await reply(`${aiAnswer}\n\n_Type *0* for the main menu._`);
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

async function executeTeacherIntent(
  intent: Intent,
  aiAnswer: string | undefined,
  userId: number,
  firstName: string,
  fromJid: string,
  session: Session,
  reply: (msg: string) => Promise<void>,
): Promise<boolean> {
  switch (intent) {
    case "CHECK_STATUS":
    case "MY_CHILDREN": {
      await _handleTeacherRoster(userId, reply);
      return true;
    }
    case "NOTIFICATIONS": {
      const n = await getRecentNotifications(userId);
      await reply(notificationsText(n));
      return true;
    }
    case "MENU": {
      await resetSession(fromJid, userId, session.data.lastAction);
      await reply(teacherMenuText(firstName, session.data.lastAction));
      return true;
    }
    case "GENERAL_QUESTION": {
      if (aiAnswer) {
        await reply(`${aiAnswer}\n\n_Type *0* for the main menu._`);
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleInboundMessage(
  fromJid: string,
  text: string,
  imageBuffer: Buffer | null,
  reply: (msg: string) => Promise<void>,
  replyWithImage: (buf: Buffer, caption: string) => Promise<void>,
): Promise<void> {
  const input = text.trim().toLowerCase();

  // ── Image from support — relay to parent ─────────────────────────────────
  if (imageBuffer) {
    const ref = await getPhotoPendingRef(fromJid);
    if (ref) {
      await deletePhotoPending(fromJid);
      await _handleSupportPhoto(fromJid, ref, imageBuffer, reply);
    }
    return;
  }

  // ── Global APPROVE / REJECT ──────────────────────────────────────────────
  const approveMatch = input.match(/^approve\s+(sc-req-\d{4}-\d+)/i);
  const rejectMatch  = input.match(/^reject\s+(sc-req-\d{4}-\d+)/i);
  if (approveMatch) { await _handleApproval(fromJid, approveMatch[1]!.toUpperCase(), true,  reply); return; }
  if (rejectMatch)  { await _handleApproval(fromJid, rejectMatch[1]!.toUpperCase(),  false, reply); return; }

  // Also handle natural "yes" / "no" if parent has a pending approval in session
  const session0 = await getSession(fromJid);
  if (session0.data.pendingApprovalRef) {
    if (/^(yes|approve|ok|okay|confirm|proceed|yes please)$/i.test(input)) {
      await _handleApproval(fromJid, session0.data.pendingApprovalRef, true, reply); return;
    }
    if (/^(no|reject|cancel|stop|dont|don't)$/i.test(input)) {
      await _handleApproval(fromJid, session0.data.pendingApprovalRef, false, reply); return;
    }
  }

  // ── PHOTO <REF> from support ─────────────────────────────────────────────
  const photoMatch = input.match(/^photo\s+(sc-req-\d{4}-\d+)/i);
  if (photoMatch) { await _handlePhotoIntent(fromJid, photoMatch[1]!.toUpperCase(), reply); return; }

  // ── Resolve userId from JID ──────────────────────────────────────────────
  let resolvedUserId: number | null = null;

  if (isLidJid(fromJid)) {
    const cached = await getLidUserId(fromJid);
    if (cached) {
      resolvedUserId = cached;
    } else {
      const session = await getSession(fromJid);
      if (session.step === "lid_verify_phone") {
        const matches = await findUsersByPhone(text.trim());
        if (!matches.length) {
          await reply(`❌ I couldn't find that number.\n\nPlease check and try again.\n\n_Type your registered phone (e.g. 08012345678):_`);
          return;
        }
        await setLidUserId(fromJid, matches[0]!.id);
        resolvedUserId = matches[0]!.id;
        if (matches.length > 1) {
          const s: Session = { step: "role_select", data: { candidates: matches.map(u => u.id).join(",") } };
          await saveSession(fromJid, s);
          const opts = matches.map((u, i) => `*${i + 1}* — ${roleLabel(u.role as UserRole)} (${u.firstName} ${u.lastName})`).join("\n");
          await reply(`I found multiple accounts. Which one are you using today?\n\n${opts}`);
          return;
        }
        await resetSession(fromJid, matches[0]!.id);
        const user = await findUserById(matches[0]!.id);
        if (user) await reply(parentMenuText(user.firstName));
        return;
      } else {
        const s: Session = { step: "lid_verify_phone", data: {} };
        await saveSession(fromJid, s);
        await reply(`👋 Welcome to *Shepherd Connect*!\n\nPlease type your registered phone number to verify your account.\n\n_Example: 08012345678_`);
        return;
      }
    }
  } else {
    const phone   = phoneFromWaJid(fromJid);
    const matches = await findUsersByPhone(phone);
    if (matches.length) resolvedUserId = matches[0]!.id;

    if (matches.length > 1) {
      const session = await getSession(fromJid);
      if (session.step !== "role_select" && !session.activeUserId) {
        const s: Session = { step: "role_select", data: { candidates: matches.map(u => u.id).join(",") } };
        await saveSession(fromJid, s);
        const opts = matches.map((u, i) => `*${i + 1}* — ${roleLabel(u.role as UserRole)} (${u.firstName} ${u.lastName})`).join("\n");
        await reply(`I found multiple accounts. Which one would you like to use?\n\n${opts}`);
        return;
      }
    }
  }

  if (!resolvedUserId) {
    await reply(
      `👋 Hello! I'm the *Shepherd Connect* assistant.\n\n` +
      `I don't recognise this number. Only registered users can access this service.\n\n` +
      `Register at: 🌐 https://shepherdconnect.name.ng\n\n` +
      `Contact the church admin if you believe this is an error.`,
    );
    return;
  }

  // ── Load session ─────────────────────────────────────────────────────────
  let session = await getSession(fromJid);
  if (session.activeUserId) resolvedUserId = session.activeUserId;

  // ── Role selection ────────────────────────────────────────────────────────
  if (session.step === "role_select") {
    const candidates = (session.data.candidates ?? "").split(",").map(Number).filter(Boolean);
    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= candidates.length) {
      await reply(`Please reply with a number between 1 and ${candidates.length}.`); return;
    }
    resolvedUserId = candidates[idx]!;
    session = await resetSession(fromJid, resolvedUserId);
  }

  const user = await findUserById(resolvedUserId);
  if (!user) { await reply(`⚠️ Something went wrong. Please try again.`); return; }
  const role = user.role as UserRole;

  // ── Multi-step: concern ───────────────────────────────────────────────────
  if (session.step === "concern_select_type") {
    const typeMap: Record<string, string> = { "1": "safeguarding_concern", "2": "complaint", "3": "compliment", "4": "general_feedback" };
    const ct = typeMap[input];
    if (!ct) { await reply(`Please reply with *1*, *2*, *3*, or *4*.\n\nType *0* to cancel.`); return; }
    session.step = "concern_enter_desc";
    session.data.concernType = ct;
    await saveSession(fromJid, session);
    const labels: Record<string, string> = { safeguarding_concern: "Safeguarding Concern", complaint: "Complaint", compliment: "Compliment", general_feedback: "General Feedback" };
    await reply(`✏️ You selected: *${labels[ct]}*\n\nType your message now.\n\n_Type *0* to cancel._`); return;
  }

  if (session.step === "concern_enter_desc") {
    if (text.trim().length < 10) { await reply(`Please provide more detail (at least 10 characters).\n\nType *0* to cancel.`); return; }
    let ref = generateRef("SC");
    const [clash] = await db.select().from(parentConcernsTable).where(eq(parentConcernsTable.referenceNumber, ref));
    if (clash) ref = generateRef("SC");
    await db.insert(parentConcernsTable).values({ referenceNumber: ref, parentUserId: user.id, type: session.data.concernType as any, description: text.trim(), status: "open" });
    await resetSession(fromJid, resolvedUserId, "SUBMIT_CONCERN");
    logger.info({ userId: user.id, ref }, "Bot: concern submitted");
    await reply(`✅ *Concern submitted!*\n\nReference: *${ref}*\n\nThe safeguarding team will respond via the app.\n\nType *0* for the main menu.`); return;
  }

  // ── Multi-step: support request ───────────────────────────────────────────
  if (session.step === "request_select_type") {
    const reqTypeMap: Record<string, "checkin" | "checkout" | "delegate_pickup"> = { "1": "checkin", "2": "checkout", "3": "delegate_pickup" };
    const reqType = reqTypeMap[input];
    if (!reqType) { await reply(`Please reply with *1*, *2*, or *3*.\n\nType *0* to cancel.`); return; }
    const children = await getParentChildren(user.id);
    if (!children.length) { await resetSession(fromJid, resolvedUserId); await reply(`ℹ️ No children registered. Add them via the app first.`); return; }
    if (children.length === 1) {
      await _createSupportRequest(fromJid, user, children[0]!, reqType, reply);
      await resetSession(fromJid, resolvedUserId, "SUPPORT_REQUEST"); return;
    }
    session.step = "request_select_child";
    session.data.requestType = reqType;
    session.data.childList = children.map(c => c.id).join(",");
    await saveSession(fromJid, session);
    const opts = children.map((c, i) => `*${i + 1}* — ${c.firstName} ${c.lastName}${c.className ? ` (${c.className})` : ""}`).join("\n");
    await reply(`Which child is this request for?\n\n${opts}\n\nOr type *0* to cancel.`); return;
  }

  if (session.step === "request_select_child") {
    const childIds = (session.data.childList ?? "").split(",").map(Number).filter(Boolean);
    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= childIds.length) { await reply(`Please reply with a number between 1 and ${childIds.length}.\n\nType *0* to cancel.`); return; }
    const [childRow] = await db
      .select({ id: childrenTable.id, firstName: childrenTable.firstName, lastName: childrenTable.lastName, currentClassId: childrenTable.currentClassId, className: classesTable.name })
      .from(childrenTable)
      .leftJoin(classesTable, eq(childrenTable.currentClassId, classesTable.id))
      .where(eq(childrenTable.id, childIds[idx]!));
    if (!childRow) { await reply(`Something went wrong. Please try again.`); return; }
    await _createSupportRequest(fromJid, user, childRow, session.data.requestType as any, reply);
    await resetSession(fromJid, resolvedUserId, "SUPPORT_REQUEST"); return;
  }

  // ── Global escapes ────────────────────────────────────────────────────────
  if (["0", "menu", "help", "hi", "hello", "start"].includes(input)) {
    await resetSession(fromJid, resolvedUserId, session.data.lastAction);
    if (role === "teacher") { await reply(teacherMenuText(user.firstName, session.data.lastAction)); return; }
    if (role === "support" || role === "attendant") { await reply(supportMenuText(user.firstName)); return; }
    await reply(parentMenuText(user.firstName, session.data.lastAction)); return;
  }

  if (input === "switch") {
    const phone   = isLidJid(fromJid) ? null : phoneFromWaJid(fromJid);
    const matches = phone ? await findUsersByPhone(phone) : [user];
    if (matches.length <= 1) { await reply(`ℹ️ You only have one account on this number.`); return; }
    const s: Session = { step: "role_select", data: { candidates: matches.map(u => u.id).join(",") } };
    await saveSession(fromJid, s);
    const opts = matches.map((u, i) => `*${i + 1}* — ${roleLabel(u.role as UserRole)} (${u.firstName} ${u.lastName})`).join("\n");
    await reply(`Which account would you like to use?\n\n${opts}`); return;
  }

  // ── Numbered shortcuts ────────────────────────────────────────────────────
  const numberHandled = await _handleNumberedCommand(
    input, role, user.id, user.firstName, fromJid, session, reply,
  );
  if (numberHandled !== null) {
    if (numberHandled) {
      // Save last action by number
      const intentByNumber: Record<string, Intent> = { "1": role === "teacher" ? "MY_CHILDREN" : "CHECK_STATUS", "2": role === "teacher" ? "CHECK_STATUS" : "GET_OTP", "3": "NOTIFICATIONS", "4": "NOTIFICATIONS", "5": "SUBMIT_CONCERN", "6": "SUPPORT_REQUEST" };
      const la = intentByNumber[input];
      if (la) { session.data.lastAction = la; await saveSession(fromJid, session); }
    }
    return;
  }

  // ── Natural language fallback: fuzzy → AI ────────────────────────────────
  if (role === "support" || role === "attendant" || role === "admin" || role === "super_admin") {
    await reply(supportMenuText(user.firstName));
    return;
  }

  // 1. Fuzzy keyword match (free, instant)
  const fuzzyIntent = fuzzyClassify(text);

  if (fuzzyIntent && fuzzyIntent !== "UNKNOWN") {
    const children = await getParentChildren(user.id);
    const childNames = children.map(c => `${c.firstName} ${c.lastName}`);
    const handler = role === "teacher"
      ? executeTeacherIntent(fuzzyIntent, undefined, user.id, user.firstName, fromJid, session, reply)
      : executeParentIntent(fuzzyIntent, undefined, user.id, user.firstName, fromJid, session, reply);
    const handled = await handler;
    if (handled) {
      if (fuzzyIntent !== "MENU") { session.data.lastAction = fuzzyIntent; await saveSession(fromJid, session); }
      return;
    }
  }

  // 2. AI intent classification (handles everything else: typos, questions, complex phrasing)
  try {
    const children = await getParentChildren(user.id);
    const childNames = children.map(c => `${c.firstName} ${c.lastName}`);
    const classified = await classifyIntent(text, role as any, childNames);

    if (classified.confidence >= 0.5 && classified.intent !== "UNKNOWN") {
      const handler = role === "teacher"
        ? executeTeacherIntent(classified.intent, classified.answer, user.id, user.firstName, fromJid, session, reply)
        : executeParentIntent(classified.intent, classified.answer, user.id, user.firstName, fromJid, session, reply);
      const handled = await handler;
      if (handled) {
        if (classified.intent !== "MENU" && classified.intent !== "GENERAL_QUESTION") {
          session.data.lastAction = classified.intent;
          await saveSession(fromJid, session);
        }
        return;
      }
    }

    // AI gave a direct answer for low-confidence or GENERAL_QUESTION
    if (classified.answer) {
      await reply(`${classified.answer}\n\n_Type *0* for the main menu._`);
      return;
    }
  } catch (err) {
    logger.warn({ err: String(err) }, "Bot: AI classification failed, showing menu");
  }

  // 3. Final fallback — show personalised menu
  if (role === "teacher") {
    await reply(teacherMenuText(user.firstName, session.data.lastAction));
  } else {
    await reply(parentMenuText(user.firstName, session.data.lastAction));
  }
}

// ── Numbered command dispatcher ───────────────────────────────────────────────
// Returns: true (handled), false (handled but no action), null (not a number)

async function _handleNumberedCommand(
  input: string, role: UserRole, userId: number, firstName: string,
  fromJid: string, session: Session,
  reply: (msg: string) => Promise<void>,
): Promise<boolean | null> {
  if (role === "teacher") {
    if (input === "1") { await _handleTeacherRoster(userId, reply); return true; }
    if (input === "2") { await _handleTeacherAttendance(userId, reply); return true; }
    if (input === "3") { const n = await getRecentNotifications(userId); await reply(notificationsText(n)); return true; }
    return null;
  }

  // Parent numbers
  if (input === "1") {
    const ch = await getParentChildren(userId);
    const at = await getTodayAttendance(ch.map(c => c.id));
    await reply(attendanceStatusText(ch, at)); return true;
  }
  if (input === "2") {
    const ch = await getParentChildren(userId);
    const dl = await getDelegates(ch.map(c => c.id));
    await reply(otpText(ch, dl)); return true;
  }
  if (input === "3") {
    const ch = await getParentChildren(userId);
    if (!ch.length) { await reply(`ℹ️ No children registered. Add them via the app.`); return true; }
    const lines = ch.map((c, i) => `${i + 1}. *${c.firstName} ${c.lastName}*\n   📚 ${c.className ?? "No class assigned"}`);
    await reply(`👶 *My Children*\n\n${lines.join("\n\n")}`); return true;
  }
  if (input === "4") {
    const n = await getRecentNotifications(userId);
    await reply(notificationsText(n)); return true;
  }
  if (input === "5") {
    session.step = "concern_select_type";
    await saveSession(fromJid, session);
    await reply(`💬 *Submit a Concern or Feedback*\n\n*1* — 🛡️ Safeguarding Concern\n*2* — ⚠️ Complaint\n*3* — 👍 Compliment\n*4* — 💬 General Feedback\n\n_Type *0* to cancel._`);
    return false; // session is now mid-flow
  }
  if (input === "6") {
    session.step = "request_select_type";
    await saveSession(fromJid, session);
    await reply(`🆘 *Request Support*\n\n*1* — 🟢 Check-in (bring child in)\n*2* — 🔴 Check-out (pick up child)\n*3* — 👤 Delegate Pickup\n\n_Type *0* to cancel._`);
    return false;
  }

  return null; // not a recognised number
}

// ── Teacher sub-handlers ──────────────────────────────────────────────────────

async function _handleTeacherRoster(userId: number, reply: (msg: string) => Promise<void>) {
  const teacher = await getTeacherRecord(userId);
  if (!teacher) { await reply(`ℹ️ No teacher profile found. Contact admin.`); return; }
  const alloc = await getTodayAllocationForTeacher(teacher.id);
  if (!alloc) { await reply(`ℹ️ No class allocation for today.`); return; }
  const ch = await getClassChildren(alloc.classId);
  if (!ch.length) { await reply(`ℹ️ No children in *${alloc.className}* yet.`); return; }
  const lines = ch.map((c, i) => `${i + 1}. ${c.gender === "male" ? "👦" : "👧"} ${c.firstName} ${c.lastName}`);
  await reply(`🏫 *${alloc.className}*\n📅 ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}\n\n${lines.join("\n")}\n\n_${ch.length} ${ch.length === 1 ? "child" : "children"} enrolled._`);
}

async function _handleTeacherAttendance(userId: number, reply: (msg: string) => Promise<void>) {
  const teacher = await getTeacherRecord(userId);
  if (!teacher) { await reply(`ℹ️ No teacher profile found. Contact admin.`); return; }
  const alloc = await getTodayAllocationForTeacher(teacher.id);
  if (!alloc) { await reply(`ℹ️ No class allocation for today.`); return; }
  const ch = await getClassChildren(alloc.classId);
  const at = await getTodayAttendance(ch.map(c => c.id));
  await reply(
    `📋 *${alloc.className}* — Attendance\n📅 ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}\n\n` +
    `🟢 In class: *${at.filter(a => a.status === "in_class").length}*\n` +
    `🟠 In transit: *${at.filter(a => a.status === "in_transit").length}*\n` +
    `🟡 Dropped off: *${at.filter(a => a.status === "dropped_off").length}*\n` +
    `✅ Picked up: *${at.filter(a => a.status === "picked_up").length}*\n` +
    `⚪ Not checked in: *${ch.length - at.length}*\n\n` +
    `👥 Total enrolled: *${ch.length}*`
  );
}

// ── Support request creation ──────────────────────────────────────────────────

async function _createSupportRequest(
  parentJid: string,
  parent: NonNullable<Awaited<ReturnType<typeof findUserById>>>,
  child: { id: number; firstName: string; lastName: string; currentClassId: number | null; className?: string | null },
  requestType: "checkin" | "checkout" | "delegate_pickup",
  reply: (msg: string) => Promise<void>,
) {
  const supportUsers = await getActiveSupportUsers();
  if (!supportUsers.length) {
    await reply(`⚠️ No support staff available right now.\n\nPlease visit the check-in desk directly.`); return;
  }

  const assigned   = supportUsers[supportRoundRobinIdx % supportUsers.length]!;
  supportRoundRobinIdx++;

  const ref         = generateRef("SC-REQ");
  const serviceDate = todayDate();
  const serviceSlot = todaySlot();
  const childName   = `${child.firstName} ${child.lastName}`;
  const childClass  = child.className ? ` (${child.className})` : "";
  const slotLabel   = serviceSlot === "7am" ? "7:00 AM" : "10:30 AM";

  await db.insert(supportRequestsTable).values({ referenceNumber: ref, type: requestType, childId: child.id, parentUserId: parent.id, assignedSupportId: assigned.id, status: "pending", serviceDate, serviceSlot });

  await reply(
    `✅ *Support Request Sent!*\n\n📌 Type: *${typeLabel(requestType)}*\n👦 Child: *${childName}*${childClass}\n🔖 Ref: *${ref}*\n\n` +
    `A support officer has been notified and will assist shortly.\n` +
    `You will receive a photo for approval before anything proceeds.\n\n` +
    `_Type *0* for the main menu._`
  );

  const supportJid = assigned.phone ? phoneToWaJid(assigned.phone) : null;
  if (supportJid) {
    await setPendingApproval(ref, { parentJid, supportJid, childName, requestType, childId: child.id, parentUserId: parent.id, assignedSupportId: assigned.id });
    await sendWhatsAppToJid(supportJid,
      `🔔 *New Support Request*\nRef: *${ref}*\n\n📌 Type: *${typeLabel(requestType)}*\n👦 Child: *${childName}*${childClass}\n` +
      `👨‍👩‍👧 Parent: *${parent.firstName} ${parent.lastName}*\n${parent.phone ? `📞 ${parent.phone}\n` : ""}⏰ Service: *${slotLabel}*\n\n` +
      `When the person arrives:\n1️⃣ Take their photo\n2️⃣ Type: *PHOTO ${ref}*\n3️⃣ Send the photo immediately\n\n⚠️ _This request is assigned to you only._`
    );
  }

  logger.info({ ref, parentId: parent.id, supportId: assigned.id, requestType }, "Support request created");
}

// ── Photo intent ──────────────────────────────────────────────────────────────

async function _handlePhotoIntent(fromJid: string, ref: string, reply: (msg: string) => Promise<void>) {
  const [req] = await db.select().from(supportRequestsTable).where(eq(supportRequestsTable.referenceNumber, ref));
  if (!req) { await reply(`❌ Request *${ref}* not found.`); return; }
  if (req.status !== "pending") { await reply(`⚠️ Request *${ref}* is already *${req.status}*.`); return; }

  const existing = await getPendingApproval(ref);
  if (!existing) {
    const [child]  = await db.select().from(childrenTable).where(eq(childrenTable.id, req.childId));
    const [parent] = await db.select().from(usersTable).where(eq(usersTable.id, req.parentUserId));
    if (!child || !parent) { await reply(`⚠️ Could not load request data. Contact admin.`); return; }
    const parentJid = parent.phone ? phoneToWaJid(parent.phone) : "";
    await setPendingApproval(ref, { parentJid, supportJid: fromJid, childName: `${child.firstName} ${child.lastName}`, requestType: req.type, childId: child.id, parentUserId: parent.id, assignedSupportId: req.assignedSupportId! });
  }

  await setPhotoPending(fromJid, ref);
  await reply(`📸 Ready! Now send the photo of the person immediately.`);
}

// ── Photo relay ───────────────────────────────────────────────────────────────

async function _handleSupportPhoto(supportJid: string, ref: string, imageBuffer: Buffer, reply: (msg: string) => Promise<void>) {
  const relay = await getPendingApproval(ref);
  if (!relay) { await reply(`⚠️ Couldn't find request *${ref}*. Type *PHOTO ${ref}* again.`); return; }

  await db.update(supportRequestsTable).set({ status: "photo_sent", updatedAt: new Date() }).where(eq(supportRequestsTable.referenceNumber, ref));
  await reply(`✅ Photo received. Sending to the parent for approval...\nPlease wait for their decision.`);

  if (relay.parentJid) {
    // Store ref in parent's session so they can reply "yes/no"
    const parentSession = await getSession(relay.parentJid);
    parentSession.data.pendingApprovalRef = ref;
    await saveSession(relay.parentJid, parentSession);

    await sendWhatsAppImageToJid(relay.parentJid, imageBuffer,
      `📸 *Photo for Your Approval*\n\n👦 Child: *${relay.childName}*\n📌 Type: *${typeLabel(relay.requestType)}*\n🔖 Ref: *${ref}*\n\n` +
      `Please confirm this is the right person:\n\n✅ Reply *YES* or type *APPROVE ${ref}*\n❌ Reply *NO* or type *REJECT ${ref}*`
    );
    logger.info({ ref, parentJid: relay.parentJid }, "Photo relayed to parent");
  }
}

// ── Approval handler ──────────────────────────────────────────────────────────

async function _handleApproval(parentJid: string, ref: string, approved: boolean, reply: (msg: string) => Promise<void>) {
  const relay = await getPendingApproval(ref);
  const [req]  = await db.select().from(supportRequestsTable).where(eq(supportRequestsTable.referenceNumber, ref));
  if (!req) { await reply(`❌ Request *${ref}* not found.`); return; }
  if (req.status !== "photo_sent" && req.status !== "pending") {
    await reply(`⚠️ Request *${ref}* has already been *${req.status}*.`); return;
  }

  const childName = relay?.childName ?? `Child #${req.childId}`;

  // Clear pending approval ref from parent session
  const parentSession = await getSession(parentJid);
  delete parentSession.data.pendingApprovalRef;
  await saveSession(parentJid, parentSession);

  if (approved) {
    await db.update(supportRequestsTable).set({ status: "approved", updatedAt: new Date() }).where(eq(supportRequestsTable.referenceNumber, ref));
    await _recordAttendance(req);
    await reply(`✅ *Approved!*\n\nYou approved the ${typeLabel(req.type).toLowerCase()} for *${childName}*.\nThe support officer has been notified.\n\nType *0* for the main menu.`);
    if (relay?.supportJid) {
      await sendWhatsAppToJid(relay.supportJid, `✅ *Parent Approved!*\n\n👦 *${childName}* — ${typeLabel(req.type)}\n🔖 Ref: *${ref}*\n\nPlease proceed. Attendance has been recorded automatically.`);
    }
  } else {
    await db.update(supportRequestsTable).set({ status: "rejected", updatedAt: new Date() }).where(eq(supportRequestsTable.referenceNumber, ref));
    await reply(`❌ *Rejected.*\n\nThe support officer has been notified not to proceed for *${childName}*.\n\nType *0* for the main menu.`);
    if (relay?.supportJid) {
      await sendWhatsAppToJid(relay.supportJid, `❌ *Parent Rejected the Photo*\n\n👦 *${childName}* — ${typeLabel(req.type)}\n🔖 Ref: *${ref}*\n\n⚠️ *Do not proceed.*`);
    }
  }

  await deletePendingApproval(ref);
}

// ── Auto-record attendance ────────────────────────────────────────────────────

async function _recordAttendance(req: typeof supportRequestsTable.$inferSelect) {
  try {
    const today = todayDate();
    const [existing] = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.childId, req.childId), eq(attendanceTable.serviceDate, today)));

    if (req.type === "checkin") {
      if (existing) {
        await db.update(attendanceTable).set({ status: "dropped_off", checkInTime: new Date() }).where(eq(attendanceTable.id, existing.id));
      } else {
        const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, req.childId));
        if (child?.currentClassId) {
          await db.insert(attendanceTable).values({ childId: req.childId, classId: child.currentClassId, serviceDate: today, serviceSlot: req.serviceSlot, checkInTime: new Date(), status: "dropped_off", checkedInBy: req.assignedSupportId ?? undefined });
        }
      }
    } else if (req.type === "checkout" || req.type === "delegate_pickup") {
      if (existing) {
        await db.update(attendanceTable).set({ status: "picked_up", checkOutTime: new Date(), checkedOutBy: req.assignedSupportId ?? undefined }).where(eq(attendanceTable.id, existing.id));
      }
    }

    await db.update(supportRequestsTable).set({ status: "completed", updatedAt: new Date() }).where(eq(supportRequestsTable.referenceNumber, req.referenceNumber));
    logger.info({ ref: req.referenceNumber, type: req.type }, "Attendance auto-recorded on approval");
  } catch (err) {
    logger.error({ ref: req.referenceNumber, err: String(err) }, "Failed to auto-record attendance");
  }
}

// ── Export proactive notification helper for use in attendance routes ─────────
export { notifyParentAttendanceChange } from "./botAI";
