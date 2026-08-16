import { Router } from "express";
import { eq, and, ne, lt, inArray } from "drizzle-orm";
import { db, attendanceTable, childrenTable, classesTable, familiesTable, usersTable, notificationsTable, teachersTable, teacherAllocationsTable, hallSessionsTable, dropOffIntentsTable } from "@workspace/db";
import { CheckInBody, CheckOutBody, ListAttendanceQueryParams, ScanQrCodeBody } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { notifyChildCheckedIn, notifyChildInTransit, notifyChildArrivedInClass, notifyChildPickedUp, notifyTeachersChildDroppedOff, notifyTeachersChildInTransit, notifyTeachersChildPickedUp, sendNotification } from "../lib/notify";
import { smsChildCheckedIn, smsChildCheckedOut, smsPreDismissal, emailChildCheckedIn, emailChildCheckedOut } from "../services/sms";
import { pushToUsers } from "../services/push";
import { getParentChildIds } from "../lib/parentScope";

async function getParentContacts(childId: number): Promise<{ phones: (string | null)[]; emails: (string | null)[]; parentIds: number[]; childName: string; className: string }> {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) return { phones: [], emails: [], parentIds: [], childName: "Your child", className: "class" };

  const childName = `${child.firstName} ${child.lastName}`;

  let className = "class";
  if (child.currentClassId) {
    const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, child.currentClassId));
    if (cls) className = cls.name;
  }

  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
  if (!family) return { phones: [], emails: [], parentIds: [], childName, className };

  // Batch both parents in one query instead of two separate queries
  const parentIds = [family.parent1Id, family.parent2Id].filter(Boolean) as number[];
  const parents = parentIds.length
    ? await db.select({ phone: usersTable.phone, email: usersTable.email }).from(usersTable)
        .where(inArray(usersTable.id, parentIds))
    : [];

  return { phones: parents.map(p => p.phone), emails: parents.map(p => p.email), parentIds, childName, className };
}

const router = Router();

/** Returns the class IDs a teacher is allocated to for today. Empty = not assigned. */
async function getTeacherAllocatedClassIds(userId: number): Promise<number[]> {
  const today = new Date().toISOString().slice(0, 10);
  const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.userId, userId));
  if (!teacher) return [];
  const allocs = await db
    .select({ classId: teacherAllocationsTable.classId })
    .from(teacherAllocationsTable)
    .where(and(
      eq(teacherAllocationsTable.teacherId, teacher.id),
      eq(teacherAllocationsTable.serviceDate, today),
    ));
  return allocs.map(a => a.classId);
}

// Single-record formatter (for mutation responses — only 1 record, so no N+1)
async function formatAttendance(a: typeof attendanceTable.$inferSelect) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, a.childId));
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, a.classId));
  return { ...a, child: child || null, class: cls || null };
}

// Batch formatter for lists — avoids N+1 queries
async function formatAttendanceBatch(records: (typeof attendanceTable.$inferSelect)[]) {
  if (records.length === 0) return [];
  const childIds = [...new Set(records.map(r => r.childId))];
  const classIds = [...new Set(records.map(r => r.classId))];
  const [children, classes] = await Promise.all([
    db.select().from(childrenTable).where(inArray(childrenTable.id, childIds)),
    db.select().from(classesTable).where(inArray(classesTable.id, classIds)),
  ]);
  const childMap = Object.fromEntries(children.map(c => [c.id, c]));
  const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
  return records.map(a => ({ ...a, child: childMap[a.childId] ?? null, class: classMap[a.classId] ?? null }));
}

