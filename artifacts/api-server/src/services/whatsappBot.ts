/**
 * Shepherd Connect WhatsApp Bot
 *
 * Handles inbound WhatsApp messages via Baileys.
 * Supports registered parents AND teachers (same phone → role selection).
 *
 * JID note: newer WhatsApp accounts use "@lid" JIDs (Linked Device IDs) that
 * contain no phone number. Those go through a one-time phone-verification step
 * and the LID → userId mapping is cached in memory.
 *
 * Parent flows:
 *   1 / STATUS     → Child attendance status today
 *   2 / OTP        → Pickup delegate OTP codes
 *   3 / CHILDREN   → My children & their classes
 *   4 / NOTIFY     → Recent notifications (last 5)
 *   5 / CONCERN    → Submit a concern or feedback
 *
 * Teacher flows:
 *   1 / CLASS      → My class roster today
 *   2 / ATTEND     → Today's attendance summary for my class
 *   3 / NOTIFY     → Recent notifications (last 5)
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
} from "@workspace/db/schema";
import { eq, or, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

type UserRole = "parent" | "teacher" | "admin" | "super_admin" | "attendant" | "support";

type Step =
  | "idle"
  | "lid_verify_phone"
  | "role_select"
  | "concern_select_type"
  | "concern_enter_desc";

interface Session {
  step: Step;
  /** Active role once resolved (may differ from user.role if dual accounts) */
  activeUserId?: number;
  data: Record<string, string>;
  expiresAt: number;
}

// ── In-memory caches ──────────────────────────────────────────────────────────

/** LID JID → resolved userId (persists within one process lifetime) */
const lidCache = new Map<string, number>();

/** Active sessions keyed by JID */
const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

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

function isLidJid(jid: string) { return jid.endsWith("@lid"); }

/** Extract phone from @s.whatsapp.net JIDs (strips :device suffix). */
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

// Parent helpers
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
    })
    .from(childrenTable)
    .leftJoin(classesTable, eq(childrenTable.currentClassId, classesTable.id))
    .where(eq(childrenTable.familyId, family.id));
}

async function getTodayAttendance(childIds: number[]) {
  if (!childIds.length) return [];
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      childId: attendanceTable.childId,
      status: attendanceTable.status,
      serviceSlot: attendanceTable.serviceSlot,
    })
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

// Teacher helpers
async function getTeacherRecord(userId: number) {
  const [t] = await db.select().from(teachersTable).where(eq(teachersTable.userId, userId));
  return t ?? null;
}

async function getTodayAllocation(teacherId: number) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      id: teacherAllocationsTable.id,
      classId: teacherAllocationsTable.classId,
      serviceSlot: teacherAllocationsTable.serviceSlot,
      status: teacherAllocationsTable.status,
      className: classesTable.name,
    })
    .from(teacherAllocationsTable)
    .leftJoin(classesTable, eq(teacherAllocationsTable.classId, classesTable.id))
    .where(eq(teacherAllocationsTable.teacherId, teacherId));
  return rows.filter(r => r.id && true).find(r => true) ?? null;
  // Filter by date in JS since date comparison can vary
}

async function getTodayAllocationForTeacher(teacherId: number) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      classId: teacherAllocationsTable.classId,
      serviceSlot: teacherAllocationsTable.serviceSlot,
      status: teacherAllocationsTable.status,
      className: classesTable.name,
    })
    .from(teacherAllocationsTable)
    .leftJoin(classesTable, eq(teacherAllocationsTable.classId, classesTable.id))
    .where(eq(teacherAllocationsTable.teacherId, teacherId));

  // Drizzle returns date as string; filter manually
  const allRows = await db.select().from(teacherAllocationsTable).where(eq(teacherAllocationsTable.teacherId, teacherId));
  const todayRow = allRows.find(r => String(r.serviceDate).slice(0, 10) === today);
  if (!todayRow) return null;

  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, todayRow.classId));
  return { ...todayRow, className: cls?.name ?? "Unknown class" };
}

