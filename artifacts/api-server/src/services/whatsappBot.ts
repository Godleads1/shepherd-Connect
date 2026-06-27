/**
 * Shepherd Connect WhatsApp Bot
 *
 * Supports registered parents AND teachers AND support staff.
 *
 * JID note: newer WhatsApp accounts use "@lid" JIDs that contain no phone
 * number. Those go through a one-time phone-verification step; the LID →
 * userId mapping is cached in memory.
 *
 * Parent menus:
 *   1 STATUS    — Child attendance status today
 *   2 OTP       — Pickup delegate OTP codes
 *   3 CHILDREN  — My children & classes
 *   4 NOTIFY    — Recent notifications
 *   5 CONCERN   — Submit a concern or feedback
 *   6 REQUEST   — Request support for check-in / check-out / delegate pickup
 *
 * Support menus:
 *   PHOTO <REF> — Signal intent to send photo for a pending request
 *   [image]     — Relays photo to parent after PHOTO command
 *
 * Parent approval:
 *   APPROVE <REF> — Approves the photo; records check-in/out automatically
 *   REJECT <REF>  — Rejects and notifies support
 *
 * Teacher menus:
 *   1 CLASS     — My class roster today
 *   2 ATTEND    — Today's attendance summary
 *   3 NOTIFY    — Recent notifications
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
} from "@workspace/db/schema";
import { eq, or, desc, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  sendWhatsAppToJid,
  sendWhatsAppImageToJid,
} from "./whatsapp";

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

interface Session {
  step: Step;
  activeUserId?: number;
  data: Record<string, string>;
  expiresAt: number;
}

// ── In-memory state ───────────────────────────────────────────────────────────

/** LID JID → resolved userId */
const lidCache = new Map<string, number>();

/** Sessions keyed by JID */
const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Support photo flow:
 * pendingPhotoCapture: support's fromJid → ref number
 * (set when support types "PHOTO <REF>", cleared after image is relayed)
 */
const pendingPhotoCapture = new Map<string, string>();

/**
 * Relay data for pending approval:
 * ref → { parentJid, supportJid, childName, requestType, childId, parentUserId }
 */
interface RelayData {
  parentJid: string;
  supportJid: string;
  childName: string;
  requestType: "checkin" | "checkout" | "delegate_pickup";
  childId: number;
  parentUserId: number;
  assignedSupportId: number;
}
const pendingApproval = new Map<string, RelayData>();

/**
 * Round-robin support assignment counter.
 * Incremented each time a support person is assigned.
 */
let supportRoundRobinIdx = 0;

// ── Session helpers ───────────────────────────────────────────────────────────

function getSession(jid: string): Session {
  const s = sessions.get(jid);
  if (s && s.expiresAt > Date.now()) {
    s.expiresAt = Date.now() + SESSION_TTL_MS;
    return s;
  }
  const fresh: Session = { step: "idle", data: {}, expiresAt: Date.now() + SESSION_TTL_MS };
  sessions.set(jid, fresh);
  return fresh;
}

function resetSession(jid: string, keepUserId?: number): Session {
  const s: Session = {
    step: "idle",
    data: {},
    expiresAt: Date.now() + SESSION_TTL_MS,
    activeUserId: keepUserId,
  };
  sessions.set(jid, s);
  return s;
}

// ── Phone helpers ─────────────────────────────────────────────────────────────

function normalisePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("0")) return "234" + d.slice(1);
  if (d.startsWith("+")) return d.slice(1);
  return d;
}

function phoneToWaJid(phone: string): string {
  return normalisePhone(phone) + "@s.whatsapp.net";
}

function isLidJid(jid: string) { return jid.endsWith("@lid"); }

function phoneFromWaJid(jid: string) { return jid.split("@")[0]!.split(":")[0]!; }

// ── DB helpers ────────────────────────────────────────────────────────────────

async function findUsersByPhone(phone: string) {
  const norm = normalisePhone(phone);
  const all = await db.select().from(usersTable);
  return all.filter(u => u.phone && normalisePhone(u.phone) === norm);
}

async function findUserById(id: number) {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return u ?? null;
}

async function getActiveSupportUsers() {
  return db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.role, "support"), eq(usersTable.isActive, true)));
}

