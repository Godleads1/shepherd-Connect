import { Router } from "express";
import { eq, and, or } from "drizzle-orm";
import { db, teacherAllocationsTable, teachersTable, classesTable, usersTable } from "@workspace/db";
import { CreateTeacherAllocationBody, UpdateTeacherAllocationBody, ListTeacherAllocationsQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { createNotificationDelivery, type OutboxExecutor } from "../services/notificationOutbox";

const router = Router();

type AllocationReader = Pick<typeof db, "select">;

async function formatAllocation(reader: AllocationReader, a: typeof teacherAllocationsTable.$inferSelect) {
  const [teacher] = await reader.select().from(teachersTable).where(eq(teachersTable.id, a.teacherId));
  let teacherWithUser = null;
  if (teacher) {
    const [user] = await reader.select().from(usersTable).where(eq(usersTable.id, teacher.userId));
    teacherWithUser = { ...teacher, user: user ? { id: user.id, email: user.email, phone: user.phone, role: user.role, firstName: user.firstName, lastName: user.lastName, isActive: user.isActive, createdAt: user.createdAt } : null };
  }
  const [cls] = await reader.select().from(classesTable).where(eq(classesTable.id, a.classId));
  return { ...a, teacher: teacherWithUser, class: cls || null };
}

async function createAllocationNotification(
  tx: OutboxExecutor,
  input: {
    identity: string;
    domainIdentifier: string;
    userId: number;
    type: string;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  },
) {
  await createNotificationDelivery(tx, {
    logicalIdentity: input.identity,
    domainType: "teacher_allocation",
    domainIdentifier: input.domainIdentifier,
    projection: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: input.metadata,
    },
    channels: ["whatsapp"],
    templateKey: input.type,
  });
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
  const formatted = await Promise.all(allocations.map(a => formatAllocation(db, a)));
  res.json(formatted);
});

router.post("/teacher-allocations", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateTeacherAllocationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  // AUTHORITATIVE: allocation insert. RESPONSE ENRICHMENT is required by the
  // response contract, so all formatter reads occur before the insert commits.
  // This endpoint has no idempotency key: a lost 201 can still prompt a retry;
  // the existing unique allocation constraint is the only duplicate guard.
  const result = await db.transaction(async tx => {
    const [allocation] = await tx.insert(teacherAllocationsTable).values(parsed.data).onConflictDoNothing().returning();
    return allocation ? { allocation, formatted: await formatAllocation(tx, allocation) } : null;
  });
  if (!result) {
    res.status(409).json({ error: "Conflict", message: "This teacher is already allocated to a class for this date and slot." });
    return;
  }
  res.status(201).json(result.formatted);
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
  // AUTHORITATIVE: allocation update. RESPONSE ENRICHMENT: required formatter
  // reads are in the same transaction so read failure cannot follow a commit.
  const result = await db.transaction(async tx => {
    const [allocation] = await tx.update(teacherAllocationsTable).set(updates).where(eq(teacherAllocationsTable.id, id)).returning();
    return allocation ? { allocation, formatted: await formatAllocation(tx, allocation) } : null;
  });
  if (!result) { res.status(404).json({ error: "Not found", message: "Allocation not found" }); return; }
  res.json(result.formatted);
});

router.delete("/teacher-allocations/:id", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  await db.delete(teacherAllocationsTable).where(eq(teacherAllocationsTable.id, id));
  res.json({ success: true, id });
});

