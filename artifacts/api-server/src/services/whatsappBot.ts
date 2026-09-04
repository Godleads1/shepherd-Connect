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
  botStepUpProofsTable,
  botInboundEventsTable,
  custodyEpisodesTable,
  pickupRequestsTable,
  emergencyUpdatesTable,
  emergenciesTable,
} from "@workspace/db/schema";
import { eq, or, desc, and, inArray, lt, sql } from "drizzle-orm";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { logger } from "../lib/logger";
import { CustodyHandoverError, releasePhysicalCustody, requestCustodyEpisode } from "./custodyHandover";
import { createNotificationDelivery } from "./notificationOutbox";
import { ObjectStorageService } from "../lib/objectStorage";
import { createParentPickupRequest, ParentPickupRequestError } from "../routes/pickupRequests";
import { scopeFamilyEmergencyUpdates } from "../lib/familyEmergencyUpdates";
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
  | "custody_select_child"
  | "custody_select_service"
  | "notification_pref_select"
  | "pickup_select_child"
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
  parentContactVersion: number;
}

// ── Round-robin counter (per-process; resets on restart — acceptable) ─────────
let supportRoundRobinIdx = 0;

// ── Session TTL ───────────────────────────────────────────────────────────────
const SESSION_TTL_MS = 15 * 60 * 1000;
const PHOTO_TTL_MS   = 10 * 60 * 1000;
const STEP_UP_TTL_MS = 5 * 60 * 1000;
const STEP_UP_ACTION = "delegate_release_approval";
const STEP_UP_KEY: string = process.env.SESSION_SECRET ?? (() => {
  throw new Error("SESSION_SECRET environment variable is required for WhatsApp step-up proofs.");
})();

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

async function getLidUserId(jid: string): Promise<{ userId: number; contactVersion: number } | null> {
  const [row] = await db.select().from(botLidCacheTable).where(eq(botLidCacheTable.jid, jid));
  return row ? { userId: row.userId, contactVersion: row.contactVersion } : null;
}

async function setLidUserId(jid: string, userId: number, contactVersion: number): Promise<void> {
  await db.insert(botLidCacheTable).values({ jid, userId, contactVersion })
    .onConflictDoUpdate({ target: botLidCacheTable.jid, set: { userId, contactVersion } });
}

// ── Pending approval helpers ──────────────────────────────────────────────────

async function getPendingApproval(ref: string): Promise<RelayData | null> {
  const [row] = await db.select().from(botPendingApprovalsTable).where(eq(botPendingApprovalsTable.refNumber, ref));
  if (!row) return null;
  return { parentJid: row.parentJid, supportJid: row.supportJid, childName: row.childName, requestType: row.requestType as RelayData["requestType"], childId: row.childId, parentUserId: row.parentUserId, assignedSupportId: row.assignedSupportId, parentContactVersion: row.parentContactVersion };
}

async function setPendingApproval(ref: string, data: RelayData): Promise<void> {
  await db.insert(botPendingApprovalsTable)
    .values({ refNumber: ref, parentJid: data.parentJid, supportJid: data.supportJid, childName: data.childName, requestType: data.requestType, childId: data.childId, parentUserId: data.parentUserId, assignedSupportId: data.assignedSupportId, parentContactVersion: data.parentContactVersion })
    .onConflictDoUpdate({ target: botPendingApprovalsTable.refNumber, set: { parentJid: data.parentJid, supportJid: data.supportJid, parentContactVersion: data.parentContactVersion } });
}

async function deletePendingApproval(ref: string): Promise<void> {
  await db.delete(botPendingApprovalsTable).where(eq(botPendingApprovalsTable.refNumber, ref));
}

function stepUpDigest(id: string, userId: number, contactVersion: number, action: string, reference: string, code: string): string {
  return createHmac("sha256", STEP_UP_KEY)
    .update(`${id}\0${userId}\0${contactVersion}\0${action}\0${reference}\0${code}`)
    .digest("hex");
}

async function createStepUpProof(tx: any, userId: number, contactVersion: number, reference: string): Promise<string> {
  const id = randomBytes(16).toString("hex");
  const code = randomBytes(5).toString("hex").toUpperCase();
  await tx.insert(botStepUpProofsTable).values({
    id, userId, contactVersion, action: STEP_UP_ACTION, reference,
    proofDigest: stepUpDigest(id, userId, contactVersion, STEP_UP_ACTION, reference, code),
    expiresAt: new Date(Date.now() + STEP_UP_TTL_MS),
  });
  return code;
}