async function getParentChildren(userId: number) {
  const [family] = await db
    .select()
    .from(familiesTable)
    .where(or(eq(familiesTable.parent1Id, userId), eq(familiesTable.parent2Id, userId)));
  if (!family) return [];
  return db
    .select({
      id: childrenTable.id,
      firstName: childrenTable.firstName,
      lastName: childrenTable.lastName,
      className: classesTable.name,
      currentClassId: childrenTable.currentClassId,
    })
    .from(childrenTable)
    .leftJoin(classesTable, eq(childrenTable.currentClassId, classesTable.id))
    .where(eq(childrenTable.familyId, family.id));
}

async function getTodayAttendance(childIds: number[]) {
  if (!childIds.length) return [];
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.serviceDate, today));
  return rows.filter(r => childIds.includes(r.childId));
}

async function getDelegates(childIds: number[]) {
  if (!childIds.length) return [];
  const all = await db.select().from(pickupDelegatesTable);
  return all.filter(d => childIds.includes(d.childId));
}

async function getRecentNotifications(userId: number, limit = 5) {
  return db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);
}

async function getTeacherRecord(userId: number) {
  const [t] = await db.select().from(teachersTable).where(eq(teachersTable.userId, userId));
  return t ?? null;
}

async function getTodayAllocationForTeacher(teacherId: number) {
  const today = new Date().toISOString().slice(0, 10);
  const allRows = await db
    .select()
    .from(teacherAllocationsTable)
    .where(eq(teacherAllocationsTable.teacherId, teacherId));
  const todayRow = allRows.find(r => String(r.serviceDate).slice(0, 10) === today);
  if (!todayRow) return null;
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, todayRow.classId));
  return { ...todayRow, className: cls?.name ?? "Unknown class" };
}

async function getClassChildren(classId: number) {
  return db
    .select({ id: childrenTable.id, firstName: childrenTable.firstName, lastName: childrenTable.lastName, gender: childrenTable.gender })
    .from(childrenTable)
    .where(eq(childrenTable.currentClassId, classId));
}

function generateRef(prefix = "SC-REQ"): string {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
}

