import { Router } from "express";
import { eq, and, ne, sql } from "drizzle-orm";
import { db, attendanceTable, childrenTable, classesTable, familiesTable, usersTable, emergenciesTable, pickupDelegatesTable, teacherAllocationsTable, teachersTable, parentFeedbackTable, childAppraisalsTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { streamPdf, renderReportPdf } from "../lib/pdf";

const router = Router();

router.get("/reports/not-picked-up", authMiddleware, requireRoles("super_admin", "admin", "support"), async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    req.log.error({ err }, "Failed to load not-picked-up report");
    res.status(500).json({ error: "Failed to load report" });
  }
});

router.get("/reports/attendance-export", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    req.log.error({ err }, "Failed to export attendance");
    res.status(500).json({ error: "Failed to export attendance" });
  }
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

router.get("/reports/class-list", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const { classId, format = "json" } = req.query as { classId?: string; format?: string };
    if (!classId) { res.status(400).json({ error: "classId is required" }); return; }

    const classIdNum = parseInt(classId, 10);
    const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, classIdNum));
    if (!cls) { res.status(404).json({ error: "Class not found" }); return; }

    const children = await db.select().from(childrenTable).where(eq(childrenTable.currentClassId, classIdNum));

    const enriched = await Promise.all(children.map(async (child) => {
      const age = child.dob
        ? Math.floor((Date.now() - new Date(child.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : null;
      let parent1Name = "", parent1Phone = "", parent1Email = "";
      let parent2Name = "", parent2Phone = "";

      if (child.familyId) {
        const [fam] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
        if (fam) {
          const [p1, p2] = await Promise.all([
            fam.parent1Id ? db.select().from(usersTable).where(eq(usersTable.id, fam.parent1Id)).then(r => r[0]) : Promise.resolve(undefined),
            fam.parent2Id ? db.select().from(usersTable).where(eq(usersTable.id, fam.parent2Id)).then(r => r[0]) : Promise.resolve(undefined),
          ]);
          if (p1) { parent1Name = `${p1.firstName} ${p1.lastName}`; parent1Phone = p1.phone || ""; parent1Email = p1.email; }
          if (p2) { parent2Name = `${p2.firstName} ${p2.lastName}`; parent2Phone = p2.phone || ""; }
        }
      }

      return {
        childName: `${child.firstName} ${child.lastName}`,
        dob: child.dob || "",
        age: age !== null ? String(age) : "",
        gender: child.gender || "",
        allergies: child.allergies || "",
        medicalNotes: child.medicalNotes || "",
        parent1Name, parent1Phone, parent1Email,
        parent2Name, parent2Phone,
      };
    }));

    if (format === "csv") {
      const headers = ["Child Name", "Date of Birth", "Age", "Gender", "Allergies", "Medical Notes", "Parent 1 Name", "Parent 1 Phone", "Parent 1 Email", "Parent 2 Name", "Parent 2 Phone"];
      const rows = enriched.map(r => [r.childName, r.dob, r.age, r.gender, r.allergies, r.medicalNotes, r.parent1Name, r.parent1Phone, r.parent1Email, r.parent2Name, r.parent2Phone]);
      const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const safeName = cls.name.replace(/\s+/g, "-").toLowerCase();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}-class-list.csv"`);
      res.send(csv); return;
    }

    res.json({ classId: classIdNum, className: cls.name, serviceSlot: cls.serviceSlot, total: enriched.length, children: enriched });
  } catch (err) {
    req.log.error({ err }, "Failed to load class list");
    res.status(500).json({ error: "Failed to load class list" });
  }
});

router.get("/reports/family-registry", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    req.log.error({ err }, "Failed to load family registry");
    res.status(500).json({ error: "Failed to load family registry" });
  }
});

router.get("/reports/families-export", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const enriched = await buildFamilyRegistry();
    const headers = ["Family Code", "Parent 1 Name", "Parent 1 Email", "Parent 1 Phone", "Parent 2 Name", "Parent 2 Email", "Parent 2 Phone", "Address", "Emergency Contact", "Emergency Phone", "Children Count", "Children Names", "Registered"];
    const rows = enriched.map(r => [r.familyCode, r.parentName, r.parentEmail, r.parentPhone, r.parent2Name, r.parent2Email, r.parent2Phone, r.address, r.emergencyContact, r.emergencyPhone, r.childCount, r.childrenNames, r.registeredAt]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="family-registry.csv"');
    res.send(csv);
  } catch (err) {
    req.log.error({ err }, "Failed to export families");
    res.status(500).json({ error: "Failed to export families" });
  }
});

