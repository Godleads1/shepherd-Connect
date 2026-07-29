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
  substituteRequestsTable,
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
  | "teacher_sub_reason"
  | "awaiting_photo"
  | "awaiting_nudge";

interface SessionData {
  candidates?: string;
  candidateRoles?: string;  // parallel to candidates — role for each slot (for single-user multi-role)
  activeRole?: string;      // overrides user.role when user has secondary roles
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

async function getTodayAllocationsForTeacher(teacherId: number) {
  const today = new Date().toISOString().slice(0, 10);
  const allRows = await db.select().from(teacherAllocationsTable).where(eq(teacherAllocationsTable.teacherId, teacherId));
  const todayRows = allRows.filter(r => String(r.serviceDate).slice(0, 10) === today);
  if (!todayRows.length) return [];
  const classIds = [...new Set(todayRows.map(r => r.classId))];
  const classes = await db.select().from(classesTable).where(inArray(classesTable.id, classIds));
  const classMap = new Map(classes.map(c => [c.id, c.name]));
  return todayRows.map(r => ({ ...r, className: classMap.get(r.classId) ?? "Unknown class" }));
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
    `*4* — 💬 Submit a concern or feedback\n` +
    `*5* — 🔄 Request a substitute\n` +
    `*6* — 📅 My full schedule today\n` +
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
    case "SUBMIT_CONCERN": {
      session.step = "concern_select_type";
      await saveSession(fromJid, session);
      await reply(`💬 *Submit a Concern or Feedback*\n\n*1* — 🛡️ Safeguarding Concern\n*2* — ⚠️ Complaint\n*3* — 👍 Compliment\n*4* — 💬 General Feedback\n\n_Type *0* to cancel._`);
      return true;
    }
    case "SUBSTITUTE_REQUEST": {
      await _startTeacherSubRequest(userId, fromJid, session, reply);
      return true;
    }
    case "MY_SCHEDULE": {
      await _handleTeacherSchedule(userId, reply);
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

// ── Role-option builder ───────────────────────────────────────────────────────
// Expands a list of DB user rows into a flat list of {userId, role, name} options,
// including secondary roles stored as JSON in user.secondaryRoles.

interface RoleOption { userId: number; role: UserRole; name: string; }

function buildRoleOptions(matches: Awaited<ReturnType<typeof findUsersByPhone>>): RoleOption[] {
  const opts: RoleOption[] = [];
  for (const m of matches) {
    const name = `${m.firstName} ${m.lastName}`;
    opts.push({ userId: m.id, role: m.role as UserRole, name });
    if (m.secondaryRoles) {
      try {
        const secRoles: string[] = JSON.parse(m.secondaryRoles);
        for (const sr of secRoles) {
          opts.push({ userId: m.id, role: sr as UserRole, name });
        }
      } catch { /* ignore malformed JSON */ }
    }
  }
  return opts;
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
        if (user) {
          if (user.role === "teacher") await reply(teacherMenuText(user.firstName));
          else if (user.role === "support" || user.role === "attendant") await reply(supportMenuText(user.firstName));
          else await reply(parentMenuText(user.firstName));
        }
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

    const session0 = await getSession(fromJid);
    if (session0.step !== "role_select" && !session0.activeUserId) {
      // Build full role options (separate DB accounts + secondary roles on single rows)
      const roleOpts = buildRoleOptions(matches);
      if (roleOpts.length > 1) {
        const s: Session = {
          step: "role_select",
          data: {
            candidates: roleOpts.map(o => String(o.userId)).join(","),
            candidateRoles: roleOpts.map(o => o.role).join(","),
          },
        };
        await saveSession(fromJid, s);
        const opts = roleOpts.map((o, i) => `*${i + 1}* — ${roleLabel(o.role)} (${o.name})`).join("\n");
        await reply(`I found multiple roles on this number. Which would you like to use?\n\n${opts}`);
        return;
      }
    }
  }

  if (!resolvedUserId) {
    await reply(
      `👋 Hello! I'm the *Shepherd Connect* assistant.\n\n` +
      `I'm sorry, I don't recognise this number. Only registered users can access this service.\n\n` +
      `Please register on the Shepherd Connect app first:\n🌐 https://shepherdconnect.name.ng\n\n` +
      `If you believe this is an error, please contact the church admin.`,
    );
    return;
  }

  // ── Load session ─────────────────────────────────────────────────────────
  let session = await getSession(fromJid);
  if (session.activeUserId) resolvedUserId = session.activeUserId;

  // ── Role selection ────────────────────────────────────────────────────────
  if (session.step === "role_select") {
    const candidates = (session.data.candidates ?? "").split(",").map(Number).filter(Boolean);
    const candidateRoles = (session.data.candidateRoles ?? "").split(",").filter(Boolean);
    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= candidates.length) {
      await reply(`Please reply with a number between 1 and ${candidates.length}.`); return;
    }
    resolvedUserId = candidates[idx]!;
    const chosenRole = candidateRoles[idx] ?? null;
    session = await resetSession(fromJid, resolvedUserId);
    if (chosenRole) {
      session.data.activeRole = chosenRole;
      await saveSession(fromJid, session);
    }
  }

  const user = await findUserById(resolvedUserId);
  if (!user) { await reply(`⚠️ Something went wrong. Please try again.`); return; }
  // Use activeRole from session (set when user switches to a secondary role)
  const role = (session.data.activeRole as UserRole | undefined) ?? (user.role as UserRole);

  // ── Idle-nudge reply — YES/NO (or anything) after "are you there?" ─────────
  if (session.step === "awaiting_nudge") {
    const isNo  = /\b(no|nope|nah|not really|all good|i'?m fine|fine)\b/i.test(input);
    const isExplicitYes = input.length < 30 && /\b(yes|yeah|yep|yup|sure|ok|okay|please)\b/i.test(input);

    if (isNo) {
      await db.delete(botSessionsTable).where(eq(botSessionsTable.jid, fromJid));
      const h = new Date().getHours();
      const sign = h >= 5 && h < 12 ? "Have a lovely day! ☀️"
                 : h >= 12 && h < 17 ? "Have a great afternoon! 🌤️"
                 : "Good night! Rest well. 🌙";
      await reply(
        `${sign}\n\n` +
        `Take care, *${user.firstName}!* 😊\n\n` +
        `_Feel free to message anytime — I'm always here. Type *hi* or *0* whenever you need me._`,
      );
      return;
    }

    // YES or a real message — reset session and either show menu (explicit yes)
    // or fall through so their actual message is processed normally
    session = await resetSession(fromJid, resolvedUserId, session.data.lastAction);
    if (isExplicitYes) {
      const menuHint = role === "teacher"
        ? `*1* — Class roster  |  *2* — Attendance  |  *3* — Notifications  |  *4* — Concern  |  *5* — Substitute  |  *6* — Schedule`
        : `*1* — Status  |  *2* — OTP  |  *3* — Children  |  *4* — Notifications  |  *5* — Concern  |  *6* — Support`;
      await reply(
        `Welcome back, *${user.firstName}!* 🎉\n\n` +
        `What can I do for you? Here's a quick reminder of what I can help with:\n\n${menuHint}\n\n` +
        `Or type *0* for the full menu, or just describe what you need.`,
      );
      return;
    }
    // else: fall through so their actual typed message is handled normally
  }

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

  // ── Multi-step: teacher substitute request ───────────────────────────────
  if (session.step === "teacher_sub_reason") {
    if (text.trim().length < 5) { await reply(`Please type your reason (e.g. "I'm sick today").\n\nType *0* to cancel.`); return; }
    const classIds = (session.data.subClassIds ?? "").split(",").map(Number).filter(Boolean);
    const serviceDate = session.data.subServiceDate ?? new Date().toISOString().slice(0, 10);
    const classNames = session.data.subClassNames ?? "today's class";
    for (const classId of classIds) {
      await db.insert(substituteRequestsTable).values({
        requestingTeacherId: user.id,
        classId,
        serviceDate,
        reason: text.trim(),
        status: "pending",
      }).catch(err => logger.warn({ err }, "Bot: substitute request insert failed"));
    }
    // Notify all admins in-app
    const admins = await db.select({ id: usersTable.id }).from(usersTable)
      .where(or(eq(usersTable.role, "admin"), eq(usersTable.role, "super_admin")));
    for (const admin of admins) {
      await db.insert(notificationsTable).values({
        userId: admin.id,
        type: "substitute_request",
        title: "Substitute Needed",
        body: `${user.firstName} ${user.lastName} can't make it for ${classNames}. Reason: ${text.trim().slice(0, 80)}`,
      }).catch(() => {});
    }
    await resetSession(fromJid, resolvedUserId, "SUBSTITUTE_REQUEST");
    logger.info({ userId: user.id, classIds, serviceDate }, "Bot: substitute request submitted");
    await reply(
      `✅ *Substitute request sent!*\n\n` +
      `Admin has been notified about *${classNames}*.\n\n` +
      `You'll receive confirmation once a substitute is assigned.\n\n` +
      `Type *0* for the main menu.`
    );
    return;
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

  // ── Farewell — end the conversation gracefully ─────────────────────────────
  const FAREWELL_RE = /\b(bye|goodbye|good.?night|good.?eve|see.?you|later|cya|take.?care|night|signing.?off|ttyl)\b/i;
  if (FAREWELL_RE.test(input)) {
    const hour = new Date().getHours(); // server is UTC; close enough for a hint
    const sign = hour >= 5 && hour < 12 ? "Have a lovely day! ☀️"
               : hour >= 12 && hour < 17 ? "Have a great afternoon! 🌤️"
               : "Good night! Rest well. 🌙";
    await reply(
      `${sign}\n\n` +
      `Feel free to message anytime — I'm always here. 😊\n\n` +
      `_Your session is saved. Type *hi* or *0* whenever you're ready._`
    );
    return;
  }

  if (input === "switch") {
    const phone   = isLidJid(fromJid) ? (user.phone ?? null) : phoneFromWaJid(fromJid);
    const matches = phone ? await findUsersByPhone(phone) : [user];
    const roleOpts = buildRoleOptions(matches);
    if (roleOpts.length <= 1) { await reply(`ℹ️ You only have one role on this number.`); return; }
    const s: Session = {
      step: "role_select",
      data: {
        candidates: roleOpts.map(o => String(o.userId)).join(","),
        candidateRoles: roleOpts.map(o => o.role).join(","),
      },
    };
    await saveSession(fromJid, s);
    const opts = roleOpts.map((o, i) => `*${i + 1}* — ${roleLabel(o.role)} (${o.name})`).join("\n");
    await reply(`Which role would you like to use?\n\n${opts}`); return;
  }

  // ── Role name typed (e.g. "Teacher", "Parent") — try to switch accounts ──
  const ROLE_NAMES: Record<string, UserRole> = {
    teacher: "teacher", parent: "parent", admin: "admin",
    attendant: "attendant", support: "support", "super admin": "super_admin",
  };
  const typedRole = ROLE_NAMES[input.toLowerCase()];
  if (typedRole) {
    if (role === typedRole) {
      // Already on that role — just show the right menu
      await resetSession(fromJid, resolvedUserId, session.data.lastAction);
      if (role === "teacher") { await reply(teacherMenuText(user.firstName, session.data.lastAction)); return; }
      if (role === "support" || role === "attendant") { await reply(supportMenuText(user.firstName)); return; }
      await reply(parentMenuText(user.firstName, session.data.lastAction)); return;
    }
    // Check if they have an account with the typed role on this number
    // LID JIDs have no phone in the JID itself — fall back to the user's stored phone
    const phone      = isLidJid(fromJid) ? (user.phone ?? null) : phoneFromWaJid(fromJid);
    const allMatches = phone ? await findUsersByPhone(phone) : [user];
    const roleMatch  = allMatches.filter(u => u.role === typedRole);

    if (roleMatch.length === 1) {
      // Exactly one account with that role — switch directly
      await resetSession(fromJid, roleMatch[0]!.id);
      const u = roleMatch[0]!;
      if (typedRole === "teacher") { await reply(teacherMenuText(u.firstName)); return; }
      if (typedRole === "support" || typedRole === "attendant") { await reply(supportMenuText(u.firstName)); return; }
      await reply(parentMenuText(u.firstName)); return;
    }

    if (roleMatch.length > 1) {
      // Multiple accounts with the same role — let them pick
      const s: Session = { step: "role_select", data: { candidates: roleMatch.map(u => u.id).join(",") } };
      await saveSession(fromJid, s);
      const opts = roleMatch.map((u, i) => `*${i + 1}* — ${u.firstName} ${u.lastName}`).join("\n");
      await reply(`You have ${roleMatch.length} *${roleLabel(typedRole)}* accounts on this number. Which one?\n\n${opts}`);
      return;
    }

    // No account with that role on this number
    // Show all available roles on this number so they can pick the right one
    const availableRoles = allMatches.map(u => `• ${roleLabel(u.role as UserRole)} (${u.firstName} ${u.lastName})`).join("\n");
    await reply(
      `ℹ️ There is no *${roleLabel(typedRole)}* account linked to this number.\n\n` +
      `Your registered ${allMatches.length === 1 ? "account" : "accounts"} on this number:\n${availableRoles}\n\n` +
      `Type *SWITCH* to change account, or *0* for your current menu.`
    ); return;
  }

  // ── Numbered shortcuts ────────────────────────────────────────────────────
  const numberHandled = await _handleNumberedCommand(
    input, role, user.id, user.firstName, fromJid, session, reply,
  );
  if (numberHandled !== null) {
    if (numberHandled) {
      // Save last action by number
      const intentByNumber: Record<string, Intent> = { "1": role === "teacher" ? "MY_CHILDREN" : "CHECK_STATUS", "2": role === "teacher" ? "CHECK_STATUS" : "GET_OTP", "3": "NOTIFICATIONS", "4": role === "teacher" ? "SUBMIT_CONCERN" : "NOTIFICATIONS", "5": role === "teacher" ? "SUBSTITUTE_REQUEST" : "SUBMIT_CONCERN", "6": role === "teacher" ? "MY_SCHEDULE" : "SUPPORT_REQUEST" };
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

  // Teachers get their own NLP path — no parent children needed
  if (role === "teacher") {
    const fuzzyTeacher = fuzzyClassify(text);
    if (fuzzyTeacher && fuzzyTeacher !== "UNKNOWN") {
      const handled = await executeTeacherIntent(fuzzyTeacher, undefined, user.id, user.firstName, fromJid, session, reply);
      if (handled) { session.data.lastAction = fuzzyTeacher; await saveSession(fromJid, session); return; }
    }
    try {
      const classified = await classifyIntent(text, "teacher", []);
      if (classified.confidence >= 0.5 && classified.intent !== "UNKNOWN") {
        const handled = await executeTeacherIntent(classified.intent, classified.answer, user.id, user.firstName, fromJid, session, reply);
        if (handled) { session.data.lastAction = classified.intent; await saveSession(fromJid, session); return; }
      }
      if (classified.answer) { await reply(`${classified.answer}\n\n_Type *0* for the main menu._`); return; }
    } catch (err) {
      logger.warn({ err: String(err) }, "Bot: AI classification failed (teacher)");
    }
    await reply(`🤔 I didn't quite understand that.\n\nTry:\n*1* — Class roster  |  *2* — Attendance  |  *3* — Notifications  |  *4* — Concern  |  *5* — Substitute  |  *6* — Schedule\n\nOr type *0* for the full menu.`);
    return;
  }

  // Fetch children once — reused by both fuzzy and AI paths (parent path)
  const children = await getParentChildren(user.id);
  const childNames = children.map(c => `${c.firstName} ${c.lastName}`);

  // 1. Fuzzy keyword match (free, instant)
  const fuzzyIntent = fuzzyClassify(text);

  if (fuzzyIntent && fuzzyIntent !== "UNKNOWN") {
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
    logger.warn({ err: String(err) }, "Bot: AI classification failed");
  }

  // 3. Final fallback — brief "I didn't understand", not the full menu again
  const menuHint = role === "teacher"
    ? `*1* — Class roster  |  *2* — Attendance  |  *3* — Notifications  |  *4* — Concern  |  *5* — Substitute  |  *6* — Schedule`
    : `*1* — Status  |  *2* — OTP  |  *3* — Children  |  *4* — Notifications  |  *5* — Concern  |  *6* — Support`;

  await reply(
    `🤔 I didn't quite understand that.\n\n` +
    `Try picking a number:\n${menuHint}\n\n` +
    `Or type *0* for the full menu, or just describe what you need in plain words.`
  );
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
    if (input === "4") {
      session.step = "concern_select_type";
      await saveSession(fromJid, session);
      await reply(`💬 *Submit a Concern or Feedback*\n\n*1* — 🛡️ Safeguarding Concern\n*2* — ⚠️ Complaint\n*3* — 👍 Compliment\n*4* — 💬 General Feedback\n\n_Type *0* to cancel._`);
      return false;
    }
    if (input === "5") { await _startTeacherSubRequest(userId, fromJid, session, reply); return false; }
    if (input === "6") { await _handleTeacherSchedule(userId, reply); return true; }
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

// ── Teacher schedule & substitute request helpers ─────────────────────────────

async function _handleTeacherSchedule(userId: number, reply: (msg: string) => Promise<void>) {
  const teacher = await getTeacherRecord(userId);
  if (!teacher) { await reply(`ℹ️ No teacher profile found. Contact admin.`); return; }
  const allocs = await getTodayAllocationsForTeacher(teacher.id);
  if (!allocs.length) { await reply(`ℹ️ No class allocation for today.`); return; }
  const slotLabel = (s: string) => s === "7am" ? "7:00 AM" : s === "10:30am" ? "10:30 AM" : s;
  const lines = allocs.map(a => `• *${a.className}* — ${slotLabel(a.serviceSlot ?? "")}`);
  await reply(
    `📅 *My Schedule Today*\n` +
    `${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}\n\n` +
    `${lines.join("\n")}\n\n` +
    `_Type *1* for class roster · *2* for attendance · *5* to request a substitute._`
  );
}

async function _startTeacherSubRequest(
  userId: number,
  fromJid: string,
  session: Session,
  reply: (msg: string) => Promise<void>,
) {
  const teacher = await getTeacherRecord(userId);
  if (!teacher) { await reply(`ℹ️ No teacher profile found. Contact admin.`); return; }
  const allocs = await getTodayAllocationsForTeacher(teacher.id);
  if (!allocs.length) {
    await reply(`ℹ️ You have no class allocation for today — no substitute needed.`); return;
  }
  const slotLabel = (s: string) => s === "7am" ? "7:00 AM" : s === "10:30am" ? "10:30 AM" : s;
  const summary = allocs.length === 1
    ? `You are scheduled for *${allocs[0]!.className}* at *${slotLabel(allocs[0]!.serviceSlot ?? "")}*.`
    : `You have ${allocs.length} classes today:\n${allocs.map(a => `• ${a.className} (${slotLabel(a.serviceSlot ?? "")})`).join("\n")}`;
  const classNames = allocs.map(a => a.className).join(", ");
  session.step = "teacher_sub_reason";
  session.data.subClassIds = allocs.map(a => a.classId).join(",");
  session.data.subClassNames = classNames;
  session.data.subServiceDate = new Date().toISOString().slice(0, 10);
  await saveSession(fromJid, session);
  await reply(
    `🔄 *Request a Substitute*\n\n${summary}\n\n` +
    `Please type your reason (e.g. "I'm sick", "family emergency"):\n\n` +
    `_Type *0* to cancel._`
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

  const isDelegate = requestType === "delegate_pickup";

  // Parent confirmation — delegate pickup requires photo approval; check-in/out does not
  await reply(
    `✅ *Support Request Sent!*\n\n📌 Type: *${typeLabel(requestType)}*\n👦 Child: *${childName}*${childClass}\n🔖 Ref: *${ref}*\n\n` +
    (isDelegate
      ? `A support officer will photograph the delegate and send you the image to confirm their identity before releasing *${child.firstName}*.\n\n_Reply *YES* to approve or *NO* to reject when you receive the photo._`
      : `A support officer has been notified and will assist you directly at the desk.`) +
    `\n\n_Type *0* for the main menu._`
  );

  const supportJid = assigned.phone ? phoneToWaJid(assigned.phone) : null;
  if (supportJid) {
    // Only store relay data for delegate pickup (photo approval flow)
    if (isDelegate) {
      await setPendingApproval(ref, { parentJid, supportJid, childName, requestType, childId: child.id, parentUserId: parent.id, assignedSupportId: assigned.id });
    }

    const supportMsg = isDelegate
      ? `🔔 *Delegate Pickup Request*\nRef: *${ref}*\n\n👦 Child: *${childName}*${childClass}\n` +
        `👨‍👩‍👧 Parent: *${parent.firstName} ${parent.lastName}*\n${parent.phone ? `📞 ${parent.phone}\n` : ""}⏰ Service: *${slotLabel}*\n\n` +
        `📸 *Photo verification required:*\n1️⃣ Ask the delegate to show ID\n2️⃣ Type: *PHOTO ${ref}*\n3️⃣ Send their photo immediately\n\n` +
        `⚠️ _Do NOT release the child until the parent approves the photo._`
      : `🔔 *${typeLabel(requestType)} Request*\nRef: *${ref}*\n\n👦 Child: *${childName}*${childClass}\n` +
        `👨‍👩‍👧 Parent: *${parent.firstName} ${parent.lastName}*\n${parent.phone ? `📞 ${parent.phone}\n` : ""}⏰ Service: *${slotLabel}*\n\n` +
        `Please assist this parent directly at the check-in desk.\n🔖 Ref: *${ref}*`;

    await sendWhatsAppToJid(supportJid, supportMsg);
  }

  logger.info({ ref, parentId: parent.id, supportId: assigned.id, requestType }, "Support request created");
}

// ── Photo intent ──────────────────────────────────────────────────────────────

async function _handlePhotoIntent(fromJid: string, ref: string, reply: (msg: string) => Promise<void>) {
  const [req] = await db.select().from(supportRequestsTable).where(eq(supportRequestsTable.referenceNumber, ref));
  if (!req) { await reply(`❌ Request *${ref}* not found.`); return; }
  if (req.status !== "pending") { await reply(`⚠️ Request *${ref}* is already *${req.status}*.`); return; }

  // Photo verification is only for delegate pickup — not for check-in or check-out
  if (req.type !== "delegate_pickup") {
    await reply(
      `⚠️ Photo verification is only required for *Delegate Pickup* requests.\n\n` +
      `For *${typeLabel(req.type)}* (ref: ${ref}), please assist the parent directly at the desk.\n\n` +
      `Once done, the system will be updated by the attendant via the app.`
    );
    return;
  }

  const existing = await getPendingApproval(ref);
  if (!existing) {
    const [child]  = await db.select().from(childrenTable).where(eq(childrenTable.id, req.childId));
    const [parent] = await db.select().from(usersTable).where(eq(usersTable.id, req.parentUserId));
    if (!child || !parent) { await reply(`⚠️ Could not load request data. Contact admin.`); return; }
    const parentJid = parent.phone ? phoneToWaJid(parent.phone) : "";
    await setPendingApproval(ref, { parentJid, supportJid: fromJid, childName: `${child.firstName} ${child.lastName}`, requestType: req.type, childId: child.id, parentUserId: parent.id, assignedSupportId: req.assignedSupportId! });
  }

  await setPhotoPending(fromJid, ref);
  await reply(`📸 Ready! Now send the photo of the *delegate* immediately.`);
}

// ── Photo relay ───────────────────────────────────────────────────────────────

async function _handleSupportPhoto(supportJid: string, ref: string, imageBuffer: Buffer, reply: (msg: string) => Promise<void>) {
  const relay = await getPendingApproval(ref);
  if (!relay) { await reply(`⚠️ Couldn't find request *${ref}*. Type *PHOTO ${ref}* again.`); return; }

  // Delegate pickup: relay photo to parent and wait for YES/NO approval
  if (relay.requestType === "delegate_pickup") {
    await db.update(supportRequestsTable).set({ status: "photo_sent", updatedAt: new Date() }).where(eq(supportRequestsTable.referenceNumber, ref));
    await reply(`✅ Photo received. Sending to the parent for identity approval...\nPlease wait — *do NOT release the child yet.*`);

    if (relay.parentJid) {
      const parentSession = await getSession(relay.parentJid);
      parentSession.data.pendingApprovalRef = ref;
      await saveSession(relay.parentJid, parentSession);

      await sendWhatsAppImageToJid(relay.parentJid, imageBuffer,
        `📸 *Delegate Identity Verification*\n\n👦 Child: *${relay.childName}*\n🔖 Ref: *${ref}*\n\n` +
        `Please confirm this is the person you authorised to collect your child:\n\n` +
        `✅ Reply *YES* to approve — delegate may collect\n❌ Reply *NO* to reject — delegate will be turned away`
      );
      logger.info({ ref, parentJid: relay.parentJid }, "Delegate photo relayed to parent for approval");
    }
    return;
  }

  // Check-in / checkout: no parent approval needed — just log the photo and confirm to support
  // (The parent is present or the child is known to staff — no identity risk)
  await reply(
    `✅ Photo logged for *${typeLabel(relay.requestType)}* — *${relay.childName}*.\n\n` +
    `No parent approval needed for this request type.\n` +
    `Please proceed and update attendance in the app.\n🔖 Ref: *${ref}*`
  );
  logger.info({ ref, requestType: relay.requestType }, "Photo logged for non-delegate request — no parent approval required");
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