async function consumeStepUpProof(tx: any, userId: number, contactVersion: number, reference: string, code: string): Promise<boolean> {
  const [proof] = await tx.select().from(botStepUpProofsTable).where(and(
    eq(botStepUpProofsTable.userId, userId), eq(botStepUpProofsTable.contactVersion, contactVersion),
    eq(botStepUpProofsTable.reference, reference), eq(botStepUpProofsTable.action, STEP_UP_ACTION),
    sql`${botStepUpProofsTable.expiresAt} > NOW()`, sql`${botStepUpProofsTable.consumedAt} IS NULL`,
  )).orderBy(desc(botStepUpProofsTable.createdAt)).limit(1);
  if (!proof) return false;
  const expected = Buffer.from(proof.proofDigest, "hex");
  const actual = Buffer.from(stepUpDigest(proof.id, userId, contactVersion, STEP_UP_ACTION, reference, code), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  const [consumed] = await tx.update(botStepUpProofsTable).set({ consumedAt: new Date() }).where(and(
    eq(botStepUpProofsTable.id, proof.id), sql`${botStepUpProofsTable.consumedAt} IS NULL`,
  )).returning();
  return !!consumed;
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

export function normalizeNigerianE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const national = digits.startsWith("0") ? digits.slice(1) : digits.startsWith("234") ? digits.slice(3) : "";
  return /^8\d{9}$|^7\d{9}$|^9\d{9}$/.test(national) ? `+234${national}` : null;
}

function phoneToWaJid(phone: string): string {
  const canonical = normalizeNigerianE164(phone);
  if (!canonical) throw new Error("Cannot create WhatsApp JID for an invalid Nigerian phone");
  return `${canonical.slice(1)}@s.whatsapp.net`;
}

function isLidJid(jid: string) { return jid.endsWith("@lid"); }
function phoneFromWaJid(jid: string) { return jid.split("@")[0]!.split(":")[0]!; }

const objectStorage = new ObjectStorageService();

// ── DB data helpers ───────────────────────────────────────────────────────────

async function findUsersByPhone(phone: string) {
  const canonical = normalizeNigerianE164(phone);
  if (!canonical) return [];
  return db.select().from(usersTable).where(and(
    // Variants retain access during the one-time legacy data migration. New
    // writes always use canonical E.164.
    inArray(usersTable.phone, [...phoneVariants(phone.trim()), canonical]),
    eq(usersTable.isActive, true),
    eq(usersTable.status, "active"),
    eq(usersTable.whatsappVerified, true),
  ));
}

async function findUserById(id: number) {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return u ?? null;
}

function isActiveUser(user: Awaited<ReturnType<typeof findUserById>>): user is NonNullable<Awaited<ReturnType<typeof findUserById>>> {
  return !!user && user.isActive && user.status === "active";
}

function userHasRole(user: NonNullable<Awaited<ReturnType<typeof findUserById>>>, role: UserRole): boolean {
  if (user.role === role) return true;
  try {
    const secondaryRoles = user.secondaryRoles ? JSON.parse(user.secondaryRoles) : [];
    return Array.isArray(secondaryRoles) && secondaryRoles.includes(role);
  } catch {
    return false;
  }
}

async function senderMatchesActiveUser(jid: string, expectedUserId: number): Promise<boolean> {
  const expected = await findUserById(expectedUserId);
  if (!isActiveUser(expected) || expected.whatsappVerified === false) return false;
  if (isLidJid(jid)) {
    const cached = await getLidUserId(jid);
    return cached?.userId === expectedUserId && cached.contactVersion === expected.contactVersion;
  }
  const matches = await findUsersByPhone(phoneFromWaJid(jid));
  return matches.some(user => user.id === expectedUserId);
}

async function getActiveSupportUsers() {
  return db.select().from(usersTable).where(and(
    eq(usersTable.role, "support"),
    eq(usersTable.isActive, true),
    eq(usersTable.status, "active"),
  ));
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

type CommunicationPrefs = { inApp: boolean; whatsapp: boolean; sms: boolean; email: boolean };
const DEFAULT_COMMUNICATION_PREFS: CommunicationPrefs = { inApp: true, whatsapp: false, sms: false, email: false };

function parseCommunicationPrefs(raw: string | null | undefined): CommunicationPrefs {
  try {
    const value = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    return {
      inApp: typeof value.inApp === "boolean" ? value.inApp : true,
      whatsapp: typeof value.whatsapp === "boolean" ? value.whatsapp : false,
      sms: typeof value.sms === "boolean" ? value.sms : false,
      email: typeof value.email === "boolean" ? value.email : false,
    };
  } catch {
    return { ...DEFAULT_COMMUNICATION_PREFS };
  }
}

function notificationPreferencesText(prefs: CommunicationPrefs, prompt = false): string {
  const state = (enabled: boolean) => enabled ? "✅ On" : "⬜ Off";
  return (
    `🔔 *Notification Preferences*\n\n` +
    `*1* — In-app: ${state(prefs.inApp)}\n` +
    `*2* — WhatsApp: ${state(prefs.whatsapp)}\n` +
    `*3* — SMS: ${state(prefs.sms)}\n` +
    `*4* — Email: ${state(prefs.email)}` +
    (prompt ? `\n\nReply with *1–4* to toggle a channel.\n_Type *0* to finish._` : "")
  );
}

async function getParentCustodyEpisodes(userId: number) {
  const children = await getParentChildren(userId);
  if (!children.length) return { children, episodes: [] };
  const episodes = await db.select().from(custodyEpisodesTable)
    .where(inArray(custodyEpisodesTable.childId, children.map(child => child.id)))
    .orderBy(desc(custodyEpisodesTable.createdAt));
  return { children, episodes };
}

async function getParentPickupRequests(userId: number) {
  const children = await getParentChildren(userId);
  if (!children.length) return { children, requests: [] };
  const requests = await db.select().from(pickupRequestsTable)
    .where(inArray(pickupRequestsTable.childId, children.map(child => child.id)))
    .orderBy(desc(pickupRequestsTable.requestedAt));
  return { children, requests };
}

async function getFamilyEmergencyUpdates(userId: number) {
  const children = await getParentChildren(userId);
  const childIds = children.map(child => child.id);
  if (!childIds.length) return [];
  const rows = await db.select({
    id: emergencyUpdatesTable.id, emergencyId: emergencyUpdatesTable.emergencyId,
    childId: childrenTable.id, childFirstName: childrenTable.firstName,
    familyStatus: emergencyUpdatesTable.familyStatus, familyInstructions: emergencyUpdatesTable.familyInstructions,
    publishedAt: emergencyUpdatesTable.publishedAt,
  }).from(emergencyUpdatesTable)
    .innerJoin(emergenciesTable, eq(emergenciesTable.id, emergencyUpdatesTable.emergencyId))
    .innerJoin(childrenTable, eq(childrenTable.id, emergenciesTable.childId))
    .where(and(inArray(childrenTable.id, childIds), sql`${emergencyUpdatesTable.publishedAt} IS NOT NULL`,
      sql`${emergencyUpdatesTable.familyStatus} IS NOT NULL`, sql`${emergencyUpdatesTable.familyInstructions} IS NOT NULL`))
    .orderBy(desc(emergencyUpdatesTable.publishedAt));
  return scopeFamilyEmergencyUpdates(rows.map(row => ({
    ...row, familyStatus: row.familyStatus!, familyInstructions: row.familyInstructions!, publishedAt: row.publishedAt!,
  })), childIds);
}

function custodyStatusText(
  children: Awaited<ReturnType<typeof getParentChildren>>,
  episodes: Array<typeof custodyEpisodesTable.$inferSelect>,
) {
  if (!children.length) return `ℹ️ No children registered yet. Add them via the app.`;
  if (!episodes.length) return `ℹ️ You have no custody handover requests yet.`;
  const childNames = new Map(children.map(child => [child.id, `${child.firstName} ${child.lastName}`]));
  const labels: Record<string, string> = {
    requested: "🟡 Awaiting support",
    accepted: "🟢 In support custody",
    picked_up: "✅ Picked up",
    cancelled: "⚪ Cancelled",
  };
  const lines = episodes.slice(0, 5).map(episode =>
    `• *${childNames.get(episode.childId) ?? "Child"}* — ${labels[episode.status] ?? episode.status}\n  ${episode.serviceDate} · ${episode.requestedServices} service`,
  );
  return `🤝 *Custody Handover Status*\n\n${lines.join("\n\n")}`;
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
function todayLagos() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}
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
    CUSTODY_REQUEST: "🤝 _Last: custody request (type *7* to request again)_",
    CUSTODY_STATUS: "📍 _Last: custody status (type *8* to view again)_",
    NOTIFICATION_PREFS: "⚙️ _Last: notification preferences (type *9* to view again)_",
    PICKUP_REQUEST: "🚗 _Last: pickup request (type *10* to request again)_",
    PICKUP_STATUS: "🚗 _Last: pickup status (type *11* to view again)_",
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
    `*7* — 🤝 Request custody handover\n` +
    `*8* — 📍 Custody handover status\n` +
    `*9* — ⚙️ Notification preferences\n` +
    `*10* — 🚗 Request pickup\n` +
    `*11* — 🚗 Pickup request status\n` +
    `*12* — 🛟 Family emergency updates\n` +
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
    case "CUSTODY_REQUEST": {
      const children = await getParentChildren(userId);
      if (!children.length) { await reply(`ℹ️ No children registered. Add them via the app first.`); return true; }
      session.step = "custody_select_child";
      session.data.childList = children.map(child => child.id).join(",");
      await saveSession(fromJid, session);
      await reply(`🤝 *Request Custody Handover*\n\n${children.map((child, index) => `*${index + 1}* — ${child.firstName} ${child.lastName}`).join("\n")}\n\n_Type *0* to cancel._`);
      return true;
    }
    case "CUSTODY_STATUS": {
      const { children, episodes } = await getParentCustodyEpisodes(userId);
      await reply(custodyStatusText(children, episodes));
      return true;
    }
    case "NOTIFICATION_PREFS": {
      const [freshUser] = await db.select({ communicationPrefs: usersTable.communicationPrefs }).from(usersTable)
        .where(eq(usersTable.id, userId));
      session.step = "notification_pref_select";
      await saveSession(fromJid, session);
      await reply(notificationPreferencesText(parseCommunicationPrefs(freshUser?.communicationPrefs), true));
      return true;
    }
    case "PICKUP_REQUEST": {
      const children = await getParentChildren(userId);
      if (!children.length) { await reply(`ℹ️ No children registered. Add them via the app first.`); return true; }
      session.step = "pickup_select_child";
      session.data.childList = children.map(child => child.id).join(",");
      await saveSession(fromJid, session);
      await reply(`🚗 *Request Pickup*\n\n${children.map((child, index) => `*${index + 1}* — ${child.firstName} ${child.lastName}`).join("\n")}\n\n_Type *0* to cancel._`);
      return true;
    }
    case "PICKUP_STATUS": {
      const { children, requests } = await getParentPickupRequests(userId);
      if (!children.length) { await reply(`ℹ️ No children registered.`); return true; }
      if (!requests.length) { await reply(`ℹ️ No pickup requests found for your children.`); return true; }
      const names = new Map(children.map(child => [child.id, `${child.firstName} ${child.lastName}`]));
      await reply(`🚗 *Pickup Request Status*\n\n${requests.slice(0, 5).map(request =>
        `• *${names.get(request.childId) ?? "Child"}* — ${request.status === "requested" ? "🟡 Awaiting classroom" : request.status === "resolved" ? "✅ Resolved" : "⚪ Cancelled"}\n  ${request.serviceDate}`,
      ).join("\n\n")}`);
      return true;
    }
    case "EMERGENCY_UPDATES": {
      const updates = await getFamilyEmergencyUpdates(userId);
      if (!updates.length) { await reply(`ℹ️ There are no approved family emergency updates at this time.`); return true; }
      await reply(`🛟 *Family Emergency Updates*\n\n${updates.slice(0, 3).map(update =>
        `*${update.childFirstName}* — ${update.status}\n${update.instructions}`,
      ).join("\n\n")}`);
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

async function processInboundMessage(
  fromJid: string,
  text: string,
  imageBuffer: Buffer | null,
  reply: (msg: string) => Promise<void>,
  replyWithImage: (buf: Buffer, caption: string) => Promise<void>,
  providerEventId?: string,
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
  const approveMatch = input.match(/^approve\s+(sc-req-\d{4}-\d+)(?:\s+([a-f0-9]{10}))?\s*$/i);
  const rejectMatch  = input.match(/^reject\s+(sc-req-\d{4}-\d+)\s*$/i);
  if (approveMatch) { await _handleApproval(fromJid, approveMatch[1]!.toUpperCase(), true, reply, approveMatch[2]?.toUpperCase()); return; }
  if (rejectMatch)  { await _handleApproval(fromJid, rejectMatch[1]!.toUpperCase(),  false, reply); return; }

  // Also handle natural "yes" / "no" if parent has a pending approval in session
  const session0 = await getSession(fromJid);
  if (session0.data.pendingApprovalRef) {
    if (/^(yes|approve|ok|okay|confirm|proceed|yes please)$/i.test(input)) {
      await reply(`For safety, use the one-time code sent with the photo: *APPROVE ${session0.data.pendingApprovalRef} CODE*.`); return;
    }
    if (/^(no|reject|cancel|stop|dont|don't)$/i.test(input)) {
      await _handleApproval(fromJid, session0.data.pendingApprovalRef, false, reply); return;
    }
  }

  // ── PHOTO <REF> from support ─────────────────────────────────────────────
  const photoMatch = input.match(/^photo\s+(sc-req-\d{4}-\d+)\s*$/i);
  if (photoMatch) { await _handlePhotoIntent(fromJid, photoMatch[1]!.toUpperCase(), reply); return; }

  // ── Resolve userId from JID ──────────────────────────────────────────────
  let resolvedUserId: number | null = null;

  if (isLidJid(fromJid)) {
    const cached = await getLidUserId(fromJid);
    if (cached) {
      const user = await findUserById(cached.userId);
      if (isActiveUser(user) && user.whatsappVerified !== false && user.contactVersion === cached.contactVersion) resolvedUserId = cached.userId;
    } else {
      const session = await getSession(fromJid);
      if (session.step === "lid_verify_phone") {
        const matches = await findUsersByPhone(text.trim());
        if (!matches.length) {
          await reply(`❌ I couldn't find that number.\n\nPlease check and try again.\n\n_Type your registered phone (e.g. 08012345678):_`);
          return;
        }
        // A LID is opaque and typing a number is not proof of possession.
        // It may only bind an already WhatsApp-verified account.
        if (matches.some(match => match.whatsappVerified === false)) {
          await reply(`⛔ This WhatsApp contact has not been verified in the app.`); return;
        }
        resolvedUserId = matches[0]!.id;
        if (matches.length > 1) {
          const s: Session = { step: "role_select", data: { candidates: matches.map(u => u.id).join(",") } };
          await saveSession(fromJid, s);
          const opts = matches.map((u, i) => `*${i + 1}* — ${roleLabel(u.role as UserRole)} (${u.firstName} ${u.lastName})`).join("\n");
          await reply(`I found multiple accounts. Which one are you using today?\n\n${opts}`);
          return;
        }
        await setLidUserId(fromJid, matches[0]!.id, matches[0]!.contactVersion);
        await resetSession(fromJid, matches[0]!.id);
        const user = await findUserById(matches[0]!.id);
        if (user) {
          if (user.role === "teacher") await reply(teacherMenuText(user.firstName));
          else if (user.role === "support") await reply(supportMenuText(user.firstName));
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
  if (session.activeUserId) {
    const sessionUserIsCurrent = isLidJid(fromJid)
      ? session.activeUserId === resolvedUserId
      : (await findUsersByPhone(phoneFromWaJid(fromJid))).some(user => user.id === session.activeUserId);
    if (sessionUserIsCurrent) {
      resolvedUserId = session.activeUserId;
    } else {
      session = await resetSession(fromJid, resolvedUserId);
    }
  }

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
    if (isLidJid(fromJid)) {
      const selected = await findUserById(resolvedUserId);
      if (!isActiveUser(selected) || selected.whatsappVerified === false) {
        await resetSession(fromJid);
        await reply(`⛔ This account is not active for WhatsApp.`);
        return;
      }
      await setLidUserId(fromJid, selected.id, selected.contactVersion);
    }
  }

  const user = await findUserById(resolvedUserId);
  if (!isActiveUser(user) || user.whatsappVerified === false) {
    await resetSession(fromJid);
    await reply(`⛔ This account is not active. Please contact the church admin.`);
    return;
  }
  if (session.data.contactVersion !== String(user.contactVersion)) {
    // This check happens against the freshly loaded user, rather than treating
    // session state as authoritative. Phone changes also delete sessions in
    // the same transaction, so an old version cannot survive a write.
    session.data.contactVersion = String(user.contactVersion);
    session.activeUserId = user.id;
  }
  // Use activeRole from session (set when user switches to a secondary role)
  let secondaryRoles: string[] = [];
  try {
    const parsed = user.secondaryRoles ? JSON.parse(user.secondaryRoles) : [];
    if (Array.isArray(parsed)) secondaryRoles = parsed.filter((value): value is string => typeof value === "string");
  } catch { /* invalid secondary roles cannot authorize a session override */ }
  const activeRole = session.data.activeRole;
  const role = activeRole && [user.role, ...secondaryRoles].includes(activeRole)
    ? activeRole as UserRole
    : user.role as UserRole;

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
        : `*1* — Status  |  *2* — OTP  |  *3* — Children  |  *4* — Notifications  |  *5* — Concern  |  *6* — Support  |  *7* — Custody request  |  *8* — Custody status  |  *9* — Preferences`;
      await reply(
        `Welcome back, *${user.firstName}!* 🎉\n\n` +
        `What can I do for you? Here's a quick reminder of what I can help with:\n\n${menuHint}\n\n` +
        `Or type *0* for the full menu, or just describe what you need.`,
      );
      return;
    }
    // else: fall through so their actual typed message is handled normally
  }

  // ── Early escape: typing "0" during any multi-step flow returns to main menu ─
  const MULTI_STEP_STEPS: Step[] = [
    "concern_select_type", "concern_enter_desc",
    "request_select_type", "request_select_child",
    "custody_select_child", "custody_select_service", "notification_pref_select", "pickup_select_child",
    "teacher_sub_reason",
  ];
  if (input === "0" && MULTI_STEP_STEPS.includes(session.step)) {
    await resetSession(fromJid, resolvedUserId, session.data.lastAction);
    if (role === "teacher") { await reply(teacherMenuText(user.firstName, session.data.lastAction)); return; }
    if (role === "support" || role === "attendant") { await reply(supportMenuText(user.firstName)); return; }
    await reply(parentMenuText(user.firstName, session.data.lastAction)); return;
  }

  // ── Multi-step: parent custody handover ───────────────────────────────────
  if (session.step === "custody_select_child") {
    const childIds = (session.data.childList ?? "").split(",").map(Number).filter(Boolean);
    const index = Number.parseInt(input, 10) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= childIds.length) {
      await reply(`Please reply with a number between 1 and ${childIds.length}.\n\nType *0* to cancel.`);
      return;
    }
    // Re-read the owned children instead of trusting IDs persisted in session.
    const ownedChildren = await getParentChildren(user.id);
    const child = ownedChildren.find(candidate => candidate.id === childIds[index]);
    if (!child) {
      await resetSession(fromJid, resolvedUserId);
      await reply(`⛔ That child is no longer available on your family account.`);
      return;
    }
    session.step = "custody_select_service";
    session.data.custodyChildId = String(child.id);
    session.data.custodyChildName = `${child.firstName} ${child.lastName}`;
    await saveSession(fromJid, session);
    await reply(`Which service is this handover for?\n\n*1* — First service (7:00 AM)\n*2* — Second service (10:30 AM)\n*3* — Both services\n\n_Type *0* to cancel._`);
    return;
  }

  if (session.step === "custody_select_service") {
    const services: Record<string, "first" | "second" | "both"> = { "1": "first", "2": "second", "3": "both" };
    const requestedServices = services[input];
    if (!requestedServices) {
      await reply(`Please reply with *1*, *2*, or *3*.\n\nType *0* to cancel.`);
      return;
    }
    const childId = Number(session.data.custodyChildId);
    const ownedChildren = await getParentChildren(user.id);
    if (!Number.isInteger(childId) || !ownedChildren.some(child => child.id === childId)) {
      await resetSession(fromJid, resolvedUserId);
      await reply(`⛔ That child is no longer available on your family account.`);
      return;
    }
    try {
      const outcome = await db.transaction(tx => requestCustodyEpisode(tx, {
        childId,
        serviceDate: todayLagos(),
        requestedServices,
        requestedBy: user.id,
      }));
      await resetSession(fromJid, resolvedUserId, "CUSTODY_REQUEST");
      await reply(
        `✅ *Custody handover requested*\n\n` +
        `${session.data.custodyChildName ?? "Your child"} · ${requestedServices} service\n` +
        `Status: *Awaiting support acceptance*\n\nType *8* to check status or *0* for the menu.`,
      );
      if (outcome.duplicate) logger.info({ userId: user.id, childId }, "Bot: duplicate custody request replayed");
    } catch (error) {
      if (error instanceof CustodyHandoverError) {
        await reply(`ℹ️ ${error.message}\n\nType *8* to check custody status or *0* to cancel.`);
        return;
      }
      throw error;
    }
    return;
  }

  // ── Multi-step: notification preferences ─────────────────────────────────
  if (session.step === "notification_pref_select") {
    const keys: Record<string, keyof CommunicationPrefs> = {
      "1": "inApp", "2": "whatsapp", "3": "sms", "4": "email",
    };
    const key = keys[input];
    if (!key) {
      await reply(`Please reply with *1*, *2*, *3*, or *4*.\n\nType *0* to finish.`);
      return;
    }
    const [freshUser] = await db.select({
      communicationPrefs: usersTable.communicationPrefs,
      contactVersion: usersTable.contactVersion,
    }).from(usersTable).where(eq(usersTable.id, user.id));
    if (!freshUser) {
      await resetSession(fromJid);
      await reply(`⛔ This account is no longer available.`);
      return;
    }
    const prefs = parseCommunicationPrefs(freshUser.communicationPrefs);
    prefs[key] = !prefs[key];
    const [updated] = await db.update(usersTable)
      .set({ communicationPrefs: JSON.stringify(prefs) })
      .where(and(eq(usersTable.id, user.id), eq(usersTable.contactVersion, freshUser.contactVersion)))
      .returning({ id: usersTable.id });
    if (!updated) {
      await reply(`Your profile changed while I was saving. Please try that option again.`);
      return;
    }
    await reply(`✅ Preference updated.\n\n${notificationPreferencesText(prefs, true)}`);
    return;
  }

  // ── Multi-step: durable parent pickup signal ──────────────────────────────
  if (session.step === "pickup_select_child") {
    const childIds = (session.data.childList ?? "").split(",").map(Number).filter(Boolean);
    const index = Number.parseInt(input, 10) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= childIds.length) {
      await reply(`Please reply with a number between 1 and ${childIds.length}.\n\nType *0* to cancel.`);
      return;
    }
    // Session data is only a UI hint; ownership is checked again immediately
    // before calling the durable pickup command.
    const ownedChildren = await getParentChildren(user.id);
    const child = ownedChildren.find(candidate => candidate.id === childIds[index]);
    if (!child) {
      await resetSession(fromJid, resolvedUserId);
      await reply(`⛔ That child is no longer available on your family account.`);
      return;
    }
    try {
      const outcome = await createParentPickupRequest(user.id, child.id);
      await resetSession(fromJid, resolvedUserId, "PICKUP_REQUEST");
      await reply(outcome.duplicate
        ? `ℹ️ A pickup signal for *${child.firstName} ${child.lastName}* is already active.\n\nType *11* for status or *0* for the menu.`
        : `✅ *Pickup signal sent*\n\n${child.firstName} ${child.lastName}'s classroom has been notified.\n\nType *11* for status or *0* for the menu.`);
    } catch (error) {
      if (error instanceof ParentPickupRequestError) {
        await reply(`ℹ️ ${error.message}\n\nType *0* to cancel.`);
        return;
      }
      throw error;
    }
    return;
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
        message: `${user.firstName} ${user.lastName} can't make it for ${classNames}. Reason: ${text.trim().slice(0, 80)}`,
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
      const intentByNumber: Record<string, Intent> = {
        "1": role === "teacher" ? "MY_CHILDREN" : "CHECK_STATUS",
        "2": role === "teacher" ? "CHECK_STATUS" : "GET_OTP",
        "3": role === "teacher" ? "NOTIFICATIONS" : "MY_CHILDREN",
        "4": role === "teacher" ? "SUBMIT_CONCERN" : "NOTIFICATIONS",
        "5": role === "teacher" ? "SUBSTITUTE_REQUEST" : "SUBMIT_CONCERN",
        "6": role === "teacher" ? "MY_SCHEDULE" : "SUPPORT_REQUEST",
        "7": "CUSTODY_REQUEST",
        "8": "CUSTODY_STATUS",
        "9": "NOTIFICATION_PREFS",
        "10": "PICKUP_REQUEST",
        "11": "PICKUP_STATUS",
        "12": "EMERGENCY_UPDATES",
      };
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
    const handled = await executeParentIntent(fuzzyIntent, undefined, user.id, user.firstName, fromJid, session, reply);
    if (handled) {
      if (fuzzyIntent !== "MENU") { session.data.lastAction = fuzzyIntent; await saveSession(fromJid, session); }
      return;
    }
  }

  // 2. AI intent classification (handles everything else: typos, questions, complex phrasing)
  try {
    const classified = await classifyIntent(text, "parent", childNames);

    if (classified.confidence >= 0.5 && classified.intent !== "UNKNOWN") {
      const handled = await executeParentIntent(classified.intent, classified.answer, user.id, user.firstName, fromJid, session, reply);
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
  const menuHint = `*1* — Status  |  *2* — OTP  |  *3* — Children  |  *4* — Notifications  |  *5* — Concern  |  *6* — Support  |  *7* — Custody request  |  *8* — Custody status  |  *9* — Preferences`;

  await reply(
    `🤔 I didn't quite understand that.\n\n` +
    `Try picking a number:\n${menuHint}\n\n` +
    `Or type *0* for the full menu, or just describe what you need in plain words.`
  );
}

/**
 * Do not permanently deduplicate before processing: provider retries are the
 * recovery mechanism after a database/provider failure. The claim is retained
 * only after the handler completed; a failed attempt deletes its claim.
 */
export async function handleInboundMessage(
  fromJid: string,
  text: string,
  imageBuffer: Buffer | null,
  reply: (msg: string) => Promise<void>,
  replyWithImage: (buf: Buffer, caption: string) => Promise<void>,
  providerEventId?: string,
): Promise<void> {
  if (!providerEventId) return processInboundMessage(fromJid, text, imageBuffer, reply, replyWithImage);
  const claimed = await db.insert(botInboundEventsTable).values({ providerEventId })
    .onConflictDoNothing().returning();
  let ownsLease = claimed.length > 0;
  if (!ownsLease) {
    // A crashed worker leaves an incomplete row behind. Reclaim only after a
    // bounded lease; completed messages remain permanently idempotent.
    const reclaimed = await db.execute(sql`
      UPDATE bot_inbound_events
      SET processing_started_at = NOW()
      WHERE provider_event_id = ${providerEventId}
        AND completed_at IS NULL
        AND processing_started_at < NOW() - INTERVAL '5 minutes'
      RETURNING provider_event_id
    `);
    ownsLease = reclaimed.rows.length > 0;
  }
  if (!ownsLease) return;
  try {
    await processInboundMessage(fromJid, text, imageBuffer, reply, replyWithImage);
    await db.update(botInboundEventsTable).set({ completedAt: new Date() })
      .where(eq(botInboundEventsTable.providerEventId, providerEventId));
  } catch (error) {
    await db.delete(botInboundEventsTable).where(eq(botInboundEventsTable.providerEventId, providerEventId));
    throw error;
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

  if (role !== "parent") return null;

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
  if (input === "7") {
    return executeParentIntent("CUSTODY_REQUEST", undefined, userId, firstName, fromJid, session, reply);
  }
  if (input === "8") {
    return executeParentIntent("CUSTODY_STATUS", undefined, userId, firstName, fromJid, session, reply);
  }
  if (input === "9") {
    return executeParentIntent("NOTIFICATION_PREFS", undefined, userId, firstName, fromJid, session, reply);
  }
  if (input === "10") {
    return executeParentIntent("PICKUP_REQUEST", undefined, userId, firstName, fromJid, session, reply);
  }
  if (input === "11") {
    return executeParentIntent("PICKUP_STATUS", undefined, userId, firstName, fromJid, session, reply);
  }
  if (input === "12") {
    return executeParentIntent("EMERGENCY_UPDATES", undefined, userId, firstName, fromJid, session, reply);
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

  const isDelegate = requestType === "delegate_pickup";
  const supportJid = assigned.phone ? phoneToWaJid(assigned.phone) : null;
  const supportMsg = isDelegate
    ? `Delegate pickup for ${childName}${childClass}. Parent: ${parent.firstName} ${parent.lastName}. Ref: ${ref}. Ask for ID, photograph the delegate, and do not release until parent approval.`
    : `${typeLabel(requestType)} request for ${childName}${childClass}. Parent: ${parent.firstName} ${parent.lastName}. Ref: ${ref}.`;
  await db.transaction(async tx => {
    await tx.insert(supportRequestsTable).values({ referenceNumber: ref, type: requestType, childId: child.id, parentUserId: parent.id, assignedSupportId: assigned.id, status: "pending", serviceDate, serviceSlot });
    if (isDelegate && supportJid) {
      await tx.insert(botPendingApprovalsTable).values({
        refNumber: ref, parentJid, supportJid, childName, requestType, childId: child.id,
        parentUserId: parent.id, assignedSupportId: assigned.id, parentContactVersion: parent.contactVersion,
      });
    }
    await createNotificationDelivery(tx, {
      logicalIdentity: `support-request:${ref}:assigned:${assigned.id}`,
      domainType: "support_request",
      domainIdentifier: ref,
      projection: {
        userId: assigned.id, type: "support_request_assigned", title: typeLabel(requestType),
        message: supportMsg, metadata: { referenceNumber: ref, childId: child.id, requestType },
      },
      channels: ["whatsapp"],
      templateKey: "support_request_assigned",
    });
  });

  // Parent confirmation — delegate pickup requires photo approval; check-in/out does not
  await reply(
    `✅ *Support Request Sent!*\n\n📌 Type: *${typeLabel(requestType)}*\n👦 Child: *${childName}*${childClass}\n🔖 Ref: *${ref}*\n\n` +
    (isDelegate
      ? `A support officer will photograph the delegate and send you the image to confirm their identity before releasing *${child.firstName}*.\n\n_Reply *YES* to approve or *NO* to reject when you receive the photo._`
      : `A support officer has been notified and will assist you directly at the desk.`) +
    `\n\n_Type *0* for the main menu._`
  );

  logger.info({ ref, parentId: parent.id, supportId: assigned.id, requestType }, "Support request created");
}

// ── Photo intent ──────────────────────────────────────────────────────────────

async function _handlePhotoIntent(fromJid: string, ref: string, reply: (msg: string) => Promise<void>) {
  const [req] = await db.select().from(supportRequestsTable).where(eq(supportRequestsTable.referenceNumber, ref));
  if (!req) { await reply(`❌ Request *${ref}* not found.`); return; }
  if (req.status !== "pending") { await reply(`⚠️ Request *${ref}* is already *${req.status}*.`); return; }
  if (!req.assignedSupportId || !(await senderMatchesActiveUser(fromJid, req.assignedSupportId))) {
    await reply(`⛔ You are not the active support officer assigned to request *${ref}*.`);
    return;
  }
  const assignedSupport = await findUserById(req.assignedSupportId);
  if (!isActiveUser(assignedSupport) || !userHasRole(assignedSupport, "support")) {
    await reply(`⛔ You are not the active support officer assigned to request *${ref}*.`);
    return;
  }

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
  if (existing && (
    existing.parentUserId !== req.parentUserId
    || existing.childId !== req.childId
    || existing.assignedSupportId !== req.assignedSupportId
    || existing.supportJid !== fromJid
  )) {
    await reply(`⚠️ Request authorization data is no longer valid. Contact admin.`);
    return;
  }
  if (!existing) {
    const [child]  = await db.select().from(childrenTable).where(eq(childrenTable.id, req.childId));
    const [parent] = await db.select().from(usersTable).where(eq(usersTable.id, req.parentUserId));
    const [family] = child
      ? await db.select().from(familiesTable).where(and(
          eq(familiesTable.id, child.familyId),
          or(eq(familiesTable.parent1Id, req.parentUserId), eq(familiesTable.parent2Id, req.parentUserId)),
        ))
      : [];
    if (!child || !isActiveUser(parent ?? null) || !family) {
      await reply(`⚠️ Could not authorize request data. Contact admin.`);
      return;
    }
    const parentJid = parent.phone ? phoneToWaJid(parent.phone) : "";
    await setPendingApproval(ref, { parentJid, supportJid: fromJid, childName: `${child.firstName} ${child.lastName}`, requestType: req.type, childId: child.id, parentUserId: parent.id, assignedSupportId: req.assignedSupportId!, parentContactVersion: parent.contactVersion });
  }

  await setPhotoPending(fromJid, ref);
  await reply(`📸 Ready! Now send the photo of the *delegate* immediately.`);
}

// ── Photo relay ───────────────────────────────────────────────────────────────

async function _handleSupportPhoto(supportJid: string, ref: string, imageBuffer: Buffer, reply: (msg: string) => Promise<void>) {
  const relay = await getPendingApproval(ref);
  if (!relay) { await reply(`⚠️ Couldn't find request *${ref}*. Type *PHOTO ${ref}* again.`); return; }
  const [req] = await db.select().from(supportRequestsTable).where(eq(supportRequestsTable.referenceNumber, ref));
  const assignedSupport = await findUserById(relay.assignedSupportId);
  if (
    !req
    || req.status !== "pending"
    || req.type !== "delegate_pickup"
    || req.parentUserId !== relay.parentUserId
    || req.childId !== relay.childId
    || req.assignedSupportId !== relay.assignedSupportId
    || relay.supportJid !== supportJid
    || !(await senderMatchesActiveUser(supportJid, relay.assignedSupportId))
    || !isActiveUser(assignedSupport)
    || !userHasRole(assignedSupport, "support")
  ) {
    await reply(`⛔ This photo request is no longer authorized.`);
    return;
  }

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, req.childId));
  const [family] = child
    ? await db.select().from(familiesTable).where(and(
        eq(familiesTable.id, child.familyId),
        or(eq(familiesTable.parent1Id, req.parentUserId), eq(familiesTable.parent2Id, req.parentUserId)),
      ))
    : [];
  if (!child || !family) {
    await reply(`⛔ This photo request is no longer authorized.`);
    return;
  }

  // Delegate pickup: relay photo to parent and wait for YES/NO approval
  if (relay.requestType === "delegate_pickup") {
    // Uploading can leave an unreferenced object if the DB transaction loses a
    // race, but it cannot authorize release. The durable delivery intent and
    // photo_sent state are committed together below.
    const imageObjectPath = await objectStorage.uploadObjectEntityFromBuffer(imageBuffer, "image/jpeg");
    const proofCode = await db.transaction(async tx => {
      const [updated] = await tx.update(supportRequestsTable).set({ status: "photo_sent", updatedAt: new Date() })
        .where(and(
          eq(supportRequestsTable.referenceNumber, ref),
          eq(supportRequestsTable.status, "pending"),
          eq(supportRequestsTable.assignedSupportId, relay.assignedSupportId),
        )).returning();
      if (!updated) return null;
      const code = await createStepUpProof(tx, relay.parentUserId, relay.parentContactVersion, ref);
      await createNotificationDelivery(tx, {
        logicalIdentity: `support-request:${ref}:delegate-photo:${relay.parentUserId}`,
        domainType: "support_request",
        domainIdentifier: ref,
        projection: {
          userId: relay.parentUserId,
          type: "delegate_photo_approval",
          title: "Delegate Identity Verification",
          message: `Confirm the photographed delegate for ${relay.childName}. Reply APPROVE ${ref} ${code}, or reject the request.`,
          metadata: { referenceNumber: ref, childId: relay.childId },
        },
        channels: ["whatsapp"],
        templateKey: "delegate_photo_approval",
        templateMetadata: { imageObjectPath },
      });
      return code;
    });
    if (!proofCode) {
      await reply(`⚠️ Request *${ref}* has already been processed.`);
      return;
    }
    await reply(`✅ Photo received. Sending to the parent for identity approval...\nPlease wait — *do NOT release the child yet.*`);

    if (relay.parentJid) {
      const parentSession = await getSession(relay.parentJid);
      parentSession.data.pendingApprovalRef = ref;
      await saveSession(relay.parentJid, parentSession);

      logger.info({ ref, parentJid: relay.parentJid }, "Delegate photo queued for parent approval");
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

async function _handleApproval(parentJid: string, ref: string, approved: boolean, reply: (msg: string) => Promise<void>, proofCode?: string) {
  const relay = await getPendingApproval(ref);
  const [req]  = await db.select().from(supportRequestsTable).where(eq(supportRequestsTable.referenceNumber, ref));
  if (!req) { await reply(`❌ Request *${ref}* not found.`); return; }
  if (req.status !== "photo_sent") {
    await reply(`⚠️ Request *${ref}* has already been *${req.status}*.`); return;
  }
  if (
    !relay
    || req.type !== "delegate_pickup"
    || req.parentUserId !== relay.parentUserId
    || req.childId !== relay.childId
    || req.assignedSupportId !== relay.assignedSupportId
    || !(await senderMatchesActiveUser(parentJid, req.parentUserId))
  ) {
    await reply(`⛔ You are not authorized to approve request *${ref}*.`);
    return;
  }
  const parent = await findUserById(req.parentUserId);
  if (!isActiveUser(parent) || parent.contactVersion !== relay.parentContactVersion) {
    await reply(`⛔ Request *${ref}* is no longer authorized for this parent and child.`);
    return;
  }
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, req.childId));
  const [family] = child
    ? await db.select().from(familiesTable).where(and(
        eq(familiesTable.id, child.familyId),
        or(eq(familiesTable.parent1Id, req.parentUserId), eq(familiesTable.parent2Id, req.parentUserId)),
      ))
    : [];
  if (!child || !family) {
    await reply(`⛔ Request *${ref}* is no longer authorized for this parent and child.`);
    return;
  }

  const childName = relay.childName;

  // Clear pending approval ref from parent session
  const parentSession = await getSession(parentJid);
  delete parentSession.data.pendingApprovalRef;
  await saveSession(parentJid, parentSession);

  if (approved) {
    // The proof, request decision, custody/attendance transition and its
    // notification intents share one transaction. A failed transition rolls
    // back proof consumption so the parent can safely retry the same approval.
    let completed: Array<{ id: number; classId: number; serviceDate: string }> | null = null;
    try {
      completed = await db.transaction(async tx => {
        if (!proofCode || !(await consumeStepUpProof(tx, parent.id, parent.contactVersion, ref, proofCode))) {
          throw new CustodyHandoverError(403, "That approval code is invalid, expired, or already used.");
        }
        const [claimed] = await tx.update(supportRequestsTable)
          .set({ status: "approved", updatedAt: new Date() })
          .where(and(
            eq(supportRequestsTable.referenceNumber, ref),
            eq(supportRequestsTable.status, "photo_sent"),
            eq(supportRequestsTable.parentUserId, relay.parentUserId),
            eq(supportRequestsTable.childId, relay.childId),
            eq(supportRequestsTable.assignedSupportId, relay.assignedSupportId),
          ))
          .returning();
        if (!claimed) return null;
        const resolvedPickupRequests = await _recordAttendance(tx, claimed, relay);
        await createNotificationDelivery(tx, {
          logicalIdentity: `support-request:${ref}:approved:${relay.assignedSupportId}`,
          domainType: "support_request",
          domainIdentifier: ref,
          projection: {
            userId: relay.assignedSupportId,
            type: "support_request_approved",
            title: "Parent Approved Delegate Pickup",
            message: `${childName}'s delegate pickup was approved by the parent.`,
            metadata: { referenceNumber: ref, childId: relay.childId, requestType: "delegate_pickup" },
          },
          channels: ["whatsapp"],
          templateKey: "support_request_approved",
        });
        await tx.delete(botPendingApprovalsTable).where(eq(botPendingApprovalsTable.refNumber, ref));
        return resolvedPickupRequests;
      });
    } catch (err) {
      if (err instanceof CustodyHandoverError) {
        await reply(`⛔ ${err.message} Request a new delegate photo if needed.`);
        return;
      }
      throw err;
    }
    if (!completed) {
      await reply(`⚠️ Request *${ref}* has already been processed.`);
      return;
    }
    await reply(`✅ *Approved!*\n\nYou approved the ${typeLabel(req.type).toLowerCase()} for *${childName}*.\nThe support officer has been notified.\n\nType *0* for the main menu.`);
  } else {
    const rejected = await db.transaction(async tx => {
      const [row] = await tx.update(supportRequestsTable).set({ status: "rejected", updatedAt: new Date() }).where(and(
        eq(supportRequestsTable.referenceNumber, ref),
        eq(supportRequestsTable.status, "photo_sent"),
        eq(supportRequestsTable.parentUserId, relay.parentUserId),
        eq(supportRequestsTable.childId, relay.childId),
        eq(supportRequestsTable.assignedSupportId, relay.assignedSupportId),
      )).returning();
      if (!row) return null;
      await createNotificationDelivery(tx, {
        logicalIdentity: `support-request:${ref}:rejected:${relay.assignedSupportId}`,
        domainType: "support_request",
        domainIdentifier: ref,
        projection: {
          userId: relay.assignedSupportId, type: "support_request_rejected",
          title: "Parent Rejected Delegate Pickup",
          message: `${childName}'s delegate pickup was rejected. Do not release the child.`,
          metadata: { referenceNumber: ref, childId: relay.childId },
        },
        channels: ["whatsapp"],
        templateKey: "support_request_rejected",
      });
      await tx.delete(botPendingApprovalsTable).where(eq(botPendingApprovalsTable.refNumber, ref));
      return row;
    });
    if (!rejected) {
      await reply(`⚠️ Request *${ref}* has already been processed.`);
      return;
    }
    await reply(`❌ *Rejected.*\n\nThe support officer has been notified not to proceed for *${childName}*.\n\nType *0* for the main menu.`);
  }

}

// ── Auto-record attendance ────────────────────────────────────────────────────

async function _recordAttendance(tx: any, req: typeof supportRequestsTable.$inferSelect, relay: RelayData) {
    const today = req.serviceDate;
    const lockKey = Number(today.replace(/-/g, ""));
      // This is the same child/day lock as the primary attendance endpoint.
      // It prevents bot approvals and desk actions from both becoming winners.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${req.childId}, ${lockKey})`);
      const [currentRequest] = await tx.select().from(supportRequestsTable)
        .where(eq(supportRequestsTable.referenceNumber, req.referenceNumber));
      if (
        currentRequest?.status !== "approved"
        || currentRequest.type !== "delegate_pickup"
        || currentRequest.parentUserId !== relay.parentUserId
        || currentRequest.childId !== relay.childId
        || currentRequest.assignedSupportId !== relay.assignedSupportId
      ) throw new CustodyHandoverError(409, "The approval request is no longer eligible for release.");
      const [parent] = await tx.select().from(usersTable).where(eq(usersTable.id, currentRequest.parentUserId));
      const [support] = await tx.select().from(usersTable).where(eq(usersTable.id, currentRequest.assignedSupportId!));
      const [child] = await tx.select().from(childrenTable).where(eq(childrenTable.id, currentRequest.childId));
      const [family] = child
        ? await tx.select().from(familiesTable).where(and(
            eq(familiesTable.id, child.familyId),
            or(eq(familiesTable.parent1Id, currentRequest.parentUserId), eq(familiesTable.parent2Id, currentRequest.parentUserId)),
          ))
        : [];
      if (
        !isActiveUser(parent ?? null)
        || !isActiveUser(support ?? null)
        || !userHasRole(support, "support")
        || !child
        || !family
      ) throw new CustodyHandoverError(403, "The parent, child, or assigned support authorization is no longer valid.");

      const existing: Array<typeof attendanceTable.$inferSelect> = await tx.select().from(attendanceTable)
        .where(and(eq(attendanceTable.childId, req.childId), eq(attendanceTable.serviceDate, today)));
      if (req.type !== "delegate_pickup") {
        throw new CustodyHandoverError(409, "WhatsApp attendance changes require the normal custody handover workflow.");
      }
      const active = existing.filter((row: typeof attendanceTable.$inferSelect) => row.status !== "picked_up");
      const custodyEpisodeIds = active.reduce<number[]>((ids, row: typeof attendanceTable.$inferSelect) => {
        const episodeId = row.custodyEpisodeId;
        if (typeof episodeId === "number" && !ids.includes(episodeId)) ids.push(episodeId);
        return ids;
      }, []);
      if (custodyEpisodeIds.length !== 1) {
        throw new CustodyHandoverError(409, "Delegate release requires one accepted custody episode. Complete the normal custody handover first.");
      }
      const outcome = await releasePhysicalCustody(tx, {
        episodeId: custodyEpisodeIds[0]!,
        actorUserId: req.assignedSupportId!,
      });

      await tx.update(supportRequestsTable).set({ status: "completed", updatedAt: new Date() })
        .where(and(eq(supportRequestsTable.referenceNumber, req.referenceNumber), eq(supportRequestsTable.status, "approved")));
    logger.info({ ref: req.referenceNumber, type: req.type }, "Attendance auto-recorded on approval");
    return outcome.resolvedPickupRequests;
}

// ── Export proactive notification helper for use in attendance routes ─────────
export { notifyParentAttendanceChange } from "./botAI";