router.get("/attendance", authMiddleware, async (req, res): Promise<void> => {
  const params = ListAttendanceQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { classId, childId, serviceDate, serviceSlot, status } = params.data;
  const conditions = [];

  // Teachers may only see attendance for classes they are allocated to today.
  if (req.user!.role === "teacher") {
    const allocatedClassIds = await getTeacherAllocatedClassIds(req.user!.userId);
    if (allocatedClassIds.length === 0) {
      res.json([]);
      return;
    }
    if (classId !== undefined) {
      if (!allocatedClassIds.includes(classId)) {
        res.status(403).json({ error: "Forbidden", message: "You are not allocated to this class today" });
        return;
      }
      conditions.push(eq(attendanceTable.classId, classId));
    } else {
      conditions.push(inArray(attendanceTable.classId, allocatedClassIds));
    }
  } else {
    if (classId) conditions.push(eq(attendanceTable.classId, classId));
  }

  // Parents may only see attendance for their own children.
  if (req.user!.role === "parent") {
    const ownChildIds = await getParentChildIds(req.user!.userId);
    if (ownChildIds.length === 0) { res.json([]); return; }
    if (childId !== undefined) {
      if (!ownChildIds.includes(childId)) {
        res.status(403).json({ error: "Forbidden", message: "Access denied" });
        return;
      }
      conditions.push(eq(attendanceTable.childId, childId));
    } else {
      conditions.push(inArray(attendanceTable.childId, ownChildIds));
    }
  } else if (childId) conditions.push(eq(attendanceTable.childId, childId));
  if (serviceDate) conditions.push(eq(attendanceTable.serviceDate, serviceDate));
  if (serviceSlot) conditions.push(eq(attendanceTable.serviceSlot, serviceSlot));
  if (status) conditions.push(eq(attendanceTable.status, status as "dropped_off" | "in_transit" | "in_class" | "picked_up"));
  const records = await db.select().from(attendanceTable)
    .where(conditions.length ? and(...conditions) : undefined);
  const formatted = await formatAttendanceBatch(records);
  res.json(formatted);
});

router.post("/attendance", authMiddleware, requireRoles("super_admin", "admin", "support", "attendant"), async (req, res): Promise<void> => {
  const parsed = CheckInBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { childId, classId, serviceDate, serviceSlot } = parsed.data;
  const [existing] = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.childId, childId), eq(attendanceTable.serviceDate, serviceDate), eq(attendanceTable.serviceSlot, serviceSlot)));
  if (existing) {
    if (existing.status === "picked_up") {
      // Child was already picked up — reset for a new drop-off (e.g. second service,
      // or correcting a premature checkout). Treat this as a fresh check-in.
      const [reset] = await db.update(attendanceTable).set({
        status: "dropped_off",
        checkInTime: new Date(),
        checkedInBy: req.user!.userId,
        checkOutTime: null,
        escortTime: null,
        classArrivalTime: null,
        confirmedByTeacherId: null,
      }).where(eq(attendanceTable.id, existing.id)).returning();
      notifyChildCheckedIn(childId, reset.classId, serviceSlot).catch((err) => {
        req.log.error({ err, childId, classId: reset.classId }, "notifyChildCheckedIn failed (re-checkin after pickup)");
      });
      notifyTeachersChildDroppedOff(childId, reset.classId, serviceSlot, serviceDate).catch((err) => {
        req.log.error({ err, childId, classId: reset.classId, serviceSlot, serviceDate }, "notifyTeachersChildDroppedOff failed (re-checkin after pickup)");
      });
      res.json(await formatAttendance(reset));
      return;
    }
    // Child is dropped_off or in_transit/in_class — re-notify teacher if still waiting
    if (existing.status === "dropped_off") {
      notifyTeachersChildDroppedOff(childId, existing.classId, serviceSlot, serviceDate).catch((err) => {
        req.log.error({ err, childId, classId: existing.classId }, "notifyTeachersChildDroppedOff failed (re-checkin)");
      });
    }
    res.json(await formatAttendance(existing));
    return;
  }
  // Use INSERT … RETURNING so the unique constraint (childId, serviceDate, serviceSlot) acts as
  // an atomic guard against concurrent check-ins by two staff members at the same moment.
  let record: typeof attendanceTable.$inferSelect;
  try {
    const [inserted] = await db.insert(attendanceTable).values({
      childId, classId, serviceDate, serviceSlot,
      checkedInBy: req.user!.userId,
      checkInTime: new Date(),
      status: "dropped_off",
    }).returning();
    record = inserted;
  } catch (err: any) {
    if (err?.code === "23505") {
      // Unique constraint violation — another staff member checked in this child a split-second ago.
      // Fetch and return the winning record so the UI still shows a success state.
      const [race] = await db.select().from(attendanceTable)
        .where(and(eq(attendanceTable.childId, childId), eq(attendanceTable.serviceDate, serviceDate), eq(attendanceTable.serviceSlot, serviceSlot)));
      if (race) { res.json(await formatAttendance(race)); return; }
    }
    throw err;
  }

  // Resolve any "on our way" signal for this family — they've arrived
  db.select().from(childrenTable).where(eq(childrenTable.id, childId)).then(async ([child]) => {
    if (!child?.familyId) return;
    await db.update(dropOffIntentsTable)
      .set({ status: "arrived" })
      .where(and(
        eq(dropOffIntentsTable.familyId, child.familyId),
        eq(dropOffIntentsTable.serviceDate, serviceDate),
        eq(dropOffIntentsTable.status, "on_the_way"),
      ));
  }).catch(() => {});

  notifyChildCheckedIn(childId, classId, serviceSlot).catch((err) => {
    req.log.error({ err, childId, classId }, "notifyChildCheckedIn failed");
  });
  notifyTeachersChildDroppedOff(childId, classId, serviceSlot, serviceDate).catch((err) => {
    req.log.error({ err, childId, classId, serviceSlot, serviceDate }, "notifyTeachersChildDroppedOff failed");
  });

  getParentContacts(childId).then(({ phones, emails, parentIds, childName, className }) => {
    smsChildCheckedIn(phones, childName, className, serviceSlot, req.log).catch(() => {});
    emailChildCheckedIn(emails, childName, className, serviceSlot, req.log).catch(() => {});
    pushToUsers(parentIds, {
      title: "✅ Child Checked In",
      body: `${childName} has been checked in to ${className} (${serviceSlot ?? "service"}).`,
      icon: "/pwa-192.png",
      url: "/my-children",
    }, req.log).catch(() => {});
  }).catch(() => {});

  res.status(201).json(await formatAttendance(record));
});

