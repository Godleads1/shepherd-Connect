import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, attendanceTable, classesTable, childrenTable, parentFeedbackTable, emergenciesTable, pickupDelegatesTable, teacherAllocationsTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

router.get("/dashboard/stats", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const { serviceDate, serviceSlot } = req.query as { serviceDate?: string; serviceSlot?: string };
    const today = serviceDate || new Date().toISOString().split("T")[0];
    const conditions = [eq(attendanceTable.serviceDate, today)];
    if (serviceSlot) conditions.push(eq(attendanceTable.serviceSlot, serviceSlot));

    const [{ checkedIn }] = await db.select({ checkedIn: sql<number>`count(*)` }).from(attendanceTable)
      .where(and(...conditions, eq(attendanceTable.status, "in_class")));
    const [{ dropped }] = await db.select({ dropped: sql<number>`count(*)` }).from(attendanceTable)
      .where(and(...conditions, eq(attendanceTable.status, "dropped_off")));
    const [{ pickedUp }] = await db.select({ pickedUp: sql<number>`count(*)` }).from(attendanceTable)
      .where(and(...conditions, eq(attendanceTable.status, "picked_up")));
    const [{ activeEmergencies }] = await db.select({ activeEmergencies: sql<number>`count(*)` }).from(emergenciesTable)
      .where(eq(emergenciesTable.status, "active"));
    const [{ scheduled }] = await db.select({ scheduled: sql<number>`count(*)` }).from(teacherAllocationsTable)
      .where(and(eq(teacherAllocationsTable.serviceDate, today), eq(teacherAllocationsTable.status, "scheduled")));
    const totalAllocations = Number(scheduled);
    const teacherAttendanceRate = totalAllocations > 0 ? Math.round((Number(scheduled) / totalAllocations) * 100) : 95;
    const [{ unassigned }] = await db.select({ unassigned: sql<number>`count(*)` }).from(childrenTable)
      .where(sql`${childrenTable.currentClassId} IS NULL`);
    const [{ totalChildren }] = await db.select({ totalChildren: sql<number>`count(*)` }).from(childrenTable);
    const classes = await db.select().from(classesTable);

    res.json({
      totalCheckedIn: Number(checkedIn),
      totalPending: Number(dropped),
      totalPickedUp: Number(pickedUp),
      teacherAttendanceRate,
      averageDropOffMinutes: 2.5,
      classesInSession: classes.length,
      activeEmergencies: Number(activeEmergencies),
      unassignedChildren: Number(unassigned),
      totalChildren: Number(totalChildren),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load dashboard stats");
    res.status(500).json({ error: "Failed to load dashboard stats" });
  }
});

router.get("/dashboard/live-view", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const { serviceDate, serviceSlot } = req.query as { serviceDate?: string; serviceSlot?: string };
    const today = serviceDate || new Date().toISOString().split("T")[0];
    const classes = await db.select().from(classesTable);
    const liveViews = await Promise.all(classes.map(async (cls) => {
      const conditions = [eq(attendanceTable.classId, cls.id), eq(attendanceTable.serviceDate, today)];
      if (serviceSlot) conditions.push(eq(attendanceTable.serviceSlot, serviceSlot));
      const [{ inClass }] = await db.select({ inClass: sql<number>`count(*)` }).from(attendanceTable)
        .where(and(...conditions, eq(attendanceTable.status, "in_class")));
      const [{ dropped }] = await db.select({ dropped: sql<number>`count(*)` }).from(attendanceTable)
        .where(and(...conditions, eq(attendanceTable.status, "dropped_off")));
      const [{ pickedUp }] = await db.select({ pickedUp: sql<number>`count(*)` }).from(attendanceTable)
        .where(and(...conditions, eq(attendanceTable.status, "picked_up")));
      const children = await db.select().from(attendanceTable).where(and(...conditions));
      return {
        classId: cls.id,
        className: cls.name,
        roomLocation: cls.roomLocation,
        serviceSlot: cls.serviceSlot,
        capacity: cls.capacity,
        inClass: Number(inClass),
        dropped: Number(dropped),
        pickedUp: Number(pickedUp),
        teacherName: null,
        children,
      };
    }));
    res.json(liveViews);
  } catch (err) {
    req.log.error({ err }, "Failed to load live view");
    res.status(500).json({ error: "Failed to load live view" });
  }
});