async function getClassChildren(classId: number) {
  return db
    .select({
      id: childrenTable.id,
      firstName: childrenTable.firstName,
      lastName: childrenTable.lastName,
      gender: childrenTable.gender,
    })
    .from(childrenTable)
    .where(eq(childrenTable.currentClassId, classId));
}

function generateRef(): string {
  const year = new Date().getFullYear();
  return `SC-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
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
    `*5* — 💬 Submit a concern or feedback\n\n` +
    `Type *HELP* or *0* at any time to see this menu.\n` +
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
    `Type *HELP* or *0* at any time to see this menu.\n` +
    `Type *SWITCH* to use a different role.`
  );
}

function attendanceStatusText(
  children: Awaited<ReturnType<typeof getParentChildren>>,
  attendance: Awaited<ReturnType<typeof getTodayAttendance>>,
) {
  if (!children.length) {
    return `ℹ️ You don't have any children registered yet. Please add them via the Shepherd Connect app.`;
  }
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
  if (!delegates.length) {
    return `ℹ️ You haven't added any pickup delegates yet.\n\nAdd delegates via the Shepherd Connect app under *Pickup Delegates*.`;
  }
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
  return `🔑 *Pickup Delegate OTPs*\n\n${lines.join("\n")}\n\n_Show the OTP to the attendant at pickup._`;
}

function childrenListText(children: Awaited<ReturnType<typeof getParentChildren>>) {
  if (!children.length) {
    return `ℹ️ You don't have any children registered yet. Please add them via the Shepherd Connect app.`;
  }
  const lines = children.map((c, i) => {
    const cls = c.className ? `📚 ${c.className}` : "📚 No class assigned";
    return `${i + 1}. *${c.firstName} ${c.lastName}*\n   ${cls}`;
  });
  return `👶 *My Children*\n\n${lines.join("\n\n")}`;
}