function todaySlot(): string {
  return new Date().getHours() < 9 ? "7am" : "10:30am";
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Message builders ──────────────────────────────────────────────────────────

function parentMenuText(firstName: string) {
  return (
    `👋 Hi ${firstName}! Welcome to *Shepherd Connect*.\n\n` +
    `What would you like to do?\n\n` +
    `*1* — 📋 Check attendance status\n` +
    `*2* — 🔑 Get pickup delegate OTP\n` +
    `*3* — 👶 My children & classes\n` +
    `*4* — 🔔 Recent notifications\n` +
    `*5* — 💬 Submit a concern or feedback\n` +
    `*6* — 🆘 Request support (check-in / check-out)\n\n` +
    `Type *HELP* or *0* at any time.\n` +
    `Type *SWITCH* to use a different role.`
  );
}

function teacherMenuText(firstName: string) {
  return (
    `👋 Hi ${firstName}! Welcome to *Shepherd Connect*.\n\n` +
    `What would you like to do?\n\n` +
    `*1* — 🏫 My class roster today\n` +
    `*2* — 📋 Today's attendance summary\n` +
    `*3* — 🔔 Recent notifications\n\n` +
    `Type *HELP* or *0* at any time.\n` +
    `Type *SWITCH* to use a different role.`
  );
}

function supportMenuText(firstName: string) {
  return (
    `👋 Hi ${firstName}! You are logged in as *Support Staff*.\n\n` +
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
  if (!children.length) return `ℹ️ No children registered yet. Add them via the Shepherd Connect app.`;
  const statusLabel: Record<string, string> = {
    dropped_off: "🟡 Dropped off (not yet in class)",
    in_transit:  "🟠 In transit to classroom",
    in_class:    "🟢 In class",
    picked_up:   "✅ Picked up",
  };
  const lines = children.map(c => {
    const att  = attendance.find(a => a.childId === c.id);
    const name = `${c.firstName} ${c.lastName}`;
    const cls  = c.className ? ` (${c.className})` : "";
    if (!att) return `👦 *${name}*${cls}\n   ⚪ Not checked in today`;
    const slot = att.serviceSlot === "7am" ? "7:00 AM" : "10:30 AM";
    return `👦 *${name}*${cls}\n   ${statusLabel[att.status] ?? att.status}\n   ⏰ ${slot} service`;
  });
  return `📋 *Today's Attendance*\n\n${lines.join("\n\n")}`;
}

function otpText(
  children: Awaited<ReturnType<typeof getParentChildren>>,
  delegates: Awaited<ReturnType<typeof getDelegates>>,
) {
  if (!children.length) return `ℹ️ No children found on your account.`;
  if (!delegates.length) return `ℹ️ No pickup delegates added yet. Add them via the app.`;
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
  if (!lines.length) return `ℹ️ No delegates found.`;
  return `🔑 *Pickup Delegate OTPs*\n\n${lines.join("\n")}\n\n_Show OTP to the attendant at pickup._`;
}

function notificationsText(notifs: Awaited<ReturnType<typeof getRecentNotifications>>) {
  if (!notifs.length) return `🔔 You have no recent notifications.`;
  const lines = notifs.map(n => {
    const dot  = n.readStatus ? "" : "🔵 ";
    const date = new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${dot}*${n.title}*\n_${date}_ — ${n.message}`;
  });
  return `🔔 *Recent Notifications*\n\n${lines.join("\n\n")}\n\n_Open the app to see all._`;
}

function typeLabel(type: string): string {
  return type === "checkin" ? "Check-in" : type === "checkout" ? "Check-out" : "Delegate Pickup";
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

  // ── Image from support staff ──────────────────────────────────────────────
  if (imageBuffer) {
    const ref = pendingPhotoCapture.get(fromJid);
    if (ref) {
      pendingPhotoCapture.delete(fromJid);
      await _handleSupportPhoto(fromJid, ref, imageBuffer, reply);
      return;
    }
    // Image with no pending context — ignore silently
    return;
  }

  // ── Global APPROVE / REJECT commands (parent approval flow) ───────────────
  const approveMatch = input.match(/^approve\s+(sc-req-\d{4}-\d+)/i);
  const rejectMatch  = input.match(/^reject\s+(sc-req-\d{4}-\d+)/i);

  if (approveMatch) {
    await _handleApproval(fromJid, approveMatch[1]!.toUpperCase(), true, reply);
    return;
  }
  if (rejectMatch) {
    await _handleApproval(fromJid, rejectMatch[1]!.toUpperCase(), false, reply);
    return;
  }

  // ── PHOTO command from support ────────────────────────────────────────────
  const photoMatch = input.match(/^photo\s+(sc-req-\d{4}-\d+)/i);
  if (photoMatch) {
    await _handlePhotoIntent(fromJid, photoMatch[1]!.toUpperCase(), reply);
    return;
  }

  // ── Resolve user from JID ─────────────────────────────────────────────────
  let resolvedUserId: number | null = null;

  if (isLidJid(fromJid)) {
    const cached = lidCache.get(fromJid);
    if (cached) {
      resolvedUserId = cached;
    } else {
      const session = getSession(fromJid);
      if (session.step === "lid_verify_phone") {
        const matches = await findUsersByPhone(text.trim());
        if (!matches.length) {
          await reply(
            `❌ I couldn't find that number.\n\n` +
            `Please check and try again, or contact the church admin.\n\n` +
            `_Type your registered phone number (e.g. 08012345678):_`,
          );
          return;
        }
        lidCache.set(fromJid, matches[0]!.id);
        resetSession(fromJid);
        resolvedUserId = matches[0]!.id;
        if (matches.length > 1) {
          const s = getSession(fromJid);
          s.step = "role_select";
          s.data.candidates = matches.map(u => u.id).join(",");
          const opts = matches.map((u, i) => `*${i + 1}* — ${_roleLabel(u.role as UserRole)} (${u.firstName} ${u.lastName})`).join("\n");
          await reply(`I found multiple accounts for this number. Which one are you using today?\n\n${opts}`);
          return;
        }
      } else {
        session.step = "lid_verify_phone";
        await reply(
          `👋 Welcome to *Shepherd Connect*!\n\n` +
          `Please type your registered phone number to verify your account.\n\n` +
          `_Example: 08012345678_`,
        );
        return;
      }
    }
  } else {
    const phone   = phoneFromWaJid(fromJid);
    const matches = await findUsersByPhone(phone);
    if (matches.length) resolvedUserId = matches[0]!.id;

    if (matches.length > 1) {
      const session = getSession(fromJid);
      if (session.step !== "role_select" && !session.activeUserId) {
        session.step = "role_select";
        session.data.candidates = matches.map(u => u.id).join(",");
        const opts = matches.map((u, i) => `*${i + 1}* — ${_roleLabel(u.role as UserRole)} (${u.firstName} ${u.lastName})`).join("\n");
        await reply(`I found multiple accounts for this number. Which one would you like to use?\n\n${opts}`);
        return;
      }
    }
  }

  if (!resolvedUserId) {
    await reply(
      `👋 Hello! I'm the *Shepherd Connect* assistant.\n\n` +
      `I'm sorry, I don't recognise this number. Only registered users can use this service.\n\n` +
      `Please register at:\n🌐 https://shepherdconnect.name.ng\n\n` +
      `If you believe this is an error, please contact the church admin.`,
    );
    return;
  }

  const session = getSession(fromJid);

  // ── Role selection ────────────────────────────────────────────────────────
  if (session.step === "role_select") {
    const candidates = (session.data.candidates ?? "").split(",").map(Number).filter(Boolean);
    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= candidates.length) {
      await reply(`Please reply with a number between 1 and ${candidates.length}.`);
      return;
    }
    session.activeUserId = candidates[idx]!;
    session.step = "idle";
    resolvedUserId = session.activeUserId;
  }

  if (session.activeUserId) resolvedUserId = session.activeUserId;

  const user = await findUserById(resolvedUserId);
  if (!user) {
    await reply(`⚠️ Something went wrong. Please try again.`);
    return;
  }

  const role = user.role as UserRole;

  // ── Global escapes ────────────────────────────────────────────────────────
  if (["0", "menu", "help", "hi", "hello", "start"].includes(input)) {
    resetSession(fromJid, resolvedUserId);
    if (role === "teacher") { await reply(teacherMenuText(user.firstName)); return; }
    if (role === "support") { await reply(supportMenuText(user.firstName)); return; }
    await reply(parentMenuText(user.firstName));
    return;
  }

  if (input === "switch") {
    const phone   = isLidJid(fromJid) ? null : phoneFromWaJid(fromJid);
    const matches = phone ? await findUsersByPhone(phone) : [user];
    if (matches.length <= 1) { await reply(`ℹ️ You only have one account on this number.`); return; }
    const s = resetSession(fromJid);
    s.step = "role_select";
    s.data.candidates = matches.map(u => u.id).join(",");
    const opts = matches.map((u, i) => `*${i + 1}* — ${_roleLabel(u.role as UserRole)} (${u.firstName} ${u.lastName})`).join("\n");
    await reply(`Which account would you like to use?\n\n${opts}`);
    return;
  }

  // ── Multi-step flows (concern) ────────────────────────────────────────────
  if (session.step === "concern_select_type") {
    const typeMap: Record<string, string> = { "1": "safeguarding_concern", "2": "complaint", "3": "compliment", "4": "general_feedback" };
    const concernType = typeMap[input];
    if (!concernType) { await reply(`Please reply with *1*, *2*, *3*, or *4*.\n\nOr type *0* to cancel.`); return; }
    session.step = "concern_enter_desc";
    session.data.concernType = concernType;
    const labels: Record<string, string> = { safeguarding_concern: "Safeguarding Concern", complaint: "Complaint", compliment: "Compliment", general_feedback: "General Feedback" };
    await reply(`✏️ You selected: *${labels[concernType]}*\n\nPlease type your message now.\n\n_Type *0* to cancel._`);
    return;
  }

  if (session.step === "concern_enter_desc") {
    if (text.trim().length < 10) { await reply(`Please provide more detail.\n\nType *0* to cancel.`); return; }
    let ref = generateRef("SC");
    const [clash] = await db.select().from(parentConcernsTable).where(eq(parentConcernsTable.referenceNumber, ref));
    if (clash) ref = generateRef("SC");
    await db.insert(parentConcernsTable).values({ referenceNumber: ref, parentUserId: user.id, type: session.data.concernType as any, description: text.trim(), status: "open" });
    resetSession(fromJid, resolvedUserId);
    logger.info({ userId: user.id, ref }, "WhatsApp bot: concern submitted");
    await reply(`✅ *Concern submitted!*\n\nReference: *${ref}*\n\nThe safeguarding team will respond via the app.\n\nType *0* for the main menu.`);
    return;
  }

  // ── Multi-step flows (support request) ────────────────────────────────────
  if (session.step === "request_select_type") {
    const reqTypeMap: Record<string, "checkin" | "checkout" | "delegate_pickup"> = {
      "1": "checkin", "2": "checkout", "3": "delegate_pickup",
    };
    const reqType = reqTypeMap[input];
    if (!reqType) { await reply(`Please reply with *1*, *2*, or *3*.\n\nType *0* to cancel.`); return; }
    session.data.requestType = reqType;

    // Check how many children this parent has
    const children = await getParentChildren(user.id);
    if (!children.length) {
      resetSession(fromJid, resolvedUserId);
      await reply(`ℹ️ You have no children registered. Please add them via the Shepherd Connect app first.`);
      return;
    }
    if (children.length === 1) {
      // Skip child selection
      await _createSupportRequest(fromJid, user, children[0]!, reqType, reply);
      resetSession(fromJid, resolvedUserId);
      return;
    }
    session.step = "request_select_child";
    session.data.childList = children.map(c => c.id).join(",");
    const childOpts = children.map((c, i) => `*${i + 1}* — ${c.firstName} ${c.lastName}${c.className ? ` (${c.className})` : ""}`).join("\n");
    await reply(`Which child is this request for?\n\n${childOpts}\n\nOr type *0* to cancel.`);
    return;
  }

  if (session.step === "request_select_child") {
    const childIds = (session.data.childList ?? "").split(",").map(Number).filter(Boolean);
    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= childIds.length) {
      await reply(`Please reply with a number between 1 and ${childIds.length}.\n\nType *0* to cancel.`);
      return;
    }
    const childId = childIds[idx]!;
    const [childRow] = await db
      .select({ id: childrenTable.id, firstName: childrenTable.firstName, lastName: childrenTable.lastName, currentClassId: childrenTable.currentClassId, className: classesTable.name })
      .from(childrenTable)
      .leftJoin(classesTable, eq(childrenTable.currentClassId, classesTable.id))
      .where(eq(childrenTable.id, childId));
    if (!childRow) { await reply(`Something went wrong. Please try again.`); return; }
    const reqType = session.data.requestType as "checkin" | "checkout" | "delegate_pickup";
    await _createSupportRequest(fromJid, user, childRow, reqType, reply);
    resetSession(fromJid, resolvedUserId);
    return;
  }

  // ── Role-specific menu commands ───────────────────────────────────────────
  if (role === "teacher") {
    await _handleTeacherCommand(input, user.id, user.firstName, reply);
  } else if (role === "support" || role === "attendant") {
    await reply(supportMenuText(user.firstName));
  } else {
    await _handleParentCommand(input, user.id, user.firstName, fromJid, resolvedUserId, session, reply);
  }
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
    await reply(
      `⚠️ No support staff are available right now.\n\n` +
      `Please contact the church admin directly or visit the check-in desk.`,
    );
    return;
  }

  // Pick one support person — round-robin, never two get the same request
  const assigned = supportUsers[supportRoundRobinIdx % supportUsers.length]!;
  supportRoundRobinIdx++;

  const ref = generateRef("SC-REQ");
  const serviceDate = todayDate();
  const serviceSlot = todaySlot();

  await db.insert(supportRequestsTable).values({
    referenceNumber: ref,
    type: requestType,
    childId: child.id,
    parentUserId: parent.id,
    assignedSupportId: assigned.id,
    status: "pending",
    serviceDate,
    serviceSlot,
  });

  logger.info({ ref, parentId: parent.id, supportId: assigned.id, requestType }, "Support request created");

  const childName = `${child.firstName} ${child.lastName}`;
  const childClass = child.className ? ` (${child.className})` : "";
  const slotLabel  = serviceSlot === "7am" ? "7:00 AM" : "10:30 AM";

  // Confirm to parent
  await reply(
    `✅ *Support Request Sent!*\n\n` +
    `📌 Type: *${typeLabel(requestType)}*\n` +
    `👦 Child: *${childName}*${childClass}\n` +
    `🔖 Reference: *${ref}*\n\n` +
    `A support officer has been notified and will assist shortly.\n\n` +
    `You will receive a photo for approval before anything proceeds.\n` +
    `_Type *0* for the main menu._`,
  );

  // Notify the assigned support officer
  const supportJid = assigned.phone ? phoneToWaJid(assigned.phone) : null;
  if (supportJid) {
    const notifText =
      `🔔 *New Support Request*\n` +
      `Ref: *${ref}*\n\n` +
      `📌 Type: *${typeLabel(requestType)}*\n` +
      `👦 Child: *${childName}*${childClass}\n` +
      `👨‍👩‍👧 Parent: *${parent.firstName} ${parent.lastName}*\n` +
      (parent.phone ? `📞 ${parent.phone}\n` : "") +
      `⏰ Service: *${slotLabel}*\n\n` +
      `When the person arrives:\n` +
      `1️⃣  Take their photo with your camera\n` +
      `2️⃣  Type: *PHOTO ${ref}*\n` +
      `3️⃣  Then send the photo immediately\n\n` +
      `⚠️ _This request is assigned to you. Do not share it with other staff._`;

    await sendWhatsAppToJid(supportJid, notifText);

    // Cache relay data so we can forward the photo later
    pendingApproval.set(ref, {
      parentJid,
      supportJid,
      childName,
      requestType,
      childId: child.id,
      parentUserId: parent.id,
      assignedSupportId: assigned.id,
    });
  } else {
    logger.warn({ supportId: assigned.id }, "Assigned support has no phone number — cannot WhatsApp them");
  }
}

