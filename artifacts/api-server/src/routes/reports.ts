import { Router } from "express";
import { eq, and, ne, sql } from "drizzle-orm";
import { db, attendanceTable, childrenTable, classesTable, familiesTable, usersTable, emergenciesTable, pickupDelegatesTable, teacherAllocationsTable, teachersTable, parentFeedbackTable, childAppraisalsTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

router.get("/reports/not-picked-up", authMiddleware, requireRoles("super_admin", "admin", "attendant"), async (req, res): Promise<void> => {
  const { serviceDate, serviceSlot } = req.query as { serviceDate?: string; serviceSlot?: string };
  const today = serviceDate || new Date().toISOString().split("T")[0];

  const conditions = [eq(attendanceTable.serviceDate, today), ne(attendanceTable.status, "picked_up")];
  if (serviceSlot) conditions.push(eq(attendanceTable.serviceSlot, serviceSlot));

  const records = await db.select().from(attendanceTable).where(and(...conditions));

  const enriched = await Promise.all(records.map(async (r) => {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, r.childId));
    const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, r.classId));
    let family = null;
    let parentPhone = null;
    if (child?.familyId) {
      const [fam] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
      family = fam;
      if (fam?.parent1Id) {
        const [p] = await db.select().from(usersTable).where(eq(usersTable.id, fam.parent1Id));
        parentPhone = p?.phone || null;
      }
    }
    const checkInMins = r.checkInTime ? Math.floor((Date.now() - new Date(r.checkInTime).getTime()) / 60000) : null;
    return { ...r, child: child || null, class: cls || null, family: family ? { id: family.id, familyCode: family.familyCode, parentPhone } : null, minutesSinceCheckIn: checkInMins };
  }));

  res.json({ date: today, serviceSlot: serviceSlot || "all", total: enriched.length, children: enriched });
});

router.get("/reports/attendance-export", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { from, to, serviceSlot, classId, format = "json" } = req.query as { from?: string; to?: string; serviceSlot?: string; classId?: string; format?: string };
  const conditions = [];
  if (serviceSlot) conditions.push(eq(attendanceTable.serviceSlot, serviceSlot));
  if (classId) conditions.push(eq(attendanceTable.classId, parseInt(classId, 10)));

  const records = await db.select().from(attendanceTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(attendanceTable.serviceDate);

  const enriched = await Promise.all(records.map(async (r) => {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, r.childId));
    const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, r.classId));
    return { date: r.serviceDate, serviceSlot: r.serviceSlot, childName: child ? `${child.firstName} ${child.lastName}` : "Unknown", className: cls?.name || "Unknown", status: r.status, checkInTime: r.checkInTime, checkOutTime: r.checkOutTime };
  }));

  const filtered = enriched.filter(r => {
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    return true;
  });

  if (format === "csv") {
    const headers = ["Date", "Service Slot", "Child Name", "Class", "Status", "Check-in Time", "Check-out Time"];
    const rows = filtered.map(r => [r.date, r.serviceSlot, r.childName, r.className, r.status, r.checkInTime ? new Date(r.checkInTime).toLocaleString() : "", r.checkOutTime ? new Date(r.checkOutTime).toLocaleString() : ""]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${from || "all"}-to-${to || "all"}.csv"`);
    res.send(csv);
    return;
  }
  res.json({ total: filtered.length, from, to, serviceSlot: serviceSlot || "all", data: filtered });
});

async function buildFamilyRegistry() {
  const families = await db.select().from(familiesTable).orderBy(familiesTable.createdAt);
  return Promise.all(families.map(async (fam) => {
    let parentName = "", parentPhone = "", parentEmail = "";
    let isActive = false;
    if (fam.parent1Id) {
      const [p] = await db.select().from(usersTable).where(eq(usersTable.id, fam.parent1Id));
      if (p) { parentName = `${p.firstName} ${p.lastName}`; parentEmail = p.email; parentPhone = p.phone || ""; isActive = p.isActive ?? false; }
    }
    let parent2Name = "", parent2Email = "", parent2Phone = "";
    if (fam.parent2Id) {
      const [p] = await db.select().from(usersTable).where(eq(usersTable.id, fam.parent2Id));
      if (p) { parent2Name = `${p.firstName} ${p.lastName}`; parent2Email = p.email; parent2Phone = p.phone || ""; }
    }
    const children = await db.select().from(childrenTable).where(eq(childrenTable.familyId, fam.id));
    return {
      familyId: fam.id, familyCode: fam.familyCode,
      familyName: parentName || fam.familyCode,
      parentName, parentEmail, parentPhone, isActive,
      parent2Name, parent2Email, parent2Phone,
      address: fam.address || "", emergencyContact: fam.emergencyContactName || "", emergencyPhone: fam.emergencyContactPhone || "",
      childCount: children.length, childrenNames: children.map(c => `${c.firstName} ${c.lastName}`).join("; "),
      registeredAt: new Date(fam.createdAt).toLocaleDateString(),
    };
  }));
}