// Assign a duty roster — picks teachers by their permanent class for a specific Sunday
router.post("/teacher-allocations/assign-duty", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { serviceDate, serviceSlots = ["7am", "10:30am"], teacherIds } = req.body as {
    serviceDate: string; serviceSlots?: string[]; teacherIds: number[];
  };
  if (!serviceDate) { res.status(400).json({ error: "Bad request", message: "serviceDate is required" }); return; }
  if (!Array.isArray(teacherIds) || teacherIds.length === 0) {
    res.status(400).json({ error: "Bad request", message: "teacherIds must be a non-empty array" }); return;
  }

  const created: number[] = [];
  const noClass: string[] = [];

  // PARTIAL-MULTI-WRITE COMMAND: each allocation remains its own transaction,
  // preserving the existing partial-batch behavior. The assignment message is
  // REQUIRED TRANSACTIONAL OUTBOX/INTENT because success currently promises
  // the assigned teacher was notified and asks them to confirm.
  for (const teacherId of teacherIds) {
    const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.id, teacherId));
    if (!teacher) continue;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, teacher.userId));
    if (!user?.primaryClassId) {
      noClass.push(`${user?.firstName ?? "Unknown"} ${user?.lastName ?? ""}`);
      continue;
    }
    const classId = user.primaryClassId;
    const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, classId));

    for (const slot of serviceSlots) {
      // ON CONFLICT DO NOTHING is the atomic guard — the pre-check above reduces noise
      // but two concurrent requests can both pass it; the unique constraint catches the second.
      const alloc = await db.transaction(async tx => {
        const [inserted] = await tx.insert(teacherAllocationsTable).values({
          teacherId,
          classId,
          serviceDate,
          serviceSlot: slot,
          status: "scheduled",
        }).onConflictDoNothing().returning();
        if (!inserted) return null;
        await createAllocationNotification(tx, {
          identity: `teacher-allocation:${inserted.id}:duty-assigned`,
          domainIdentifier: String(inserted.id),
          userId: user.id,
          type: "schedule_published",
          title: "Sunday Duty Assigned",
          message: `You are on duty ${slot} on ${serviceDate}${cls ? ` — ${cls.name}` : ""}. Please log in to confirm.`,
          metadata: { serviceDate, serviceSlot: slot, allocationId: inserted.id },
        });
        return inserted;
      });
      if (!alloc) continue; // already allocated — silently skip
      created.push(alloc.id);
    }
  }

  const warnings = noClass.length > 0
    ? [`${noClass.join(", ")} skipped — no permanent class assigned. Use "Add Allocation" to schedule them manually.`]
    : [];

  res.json({
    success: true,
    created: created.length,
    allocationIds: created,
    warnings,
    message: `${created.length} allocation(s) created for ${serviceDate}.${warnings.length ? " " + warnings[0] : ""}`,
  });
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
  const { serviceDate, serviceSlots = ["7am", "10:30am"], teachersPerClass = 1 } = req.body as { serviceDate: string; serviceSlots?: string[]; teachersPerClass?: number };
  if (!serviceDate) { res.status(400).json({ error: "Bad request", message: "serviceDate is required" }); return; }
  const perClass = Math.max(1, Math.floor(teachersPerClass));

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
  const notifiedUserIds = new Set<number>();
  let teacherIdx = 0;

  // PARTIAL-MULTI-WRITE COMMAND: retain one commit boundary per allocation.
  // Schedule publication is REQUIRED TRANSACTIONAL OUTBOX/INTENT; the first
  // allocation for each teacher in this invocation owns the batch notification.
  for (const slot of serviceSlots) {
    for (const cls of classes) {
      // Count how many teachers are already assigned to this class/slot
      const existing = await db.select().from(teacherAllocationsTable)
        .where(and(eq(teacherAllocationsTable.classId, cls.id), eq(teacherAllocationsTable.serviceDate, serviceDate), eq(teacherAllocationsTable.serviceSlot, slot)));
      const needed = perClass - existing.length;
      if (needed <= 0) continue; // already has enough teachers

      for (let i = 0; i < needed; i++) {
        // Skip teachers already allocated in this slot (prevent same teacher in two classes)
        let attempts = 0;
        while (attempts < teacherHours.length) {
          const candidate = teacherHours[teacherIdx % teacherHours.length];
          const alreadyBooked = await db.select().from(teacherAllocationsTable)
            .where(and(
              eq(teacherAllocationsTable.teacherId, candidate.teacher.id),
              eq(teacherAllocationsTable.serviceDate, serviceDate),
              eq(teacherAllocationsTable.serviceSlot, slot)
            ));
          if (alreadyBooked.length === 0) break;
          teacherIdx++;
          attempts++;
        }
        if (attempts >= teacherHours.length) break; // no available teachers left
        const assigned = teacherHours[teacherIdx % teacherHours.length];
        teacherIdx++;

        const shouldNotify = !notifiedUserIds.has(assigned.teacher.userId);
        const alloc = await db.transaction(async tx => {
          const [inserted] = await tx.insert(teacherAllocationsTable).values({
            teacherId: assigned.teacher.id,
            classId: cls.id,
            serviceDate,
            serviceSlot: slot,
            status: "scheduled",
          }).onConflictDoNothing().returning();
          if (!inserted) return null;
          if (shouldNotify) {
            await createAllocationNotification(tx, {
              identity: `teacher-allocation:${inserted.id}:auto-schedule-published`,
              domainIdentifier: String(inserted.id),
              userId: assigned.teacher.userId,
              type: "schedule_published",
              title: "New Schedule Published",
              message: `Your schedule for ${serviceDate} has been published. Please check your allocations.`,
              metadata: { serviceDate },
            });
          }
          return inserted;
        });
        if (!alloc) continue; // concurrent auto-schedule claimed this slot first
        created.push(alloc.id);
        if (shouldNotify) notifiedUserIds.add(assigned.teacher.userId);
        assigned.totalServices++;
        teacherHours.sort((a, b) => a.totalServices - b.totalServices);
      }
    }
  }

  res.json({ success: true, created: created.length, allocationIds: created, message: `Auto-scheduled ${created.length} teacher allocation(s) for ${serviceDate}` });
});