router.get("/reports/emergency-log", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    req.log.error({ err }, "Failed to load emergency log");
    res.status(500).json({ error: "Failed to load emergency log" });
  }
});

router.get("/reports/teacher-ratios", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    req.log.error({ err }, "Failed to load teacher ratios");
    res.status(500).json({ error: "Failed to load teacher ratios" });
  }
});

router.get("/reports/summary", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const { serviceDate } = req.query as { serviceDate?: string };
    const today = serviceDate || new Date().toISOString().split("T")[0];
    const todayAttendance = await db.select().from(attendanceTable).where(eq(attendanceTable.serviceDate, today));
    const totalCheckedIn = todayAttendance.length;
    const stillPresent = todayAttendance.filter(a => a.status !== "picked_up").length;
    const pickedUp = todayAttendance.filter(a => a.status === "picked_up").length;
    const delegates = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.parentApproved, false));
    const pendingApprovals = await db.select().from(usersTable).where(eq(usersTable.status, "pending_approval"));
    res.json({ date: today, totalCheckedIn, stillPresent, pickedUp, pendingDelegateApprovals: delegates.length, pendingUserApprovals: pendingApprovals.length });
  } catch (err) {
    req.log.error({ err }, "Failed to load report summary");
    res.status(500).json({ error: "Failed to load summary" });
  }
});

router.get("/reports/teacher-schedule", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    req.log.error({ err }, "Failed to load teacher schedule");
    res.status(500).json({ error: "Failed to load teacher schedule" });
  }
});

router.get("/reports/teacher-hours", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    req.log.error({ err }, "Failed to load teacher hours");
    res.status(500).json({ error: "Failed to load teacher hours" });
  }
});

router.get("/reports/feedback-summary", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    req.log.error({ err }, "Failed to load feedback summary");
    res.status(500).json({ error: "Failed to load feedback summary" });
  }
});

router.get("/reports/class-utilization", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    req.log.error({ err }, "Failed to load class utilization");
    res.status(500).json({ error: "Failed to load class utilization" });
  }
});