// ── Photo intent handler (support types "PHOTO <REF>") ────────────────────────

async function _handlePhotoIntent(
  fromJid: string,
  ref: string,
  reply: (msg: string) => Promise<void>,
) {
  // Verify the request exists and is pending
  const [req] = await db
    .select()
    .from(supportRequestsTable)
    .where(eq(supportRequestsTable.referenceNumber, ref));

  if (!req) {
    await reply(`❌ Request *${ref}* not found. Please check the reference number.`);
    return;
  }
  if (req.status !== "pending") {
    await reply(`⚠️ Request *${ref}* is already *${req.status}*. No further action needed.`);
    return;
  }

  // Load relay data — may not be in memory if server restarted
  if (!pendingApproval.has(ref)) {
    // Rebuild from DB
    const [child]  = await db.select({ id: childrenTable.id, firstName: childrenTable.firstName, lastName: childrenTable.lastName }).from(childrenTable).where(eq(childrenTable.id, req.childId));
    const [parent] = await db.select().from(usersTable).where(eq(usersTable.id, req.parentUserId));
    const [support] = await db.select().from(usersTable).where(eq(usersTable.id, req.assignedSupportId!));

    if (!child || !parent) { await reply(`⚠️ Could not load request data. Please contact admin.`); return; }

    // Try to find parent JID from LID cache or construct from phone
    let parentJid = parent.phone ? phoneToWaJid(parent.phone) : "";
    for (const [jid, uid] of lidCache) {
      if (uid === parent.id) { parentJid = jid; break; }
    }

    pendingApproval.set(ref, {
      parentJid,
      supportJid: fromJid,
      childName: `${child.firstName} ${child.lastName}`,
      requestType: req.type,
      childId: child.id,
      parentUserId: parent.id,
      assignedSupportId: req.assignedSupportId!,
    });
  }

  // Register that THIS support JID is waiting to send a photo for this ref
  pendingPhotoCapture.set(fromJid, ref);

  await reply(`📸 Ready! Now send the photo of the person immediately.`);
}