function notificationsText(notifs: Awaited<ReturnType<typeof getRecentNotifications>>) {
  if (!notifs.length) return `🔔 You have no recent notifications.`;
  const lines = notifs.map(n => {
    const unread = n.readStatus ? "" : "🔵 ";
    const date = new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${unread}*${n.title}*\n_${date}_ — ${n.message}`;
  });
  return `🔔 *Recent Notifications*\n\n${lines.join("\n\n")}\n\n_Open the app to see all notifications._`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleInboundMessage(
  fromJid: string,
  text: string,
  reply: (msg: string) => Promise<void>,
): Promise<void> {
  const input = text.trim().toLowerCase();

  // ── Step 1: Resolve a userId for this JID ───────────────────────────────────

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
            `❌ I couldn't find that number in our system.\n\n` +
            `Please check and try again, or contact the church admin.\n\n` +
            `_Type your registered phone number (e.g. 08012345678):_`,
          );
          return;
        }
        // Pick the first match; role selection happens below if > 1
        lidCache.set(fromJid, matches[0]!.id);
        resetSession(fromJid);
        resolvedUserId = matches[0]!.id;
        // Fall through to role selection if multiple accounts
        if (matches.length > 1) {
          const session2 = getSession(fromJid);
          session2.step = "role_select";
          session2.data.candidates = matches.map(u => u.id).join(",");
          const opts = matches.map((u, i) => `*${i + 1}* — ${_roleLabel(u.role as UserRole)} (${u.firstName} ${u.lastName})`).join("\n");
          await reply(`👋 I found multiple accounts for this number. Which one are you using today?\n\n${opts}`);
          return;
        }
      } else {
        session.step = "lid_verify_phone";
        await reply(
          `👋 Welcome to *Shepherd Connect*!\n\n` +
          `To get started, please type your registered phone number so I can verify your account.\n\n` +
          `_Example: 08012345678_`,
        );
        return;
      }
    }
  } else {
    const phone = phoneFromWaJid(fromJid);
    const matches = await findUsersByPhone(phone);
    if (matches.length) resolvedUserId = matches[0]!.id;

    // If multiple accounts, trigger role selection
    if (matches.length > 1) {
      const session = getSession(fromJid);
      if (session.step !== "role_select" && !session.activeUserId) {
        session.step = "role_select";
        session.data.candidates = matches.map(u => u.id).join(",");
        const opts = matches.map((u, i) => `*${i + 1}* — ${_roleLabel(u.role as UserRole)} (${u.firstName} ${u.lastName})`).join("\n");
        await reply(`👋 I found multiple accounts for this number. Which one would you like to use?\n\n${opts}`);
        return;
      }
    }
  }

  if (!resolvedUserId) {
    await reply(
      `👋 Hello! I'm the *Shepherd Connect* assistant.\n\n` +
      `I'm sorry, I don't recognise this number. Only registered users can use this service.\n\n` +
      `Please register on the Shepherd Connect app first:\n` +
      `🌐 https://shepherdconnect.name.ng\n\n` +
      `If you believe this is an error, please contact the church admin.`,
    );
    return;
  }

  const session = getSession(fromJid);

  // ── Step 2: Role selection (multi-account) ──────────────────────────────────

  if (session.step === "role_select") {
    const candidates = (session.data.candidates ?? "").split(",").map(Number).filter(Boolean);
    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= candidates.length) {
      await reply(`Please reply with a number between 1 and ${candidates.length}.`);
      return;
    }
    const chosenId = candidates[idx]!;
    session.activeUserId = chosenId;
    session.step = "idle";
    resolvedUserId = chosenId;
    // Fall through to show menu
  }

  // Use session's active user if set (e.g. role was selected)
  if (session.activeUserId) resolvedUserId = session.activeUserId;

  const user = await findUserById(resolvedUserId);
  if (!user) {
    await reply(`⚠️ Something went wrong. Please try again or contact the church admin.`);
    return;
  }

  const role = user.role as UserRole;

  // ── Step 3: Global escape commands ─────────────────────────────────────────

  if (["0", "menu", "help", "hi", "hello", "start"].includes(input)) {
    resetSession(fromJid, resolvedUserId);
    await reply(role === "teacher" ? teacherMenuText(user.firstName) : parentMenuText(user.firstName));
    return;
  }

  // SWITCH — let a multi-role person choose again
  if (input === "switch") {
    const phone = isLidJid(fromJid) ? null : phoneFromWaJid(fromJid);
    const matches = phone
      ? await findUsersByPhone(phone)
      : [user]; // LID users: single account only (can't switch)

    if (matches.length <= 1) {
      await reply(`ℹ️ You only have one account linked to this number.`);
      return;
    }
    const s = resetSession(fromJid);
    s.step = "role_select";
    s.data.candidates = matches.map(u => u.id).join(",");
    const opts = matches.map((u, i) => `*${i + 1}* — ${_roleLabel(u.role as UserRole)} (${u.firstName} ${u.lastName})`).join("\n");
    await reply(`Which account would you like to use?\n\n${opts}`);
    return;
  }

  // ── Step 4: Multi-step flows ────────────────────────────────────────────────

  if (session.step === "concern_select_type") {
    const typeMap: Record<string, string> = {
      "1": "safeguarding_concern",
      "2": "complaint",
      "3": "compliment",
      "4": "general_feedback",
    };
    const concernType = typeMap[input];
    if (!concernType) {
      await reply(`Please reply with *1*, *2*, *3*, or *4*.\n\nOr type *0* to cancel.`);
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
    await reply(
      `✏️ You selected: *${labels[concernType]}*\n\n` +
      `Please type your message now. Be as detailed as possible.\n\n` +
      `_Type *0* to cancel._`,
    );
    return;
  }

  if (session.step === "concern_enter_desc") {
    if (text.trim().length < 10) {
      await reply(`Please provide a bit more detail (at least 10 characters).\n\nType *0* to cancel.`);
      return;
    }
    let ref = generateRef();
    const [clash] = await db.select().from(parentConcernsTable).where(eq(parentConcernsTable.referenceNumber, ref));
    if (clash) ref = generateRef();

    await db.insert(parentConcernsTable).values({
      referenceNumber: ref,
      parentUserId: user.id,
      type: session.data.concernType as any,
      description: text.trim(),
      status: "open",
    });
    resetSession(fromJid, resolvedUserId);
    logger.info({ userId: user.id, ref }, "WhatsApp bot: concern submitted");
    await reply(
      `✅ *Concern submitted successfully!*\n\n` +
      `Your reference number is:\n*${ref}*\n\n` +
      `Keep this — the safeguarding team will review and respond via the app.\n\n` +
      `Type *0* to return to the main menu.`,
    );
    return;
  }

  // ── Step 5: Role-specific menu commands ────────────────────────────────────

  if (role === "teacher") {
    await _handleTeacherCommand(input, user.id, user.firstName, fromJid, resolvedUserId, session, reply);
  } else {
    // parent, admin, super_admin, attendant, support → parent-style menu
    await _handleParentCommand(input, user.id, user.firstName, fromJid, resolvedUserId, session, reply);
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
    await reply(childrenListText(children));
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
      `What type of submission is this?\n\n` +
      `*1* — 🛡️ Safeguarding Concern\n` +
      `*2* — ⚠️ Complaint\n` +
      `*3* — 👍 Compliment\n` +
      `*4* — 💬 General Feedback\n\n` +
      `_Type *0* to cancel._`,
    );
    return;
  }

  // Unrecognised → show menu
  const user = await findUserById(userId);
  await reply(parentMenuText(firstName));
}