router.get("/reports/custom-builder", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const { reportType, from, to, classId, serviceSlot, teacherId, familyId } = req.query as {
      reportType?: string; from?: string; to?: string; classId?: string; serviceSlot?: string;
      teacherId?: string; familyId?: string;
    };

    const type = reportType || "attendance";
    const cls = classId ? parseInt(classId, 10) : null;
    const teacherUserIdFilter = teacherId ? parseInt(teacherId, 10) : null;
    const familyIdFilter = familyId ? parseInt(familyId, 10) : null;

    async function childIdsForFamily(fid: number): Promise<number[]> {
      const kids = await db.select({ id: childrenTable.id }).from(childrenTable).where(eq(childrenTable.familyId, fid));
      return kids.map(k => k.id);
    }

    async function teacherRecordId(userId: number): Promise<number | null> {
      const [t] = await db.select().from(teachersTable).where(eq(teachersTable.userId, userId));
      return t?.id ?? null;
    }

    if (type === "attendance") {
      const conds: ReturnType<typeof eq>[] = [];
      if (cls) conds.push(eq(attendanceTable.classId, cls));
      if (serviceSlot) conds.push(eq(attendanceTable.serviceSlot, serviceSlot));
      if (teacherUserIdFilter) {
        const tid = await teacherRecordId(teacherUserIdFilter);
        if (tid) {
          const allocs = await db.select({ classId: teacherAllocationsTable.classId }).from(teacherAllocationsTable).where(eq(teacherAllocationsTable.teacherId, tid));
          const classIds = [...new Set(allocs.map(a => a.classId))];
          if (classIds.length > 0) {
            conds.push(sql`${attendanceTable.classId} = ANY(ARRAY[${sql.raw(classIds.join(","))}]::int[])`);
          } else {
            res.json({ title: "Attendance Log", columns: ["Date", "Slot", "Child", "Class", "Status", "Checked In", "In Class", "Picked Up"], rows: [], total: 0, summary: { totalRecords: 0, pickedUp: 0, attendanceRate: 0, uniqueDates: 0 } });
            return;
          }
        }
      }
      const records = await db.select().from(attendanceTable)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(attendanceTable.serviceDate);
      let filtered = records.filter(r => {
        if (from && r.serviceDate < from) return false;
        if (to && r.serviceDate > to) return false;
        return true;
      });
      if (familyIdFilter) {
        const childIds = await childIdsForFamily(familyIdFilter);
        filtered = filtered.filter(r => childIds.includes(r.childId));
      }
      const rows = await Promise.all(filtered.map(async (r) => {
        const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, r.childId));
        const [c] = await db.select().from(classesTable).where(eq(classesTable.id, r.classId));
        return [
          r.serviceDate, r.serviceSlot,
          child ? `${child.firstName} ${child.lastName}` : "—", c?.name || "—", r.status,
          r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—",
          (r as any).classArrivalTime ? new Date((r as any).classArrivalTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—",
          r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—",
        ];
      }));
      const pickedUp = rows.filter(r => r[4] === "picked_up").length;
      const uniqueDates = new Set(rows.map(r => r[0])).size;
      const attendanceRate = rows.length > 0 ? Math.round((pickedUp / rows.length) * 100) : 0;
      res.json({ title: "Attendance Log", columns: ["Date", "Slot", "Child", "Class", "Status", "Checked In", "In Class", "Picked Up"], rows, total: rows.length, summary: { totalRecords: rows.length, pickedUp, attendanceRate, uniqueDates } });
      return;
    }

    if (type === "arrivals") {
      const conds: ReturnType<typeof eq>[] = [eq(attendanceTable.status, "in_class")];
      if (cls) conds.push(eq(attendanceTable.classId, cls));
      if (serviceSlot) conds.push(eq(attendanceTable.serviceSlot, serviceSlot));
      const records = await db.select().from(attendanceTable).where(and(...conds)).orderBy(attendanceTable.serviceDate);
      const filtered = records.filter(r => {
        if (from && r.serviceDate < from) return false;
        if (to && r.serviceDate > to) return false;
        return true;
      });
      const rows = await Promise.all(filtered.map(async (r) => {
        const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, r.childId));
        const [c] = await db.select().from(classesTable).where(eq(classesTable.id, r.classId));
        const arrivalTime = (r as any).classArrivalTime;
        const dropTime = r.checkInTime;
        const lagMins = dropTime && arrivalTime ? Math.round((new Date(arrivalTime).getTime() - new Date(dropTime).getTime()) / 60000) : null;
        return [
          r.serviceDate, r.serviceSlot,
          child ? `${child.firstName} ${child.lastName}` : "—", c?.name || "—",
          dropTime ? new Date(dropTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—",
          arrivalTime ? new Date(arrivalTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—",
          lagMins !== null ? `${lagMins} min` : "—",
        ];
      }));
      const withLag = rows.filter(r => r[6] !== "—");
      const avgLag = withLag.length > 0 ? Math.round(withLag.reduce((s, r) => s + parseInt(r[6]), 0) / withLag.length) : null;
      res.json({ title: "Class Arrivals (Teacher Confirmed)", columns: ["Date", "Slot", "Child", "Class", "Dropped Off", "In Class", "Lag Time"], rows, total: rows.length, summary: { totalRecords: rows.length, avgLagMins: avgLag } });
      return;
    }

    if (type === "not-picked-up") {
      const conds: ReturnType<typeof eq>[] = [ne(attendanceTable.status, "picked_up")];
      if (cls) conds.push(eq(attendanceTable.classId, cls));
      if (serviceSlot) conds.push(eq(attendanceTable.serviceSlot, serviceSlot));
      const records = await db.select().from(attendanceTable).where(and(...conds)).orderBy(attendanceTable.serviceDate);
      let filtered = records.filter(r => {
        if (from && r.serviceDate < from) return false;
        if (to && r.serviceDate > to) return false;
        return true;
      });
      if (familyIdFilter) {
        const childIds = await childIdsForFamily(familyIdFilter);
        filtered = filtered.filter(r => childIds.includes(r.childId));
      }
      const rows = await Promise.all(filtered.map(async (r) => {
        const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, r.childId));
        const [c] = await db.select().from(classesTable).where(eq(classesTable.id, r.classId));
        const [fam] = child ? await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId)) : [null];
        let parentPhone = "—";
        if (fam?.parent1Id) {
          const [p] = await db.select().from(usersTable).where(eq(usersTable.id, fam.parent1Id));
          if (p?.phone) parentPhone = p.phone;
        }
        return [r.serviceDate, r.serviceSlot, child ? `${child.firstName} ${child.lastName}` : "—", c?.name || "—", r.status, fam?.familyCode || "—", parentPhone];
      }));
      res.json({ title: "Not Picked Up Report", columns: ["Date", "Slot", "Child", "Class", "Status", "Family Code", "Parent Phone"], rows, total: rows.length, summary: { totalRecords: rows.length } });
      return;
    }

    if (type === "appraisals") {
      const appraisals = await db.select().from(childAppraisalsTable).orderBy(childAppraisalsTable.createdAt);
      const filtered = await Promise.all(appraisals
        .filter(a => {
          const date = new Date(a.createdAt).toISOString().split("T")[0];
          if (from && date < from) return false;
          if (to && date > to) return false;
          return true;
        })
        .map(async (a) => {
          if (teacherUserIdFilter && a.teacherId !== teacherUserIdFilter) return null;
          const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, a.childId));
          if (cls && child?.currentClassId !== cls) return null;
          if (familyIdFilter && child?.familyId !== familyIdFilter) return null;
          const [c] = child?.currentClassId ? await db.select().from(classesTable).where(eq(classesTable.id, child.currentClassId)) : [null];
          const [teacher] = await db.select().from(usersTable).where(eq(usersTable.id, a.teacherId));
          return [
            new Date(a.createdAt).toISOString().split("T")[0],
            child ? `${child.firstName} ${child.lastName}` : "—",
            c?.name || "—",
            teacher ? `${teacher.firstName} ${teacher.lastName}` : "—",
            a.participationLevel || "—",
            a.scriptureEngagement || "—",
            a.socialInteraction || "—",
            a.milestoneNote || "—",
          ];
        }));
      const rows = filtered.filter(Boolean) as string[][];
      const excellent = rows.filter(r => r[4] === "excellent").length;
      const good = rows.filter(r => r[4] === "good").length;
      res.json({ title: "Child Appraisals", columns: ["Date", "Child", "Class", "Teacher", "Participation", "Scripture", "Social", "Milestone Note"], rows, total: rows.length, summary: { totalRecords: rows.length, excellent, good } });
      return;
    }

    if (type === "teacher-schedule") {
      const conds: ReturnType<typeof eq>[] = [];
      if (cls) conds.push(eq(teacherAllocationsTable.classId, cls));
      if (serviceSlot) conds.push(eq(teacherAllocationsTable.serviceSlot, serviceSlot));
      if (teacherUserIdFilter) {
        const tid = await teacherRecordId(teacherUserIdFilter);
        if (tid) {
          conds.push(eq(teacherAllocationsTable.teacherId, tid));
        } else {
          res.json({ title: "Teacher Schedule", columns: ["Date", "Slot", "Teacher", "Phone", "Class", "Room", "Status"], rows: [], total: 0, summary: { totalRecords: 0, confirmed: 0, pending: 0 } });
          return;
        }
      }
      const allocations = await db.select().from(teacherAllocationsTable)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(teacherAllocationsTable.serviceDate);
      const filtered = allocations.filter(a => {
        if (from && a.serviceDate < from) return false;
        if (to && a.serviceDate > to) return false;
        return true;
      });
      const rows = await Promise.all(filtered.map(async (a) => {
        const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.id, a.teacherId));
        const [u] = teacher ? await db.select().from(usersTable).where(eq(usersTable.id, teacher.userId)) : [null];
        const [c] = await db.select().from(classesTable).where(eq(classesTable.id, a.classId));
        return [a.serviceDate, a.serviceSlot || "—", u ? `${u.firstName} ${u.lastName}` : "—", u?.phone || "—", c?.name || "—", c?.roomLocation || "—", a.status];
      }));
      const confirmed = rows.filter(r => r[6] === "confirmed").length;
      res.json({ title: "Teacher Schedule", columns: ["Date", "Slot", "Teacher", "Phone", "Class", "Room", "Status"], rows, total: rows.length, summary: { totalRecords: rows.length, confirmed, pending: rows.length - confirmed } });
      return;
    }

    if (type === "family-registry") {
      const enriched = await buildFamilyRegistry();
      const list = familyIdFilter ? enriched.filter(f => f.familyId === familyIdFilter) : enriched;
      const rows = list.map(f => [f.familyCode, f.familyName, f.parentName, f.parentPhone, f.parent2Name, f.childCount.toString(), f.childrenNames, f.address, f.emergencyContact, f.emergencyPhone, f.registeredAt, f.isActive ? "Active" : "Inactive"]);
      const active = rows.filter(r => r[11] === "Active").length;
      res.json({ title: "Family Registry", columns: ["Code", "Family Name", "Parent 1", "Phone", "Parent 2", "Children", "Child Names", "Address", "Emergency Contact", "Emerg. Phone", "Registered", "Status"], rows, total: rows.length, summary: { totalRecords: rows.length, active, inactive: rows.length - active } });
      return;
    }

    if (type === "feedback") {
      const feedbacks = await db.select().from(parentFeedbackTable).orderBy(parentFeedbackTable.createdAt);
      let filtered = feedbacks.filter(f => {
        const date = new Date(f.createdAt).toISOString().split("T")[0];
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
      });
      if (familyIdFilter) {
        const [fam] = await db.select().from(familiesTable).where(eq(familiesTable.id, familyIdFilter));
        const parentIds = [fam?.parent1Id, fam?.parent2Id].filter(Boolean) as number[];
        filtered = parentIds.length ? filtered.filter(f => parentIds.includes(f.parentId)) : [];
      }
      const rows = await Promise.all(filtered.map(async (f) => {
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, f.parentId));
        return [
          new Date(f.createdAt).toISOString().split("T")[0],
          user ? `${user.firstName} ${user.lastName}` : "—",
          f.serviceDate || "—",
          String(f.rating),
          String(f.classExperience),
          String(f.teacherEngagement),
          f.sentimentLabel || "unanalyzed",
          f.improvementNote?.slice(0, 80) || "—",
        ];
      }));
      const avgRating = rows.length > 0 ? (rows.reduce((s, r) => s + Number(r[3]), 0) / rows.length).toFixed(1) : "—";
      const positive = rows.filter(r => r[6] === "positive").length;
      const negative = rows.filter(r => r[6] === "negative").length;
      res.json({ title: "Parent Feedback", columns: ["Date", "Parent", "Service Date", "Overall Rating", "Class Exp.", "Teacher Eng.", "Sentiment", "Note"], rows, total: rows.length, summary: { totalRecords: rows.length, avgRating, positive, negative } });
      return;
    }

    res.status(400).json({ error: "Unknown report type", validTypes: ["attendance", "arrivals", "not-picked-up", "appraisals", "teacher-schedule", "family-registry", "feedback"] });
  } catch (err) {
    req.log.error({ err }, "Failed to build custom report");
    res.status(500).json({ error: "Failed to build report" });
  }
});