// ── Photo relay handler (support sends image after PHOTO command) ─────────────

async function _handleSupportPhoto(
  supportJid: string,
  ref: string,
  imageBuffer: Buffer,
  reply: (msg: string) => Promise<void>,
) {
  const relay = pendingApproval.get(ref);
  if (!relay) {
    await reply(`⚠️ Couldn't find request *${ref}* in memory. Please type *PHOTO ${ref}* again.`);
    return;
  }

  // Update status in DB
  await db
    .update(supportRequestsTable)
    .set({ status: "photo_sent", updatedAt: new Date() })
    .where(eq(supportRequestsTable.referenceNumber, ref));

  // Confirm to support
  await reply(`✅ Photo received. Sending to the parent for approval...\nPlease wait for their decision.`);

  // Forward image to parent
  if (relay.parentJid) {
    const caption =
      `📸 *Photo for Your Approval*\n\n` +
      `👦 Child: *${relay.childName}*\n` +
      `📌 Type: *${typeLabel(relay.requestType)}*\n` +
      `🔖 Ref: *${ref}*\n\n` +
      `Please confirm this is the right person:\n\n` +
      `✅ Type: *APPROVE ${ref}*\n` +
      `❌ Type: *REJECT ${ref}*`;

    await sendWhatsAppImageToJid(relay.parentJid, imageBuffer, caption);
    logger.info({ ref, parentJid: relay.parentJid }, "Photo relayed to parent for approval");
  } else {
    logger.warn({ ref }, "No parent JID available to relay photo");
    await reply(`⚠️ Could not reach the parent on WhatsApp. Please contact admin.`);
  }
}