/**
 * POST /attendance/bulk-escort
 * Transitions ALL dropped_off children for today → in_transit in one action.
 * Fires parent + teacher notifications for each child asynchronously.
 * Also clears any active hall session for today so future en-route messages
 * revert to the normal "being escorted to class" wording.
 */
router.post("/attendance/bulk-escort", authMiddleware, requireRoles("super_admin", "admin", "support", "attendant"), async (req, res): Promise<void> => {
  const { serviceDate, serviceSlot } = req.body as { serviceDate?: string; serviceSlot?: "7am" | "10:30am" };
  const today = serviceDate ?? new Date().toISOString().slice(0, 10);
  const now = new Date();

  const conditions = [
    eq(attendanceTable.serviceDate, today),
    eq(attendanceTable.status, "dropped_off"),
  ];
  if (serviceSlot) conditions.push(eq(attendanceTable.serviceSlot, serviceSlot));

  const records = await db
    .update(attendanceTable)
    .set({ status: "in_transit", escortTime: now, escortedBy: req.user!.userId })
    .where(and(...conditions))
    .returning();

  // Fire all parent + teacher notifications asynchronously — don't block the response
  for (const record of records) {
    notifyChildInTransit(record.childId, record.classId, today).catch(() => {});
    notifyTeachersChildInTransit(record.childId, record.classId, today).catch((err) => {
      req.log.error({ err, childId: record.childId, classId: record.classId }, "bulk-escort: notifyTeachersChildInTransit failed");
    });
  }

  // Auto-clear the hall session for today so subsequent escort notifications
  // revert to normal wording ("being escorted to class")
  db.delete(hallSessionsTable)
    .where(eq(hallSessionsTable.serviceDate, today))
    .catch((err) => req.log.warn({ err }, "bulk-escort: could not clear hall sessions"));

  req.log.info({ count: records.length, today, serviceSlot }, "bulk-escort: dispatched all dropped-off children");
  res.json({ success: true, count: records.length });
});

router.put("/attendance/:id/escort", authMiddleware, requireRoles("super_admin", "admin", "support", "attendant"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [record] = await db.update(attendanceTable).set({
    status: "in_transit",
    escortTime: new Date(),
    escortedBy: req.user!.userId,
  }).where(and(eq(attendanceTable.id, id), eq(attendanceTable.status, "dropped_off"))).returning();
  if (!record) { res.status(404).json({ error: "Not found", message: "Attendance record not found or not in dropped_off state" }); return; }

  notifyChildInTransit(record.childId, record.classId).catch(() => {});
  notifyTeachersChildInTransit(record.childId, record.classId).catch((err) => {
    req.log.error({ err, childId: record.childId, classId: record.classId }, "notifyTeachersChildInTransit failed");
  });

  res.json(await formatAttendance(record));
});

/**
 * POST /attendance/bulk-arrive
 * Confirms ALL in_transit children for a given class → in_class in one action.
 * Teachers use this after a bulk escort so they don't have to tap each child individually.
 * Fires notifyChildArrivedInClass for every confirmed child.
 */