// ─── Birthday Tracker ────────────────────────────────────────────────────────

router.get("/reports/birthdays", authMiddleware, requireRoles("super_admin", "admin", "teacher"), async (req, res): Promise<void> => {
  try {
    const { days = "30" } = req.query as { days?: string };
    const daysAhead = Math.min(parseInt(days, 10) || 30, 365);
    const today = new Date();
    const children = await db.select().from(childrenTable);

    const upcoming = children.map(child => {
      const dob = new Date(child.dob);
      let birthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      if (birthday < today) birthday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
      const daysUntil = Math.floor((birthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const age = today.getFullYear() - dob.getFullYear() - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
      return { ...child, birthdayDate: birthday.toISOString().split("T")[0], daysUntil, turningAge: age + 1 };
    }).filter(c => c.daysUntil <= daysAhead).sort((a, b) => a.daysUntil - b.daysUntil);

    const enriched = await Promise.all(upcoming.map(async (child) => {
      let className = null;
      if (child.currentClassId) {
        const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, child.currentClassId));
        className = cls?.name || null;
      }
      return { id: child.id, firstName: child.firstName, lastName: child.lastName, dob: child.dob, birthdayDate: child.birthdayDate, daysUntil: child.daysUntil, turningAge: child.turningAge, className, familyId: child.familyId };
    }));

    res.json({ total: enriched.length, daysAhead, children: enriched });
  } catch (err) {
    req.log.error({ err }, "Failed to load birthdays");
    res.status(500).json({ error: "Failed to load birthdays" });
  }
});

