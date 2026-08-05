import { db, notificationsTable, usersTable, familiesTable, childrenTable, classesTable, teachersTable, teacherAllocationsTable, attendanceTable, hallSessionsTable, classMergesTable } from "@workspace/db";
import { eq, and, isNull, or } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Returns true if a hall session is active for the given date and (optionally) slot.
 * A row with serviceSlot = null covers both slots.
 */
async function isHallSessionActive(serviceDate: string, serviceSlot?: string | null): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: hallSessionsTable.id })
      .from(hallSessionsTable)
      .where(
        and(
          eq(hallSessionsTable.serviceDate, serviceDate),
          serviceSlot
            ? or(eq(hallSessionsTable.serviceSlot, serviceSlot as "7am" | "10:30am"), isNull(hallSessionsTable.serviceSlot))
            : isNull(hallSessionsTable.serviceSlot),
        ),
      )
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * If the child's class is merged into another class today, returns the host class id and name.
 * Returns null if no merge is in effect.
 */
async function getActiveMergeTarget(
  classId: number,
  serviceDate: string,
): Promise<{ targetClassId: number; targetClassName: string } | null> {
  try {
    const [merge] = await db
      .select({ targetClassId: classMergesTable.targetClassId })
      .from(classMergesTable)
      .where(and(
        eq(classMergesTable.sourceClassId, classId),
        eq(classMergesTable.serviceDate, serviceDate),
      ))
      .limit(1);
    if (!merge) return null;
    const [hostClass] = await db
      .select({ name: classesTable.name })
      .from(classesTable)
      .where(eq(classesTable.id, merge.targetClassId));
    return { targetClassId: merge.targetClassId, targetClassName: hostClass?.name ?? "host class" };
  } catch {
    return null;
  }
}

type Channel = "in_app" | "whatsapp" | "sms" | "email";

export async function sendNotification(opts: {
  userId: number;
  type: string;
  title: string;
  message: string;
  channel?: Channel;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(notificationsTable).values({
    userId: opts.userId,
    type: opts.type,
    title: opts.title,
    message: opts.message,
    channel: (opts.channel ?? "in_app") as Channel,
    readStatus: false,
    metadataJson: opts.metadata ? JSON.stringify(opts.metadata) : null,
  });
  dispatchExternal(opts.userId, opts.title, opts.message).then(({ delivered }) => {
    if (!delivered) {
      logger.warn({ userId: opts.userId }, "sendNotification: external delivery skipped or failed");
    }
  }).catch((err) => {
    logger.warn({ userId: opts.userId, err }, "sendNotification: external delivery threw unexpectedly");
  });
}

/**
 * Fire-and-forget external delivery (WhatsApp) based on the user's
 * saved communicationPrefs. Safe to call for any notification — silently
 * skips users without a phone or without WhatsApp enabled.
 */
export async function dispatchExternal(userId: number, title: string, message: string): Promise<{ delivered: boolean }> {
  try {
    const [user] = await db.select({
      phone: usersTable.phone,
      communicationPrefs: usersTable.communicationPrefs,
    }).from(usersTable).where(eq(usersTable.id, userId));
    if (!user?.phone) return { delivered: false };

    let prefs: { inApp?: boolean; whatsapp?: boolean; sms?: boolean; email?: boolean } = {};
    if (user.communicationPrefs) {
      try { prefs = JSON.parse(user.communicationPrefs); } catch { /* ignore malformed JSON */ }
    }

    if (!prefs.whatsapp) return { delivered: false };

    const { sendWhatsAppWithFallback } = await import("../services/sms");
    const text = `*${title}*\n\n${message}`;
    await sendWhatsAppWithFallback(user.phone, text, logger);
    return { delivered: true };
  } catch (err) {
    logger.warn({ userId, err }, "dispatchExternal: delivery failed");
    return { delivered: false };
  }
}

export async function sendToRole(opts: {
  role: "parent" | "teacher" | "support" | "admin" | "super_admin";
  type: string;
  title: string;
  message: string;
  channel?: Channel;
  metadata?: Record<string, unknown>;
}) {
  const users = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.isActive, true), eq(usersTable.role, opts.role)));
  if (users.length === 0) return;
  await db.insert(notificationsTable).values(
    users.map(u => ({
      userId: u.id,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      channel: (opts.channel ?? "in_app") as Channel,
      readStatus: false,
      metadataJson: opts.metadata ? JSON.stringify(opts.metadata) : null,
    }))
  );
}