router.post("/attendance/bulk-arrive", authMiddleware, requireRoles("super_admin", "admin", "teacher", "support", "attendant"), async (req, res): Promise<void> => {
  const { classId, serviceDate } = req.body as { classId?: number; serviceDate?: string };
  if (!classId) { res.status(400).json({ error: "Bad request", message: "classId is required" }); return; }

  const today = serviceDate ?? new Date().toISOString().slice(0, 10);

  // Teachers may only confirm arrivals for their allocated class
  if (req.user!.role === "teacher") {
    const allocatedClassIds = await getTeacherAllocatedClassIds(req.user!.userId);
    if (!allocatedClassIds.includes(classId)) {
      res.status(403).json({ error: "Forbidden", message: "You are not allocated to this class today" });
      return;
    }
  }

  const records = await db
    .update(attendanceTable)
    .set({
      status: "in_class",
      classArrivalTime: new Date(),
      confirmedByTeacherId: req.user!.userId,
    })
    .where(and(
      eq(attendanceTable.classId, classId),
      eq(attendanceTable.serviceDate, today),
      // dropped_off children who never got the escort step can also be confirmed in bulk
      inArray(attendanceTable.status, ["in_transit", "dropped_off"]),
    ))
    .returning();

  for (const record of records) {
    notifyChildArrivedInClass(record.childId, record.classId).catch(() => {});
  }

  req.log.info({ count: records.length, classId, today }, "bulk-arrive: confirmed all in-transit children");
  res.json({ success: true, count: records.length });
});

/** Business day in West Africa Time (UTC+1). */
function todayWAT(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * GET /attendance/stale
 * Staff view of unresolved records from previous service days —
 * children still marked dropped_off / in_transit after the day ended.
 */
router.get("/attendance/stale", authMiddleware, requireRoles("super_admin", "admin", "support", "attendant"), async (_req, res): Promise<void> => {
  const records = await db.select().from(attendanceTable)
    .where(and(
      lt(attendanceTable.serviceDate, todayWAT()),
      inArray(attendanceTable.status, ["dropped_off", "in_transit"]),
    ));
  res.json(await Promise.all(records.map(formatAttendance)));
});

/**
 * POST /attendance/resolve-stale
 * Closes out all stale records from previous days by marking them picked_up.
 * The children clearly went home; the records were just never closed.
 * No parent notifications are sent (the pickup happened days ago).
 */
router.post("/attendance/resolve-stale", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const records = await db.update(attendanceTable)
    .set({
      status: "picked_up",
      checkOutTime: new Date(),
      checkedOutBy: req.user!.userId,
    })
    .where(and(
      lt(attendanceTable.serviceDate, todayWAT()),
      inArray(attendanceTable.status, ["dropped_off", "in_transit"]),
    ))
    .returning();

  req.log.info({ count: records.length, resolvedBy: req.user!.userId }, "resolve-stale: closed out stale attendance records");
  res.json({ success: true, count: records.length });
});

router.put("/attendance/:id/arrive", authMiddleware, requireRoles("super_admin", "admin", "teacher", "support", "attendant"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const [existing] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found", message: "Attendance record not found" }); return; }
  if (existing.status === "picked_up") { res.status(400).json({ error: "Bad request", message: "Child has already been picked up" }); return; }
  if (existing.status === "in_class") { res.json(await formatAttendance(existing)); return; }

  // Teachers may only confirm arrivals for children in their allocated class
  if (req.user!.role === "teacher") {
    const allocatedClassIds = await getTeacherAllocatedClassIds(req.user!.userId);
    if (!allocatedClassIds.includes(existing.classId)) {
      res.status(403).json({ error: "Forbidden", message: "You are not allocated to this class today" });
      return;
    }
  }

  const now = new Date();
  const [record] = await db.update(attendanceTable).set({
    status: "in_class",
    classArrivalTime: now,
    confirmedByTeacherId: req.user!.userId,
  }).where(eq(attendanceTable.id, id)).returning();

  notifyChildArrivedInClass(record.childId, record.classId).catch(() => {});

  res.json(await formatAttendance(record));
});