// ─── Consecutive Absence Alerts ───────────────────────────────────────────────

router.get("/reports/absence-alerts", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const { missedWeeks = "2" } = req.query as { missedWeeks?: string };
    const weeks = parseInt(missedWeeks, 10) || 2;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - weeks * 7);
    const cutoff = cutoffDate.toISOString().split("T")[0];

    const children = await db.select().from(childrenTable);
    const alerts = [];

    for (const child of children) {
      const allAttendance = await db.select().from(attendanceTable)
        .where(eq(attendanceTable.childId, child.id))
        .orderBy(attendanceTable.serviceDate);
      if (allAttendance.length === 0) continue;
      const lastDate = allAttendance[allAttendance.length - 1].serviceDate;
      if (lastDate >= cutoff) continue;

      let familyInfo = null;
      const [fam] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
      if (fam?.parent1Id) {
        const [p] = await db.select().from(usersTable).where(eq(usersTable.id, fam.parent1Id));
        familyInfo = { familyCode: fam.familyCode, parentName: p ? `${p.firstName} ${p.lastName}` : null, parentPhone: p?.phone || null };
      }
      let className = null;
      if (child.currentClassId) {
        const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, child.currentClassId));
        className = cls?.name || null;
      }
      const daysMissed = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({ childId: child.id, childName: `${child.firstName} ${child.lastName}`, className, lastAttendanceDate: lastDate, daysMissed, family: familyInfo });
    }

    alerts.sort((a, b) => b.daysMissed - a.daysMissed);
    res.json({ total: alerts.length, missedWeeks: weeks, children: alerts });
  } catch (err) {
    req.log.error({ err }, "Failed to load absence alerts");
    res.status(500).json({ error: "Failed to load absence alerts" });
  }
});