router.post("/teacher-allocations/:id/swap", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const { newTeacherId, reason } = req.body as { newTeacherId: number; reason?: string };
  if (!newTeacherId) { res.status(400).json({ error: "Bad request", message: "newTeacherId is required" }); return; }

  // AUTHORITATIVE: teacher replacement. REQUIRED PRE-COMMIT VALIDATION:
  // original allocation and both notification recipients. REQUIRED
  // TRANSACTIONAL OUTBOX/INTENT: both affected teachers' schedule-change
  // messages. RESPONSE ENRICHMENT is completed before commit.
  const result = await db.transaction(async tx => {
    const [original] = await tx.select().from(teacherAllocationsTable).where(eq(teacherAllocationsTable.id, id));
    if (!original) return null;
    const [cls] = await tx.select().from(classesTable).where(eq(classesTable.id, original.classId));
    const [origTeacher] = await tx.select().from(teachersTable).where(eq(teachersTable.id, original.teacherId));
    const [newTeacherRec] = await tx.select().from(teachersTable).where(eq(teachersTable.id, newTeacherId));
    const [updated] = await tx.update(teacherAllocationsTable).set({ teacherId: newTeacherId }).where(eq(teacherAllocationsTable.id, id)).returning();
    if (!updated) return null;

    const operationIdentity = `teacher-allocation:${id}:swap:${original.teacherId}:to:${newTeacherId}`;
    // A same-teacher command remains allowed and returns the normal response,
    // but it is not a schedule transition and must not duplicate a recipient.
    const notifyIds = original.teacherId === newTeacherId ? [] : [...new Set([
      origTeacher?.userId,
      newTeacherRec?.userId,
    ].filter((uid): uid is number => uid != null))];
    for (const uid of notifyIds) {
      const isOld = origTeacher && uid === origTeacher.userId;
      await createAllocationNotification(tx, {
        identity: `${operationIdentity}:recipient:${uid}`,
        domainIdentifier: String(id),
        userId: uid,
        type: "schedule_swap",
        title: "Schedule Change",
        message: isOld
          ? `You have been swapped out of ${cls?.name || "class"} on ${original.serviceDate} (${original.serviceSlot}).${reason ? " Reason: " + reason : ""}`
          : `You have been assigned to ${cls?.name || "class"} on ${original.serviceDate} (${original.serviceSlot}).${reason ? " Reason: " + reason : ""}`,
        metadata: { allocationId: id, serviceDate: original.serviceDate, serviceSlot: original.serviceSlot },
      });
    }
    return { formatted: await formatAllocation(tx, updated) };
  });
  if (!result) { res.status(404).json({ error: "Not found", message: "Allocation not found" }); return; }
  res.json(result.formatted);
});