router.put("/attendance/:id/checkout", authMiddleware, requireRoles("super_admin", "admin", "support", "attendant"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = CheckOutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [record] = await db.update(attendanceTable).set({
    status: "picked_up",
    checkOutTime: new Date(),
    checkedOutBy: req.user!.userId,
  }).where(eq(attendanceTable.id, id)).returning();
  if (!record) { res.status(404).json({ error: "Not found", message: "Attendance record not found" }); return; }

  notifyChildPickedUp(record.childId).catch(() => {});
  notifyTeachersChildPickedUp(record.childId, record.classId).catch(() => {});

  getParentContacts(record.childId).then(({ phones, emails, parentIds, childName }) => {
    smsChildCheckedOut(phones, childName, req.log).catch(() => {});
    emailChildCheckedOut(emails, childName, req.log).catch(() => {});
    pushToUsers(parentIds, {
      title: "🎉 Child Picked Up",
      body: `${childName} has been successfully checked out. Safe journey home!`,
      icon: "/pwa-192.png",
      url: "/my-children",
    }, req.log).catch(() => {});
  }).catch(() => {});

  res.json(await formatAttendance(record));
});

router.post("/attendance/scan-qr", authMiddleware, async (req, res): Promise<void> => {
  const parsed = ScanQrCodeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { qrCode, serviceDate, serviceSlot } = parsed.data;
  let family = null;
  let children: typeof childrenTable.$inferSelect[] = [];
  const qrParts = qrCode.trim().split(":");
  if (qrParts[0] === "QR" && qrParts.length >= 2) {
    const familyId = parseInt(qrParts[1], 10);
    if (!isNaN(familyId)) {
      const [f] = await db.select().from(familiesTable).where(eq(familiesTable.id, familyId));
      family = f ?? null;
      if (family) children = await db.select().from(childrenTable).where(eq(childrenTable.familyId, familyId));
    }
  }
  if (!family && qrCode.trim().toUpperCase().startsWith("FAM-")) {
    const code = qrCode.trim().toUpperCase();
    const [f] = await db.select().from(familiesTable).where(eq(familiesTable.familyCode, code));
    family = f ?? null;
    if (family) children = await db.select().from(childrenTable).where(eq(childrenTable.familyId, family.id));
  }
  if (!family) {
    res.status(404).json({ error: "Not found", message: "QR code not recognized" });
    return;
  }
  const alerts: string[] = [];
  const childrenWithDetails = await Promise.all(children.map(async (child) => {
    const dob = new Date(child.dob);
    const now = new Date();
    const age = now.getFullYear() - dob.getFullYear() -
      (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
    if (child.allergies) alerts.push(`${child.firstName} has allergies: ${child.allergies}`);
    if (child.medicalNotes) alerts.push(`${child.firstName} has medical notes`);
    let currentClass = null;
    if (child.currentClassId) {
      const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, child.currentClassId));
      currentClass = cls || null;
    }
    const recentAttendance = await db.select().from(attendanceTable)
      .where(eq(attendanceTable.childId, child.id))
      .orderBy(attendanceTable.serviceDate)
      .limit(5);
    // Auto-heal: if still unassigned, assign by age now and persist
    if (!currentClass && age >= 1 && age <= 12) {
      const [matched] = await db.select().from(classesTable).where(eq(classesTable.ageMin, age));
      if (matched) {
        await db.update(childrenTable).set({ currentClassId: matched.id }).where(eq(childrenTable.id, child.id));
        currentClass = matched;
      }
    }
    const lastAttendance = recentAttendance.length > 0 ? recentAttendance[recentAttendance.length - 1] : null;
    return { ...child, age, currentClass, teacher: null, lastAttendance, attendanceHistory: recentAttendance };
  }));
  // Enrich family with parent name for the check-in UI
  let parent1: { firstName: string; lastName: string } | null = null;
  if (family.parent1Id) {
    const [u] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, family.parent1Id));
    if (u) parent1 = u;
  }
  res.json({ family: { ...family, parent1 }, children: childrenWithDetails, hasAlerts: alerts.length > 0, alerts });
});