// ── Approval handler (parent approves or rejects) ─────────────────────────────

async function _handleApproval(
  parentJid: string,
  ref: string,
  approved: boolean,
  reply: (msg: string) => Promise<void>,
) {
  const relay = pendingApproval.get(ref);
  const [req] = await db
    .select()
    .from(supportRequestsTable)
    .where(eq(supportRequestsTable.referenceNumber, ref));

  if (!req) {
    await reply(`❌ Request *${ref}* not found.`);
    return;
  }
  if (req.status !== "photo_sent" && req.status !== "pending") {
    await reply(`⚠️ Request *${ref}* has already been *${req.status}*.`);
    return;
  }

  const childName = relay?.childName ?? `Child #${req.childId}`;

  if (approved) {
    // Update request status
    await db
      .update(supportRequestsTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(supportRequestsTable.referenceNumber, ref));

    // Auto-record the check-in or check-out in attendance
    await _recordAttendance(req, reply);

    // Confirm to parent
    await reply(
      `✅ *Approved!*\n\n` +
      `You approved the ${typeLabel(req.type).toLowerCase()} for *${childName}*.\n` +
      `The support officer has been notified and will proceed.\n\n` +
      `Type *0* for the main menu.`,
    );

    // Notify support
    if (relay?.supportJid) {
      await sendWhatsAppToJid(
        relay.supportJid,
        `✅ *Parent Approved!*\n\n` +
        `👦 *${childName}* — ${typeLabel(req.type)}\n` +
        `🔖 Ref: *${ref}*\n\n` +
        `Please proceed with the ${typeLabel(req.type).toLowerCase()}.\n` +
        `The attendance has been recorded automatically.`,
      );
    }

    // Clean up
    pendingApproval.delete(ref);

  } else {
    // Rejected
    await db
      .update(supportRequestsTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(supportRequestsTable.referenceNumber, ref));

    await reply(
      `❌ *Rejected.*\n\n` +
      `The support officer has been notified not to proceed for *${childName}*.\n\n` +
      `If this was a mistake, you can submit a new request.\n` +
      `Type *0* for the main menu.`,
    );

    if (relay?.supportJid) {
      await sendWhatsAppToJid(
        relay.supportJid,
        `❌ *Parent Rejected the Photo*\n\n` +
        `👦 *${childName}* — ${typeLabel(req.type)}\n` +
        `🔖 Ref: *${ref}*\n\n` +
        `⚠️ *Do not proceed.* The parent has declined.\n\n` +
        `If you believe this is an error, please contact the church admin.`,
      );
    }

    pendingApproval.delete(ref);
  }
}

