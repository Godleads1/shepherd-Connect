import { Router } from "express";
import { db } from "@workspace/db";
import { teacherClockInsTable, usersTable } from "@workspace/db/schema";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

function todayWAT(): string {
  // WAT = UTC+1; return YYYY-MM-DD string for today in Lagos time
  const now = new Date();
  const wat = new Date(now.getTime() + 60 * 60 * 1000);
  return wat.toISOString().slice(0, 10);
}

// JC geofence centre — Trinity Towers, Oniru Rd, Victoria Island, Lagos
const JC_LAT = 6.4281;
const JC_LNG = 3.4219;
const GEOFENCE_RADIUS_M = 250; // 250 metre radius
const CUTOFF_HOUR = 7; // 7:00 AM Lagos time (WAT = UTC+1)

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isOnTime(now: Date): boolean {
  // WAT = UTC+1
  const watHour = (now.getUTCHours() + 1) % 24;
  const watMin  = now.getUTCMinutes();
  return watHour < CUTOFF_HOUR || (watHour === CUTOFF_HOUR && watMin === 0);
}

// POST /teacher-clock-ins/clock-in
router.post("/teacher-clock-ins/clock-in", authMiddleware, requireRoles("teacher", "support", "admin", "super_admin"), async (req, res): Promise<void> => {
  const userId = (req as any).user.userId;
  const today = todayWAT();
  const { latitude, longitude } = req.body as { latitude?: number; longitude?: number };

  if (latitude === undefined || longitude === undefined) {
    res.status(400).json({ error: "Bad request", message: "GPS coordinates required. Please enable location access and try again." });
    return;
  }

  const dist = haversineDistance(latitude, longitude, JC_LAT, JC_LNG);
  const withinGeofence = dist <= GEOFENCE_RADIUS_M;

  if (!withinGeofence) {
    res.status(403).json({
      error: "Outside geofence",
      message: `You must be physically inside JC to clock in. You appear to be ${Math.round(dist)}m away from the building.`,
      distanceMetres: Math.round(dist),
    });
    return;
  }

  // Check for existing clock-in today
  const [existing] = await db.select().from(teacherClockInsTable)
    .where(and(eq(teacherClockInsTable.userId, userId), eq(teacherClockInsTable.serviceDate, today)));

  if (existing?.clockInAt) {
    res.status(409).json({ error: "Conflict", message: "You have already clocked in today." });
    return;
  }

  const now = new Date();
  const onTime = isOnTime(now);

  if (existing) {
    const [updated] = await db.update(teacherClockInsTable)
      .set({ clockInAt: now, clockInLat: latitude, clockInLng: longitude, isOnTime: onTime, isWithinGeofence: true })
      .where(eq(teacherClockInsTable.id, existing.id))
      .returning();
    req.log.info({ userId, onTime, dist: Math.round(dist) }, "Teacher clocked in");
    res.json({ success: true, record: updated, onTime, distanceMetres: Math.round(dist) });
    return;
  }

  const [record] = await db.insert(teacherClockInsTable).values({
    userId,
    serviceDate: today,
    clockInAt: now,
    clockInLat: latitude,
    clockInLng: longitude,
    isOnTime: onTime,
    isWithinGeofence: true,
  }).returning();

  req.log.info({ userId, onTime, dist: Math.round(dist) }, "Teacher clocked in");
  res.status(201).json({ success: true, record, onTime, distanceMetres: Math.round(dist) });
});

// POST /teacher-clock-ins/clock-out
router.post("/teacher-clock-ins/clock-out", authMiddleware, requireRoles("teacher", "support", "admin", "super_admin"), async (req, res): Promise<void> => {
  const userId = (req as any).user.userId;
  const today = todayWAT();

  const [existing] = await db.select().from(teacherClockInsTable)
    .where(and(eq(teacherClockInsTable.userId, userId), eq(teacherClockInsTable.serviceDate, today)));

  if (!existing?.clockInAt) {
    res.status(400).json({ error: "Bad request", message: "You have not clocked in today." });
    return;
  }
  if (existing.clockOutAt) {
    res.status(409).json({ error: "Conflict", message: "You have already clocked out today." });
    return;
  }

  const [updated] = await db.update(teacherClockInsTable)
    .set({ clockOutAt: new Date() })
    .where(eq(teacherClockInsTable.id, existing.id))
    .returning();

  req.log.info({ userId }, "Teacher clocked out");
  res.json({ success: true, record: updated });
});

// GET /teacher-clock-ins/today — teacher's own status for today
router.get("/teacher-clock-ins/today", authMiddleware, requireRoles("teacher", "support", "admin", "super_admin"), async (req, res): Promise<void> => {
  const userId = (req as any).user.userId;
  const today = todayWAT();
  const [record] = await db.select().from(teacherClockInsTable)
    .where(and(eq(teacherClockInsTable.userId, userId), eq(teacherClockInsTable.serviceDate, today)));
  res.json({ record: record ?? null });
});