// ── Teacher command handler ───────────────────────────────────────────────────

async function _handleTeacherCommand(
  input: string,
  userId: number,
  firstName: string,
  fromJid: string,
  resolvedUserId: number,
  session: Session,
  reply: (msg: string) => Promise<void>,
) {
  if (input === "1" || input === "class" || input === "roster") {
    const teacher = await getTeacherRecord(userId);
    if (!teacher) {
      await reply(`ℹ️ You don't have a teacher profile set up yet. Please contact the admin.`);
      return;
    }
    const allocation = await getTodayAllocationForTeacher(teacher.id);
    if (!allocation) {
      await reply(`ℹ️ You don't have a class allocation for today.`);
      return;
    }
    const children = await getClassChildren(allocation.classId);
    if (!children.length) {
      await reply(`ℹ️ No children are currently assigned to *${allocation.className}*.`);
      return;
    }
    const lines = children.map((c, i) => {
      const g = c.gender === "male" ? "👦" : "👧";
      return `${i + 1}. ${g} ${c.firstName} ${c.lastName}`;
    });
    await reply(
      `🏫 *${allocation.className}* — Class Roster\n` +
      `📅 ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}\n\n` +
      lines.join("\n") +
      `\n\n_${children.length} ${children.length === 1 ? "child" : "children"} in your class._`,
    );
    return;
  }

  if (input === "2" || input === "attend" || input === "attendance") {
    const teacher = await getTeacherRecord(userId);
    if (!teacher) {
      await reply(`ℹ️ You don't have a teacher profile set up yet. Please contact the admin.`);
      return;
    }
    const allocation = await getTodayAllocationForTeacher(teacher.id);
    if (!allocation) {
      await reply(`ℹ️ You don't have a class allocation for today.`);
      return;
    }
    const children   = await getClassChildren(allocation.classId);
    const attendance = await getTodayAttendance(children.map(c => c.id));

    const inClass   = attendance.filter(a => a.status === "in_class").length;
    const transit   = attendance.filter(a => a.status === "in_transit").length;
    const droppedOff = attendance.filter(a => a.status === "dropped_off").length;
    const pickedUp  = attendance.filter(a => a.status === "picked_up").length;
    const notIn     = children.length - attendance.length;

    await reply(
      `📋 *${allocation.className}* — Attendance\n` +
      `📅 ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}\n\n` +
      `🟢 In class: *${inClass}*\n` +
      `🟠 In transit: *${transit}*\n` +
      `🟡 Dropped off: *${droppedOff}*\n` +
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

  // Unrecognised → show menu
  await reply(teacherMenuText(firstName));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _roleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    parent:      "👨‍👩‍👧 Parent",
    teacher:     "👩‍🏫 Teacher",
    admin:       "🛠️ Admin",
    super_admin: "⭐ Super Admin",
    attendant:   "🔖 Attendant",
    support:     "🤝 Support",
  };
  return labels[role] ?? role;
}