export async function notifyChildCheckedIn(childId: number, classId: number, serviceSlot: string) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) return;
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, classId));
  const className = cls?.name ?? "class";

  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
  const parentIds: number[] = [];
  if (family?.parent1Id) parentIds.push(family.parent1Id);
  if (family?.parent2Id) parentIds.push(family.parent2Id);

  const now = new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

  for (const uid of parentIds) {
    await sendNotification({
      userId: uid,
      type: "child_checked_in",
      title: "Drop-off Confirmed",
      message: `${child.firstName} has been safely dropped off for the ${serviceSlot} service at ${now}. They will be escorted to ${className} shortly.`,
      metadata: { childId, classId, serviceSlot },
    });
  }
}

export async function notifyChildInTransit(childId: number, classId: number, serviceDate?: string) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) return;
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, classId));
  const className = cls?.name ?? "class";

  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
  const parentIds: number[] = [];
  if (family?.parent1Id) parentIds.push(family.parent1Id);
  if (family?.parent2Id) parentIds.push(family.parent2Id);

  const today = serviceDate ?? new Date().toISOString().slice(0, 10);
  const hallActive = await isHallSessionActive(today);

  const message = hallActive
    ? `${child.firstName} is in the general hall for praise & worship — they will be escorted to ${className} after the session.`
    : `${child.firstName} is being escorted to ${className} right now.`;

  for (const uid of parentIds) {
    await sendNotification({
      userId: uid,
      type: "child_in_transit",
      title: hallActive ? "Child in General Hall" : "Child En Route to Class",
      message,
      metadata: { childId, classId, hallSession: hallActive },
    });
  }
}

/**
 * Notify every teacher allocated to a class when a child is being escorted there (in_transit).
 * Respects class merges (routes to host class) and hall session flags (adjusts message text).
 */
export async function notifyTeachersChildInTransit(
  childId: number,
  classId: number,
  serviceDate?: string,
) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) return;

  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, classId));
  const homeClassName = cls?.name ?? "your class";

  const childName = `${child.firstName} ${child.lastName}`;
  const now = new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  const today = serviceDate ?? new Date().toISOString().slice(0, 10);

  // Check if this class is merged into another today — route to host class teachers if so.
  const mergeTarget = await getActiveMergeTarget(classId, today);
  const routingClassId = mergeTarget?.targetClassId ?? classId;
  const routingClassName = mergeTarget?.targetClassName ?? homeClassName;

  // Check if a hall session is active — if so, adjust the message.
  const hallActive = await isHallSessionActive(today);

  let allocations = await db
    .select()
    .from(teacherAllocationsTable)
    .where(and(
      eq(teacherAllocationsTable.classId, routingClassId),
      eq(teacherAllocationsTable.serviceDate, today),
    ));

  if (allocations.length === 0) {
    allocations = await db
      .select()
      .from(teacherAllocationsTable)
      .where(eq(teacherAllocationsTable.classId, routingClassId))
      .orderBy(teacherAllocationsTable.serviceDate)
      .limit(5);
  }

  if (allocations.length === 0) {
    logger.warn({ classId, routingClassId, today }, "notifyTeachersChildInTransit: no allocations found — no teacher notified");
    return;
  }

  // Build the notification text
  const childLabel = mergeTarget
    ? `${childName} (from ${homeClassName})`
    : childName;

  let message: string;
  if (hallActive) {
    message = `${childLabel} will be brought to ${routingClassName} after the hall session — please expect them shortly.`;
  } else {
    message = `${childLabel} is being escorted to ${routingClassName} right now — expect them shortly (${now}).`;
  }

  const title = hallActive ? "Child Coming From Hall Session" : "Child En Route to Your Class";

  const seenTeacherIds = new Set<number>();
  for (const alloc of allocations) {
    if (seenTeacherIds.has(alloc.teacherId)) continue;
    seenTeacherIds.add(alloc.teacherId);

    const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.id, alloc.teacherId));
    if (!teacher) continue;

    logger.info(
      { teacherId: alloc.teacherId, userId: teacher.userId, childId, classId, routingClassId, hallActive },
      "notifyTeachersChildInTransit: sending notification",
    );

    await sendNotification({
      userId: teacher.userId,
      type: "child_in_transit",
      title,
      message,
      metadata: { childId, classId, routingClassId, serviceDate, hallSession: hallActive, merged: !!mergeTarget },
    });
  }
}

export async function notifyChildArrivedInClass(childId: number, classId: number) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) return;
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, classId));
  const className = cls?.name ?? "class";

  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
  const parentIds: number[] = [];
  if (family?.parent1Id) parentIds.push(family.parent1Id);
  if (family?.parent2Id) parentIds.push(family.parent2Id);

  let teacherName: string | null = null;
  if (cls) {
    const [alloc] = await db
      .select()
      .from(teacherAllocationsTable)
      .where(eq(teacherAllocationsTable.classId, cls.id))
      .limit(1);
    if (alloc) {
      const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.id, alloc.teacherId));
      if (teacher) {
        const [u] = await db.select().from(usersTable).where(eq(usersTable.id, teacher.userId));
        if (u) teacherName = `${u.firstName} ${u.lastName}`;
      }
    }
  }

  for (const uid of parentIds) {
    await sendNotification({
      userId: uid,
      type: "child_arrived_in_class",
      title: "Child Safely in Class",
      message: teacherName
        ? `${child.firstName} is now safely in ${className} with Teacher ${teacherName}. Have a blessed service!`
        : `${child.firstName} is now safely in ${className}. Have a blessed service!`,
      metadata: { childId, classId, teacherName },
    });
  }
}