router.post("/attendance/scan-face", authMiddleware, async (req, res): Promise<void> => {
  const { descriptor } = req.body as { descriptor: number[] };
  if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
    res.status(400).json({ error: "Bad request", message: "descriptor must be a 128-element float array" });
    return;
  }
  const allChildren = await db.select().from(childrenTable);
  const enrolled = allChildren.filter(c => c.faceDescriptorJson);

  let bestMatch: typeof childrenTable.$inferSelect | null = null;
  let bestDist = Infinity;

  for (const child of enrolled) {
    try {
      const stored: number[] = JSON.parse(child.faceDescriptorJson!);
      if (stored.length !== 128) continue;
      const dist = Math.sqrt(stored.reduce((sum, v, i) => sum + Math.pow(v - descriptor[i], 2), 0));
      if (dist < bestDist) { bestDist = dist; bestMatch = child; }
    } catch { continue; }
  }

  if (!bestMatch || bestDist > 0.6) {
    res.status(404).json({ error: "Not found", message: "No matching child found" });
    return;
  }

  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, bestMatch.familyId));
  if (!family) { res.status(404).json({ error: "Not found", message: "Family not found" }); return; }

  const familyChildren = await db.select().from(childrenTable).where(eq(childrenTable.familyId, family.id));
  const alerts: string[] = [];
  const childrenWithDetails = await Promise.all(familyChildren.map(async (child) => {
    const dob = new Date(child.dob);
    const now = new Date();
    const age = now.getFullYear() - dob.getFullYear() -
      (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
    if (child.allergies) alerts.push(`${child.firstName} has allergies: ${child.allergies}`);
    if (child.medicalNotes) alerts.push(`${child.firstName} has medical notes`);
    let currentClass = null;
    if (child.currentClassId) {
      const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, child.currentClassId));
      currentClass = cls || null;
    }
    const recentAttendance = await db.select().from(attendanceTable)
      .where(eq(attendanceTable.childId, child.id))
      .orderBy(attendanceTable.serviceDate)
      .limit(5);
    const lastAttendance = recentAttendance.length > 0 ? recentAttendance[recentAttendance.length - 1] : null;
    return { ...child, age, currentClass, teacher: null, lastAttendance, attendanceHistory: recentAttendance };
  }));

  res.json({ family, children: childrenWithDetails, hasAlerts: alerts.length > 0, alerts, matchedChildId: bestMatch.id, confidence: Math.max(0, Math.round((1 - bestDist / 0.6) * 100)) });
});

// ─── Late Pickup Alerts ───────────────────────────────────────────────────────
router.post("/attendance/late-pickup-alerts", authMiddleware, requireRoles("super_admin", "admin", "support"), async (req, res): Promise<void> => {
  const { serviceDate, serviceSlot } = req.body as { serviceDate?: string; serviceSlot?: string };
  const today = serviceDate || new Date().toISOString().split("T")[0];

  const conditions = [
    eq(attendanceTable.serviceDate, today),
    ne(attendanceTable.status, "picked_up"),
  ];
  if (serviceSlot) conditions.push(eq(attendanceTable.serviceSlot, serviceSlot));

  const presentRecords = await db.select().from(attendanceTable).where(and(...conditions));

  let notified = 0;
  for (const record of presentRecords) {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, record.childId));
    if (!child) continue;
    const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
    if (!family) continue;
    const parentIds = [family.parent1Id, family.parent2Id].filter(Boolean) as number[];
    for (const parentId of parentIds) {
      await sendNotification({
        userId: parentId,
        type: "late_pickup_reminder",
        title: "Late Pickup Reminder",
        message: `${child.firstName} ${child.lastName} is still at church and hasn't been picked up yet. Please collect them as soon as possible.`,
      });
      notified++;
    }
  }

  res.json({ ok: true, childrenStillPresent: presentRecords.length, notificationsSent: notified });
});

// ─── Attendance Trends ────────────────────────────────────────────────────────
router.get("/attendance/trends", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { weeks = "12" } = req.query as { weeks?: string };
  const numWeeks = Math.min(parseInt(weeks, 10) || 12, 52);

  const now = new Date();
  const trends: { week: string; label: string; total: number; firstService: number; secondService: number; uniqueChildren: number }[] = [];

  for (let i = numWeeks - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - i * 7);
    const dateStr = weekStart.toISOString().split("T")[0];
    const label = weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    const dayRecords = await db.select().from(attendanceTable).where(eq(attendanceTable.serviceDate, dateStr));
    const firstService = dayRecords.filter(r => r.serviceSlot === "7am").length;
    const secondService = dayRecords.filter(r => r.serviceSlot === "10:30am").length;
    const uniqueChildren = new Set(dayRecords.map(r => r.childId)).size;

    trends.push({ week: dateStr, label, total: dayRecords.length, firstService, secondService, uniqueChildren });
  }

  res.json({ weeks: numWeeks, trends });
});

export default router;