// ─── Room Occupancy Heatmap ───────────────────────────────────────────────────

router.get("/reports/room-occupancy", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const { weeks = "6" } = req.query as { weeks?: string };
    const numWeeks = Math.min(parseInt(weeks, 10) || 6, 12);
    const classes = await db.select().from(classesTable);
    const slots = ["7am", "10:30am"];

    const dates: string[] = [];
    const now = new Date();
    for (let i = numWeeks - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - now.getDay() - i * 7);
      dates.push(d.toISOString().split("T")[0]);
    }

    const grid = await Promise.all(classes.map(async (cls) => {
      const cells: Record<string, Record<string, number>> = {};
      for (const date of dates) {
        cells[date] = {};
        for (const slot of slots) {
          const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(attendanceTable)
            .where(and(eq(attendanceTable.classId, cls.id), eq(attendanceTable.serviceDate, date), eq(attendanceTable.serviceSlot, slot)));
          cells[date][slot] = Number(count);
        }
      }
      return { classId: cls.id, className: cls.name, roomLocation: cls.roomLocation, capacity: cls.capacity, data: cells };
    }));

    res.json({ dates, slots, classes: grid });
  } catch (err) {
    req.log.error({ err }, "Failed to load room occupancy");
    res.status(500).json({ error: "Failed to load room occupancy" });
  }
});

// ─── PDF Export Routes ────────────────────────────────────────────────────────

router.get("/reports/pdf/attendance", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const { from, to, serviceSlot, classId } = req.query as { from?: string; to?: string; serviceSlot?: string; classId?: string };
    const conds: ReturnType<typeof eq>[] = [];
    if (serviceSlot) conds.push(eq(attendanceTable.serviceSlot, serviceSlot));
    if (classId) conds.push(eq(attendanceTable.classId, parseInt(classId, 10)));

    const records = await db.select().from(attendanceTable)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(attendanceTable.serviceDate);

    const filtered = records.filter(r => {
      if (from && r.serviceDate < from) return false;
      if (to && r.serviceDate > to) return false;
      return true;
    });

    const rows = await Promise.all(filtered.map(async (r) => {
      const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, r.childId));
      const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, r.classId));
      return [
        r.serviceDate,
        r.serviceSlot,
        child ? `${child.firstName} ${child.lastName}` : "Unknown",
        cls?.name || "Unknown",
        r.status,
        r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : "—",
        r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString() : "—",
      ];
    }));

    const pickedUp = rows.filter(r => r[4] === "picked_up").length;
    const uniqueDates = new Set(rows.map(r => r[0])).size;
    const rate = rows.length > 0 ? Math.round((pickedUp / rows.length) * 100) : 0;

    const dateLabel = from && to ? `${from} to ${to}` : from ? `from ${from}` : to ? `to ${to}` : "All dates";
    const slotLabel = serviceSlot ? ` · ${serviceSlot}` : "";

    streamPdf(res, `attendance-${from || "all"}-to-${to || "all"}.pdf`, (doc) => {
      renderReportPdf(doc, {
        title: "Attendance Report",
        subtitle: `${dateLabel}${slotLabel} · ${rows.length} records`,
        columns: [
          { label: "Date", width: 65 },
          { label: "Slot", width: 50 },
          { label: "Child Name", width: 110 },
          { label: "Class", width: 90 },
          { label: "Status", width: 70 },
          { label: "Check-In", width: 65 },
          { label: "Check-Out", width: 65 },
        ],
        rows,
        summaryStats: [
          { label: "Total Records", value: String(rows.length) },
          { label: "Picked Up", value: String(pickedUp) },
          { label: "Pickup Rate", value: `${rate}%` },
          { label: "Service Days", value: String(uniqueDates) },
        ],
      });
    });
  } catch (err) {
    req.log.error({ err }, "Failed to generate attendance PDF");
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
});