/**
 * Notify every teacher allocated to a class when a child is dropped off.
 * Matches on classId + serviceSlot. If a serviceDate is provided it also
 * filters by date, otherwise it is omitted (useful for walk-in check-ins
 * where the date is today and already correct on the allocation).
 */
export async function notifyTeachersChildDroppedOff(
  childId: number,
  classId: number,
  serviceSlot: string,
  serviceDate?: string,
) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) return;

  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, classId));
  const className = cls?.name ?? "your class";

  const childName = `${child.firstName} ${child.lastName}`;
  const now = new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

  // Find teachers allocated to this class for this date (any slot).
  // If no date-specific allocation found, fall back to any allocation for this class.
  const today = serviceDate ?? new Date().toISOString().slice(0, 10);
  let allocations = await db
    .select()
    .from(teacherAllocationsTable)
    .where(and(
      eq(teacherAllocationsTable.classId, classId),
      eq(teacherAllocationsTable.serviceDate, today),
    ));

  logger.info({ classId, today, count: allocations.length }, "notifyTeachersChildDroppedOff: allocations found for date");

  // Fallback: use any allocation for this class if none found for today
  if (allocations.length === 0) {
    allocations = await db
      .select()
      .from(teacherAllocationsTable)
      .where(eq(teacherAllocationsTable.classId, classId))
      .orderBy(teacherAllocationsTable.serviceDate)
      .limit(5);
    logger.info({ classId, count: allocations.length }, "notifyTeachersChildDroppedOff: fallback allocations found");
  }

  if (allocations.length === 0) {
    logger.warn({ classId, today }, "notifyTeachersChildDroppedOff: no allocations found for class — no teacher notified");
    return;
  }

  // Deduplicate by teacherId so a teacher scheduled for both slots only gets one notification
  const seenTeacherIds = new Set<number>();
  for (const alloc of allocations) {
    if (seenTeacherIds.has(alloc.teacherId)) continue;
    seenTeacherIds.add(alloc.teacherId);

    const [teacher] = await db
      .select()
      .from(teachersTable)
      .where(eq(teachersTable.id, alloc.teacherId));
    if (!teacher) {
      logger.warn({ teacherId: alloc.teacherId }, "notifyTeachersChildDroppedOff: teacher record not found");
      continue;
    }

    logger.info({ teacherId: alloc.teacherId, userId: teacher.userId, childId, classId }, "notifyTeachersChildDroppedOff: sending notification");

    await sendNotification({
      userId: teacher.userId,
      type: "child_dropped_off",
      title: "Child Dropped Off",
      message: `${childName} has just been dropped off for the ${serviceSlot} service and will be heading to ${className} shortly. Checked in at ${now}.`,
      metadata: { childId, classId, serviceSlot, serviceDate },
    });
  }
}

export async function notifyChildPickedUp(childId: number) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) return;

  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
  const parentIds: number[] = [];
  if (family?.parent1Id) parentIds.push(family.parent1Id);
  if (family?.parent2Id) parentIds.push(family.parent2Id);

  const now = new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

  for (const uid of parentIds) {
    await sendNotification({
      userId: uid,
      type: "child_picked_up",
      title: "Pick-up Confirmed",
      message: `${child.firstName} has been safely picked up at ${now}. God bless your family!`,
      metadata: { childId },
    });
  }
}

/**
 * Tiered emergency broadcast — L1 to L4 escalation tree.
 *
 * L1 — Local/Class level: teachers + admins only
 * L2 — Department: all staff (teachers, supports, admins) + child's parents if childId set
 * L3 — Building-wide: all staff + ALL parents of children currently checked in today
 * L4 — Full community / critical: every active user on the platform
 */