router.get("/reports/family-registry", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { format = "json" } = req.query as { format?: string };
  const enriched = await buildFamilyRegistry();
  if (format === "csv") {
    const headers = ["Family Code", "Family Name", "Parent Name", "Parent Email", "Parent Phone", "Parent 2 Name", "Parent 2 Email", "Children Count", "Children Names", "Address", "Emergency Contact", "Emergency Phone", "Registered", "Active"];
    const rows = enriched.map(r => [r.familyCode, r.familyName, r.parentName, r.parentEmail, r.parentPhone, r.parent2Name, r.parent2Email, r.childCount, r.childrenNames, r.address, r.emergencyContact, r.emergencyPhone, r.registeredAt, r.isActive ? "Yes" : "No"]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="family-registry.csv"');
    res.send(csv); return;
  }
  res.json({ total: enriched.length, families: enriched });
});

router.get("/reports/families-export", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const enriched = await buildFamilyRegistry();
  const headers = ["Family Code", "Parent 1 Name", "Parent 1 Email", "Parent 1 Phone", "Parent 2 Name", "Parent 2 Email", "Parent 2 Phone", "Address", "Emergency Contact", "Emergency Phone", "Children Count", "Children Names", "Registered"];
  const rows = enriched.map(r => [r.familyCode, r.parentName, r.parentEmail, r.parentPhone, r.parent2Name, r.parent2Email, r.parent2Phone, r.address, r.emergencyContact, r.emergencyPhone, r.childCount, r.childrenNames, r.registeredAt]);
  const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="family-registry.csv"');
  res.send(csv);
});

router.get("/reports/emergency-log", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { format = "json" } = req.query as { format?: string };
  const records = await db.select().from(emergenciesTable).orderBy(emergenciesTable.createdAt);
  const enriched = await Promise.all(records.map(async (r) => {
    let childName = null;
    if (r.childId) {
      const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, r.childId));
      childName = child ? `${child.firstName} ${child.lastName}` : null;
    }
    const [triggeredByUser] = await db.select().from(usersTable).where(eq(usersTable.id, r.triggeredBy));
    return { id: r.id, type: r.type, level: r.level, status: r.status, description: r.description, childName, triggeredBy: triggeredByUser ? `${triggeredByUser.firstName} ${triggeredByUser.lastName}` : "Unknown", resolutionNotes: r.resolutionNotes, createdAt: r.createdAt, resolvedAt: r.resolvedAt };
  }));

  if (format === "csv") {
    const headers = ["ID", "Type", "Level", "Status", "Description", "Child", "Triggered By", "Resolution", "Created At", "Resolved At"];
    const rows = enriched.map(r => [r.id, r.type, r.level, r.status, r.description, r.childName || "", r.triggeredBy, r.resolutionNotes || "", new Date(r.createdAt).toLocaleString(), r.resolvedAt ? new Date(r.resolvedAt).toLocaleString() : ""]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="emergency-log.csv"');
    res.send(csv);
    return;
  }
  res.json({ total: enriched.length, data: enriched });
});

router.get("/reports/teacher-ratios", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { serviceDate, serviceSlot } = req.query as { serviceDate?: string; serviceSlot?: string };
  const today = serviceDate || new Date().toISOString().split("T")[0];
  const classes = await db.select().from(classesTable);
  const ratios = await Promise.all(classes.map(async (cls) => {
    const conditions = [eq(attendanceTable.classId, cls.id), eq(attendanceTable.serviceDate, today)];
    if (serviceSlot) conditions.push(eq(attendanceTable.serviceSlot, serviceSlot));
    const attendees = await db.select().from(attendanceTable).where(and(...conditions));
    const childCount = attendees.filter(a => a.status !== "picked_up").length;
    const recommended = Math.ceil(childCount / 6);
    const allocConds = [eq(teacherAllocationsTable.classId, cls.id), eq(teacherAllocationsTable.serviceDate, today)];
    if (serviceSlot) allocConds.push(eq(teacherAllocationsTable.serviceSlot, serviceSlot));
    const allocations = await db.select().from(teacherAllocationsTable).where(and(...allocConds));
    return { classId: cls.id, className: cls.name, roomLocation: cls.roomLocation, serviceSlot: cls.serviceSlot, capacity: cls.capacity, childrenPresent: childCount, allocatedTeachers: allocations.length, recommendedTeachers: recommended, ratio: childCount > 0 ? `1:${Math.ceil(childCount / Math.max(1, allocations.length || 1))}` : "N/A", alert: childCount > 0 && allocations.length < recommended };
  }));
  res.json({ date: today, serviceSlot: serviceSlot || "all", classes: ratios });
});