router.get("/reports/pdf/feedback", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const feedbacks = await db.select().from(parentFeedbackTable).orderBy(parentFeedbackTable.createdAt);
    const filtered = feedbacks.filter(f => {
      const date = new Date(f.createdAt).toISOString().split("T")[0];
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });

    const rows = await Promise.all(filtered.map(async (f) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, f.parentId));
      return [
        new Date(f.createdAt).toISOString().split("T")[0],
        user ? `${user.firstName} ${user.lastName}` : "—",
        f.serviceDate || "—",
        String(f.rating),
        String(f.classExperience),
        String(f.teacherEngagement),
        String(f.safetyRating),
        f.sentimentLabel || "unanalyzed",
        f.improvementNote?.slice(0, 60) || "—",
      ];
    }));

    const avgRating = rows.length > 0
      ? (rows.reduce((s, r) => s + Number(r[3]), 0) / rows.length).toFixed(1)
      : "—";
    const positive = rows.filter(r => r[7] === "positive").length;
    const negative = rows.filter(r => r[7] === "negative").length;
    const neutral = rows.length - positive - negative;

    const dateLabel = from && to ? `${from} to ${to}` : "All dates";

    streamPdf(res, `feedback-${from || "all"}-to-${to || "all"}.pdf`, (doc) => {
      renderReportPdf(doc, {
        title: "Parent Feedback Report",
        subtitle: `${dateLabel} · ${rows.length} responses`,
        columns: [
          { label: "Date", width: 60 },
          { label: "Parent", width: 95 },
          { label: "Service Date", width: 65 },
          { label: "Rating", width: 42 },
          { label: "Class Exp.", width: 42 },
          { label: "Teacher Eng.", width: 50 },
          { label: "Safety", width: 40 },
          { label: "Sentiment", width: 60 },
          { label: "Note", width: 61 },
        ],
        rows,
        summaryStats: [
          { label: "Total Responses", value: String(rows.length) },
          { label: "Avg Rating", value: `${avgRating} ★` },
          { label: "Positive", value: String(positive) },
          { label: "Neutral", value: String(neutral) },
          { label: "Negative", value: String(negative) },
        ],
      });
    });
  } catch (err) {
    req.log.error({ err }, "Failed to generate feedback PDF");
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
});

router.get("/reports/pdf/emergency-log", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const records = await db.select().from(emergenciesTable).orderBy(emergenciesTable.createdAt);
    const enriched = await Promise.all(records.map(async (r) => {
      let childName = "—";
      if (r.childId) {
        const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, r.childId));
        if (child) childName = `${child.firstName} ${child.lastName}`;
      }
      const [triggeredByUser] = await db.select().from(usersTable).where(eq(usersTable.id, r.triggeredBy));
      return [
        r.type,
        r.level,
        r.status,
        (r.description || "").slice(0, 60),
        childName,
        triggeredByUser ? `${triggeredByUser.firstName} ${triggeredByUser.lastName}` : "Unknown",
        new Date(r.createdAt).toLocaleDateString(),
        r.resolvedAt ? new Date(r.resolvedAt).toLocaleDateString() : "—",
      ];
    }));

    const resolved = enriched.filter(r => r[2] === "resolved").length;
    const medical = enriched.filter(r => r[0] === "medical").length;
    const security = enriched.filter(r => r[0] === "security").length;

    streamPdf(res, `emergency-log-${new Date().toISOString().split("T")[0]}.pdf`, (doc) => {
      renderReportPdf(doc, {
        title: "Emergency Incident Log",
        subtitle: `Generated ${new Date().toLocaleDateString()} · ${enriched.length} incidents total`,
        columns: [
          { label: "Type", width: 65 },
          { label: "Level", width: 42 },
          { label: "Status", width: 58 },
          { label: "Description", width: 125 },
          { label: "Child", width: 80 },
          { label: "Triggered By", width: 85 },
          { label: "Date", width: 60 },
        ],
        rows: enriched.map(r => r.slice(0, 7)),
        summaryStats: [
          { label: "Total Incidents", value: String(enriched.length) },
          { label: "Resolved", value: String(resolved) },
          { label: "Open", value: String(enriched.length - resolved) },
          { label: "Medical", value: String(medical) },
          { label: "Security", value: String(security) },
        ],
      });
    });
  } catch (err) {
    req.log.error({ err }, "Failed to generate emergency log PDF");
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
});