export async function broadcastEmergency(opts: {
  type: string;
  level: string;
  description: string;
  emergencyId: number;
  childId?: number | null;
  /**
   * When true, the alert is routed ONLY to admins/super_admins regardless of
   * level — used when a teacher (or other non-admin) reports an emergency.
   * Parents are never notified until an admin reviews and escalates it.
   */
  adminsOnly?: boolean;
}) {
  const levelLabel: Record<string, string> = {
    L1: "Local — Staff Alert",
    L2: "Department — Staff + Affected Parents",
    L3: "Building-Wide — All Staff & Checked-In Parents",
    L4: "CRITICAL — Full Community Evacuation",
  };

  const emoji: Record<string, string> = {
    medical: "🩺",
    missing_child: "🔍",
    fire_evacuation: "🔥",
    security: "🔒",
    general: "⚠️",
  };

  const typeLabel = opts.type.replace(/_/g, " ").toUpperCase();
  const icon = emoji[opts.type] ?? "⚠️";
  const title = `${icon} ${opts.level} EMERGENCY — ${typeLabel}`;
  const baseMessage = `${opts.description}. Level ${opts.level}: ${levelLabel[opts.level] ?? opts.level}.`;

  const meta = { emergencyId: opts.emergencyId, level: opts.level, type: opts.type };

  const insertNotifs = async (userIds: number[], message: string) => {
    if (userIds.length === 0) return;
    await db.insert(notificationsTable).values(
      userIds.map(uid => ({
        userId: uid,
        type: "emergency_alert",
        title,
        message,
        channel: "in_app" as Channel,
        readStatus: false,
        metadataJson: JSON.stringify(meta),
      }))
    );
    Promise.allSettled(userIds.map(uid => dispatchExternal(uid, title, message))).then((results) => {
      const failed = results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.delivered));
      if (failed.length > 0) {
        logger.warn({ totalTargets: userIds.length, failedCount: failed.length, level: opts.level }, "broadcastEmergency: some external deliveries failed or were skipped");
      }
    }).catch((err) => {
      logger.warn({ err, level: opts.level }, "broadcastEmergency: external dispatch tracking failed");
    });
  };

  if (opts.adminsOnly) {
    // Teacher/staff-reported emergency — admins alone are alerted. They review
    // and escalate, which is what triggers any parent-facing broadcast.
    const allUsers = await db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable).where(eq(usersTable.isActive, true));
    const targets = allUsers.filter(u => u.role === "admin" || u.role === "super_admin").map(u => u.id);
    await insertNotifs(targets, `[STAFF REPORT — ADMIN REVIEW REQUIRED] ${baseMessage} Reported by staff; review and escalate if parents must be alerted.`);
    return;
  }

  if (opts.level === "L1") {
    // Teachers + Admins only
    const staffRoles = new Set(["teacher", "admin", "super_admin"]);
    const allUsers = await db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable).where(eq(usersTable.isActive, true));
    const targets = allUsers.filter(u => staffRoles.has(u.role)).map(u => u.id);
    await insertNotifs(targets, `[STAFF ONLY] ${baseMessage} Please respond immediately and report to your class coordinator.`);

  } else if (opts.level === "L2") {
    // All staff + child's parents if childId provided
    const allUsers = await db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable).where(eq(usersTable.isActive, true));
    const staffRoles = new Set(["teacher", "support", "admin", "super_admin"]);
    const targets = new Set(allUsers.filter(u => staffRoles.has(u.role)).map(u => u.id));

    if (opts.childId) {
      const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, opts.childId));
      if (child) {
        const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
        if (family?.parent1Id) targets.add(family.parent1Id);
        if (family?.parent2Id) targets.add(family.parent2Id);
      }
    }

    await insertNotifs(Array.from(targets), `[DEPARTMENT ALERT] ${baseMessage} All staff please respond. Affected parents have been notified.`);

  } else if (opts.level === "L3") {
    // All staff + all parents of children checked in today
    const today = new Date().toISOString().split("T")[0];
    const allUsers = await db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable).where(eq(usersTable.isActive, true));
    const staffRoles = new Set(["teacher", "support", "admin", "super_admin"]);
    const targets = new Set(allUsers.filter(u => staffRoles.has(u.role)).map(u => u.id));

    // Find all children checked in today (not yet picked up)
    const checkedInToday = await db
      .select({ childId: attendanceTable.childId })
      .from(attendanceTable)
      .where(eq(attendanceTable.serviceDate, today));

    const childIds = [...new Set(checkedInToday.map(r => r.childId))];
    for (const cid of childIds) {
      const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, cid));
      if (!child) continue;
      const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
      if (family?.parent1Id) targets.add(family.parent1Id);
      if (family?.parent2Id) targets.add(family.parent2Id);
    }

    await insertNotifs(Array.from(targets), `[BUILDING-WIDE ALERT] ${baseMessage} All staff respond immediately. Parents of checked-in children have been notified.`);

  } else {
    // L4 — ALL active users
    const allUsers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.isActive, true));
    await insertNotifs(allUsers.map(u => u.id), `[CRITICAL — FULL COMMUNITY] ${baseMessage} All parents and staff: please respond immediately and follow emergency procedures.`);
  }
}