router.get("/reports/summary", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { serviceDate } = req.query as { serviceDate?: string };
  const today = serviceDate || new Date().toISOString().split("T")[0];
  const todayAttendance = await db.select().from(attendanceTable).where(eq(attendanceTable.serviceDate, today));
  const totalCheckedIn = todayAttendance.length;
  const stillPresent = todayAttendance.filter(a => a.status !== "picked_up").length;
  const pickedUp = todayAttendance.filter(a => a.status === "picked_up").length;
  const delegates = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.parentApproved, false));
  const pendingApprovals = await db.select().from(usersTable).where(eq(usersTable.status, "pending_approval"));
  res.json({ date: today, totalCheckedIn, stillPresent, pickedUp, pendingDelegateApprovals: delegates.length, pendingUserApprovals: pendingApprovals.length });
});

router.get("/reports/teacher-schedule", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { from, to, teacherId } = req.query as { from?: string; to?: string; teacherId?: string };
  const conditions = [];
  if (teacherId) conditions.push(eq(teacherAllocationsTable.teacherId, parseInt(teacherId, 10)));
  const allocations = await db.select().from(teacherAllocationsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(teacherAllocationsTable.serviceDate);
  const filtered = allocations.filter(a => {
    if (from && a.serviceDate < from) return false;
    if (to && a.serviceDate > to) return false;
    return true;
  });
  const enriched = await Promise.all(filtered.map(async (a) => {
    const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.id, a.teacherId));
    let teacherUser = null;
    if (teacher) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, teacher.userId));
      teacherUser = u ? { firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone } : null;
    }
    const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, a.classId));
    return { ...a, teacherName: teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : "Unknown", teacherEmail: teacherUser?.email || "", teacherPhone: teacherUser?.phone || "", className: cls?.name || "Unknown", roomLocation: cls?.roomLocation || "" };
  }));
  res.json({ total: enriched.length, data: enriched });
});

router.get("/reports/teacher-hours", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { from, to } = req.query as { from?: string; to?: string };
  const teachers = await db.select().from(teachersTable);
  const result = await Promise.all(teachers.map(async (teacher) => {
    const conditions = [eq(teacherAllocationsTable.teacherId, teacher.id)];
    const allocations = await db.select().from(teacherAllocationsTable).where(and(...conditions));
    const filtered = allocations.filter(a => {
      if (from && a.serviceDate < from) return false;
      if (to && a.serviceDate > to) return false;
      return true;
    });
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, teacher.userId));
    return { teacherId: teacher.id, teacherName: u ? `${u.firstName} ${u.lastName}` : "Unknown", totalAllocations: filtered.length, completedServices: filtered.filter(a => a.status === "completed").length, scheduledServices: filtered.filter(a => a.status === "scheduled").length };
  }));
  result.sort((a, b) => b.totalAllocations - a.totalAllocations);
  res.json({ from: from || "all", to: to || "all", teachers: result });
});

router.get("/reports/feedback-summary", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { from, to } = req.query as { from?: string; to?: string };
  const feedback = await db.select().from(parentFeedbackTable).orderBy(parentFeedbackTable.createdAt);
  const filtered = feedback.filter(f => {
    const date = new Date(f.createdAt).toISOString().split("T")[0];
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  });
  const ratings = filtered.map(f => Number(f.rating));
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;
  const appraisals = await db.select().from(childAppraisalsTable).orderBy(childAppraisalsTable.createdAt);
  const filteredAppraisals = appraisals.filter(a => {
    const date = new Date(a.createdAt).toISOString().split("T")[0];
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  });
  res.json({ totalFeedback: filtered.length, averageRating: avgRating, totalAppraisals: filteredAppraisals.length, ratingDistribution: { 5: ratings.filter(r => r === 5).length, 4: ratings.filter(r => r === 4).length, 3: ratings.filter(r => r === 3).length, 2: ratings.filter(r => r === 2).length, 1: ratings.filter(r => r === 1).length } });
});

router.get("/reports/class-utilization", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const classes = await db.select().from(classesTable);
  const result = await Promise.all(classes.map(async (cls) => {
    const [{ count: enrollment }] = await db.select({ count: sql<number>`count(*)` }).from(childrenTable).where(eq(childrenTable.currentClassId, cls.id));
    const utilPct = cls.capacity > 0 ? Math.round((Number(enrollment) / cls.capacity) * 100) : 0;
    return { classId: cls.id, className: cls.name, serviceSlot: cls.serviceSlot, capacity: cls.capacity, enrollmentCount: Number(enrollment), utilizationPercent: utilPct, isAtCapacity: Number(enrollment) >= cls.capacity, isNearCapacity: utilPct >= 80 };
  }));
  const avgUtil = result.length > 0
    ? Math.round(result.reduce((sum, c) => sum + c.utilizationPercent, 0) / result.length)
    : 0;
  const atCapacityCount = result.filter(c => c.isAtCapacity).length;
  res.json({ classes: result, averageUtilization: avgUtil, atCapacityCount, totalClasses: result.length });
});

export default router;
