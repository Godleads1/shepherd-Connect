import { Router } from "express";
import { eq, and, or, sql } from "drizzle-orm";
import { db, teacherAllocationsTable, teachersTable, classesTable, usersTable, notificationsTable } from "@workspace/db";
import { CreateTeacherAllocationBody, UpdateTeacherAllocationBody, ListTeacherAllocationsQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { sendNotification } from "../lib/notify";

const router = Router();

async function formatAllocation(a: typeof teacherAllocationsTable.$inferSelect) {
  const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.id, a.teacherId));
  let teacherWithUser = null;
  if (teacher) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, teacher.userId));
    teacherWithUser = { ...teacher, user: user ? { id: user.id, email: user.email, phone: user.phone, role: user.role, firstName: user.firstName, lastName: user.lastName, isActive: user.isActive, createdAt: user.createdAt } : null };
  }
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, a.classId));
  return { ...a, teacher: teacherWithUser, class: cls || null };
}

router.get("/teacher-allocations", authMiddleware, async (req, res): Promise<void> => {
  const params = ListTeacherAllocationsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { serviceDate, classId, teacherId } = params.data;
  const conditions = [];
  if (serviceDate) conditions.push(eq(teacherAllocationsTable.serviceDate, serviceDate));
  if (classId) conditions.push(eq(teacherAllocationsTable.classId, classId));
  if (teacherId) conditions.push(eq(teacherAllocationsTable.teacherId, teacherId));
  const allocations = await db.select().from(teacherAllocationsTable)
    .where(conditions.length ? and(...conditions) : undefined);
  const formatted = await Promise.all(allocations.map(formatAllocation));
  res.json(formatted);
});

router.post("/teacher-allocations", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateTeacherAllocationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [allocation] = await db.insert(teacherAllocationsTable).values(parsed.data).returning();
  res.status(201).json(await formatAllocation(allocation));
});

router.put("/teacher-allocations/:id", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = UpdateTeacherAllocationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const updates: Partial<typeof teacherAllocationsTable.$inferInsert> = {};
  if (parsed.data.status) updates.status = parsed.data.status as "scheduled" | "confirmed" | "completed" | "cancelled";
  if (parsed.data.teacherId) updates.teacherId = parsed.data.teacherId;
  if (parsed.data.classId) updates.classId = parsed.data.classId;
  if (parsed.data.serviceDate) updates.serviceDate = parsed.data.serviceDate;
  if (parsed.data.serviceSlot) updates.serviceSlot = parsed.data.serviceSlot as "7am" | "10:30am";
  const [allocation] = await db.update(teacherAllocationsTable).set(updates).where(eq(teacherAllocationsTable.id, id)).returning();
  if (!allocation) { res.status(404).json({ error: "Not found", message: "Allocation not found" }); return; }
  res.json(await formatAllocation(allocation));
});

router.delete("/teacher-allocations/:id", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [deleted] = await db.delete(teacherAllocationsTable).where(eq(teacherAllocationsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found", message: "Allocation not found" }); return; }
  res.json({ success: true, id });
});

router.get("/teacher-allocations/service-hours", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const teachers = await db.select().from(teachersTable);
  const result = await Promise.all(teachers.map(async (teacher) => {
    const allAllocs = await db.select().from(teacherAllocationsTable).where(eq(teacherAllocationsTable.teacherId, teacher.id));
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, teacher.userId));
    const totalServices = allAllocs.length;
    const completedServices = allAllocs.filter(a => a.status === "completed").length;
    const upcomingServices = allAllocs.filter(a => a.status === "scheduled").length;
    return { teacherId: teacher.id, teacherName: u ? `${u.firstName} ${u.lastName}` : "Unknown", totalAllocations: totalServices, completedServices, upcomingServices, estimatedHours: totalServices * 2 };
  }));
  result.sort((a, b) => b.totalAllocations - a.totalAllocations);
  res.json(result);
});

