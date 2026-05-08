import { Router } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db, attendanceTable, childrenTable, classesTable, familiesTable, usersTable, emergenciesTable, pickupDelegatesTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

router.get("/reports/not-picked-up", authMiddleware, requireRoles("super_admin", "admin", "attendant"), async (req, res): Promise<void> => {
  const { serviceDate, serviceSlot } = req.query as { serviceDate?: string; serviceSlot?: string };
  const today = serviceDate || new Date().toISOString().split("T")[0];

  const conditions = [
    eq(attendanceTable.serviceDate, today),
    ne(attendanceTable.status, "picked_up"),
  ];
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
    return {
      ...r,
      child: child || null,
      class: cls || null,
      family: family ? { id: family.id, familyCode: family.familyCode, parentPhone } : null,
      minutesSinceCheckIn: checkInMins,
    };
  }));

  res.json({ date: today, serviceSlot: serviceSlot || "all", total: enriched.length, children: enriched });
});

router.get("/reports/attendance-export", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { from, to, serviceSlot, format = "json" } = req.query as {
    from?: string; to?: string; serviceSlot?: string; format?: string;
  };

  const conditions = [];
  if (serviceSlot) conditions.push(eq(attendanceTable.serviceSlot, serviceSlot));

  const records = await db.select().from(attendanceTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(attendanceTable.serviceDate);

  const enriched = await Promise.all(records.map(async (r) => {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, r.childId));
    const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, r.classId));
    return {
      date: r.serviceDate,
      serviceSlot: r.serviceSlot,
      childName: child ? `${child.firstName} ${child.lastName}` : "Unknown",
      className: cls?.name || "Unknown",
      status: r.status,
      checkInTime: r.checkInTime,
      checkOutTime: r.checkOutTime,
    };
  }));

  const filtered = enriched.filter(r => {
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    return true;
  });

  if (format === "csv") {
    const headers = ["Date", "Service Slot", "Child Name", "Class", "Status", "Check-in Time", "Check-out Time"];
    const rows = filtered.map(r => [
      r.date,
      r.serviceSlot,
      r.childName,
      r.className,
      r.status,
      r.checkInTime ? new Date(r.checkInTime).toLocaleString() : "",
      r.checkOutTime ? new Date(r.checkOutTime).toLocaleString() : "",
    ]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${from || "all"}-to-${to || "all"}.csv"`);
    res.send(csv);
    return;
  }

  res.json({ total: filtered.length, from, to, serviceSlot: serviceSlot || "all", data: filtered });
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
    return {
      id: r.id,
      type: r.type,
      level: r.level,
      status: r.status,
      description: r.description,
      childName,
      triggeredBy: triggeredByUser ? `${triggeredByUser.firstName} ${triggeredByUser.lastName}` : "Unknown",
      resolutionNotes: r.resolutionNotes,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
    };
  }));

  if (format === "csv") {
    const headers = ["ID", "Type", "Level", "Status", "Description", "Child", "Triggered By", "Resolution", "Created At", "Resolved At"];
    const rows = enriched.map(r => [
      r.id, r.type, r.level, r.status, r.description,
      r.childName || "", r.triggeredBy, r.resolutionNotes || "",
      new Date(r.createdAt).toLocaleString(),
      r.resolvedAt ? new Date(r.resolvedAt).toLocaleString() : "",
    ]);
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
    const conditions = [
      eq(attendanceTable.classId, cls.id),
      eq(attendanceTable.serviceDate, today),
    ];
    if (serviceSlot) conditions.push(eq(attendanceTable.serviceSlot, serviceSlot));
    const attendees = await db.select().from(attendanceTable).where(and(...conditions));
    const childCount = attendees.filter(a => a.status !== "picked_up").length;
    const recommended = Math.ceil(childCount / 6);
    return {
      classId: cls.id,
      className: cls.name,
      roomLocation: cls.roomLocation,
      serviceSlot: cls.serviceSlot,
      capacity: cls.capacity,
      childrenPresent: childCount,
      recommendedTeachers: recommended,
      ratio: childCount > 0 ? `1:${Math.ceil(childCount / Math.max(1, recommended))}` : "N/A",
      alert: childCount > 0 && recommended > 1,
    };
  }));

  res.json({ date: today, serviceSlot: serviceSlot || "all", classes: ratios });
});

router.get("/reports/summary", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { serviceDate } = req.query as { serviceDate?: string };
  const today = serviceDate || new Date().toISOString().split("T")[0];

  const todayAttendance = await db.select().from(attendanceTable)
    .where(eq(attendanceTable.serviceDate, today));

  const totalCheckedIn = todayAttendance.length;
  const stillPresent = todayAttendance.filter(a => a.status !== "picked_up").length;
  const pickedUp = todayAttendance.filter(a => a.status === "picked_up").length;

  const delegates = await db.select().from(pickupDelegatesTable)
    .where(eq(pickupDelegatesTable.parentApproved, false));

  const pendingApprovals = await db.select().from(usersTable)
    .where(eq(usersTable.status, "pending_approval"));

  res.json({
    date: today,
    totalCheckedIn,
    stillPresent,
    pickedUp,
    pendingDelegateApprovals: delegates.length,
    pendingUserApprovals: pendingApprovals.length,
  });
});

export default router;