router.get("/reports/annual-summary", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const { year } = req.query as { year?: string };
    const targetYear = parseInt(year || String(new Date().getFullYear()), 10);
    const startDate = `${targetYear}-01-01`;
    const endDate = `${targetYear}-12-31`;

    const [allChildren, allFamilies, allTeachers] = await Promise.all([
      db.select().from(childrenTable),
      db.select().from(familiesTable),
      db.select().from(teachersTable),
    ]);

    const yearAttendance = await db.select().from(attendanceTable)
      .where(and(sql`${attendanceTable.serviceDate} >= ${startDate}`, sql`${attendanceTable.serviceDate} <= ${endDate}`));

    const totalSessions = yearAttendance.length;
    const uniqueChildIds = new Set(yearAttendance.map(a => a.childId));
    const pickedUp = yearAttendance.filter(a => a.status === "picked_up").length;
    const pickupRate = totalSessions > 0 ? Math.round((pickedUp / totalSessions) * 100) : 0;

    const monthlyMap: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) monthlyMap[m] = 0;
    for (const rec of yearAttendance) {
      const month = parseInt(rec.serviceDate.split("-")[1], 10);
      monthlyMap[month] = (monthlyMap[month] || 0) + 1;
    }
    const monthlyAttendance = Object.entries(monthlyMap).map(([month, count]) => ({
      month: parseInt(month, 10),
      count,
      label: new Date(targetYear, parseInt(month, 10) - 1, 1).toLocaleString("en", { month: "short" }),
    }));

    const peakMonth = monthlyAttendance.reduce((best, m) => m.count > best.count ? m : best, monthlyAttendance[0]);

    const allFeedback = await db.select().from(parentFeedbackTable);
    const yearFeedback = allFeedback.filter(f => new Date(f.createdAt).getFullYear() === targetYear);
    const avgRating = yearFeedback.length > 0
      ? (yearFeedback.reduce((s, f) => s + Number(f.rating || 0), 0) / yearFeedback.length).toFixed(1)
      : null;

    const yearEmergencies = await db.select().from(emergenciesTable)
      .where(sql`EXTRACT(YEAR FROM ${emergenciesTable.createdAt}) = ${targetYear}`);

    const newFamilies = allFamilies.filter(f => new Date(f.createdAt).getFullYear() === targetYear).length;
    const newChildren = allChildren.filter(c => new Date(c.createdAt).getFullYear() === targetYear).length;

    const teacherAllocsYear = await db.select().from(teacherAllocationsTable)
      .where(and(sql`${teacherAllocationsTable.serviceDate} >= ${startDate}`, sql`${teacherAllocationsTable.serviceDate} <= ${endDate}`));
    const completedServices = teacherAllocsYear.filter(a => a.status === "completed").length;

    res.json({
      year: targetYear,
      totalChildren: allChildren.length,
      newChildrenThisYear: newChildren,
      totalFamilies: allFamilies.length,
      newFamiliesThisYear: newFamilies,
      totalTeachers: allTeachers.length,
      totalSessions,
      uniqueChildrenAttended: uniqueChildIds.size,
      pickupRate,
      avgFeedbackRating: avgRating,
      totalFeedbackResponses: yearFeedback.length,
      totalEmergencies: yearEmergencies.length,
      resolvedEmergencies: yearEmergencies.filter(e => e.status === "resolved").length,
      completedTeacherServices: completedServices,
      monthlyAttendance,
      peakMonth: peakMonth?.label || "N/A",
      peakMonthCount: peakMonth?.count || 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load annual summary");
    res.status(500).json({ error: "Failed to load annual summary" });
  }
});

export default router;