router.post("/teacher-allocations/auto-schedule", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { serviceDate, serviceSlots = ["7am", "10:30am"] } = req.body as { serviceDate: string; serviceSlots?: string[] };
  if (!serviceDate) { res.status(400).json({ error: "Bad request", message: "serviceDate is required" }); return; }

  const teachers = await db.select().from(teachersTable);
  const classes = await db.select().from(classesTable);

  if (teachers.length === 0 || classes.length === 0) {
    res.json({ success: true, created: 0, message: "No teachers or classes available" });
    return;
  }

  const teacherHours = await Promise.all(teachers.map(async (t) => {
    const allocs = await db.select().from(teacherAllocationsTable).where(eq(teacherAllocationsTable.teacherId, t.id));
    return { teacher: t, totalServices: allocs.length };
  }));
  teacherHours.sort((a, b) => a.totalServices - b.totalServices);

  const created: number[] = [];
  let teacherIdx = 0;

  for (const slot of serviceSlots) {
    for (const cls of classes) {
      const existing = await db.select().from(teacherAllocationsTable)
        .where(and(eq(teacherAllocationsTable.classId, cls.id), eq(teacherAllocationsTable.serviceDate, serviceDate), eq(teacherAllocationsTable.serviceSlot, slot)));
      if (existing.length > 0) continue;

      const assigned = teacherHours[teacherIdx % teacherHours.length];
      teacherIdx++;

      const [alloc] = await db.insert(teacherAllocationsTable).values({
        teacherId: assigned.teacher.id,
        classId: cls.id,
        serviceDate,
        serviceSlot: slot,
        status: "scheduled",
      }).returning();
      created.push(alloc.id);
      assigned.totalServices++;
      teacherHours.sort((a, b) => a.totalServices - b.totalServices);
    }
  }

  const adminUsers = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.isActive, true), eq(usersTable.role, "teacher")));
  await Promise.all(adminUsers.map(u => sendNotification({
    userId: u.id,
    type: "schedule_published",
    title: "New Schedule Published",
    message: `Your schedule for ${serviceDate} has been published. Please check your allocations.`,
    metadata: { serviceDate },
  })));

  res.json({ success: true, created: created.length, allocationIds: created, message: `Auto-scheduled ${created.length} teacher allocation(s) for ${serviceDate}` });
});

router.post("/teacher-allocations/:id/swap", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const { newTeacherId, reason } = req.body as { newTeacherId: number; reason?: string };
  if (!newTeacherId) { res.status(400).json({ error: "Bad request", message: "newTeacherId is required" }); return; }

  const [original] = await db.select().from(teacherAllocationsTable).where(eq(teacherAllocationsTable.id, id));
  if (!original) { res.status(404).json({ error: "Not found", message: "Allocation not found" }); return; }

  const [updated] = await db.update(teacherAllocationsTable).set({ teacherId: newTeacherId }).where(eq(teacherAllocationsTable.id, id)).returning();
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, original.classId));

  const [origTeacher] = await db.select().from(teachersTable).where(eq(teachersTable.id, original.teacherId));
  const [newTeacherRec] = await db.select().from(teachersTable).where(eq(teachersTable.id, newTeacherId));

  const notifyIds: number[] = [];
  if (origTeacher) notifyIds.push(origTeacher.userId);
  if (newTeacherRec) notifyIds.push(newTeacherRec.userId);

  for (const uid of notifyIds) {
    const isOld = origTeacher && uid === origTeacher.userId;
    await sendNotification({
      userId: uid,
      type: "schedule_swap",
      title: "Schedule Change",
      message: isOld
        ? `You have been swapped out of ${cls?.name || "class"} on ${original.serviceDate} (${original.serviceSlot}).${reason ? " Reason: " + reason : ""}`
        : `You have been assigned to ${cls?.name || "class"} on ${original.serviceDate} (${original.serviceSlot}).${reason ? " Reason: " + reason : ""}`,
      metadata: { allocationId: id, serviceDate: original.serviceDate, serviceSlot: original.serviceSlot },
    });
  }

  res.json(await formatAllocation(updated));
});

router.post("/teacher-allocations/:id/mark-unavailable", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const { reason } = req.body as { reason?: string };

  const [alloc] = await db.select().from(teacherAllocationsTable).where(eq(teacherAllocationsTable.id, id));
  if (!alloc) { res.status(404).json({ error: "Not found", message: "Allocation not found" }); return; }

  const [updated] = await db.update(teacherAllocationsTable)
    .set({ status: "cancelled" })
    .where(eq(teacherAllocationsTable.id, id)).returning();

  const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.id, alloc.teacherId));
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, alloc.classId));
  let teacherName = "A teacher";
  if (teacher) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, teacher.userId));
    if (u) teacherName = `${u.firstName} ${u.lastName}`;
  }

  const admins = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.isActive, true), or(eq(usersTable.role, "admin"), eq(usersTable.role, "super_admin"))));

  await Promise.all(admins.map(a => sendNotification({
    userId: a.id,
    type: "teacher_unavailable",
    title: "⚠️ Teacher Unavailable — Substitute Needed",
    message: `${teacherName} is unavailable for ${cls?.name || "class"} on ${alloc.serviceDate} (${alloc.serviceSlot}).${reason ? " Reason: " + reason : ""} Please assign a substitute.`,
    metadata: { allocationId: id, teacherId: alloc.teacherId, classId: alloc.classId, serviceDate: alloc.serviceDate },
  })));

  res.json({ ...await formatAllocation(updated), teacherName, className: cls?.name, adminNotified: admins.length });
});

export default router;