router.post("/teacher-allocations/:id/mark-unavailable", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const { reason } = req.body as { reason?: string };

  const reqUser = (req as any).user;
  const isAdmin = reqUser?.role === "admin" || reqUser?.role === "super_admin";
  // AUTHORITATIVE: cancellation. REQUIRED PRE-COMMIT VALIDATION: ownership and
  // all data used by the response/message. REQUIRED TRANSACTIONAL OUTBOX/INTENT:
  // admin substitute-needed alerts are the command's operational purpose.
  // RESPONSE ENRICHMENT is also inside the transaction.
  const result = await db.transaction(async tx => {
    const [alloc] = await tx.select().from(teacherAllocationsTable).where(eq(teacherAllocationsTable.id, id));
    if (!alloc) return { kind: "missing" as const };
    const [teacher] = await tx.select().from(teachersTable).where(eq(teachersTable.id, alloc.teacherId));
    if (!isAdmin && (!teacher || teacher.userId !== reqUser?.userId)) {
      return { kind: "forbidden" as const };
    }
    const [cls] = await tx.select().from(classesTable).where(eq(classesTable.id, alloc.classId));
    let teacherName = "A teacher";
    if (teacher) {
      const [u] = await tx.select().from(usersTable).where(eq(usersTable.id, teacher.userId));
      if (u) teacherName = `${u.firstName} ${u.lastName}`;
    }
    const admins = await tx.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.isActive, true), or(eq(usersTable.role, "admin"), eq(usersTable.role, "super_admin"))));
    const [updated] = await tx.update(teacherAllocationsTable)
      .set({ status: "cancelled" })
      .where(eq(teacherAllocationsTable.id, id)).returning();
    if (!updated) return { kind: "missing" as const };

    const operationIdentity = `teacher-allocation:${id}:unavailable:${alloc.status}:to:cancelled`;
    // Replaying an already-cancelled command is still allowed, but there is no
    // new transition for which another substitute alert should be projected.
    for (const admin of alloc.status === "cancelled" ? [] : admins) {
      await createAllocationNotification(tx, {
        identity: `${operationIdentity}:recipient:${admin.id}`,
        domainIdentifier: String(id),
        userId: admin.id,
        type: "teacher_unavailable",
        title: "⚠️ Teacher Unavailable — Substitute Needed",
        message: `${teacherName} is unavailable for ${cls?.name || "class"} on ${alloc.serviceDate} (${alloc.serviceSlot}).${reason ? " Reason: " + reason : ""} Please assign a substitute.`,
        metadata: { allocationId: id, teacherId: alloc.teacherId, classId: alloc.classId, serviceDate: alloc.serviceDate },
      });
    }
    return {
      kind: "updated" as const,
      response: { ...await formatAllocation(tx, updated), teacherName, className: cls?.name, adminNotified: admins.length },
    };
  });
  if (result.kind === "missing") { res.status(404).json({ error: "Not found", message: "Allocation not found" }); return; }
  if (result.kind === "forbidden") { res.status(403).json({ error: "Forbidden", message: "You can only cancel your own allocations" }); return; }
  res.json(result.response);
});

export default router;