// ── Auto-record attendance on approval ────────────────────────────────────────

async function _recordAttendance(
  req: typeof supportRequestsTable.$inferSelect,
  reply: (msg: string) => Promise<void>,
) {
  const today = todayDate();
  const slot  = req.serviceSlot;

  try {
    const [existing] = await db
      .select()
      .from(attendanceTable)
      .where(and(
        eq(attendanceTable.childId, req.childId),
        eq(attendanceTable.serviceDate, today),
      ));

    if (req.type === "checkin") {
      if (existing) {
        // Already has a record — just update status
        await db.update(attendanceTable).set({ status: "dropped_off", checkInTime: new Date() }).where(eq(attendanceTable.id, existing.id));
      } else {
        // Need classId — get from child
        const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, req.childId));
        if (child?.currentClassId) {
          await db.insert(attendanceTable).values({
            childId: req.childId,
            classId: child.currentClassId,
            serviceDate: today,
            serviceSlot: slot,
            checkInTime: new Date(),
            status: "dropped_off",
            checkedInBy: req.assignedSupportId ?? undefined,
          });
        }
      }
    } else if (req.type === "checkout" || req.type === "delegate_pickup") {
      if (existing) {
        await db.update(attendanceTable).set({ status: "picked_up", checkOutTime: new Date(), checkedOutBy: req.assignedSupportId ?? undefined }).where(eq(attendanceTable.id, existing.id));
      }
    }

    await db
      .update(supportRequestsTable)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(supportRequestsTable.referenceNumber, req.referenceNumber));

    logger.info({ ref: req.referenceNumber, type: req.type }, "Attendance auto-recorded on approval");
  } catch (err) {
    logger.error({ ref: req.referenceNumber, err: String(err) }, "Failed to auto-record attendance");
  }
}

// ── Parent command handler ────────────────────────────────────────────────────