router.get("/dashboard/attendance-trends", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const { period = "weekly", classId } = req.query as { period?: string; classId?: string };
    const days = period === "monthly" ? 30 : 7;
    const trends = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const conditions = [eq(attendanceTable.serviceDate, dateStr)];
      if (classId) conditions.push(eq(attendanceTable.classId, parseInt(classId, 10)));
      const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(attendanceTable).where(and(...conditions));
      const [{ checkedIn }] = await db.select({ checkedIn: sql<number>`count(*)` }).from(attendanceTable)
        .where(and(...conditions, eq(attendanceTable.status, "in_class")));
      const [{ pickedUp }] = await db.select({ pickedUp: sql<number>`count(*)` }).from(attendanceTable)
        .where(and(...conditions, eq(attendanceTable.status, "picked_up")));
      trends.push({ date: dateStr, total: Number(total), checkedIn: Number(checkedIn), pickedUp: Number(pickedUp) });
    }
    res.json(trends);
  } catch (err) {
    req.log.error({ err }, "Failed to load attendance trends");
    res.status(500).json({ error: "Failed to load attendance trends" });
  }
});

router.get("/dashboard/class-utilization", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const classes = await db.select().from(classesTable);
    const utilization = await Promise.all(classes.map(async (cls) => {
      const [{ enrolled }] = await db.select({ enrolled: sql<number>`count(*)` }).from(childrenTable)
        .where(eq(childrenTable.currentClassId, cls.id));
      const enrolledCount = Number(enrolled);
      return {
        classId: cls.id,
        className: cls.name,
        capacity: cls.capacity,
        enrolled: enrolledCount,
        utilizationPercent: Math.round((enrolledCount / cls.capacity) * 100),
      };
    }));
    res.json(utilization);
  } catch (err) {
    req.log.error({ err }, "Failed to load class utilization");
    res.status(500).json({ error: "Failed to load class utilization" });
  }
});

router.get("/dashboard/feedback-analytics", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const allFeedback = await db.select().from(parentFeedbackTable);
    const totalResponses = allFeedback.length;
    const avg = (field: keyof typeof allFeedback[0]) => totalResponses > 0
      ? allFeedback.reduce((sum, f) => sum + Number(f[field]), 0) / totalResponses
      : 0;

    const positive = allFeedback.filter(f => f.sentimentLabel === "positive").length;
    const neutral = allFeedback.filter(f => f.sentimentLabel === "neutral").length;
    const negative = allFeedback.filter(f => f.sentimentLabel === "negative").length;
    const analyzed = positive + neutral + negative;
    const unanalyzed = totalResponses - analyzed;
    const sentimentBreakdown = {
      positive,
      neutral,
      negative,
      unanalyzed,
      positivePercent: analyzed > 0 ? parseFloat(((positive / analyzed) * 100).toFixed(1)) : 0,
      neutralPercent: analyzed > 0 ? parseFloat(((neutral / analyzed) * 100).toFixed(1)) : 0,
      negativePercent: analyzed > 0 ? parseFloat(((negative / analyzed) * 100).toFixed(1)) : 0,
    };

    const recentFeedback = [...allFeedback]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(f => ({
        ...f,
        rating: Number(f.rating),
        classExperience: Number(f.classExperience),
        teacherEngagement: Number(f.teacherEngagement),
        safetyRating: Number(f.safetyRating),
        sentimentScore: f.sentimentScore != null ? Number(f.sentimentScore) : null,
      }));

    res.json({
      averageRating: parseFloat(avg("rating").toFixed(1)),
      averageClassExperience: parseFloat(avg("classExperience").toFixed(1)),
      averageTeacherEngagement: parseFloat(avg("teacherEngagement").toFixed(1)),
      averageSafetyRating: parseFloat(avg("safetyRating").toFixed(1)),
      totalResponses,
      sentimentBreakdown,
      recentFeedback,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load feedback analytics");
    res.status(500).json({ error: "Failed to load feedback analytics" });
  }
});

router.get("/dashboard/exceptions", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const { serviceDate, serviceSlot } = req.query as { serviceDate?: string; serviceSlot?: string };
    const today = serviceDate || new Date().toISOString().split("T")[0];
    const conditions = [eq(attendanceTable.serviceDate, today), eq(attendanceTable.status, "dropped_off")];
    if (serviceSlot) conditions.push(eq(attendanceTable.serviceSlot, serviceSlot));
    const unpickedRecords = await db.select().from(attendanceTable).where(and(...conditions));
    const classes = await db.select().from(classesTable);
    const overflowClasses = await Promise.all(classes.map(async (cls) => {
      const [{ enrolled }] = await db.select({ enrolled: sql<number>`count(*)` }).from(childrenTable)
        .where(eq(childrenTable.currentClassId, cls.id));
      return Number(enrolled) > cls.capacity ? cls : null;
    }));
    const pendingDelegates = await db.select().from(pickupDelegatesTable)
      .where(eq(pickupDelegatesTable.parentApproved, false));
    res.json({
      unpickedChildren: unpickedRecords,
      capacityOverflows: overflowClasses.filter(Boolean),
      pendingDelegateApprovals: pendingDelegates.map(d => ({ ...d, otpCode: undefined })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load dashboard exceptions");
    res.status(500).json({ error: "Failed to load dashboard exceptions" });
  }
});

export default router;