// GET /teacher-clock-ins/summary?date=YYYY-MM-DD — full staff roster vs clock-in records
router.get("/teacher-clock-ins/summary", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const date = (req.query["date"] as string) || todayWAT();

  // All active teachers + support staff
  const staff = await db
    .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, role: usersTable.role, photoUrl: usersTable.photoUrl })
    .from(usersTable)
    .where(and(
      eq(usersTable.isActive, true),
      inArray(usersTable.role, ["teacher", "support"]),
    ));

  // Clock-in records for that date
  const records = await db.select().from(teacherClockInsTable)
    .where(eq(teacherClockInsTable.serviceDate, date));

  const recordMap = new Map(records.map(r => [r.userId, r]));

  const roster = staff.map(u => ({
    userId: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    photoUrl: u.photoUrl,
    clockIn: recordMap.get(u.id) ?? null,
  }));

  const present = roster.filter(r => r.clockIn?.clockInAt).length;
  const onTime  = roster.filter(r => r.clockIn?.isOnTime === true).length;
  const late    = roster.filter(r => r.clockIn?.isOnTime === false).length;
  const absent  = roster.length - present;

  res.json({
    date,
    stats: { total: roster.length, present, onTime, late, absent },
    staff: roster.sort((a, b) => {
      // Clocked-in first, then alphabetical
      const aIn = !!a.clockIn?.clockInAt;
      const bIn = !!b.clockIn?.clockInAt;
      if (aIn !== bIn) return aIn ? -1 : 1;
      return a.firstName.localeCompare(b.firstName);
    }),
  });
});

// GET /teacher-clock-ins — admin: all records, optionally filtered by date or date range
router.get("/teacher-clock-ins", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const { date, from, to } = req.query as { date?: string; from?: string; to?: string };

  let whereClause;
  if (date) {
    whereClause = eq(teacherClockInsTable.serviceDate, date);
  } else if (from && to) {
    whereClause = and(
      gte(teacherClockInsTable.serviceDate, from),
      lte(teacherClockInsTable.serviceDate, to),
    );
  } else if (from) {
    whereClause = gte(teacherClockInsTable.serviceDate, from);
  } else if (to) {
    whereClause = lte(teacherClockInsTable.serviceDate, to);
  }

  const rows = await db
    .select({
      id: teacherClockInsTable.id,
      userId: teacherClockInsTable.userId,
      serviceDate: teacherClockInsTable.serviceDate,
      clockInAt: teacherClockInsTable.clockInAt,
      clockOutAt: teacherClockInsTable.clockOutAt,
      isOnTime: teacherClockInsTable.isOnTime,
      isWithinGeofence: teacherClockInsTable.isWithinGeofence,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      photoUrl: usersTable.photoUrl,
    })
    .from(teacherClockInsTable)
    .innerJoin(usersTable, eq(teacherClockInsTable.userId, usersTable.id))
    .where(whereClause)
    .orderBy(desc(teacherClockInsTable.serviceDate), teacherClockInsTable.clockInAt);

  res.json(rows);
});

// GET /teacher-clock-ins/export — CSV download
router.get("/teacher-clock-ins/export", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const { from, to } = req.query as { from?: string; to?: string };

  let whereClause;
  if (from && to) {
    whereClause = and(gte(teacherClockInsTable.serviceDate, from), lte(teacherClockInsTable.serviceDate, to));
  } else if (from) {
    whereClause = gte(teacherClockInsTable.serviceDate, from);
  } else if (to) {
    whereClause = lte(teacherClockInsTable.serviceDate, to);
  }

  const rows = await db
    .select({
      serviceDate: teacherClockInsTable.serviceDate,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      clockInAt: teacherClockInsTable.clockInAt,
      clockOutAt: teacherClockInsTable.clockOutAt,
      isOnTime: teacherClockInsTable.isOnTime,
      isWithinGeofence: teacherClockInsTable.isWithinGeofence,
    })
    .from(teacherClockInsTable)
    .innerJoin(usersTable, eq(teacherClockInsTable.userId, usersTable.id))
    .where(whereClause)
    .orderBy(desc(teacherClockInsTable.serviceDate), teacherClockInsTable.clockInAt);

  function fmtTs(ts: Date | null): string {
    if (!ts) return "";
    try {
      const d = new Date(ts);
      const watMs = d.getTime() + 60 * 60 * 1000;
      const w = new Date(watMs);
      const hh = String(w.getUTCHours()).padStart(2, "0");
      const mm = String(w.getUTCMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    } catch { return ""; }
  }

  const headers = ["Date", "First Name", "Last Name", "Clock In (WAT)", "Clock Out (WAT)", "Status", "Within Geofence"];
  const csvRows = rows.map(r => [
    r.serviceDate,
    r.firstName,
    r.lastName,
    fmtTs(r.clockInAt),
    fmtTs(r.clockOutAt),
    r.clockInAt === null ? "Not Clocked In" : r.isOnTime ? "On Time" : "Late",
    r.isWithinGeofence ? "Yes" : "No",
  ]);

  const csv = [headers, ...csvRows]
    .map(row => row.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const label = from && to ? `${from}-to-${to}` : from ?? to ?? "all";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="teacher-time-log-${label}.csv"`);
  res.send(csv);
});

export default router;