async function _handleParentCommand(
  input: string,
  userId: number,
  firstName: string,
  fromJid: string,
  resolvedUserId: number,
  session: Session,
  reply: (msg: string) => Promise<void>,
) {
  if (input === "1" || input === "status") {
    const children   = await getParentChildren(userId);
    const attendance = await getTodayAttendance(children.map(c => c.id));
    await reply(attendanceStatusText(children, attendance));
    return;
  }
  if (input === "2" || input === "otp") {
    const children  = await getParentChildren(userId);
    const delegates = await getDelegates(children.map(c => c.id));
    await reply(otpText(children, delegates));
    return;
  }
  if (input === "3" || input === "children") {
    const children = await getParentChildren(userId);
    if (!children.length) { await reply(`ℹ️ No children registered. Add them via the app.`); return; }
    const lines = children.map((c, i) => `${i + 1}. *${c.firstName} ${c.lastName}*\n   📚 ${c.className ?? "No class assigned"}`);
    await reply(`👶 *My Children*\n\n${lines.join("\n\n")}`);
    return;
  }
  if (input === "4" || input === "notify" || input === "notifications") {
    const notifs = await getRecentNotifications(userId);
    await reply(notificationsText(notifs));
    return;
  }
  if (input === "5" || input === "concern") {
    session.step = "concern_select_type";
    await reply(
      `💬 *Submit a Concern or Feedback*\n\n` +
      `*1* — 🛡️ Safeguarding Concern\n` +
      `*2* — ⚠️ Complaint\n` +
      `*3* — 👍 Compliment\n` +
      `*4* — 💬 General Feedback\n\n` +
      `_Type *0* to cancel._`,
    );
    return;
  }
  if (input === "6" || input === "request") {
    session.step = "request_select_type";
    await reply(
      `🆘 *Request Support*\n\n` +
      `What type of request is this?\n\n` +
      `*1* — 🟢 Check-in (bring child in)\n` +
      `*2* — 🔴 Check-out (pick up child)\n` +
      `*3* — 👤 Delegate Pickup (another person collecting)\n\n` +
      `_Type *0* to cancel._`,
    );
    return;
  }
  await reply(parentMenuText(firstName));
}

// ── Teacher command handler ───────────────────────────────────────────────────

async function _handleTeacherCommand(
  input: string,
  userId: number,
  firstName: string,
  reply: (msg: string) => Promise<void>,
) {
  if (input === "1" || input === "class" || input === "roster") {
    const teacher = await getTeacherRecord(userId);
    if (!teacher) { await reply(`ℹ️ No teacher profile found. Contact admin.`); return; }
    const allocation = await getTodayAllocationForTeacher(teacher.id);
    if (!allocation) { await reply(`ℹ️ No class allocation for today.`); return; }
    const children = await getClassChildren(allocation.classId);
    if (!children.length) { await reply(`ℹ️ No children in *${allocation.className}* yet.`); return; }
    const lines = children.map((c, i) => `${i + 1}. ${c.gender === "male" ? "👦" : "👧"} ${c.firstName} ${c.lastName}`);
    await reply(
      `🏫 *${allocation.className}* — Class Roster\n` +
      `📅 ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}\n\n` +
      lines.join("\n") +
      `\n\n_${children.length} ${children.length === 1 ? "child" : "children"} enrolled._`,
    );
    return;
  }
  if (input === "2" || input === "attend" || input === "attendance") {
    const teacher = await getTeacherRecord(userId);
    if (!teacher) { await reply(`ℹ️ No teacher profile found. Contact admin.`); return; }
    const allocation = await getTodayAllocationForTeacher(teacher.id);
    if (!allocation) { await reply(`ℹ️ No class allocation for today.`); return; }
    const children   = await getClassChildren(allocation.classId);
    const attendance = await getTodayAttendance(children.map(c => c.id));
    const inClass    = attendance.filter(a => a.status === "in_class").length;
    const transit    = attendance.filter(a => a.status === "in_transit").length;
    const dropped    = attendance.filter(a => a.status === "dropped_off").length;
    const pickedUp   = attendance.filter(a => a.status === "picked_up").length;
    const notIn      = children.length - attendance.length;
    await reply(
      `📋 *${allocation.className}* — Attendance\n` +
      `📅 ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}\n\n` +
      `🟢 In class: *${inClass}*\n` +
      `🟠 In transit: *${transit}*\n` +
      `🟡 Dropped off: *${dropped}*\n` +
      `✅ Picked up: *${pickedUp}*\n` +
      `⚪ Not checked in: *${notIn}*\n\n` +
      `👥 Total enrolled: *${children.length}*`,
    );
    return;
  }
  if (input === "3" || input === "notify" || input === "notifications") {
    const notifs = await getRecentNotifications(userId);
    await reply(notificationsText(notifs));
    return;
  }
  await reply(teacherMenuText(firstName));
}

// ── Utility ───────────────────────────────────────────────────────────────────

function _roleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    parent: "👨‍👩‍👧 Parent", teacher: "👩‍🏫 Teacher", admin: "🛠️ Admin",
    super_admin: "⭐ Super Admin", attendant: "🔖 Attendant", support: "🤝 Support",
  };
  return labels[role] ?? role;
}
