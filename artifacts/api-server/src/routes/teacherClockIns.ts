import { Router } from "express";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { teacherClockInsTable, usersTable, auditLogsTable } from "@workspace/db/schema";
import { eq, and, desc, gte, lte, inArray, sql } from "drizzle-orm";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

export function teacherClockInCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map(row => row.map(value => {
    const text = String(value ?? "");
    const safe = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
}
const exportQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();
const MAX_EXPORT_DAYS = 92;
const MAX_EXPORT_ROWS = 2_000;

function validDate(value: string | undefined): boolean {
  if (!value) return true;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function todayWAT(): string {
  // WAT = UTC+1; return YYYY-MM-DD string for today in Lagos time
  const now = new Date();
  const wat = new Date(now.getTime() + 60 * 60 * 1000);
  return wat.toISOString().slice(0, 10);
}

// JC geofence centre — Trinity Towers, Oniru Rd, Victoria Island, Lagos
const JC_LAT = 6.4281;
const JC_LNG = 3.4219;
const GEOFENCE_RADIUS_M = 150; // 150 metre radius
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

  // Location is optional — staff can clock in from anywhere. If coordinates
  // are provided we still record them (and whether they were inside JC) for
  // reporting purposes only; they never block the clock-in.
  const hasCoords = latitude !== undefined && longitude !== undefined;
  const dist = hasCoords ? haversineDistance(latitude!, longitude!, JC_LAT, JC_LNG) : null;
  const withinGeofence = dist !== null && dist <= GEOFENCE_RADIUS_M;

  // Check for existing clock-in today
  const [existing] = await db.select().from(teacherClockInsTable)
    .where(and(eq(teacherClockInsTable.userId, userId), eq(teacherClockInsTable.serviceDate, today)));

  if (existing?.clockInAt) {
    res.status(409).json({ error: "Conflict", message: "You have already clocked in today." });
    return;
  }

  const now = new Date();
  const onTime = isOnTime(now);

  const distanceMetres = dist !== null ? Math.round(dist) : null;

  if (existing) {
    const [updated] = await db.update(teacherClockInsTable)
      .set({ clockInAt: now, clockInLat: latitude ?? null, clockInLng: longitude ?? null, isOnTime: onTime, isWithinGeofence: withinGeofence })
      .where(eq(teacherClockInsTable.id, existing.id))
      .returning();
    req.log.info({ userId, onTime, dist: distanceMetres }, "Teacher clocked in");
    res.json({ success: true, record: updated, onTime, distanceMetres });
    return;
  }

  const [record] = await db.insert(teacherClockInsTable).values({
    userId,
    serviceDate: today,
    clockInAt: now,
    clockInLat: latitude ?? null,
    clockInLng: longitude ?? null,
    isOnTime: onTime,
    isWithinGeofence: withinGeofence,
  }).returning();

  req.log.info({ userId, onTime, dist: distanceMetres }, "Teacher clocked in");
  res.status(201).json({ success: true, record, onTime, distanceMetres });
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

// POST /teacher-clock-ins/bulk-mark-present — admin marks every unclocked teacher/support present
router.post("/teacher-clock-ins/bulk-mark-present", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const { date } = req.body as { date?: string };
  const serviceDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayWAT();
  if (serviceDate > todayWAT()) {
    res.status(400).json({ error: "Bad request", message: "Cannot mark attendance for a future date." });
    return;
  }

  const adminUser = (req as any).user;
  const adminName = `${adminUser.firstName ?? ""} ${adminUser.lastName ?? ""}`.trim() || `user #${adminUser.userId}`;

  // All active teachers + support staff
  const staff = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.isActive, true), inArray(usersTable.role, ["teacher", "support"])));

  if (staff.length === 0) {
    res.json({ success: true, date: serviceDate, marked: 0, skipped: 0, total: 0 });
    return;
  }

  const now = new Date();
  const note = `Marked present by admin (${adminName})`;

  // Atomic upsert guarded by the (user_id, service_date) unique index.
  // Only rows without a genuine clock-in are touched — a concurrent teacher
  // clock-in can never be overwritten (the WHERE on the conflict update skips it).
  const updated = await db
    .insert(teacherClockInsTable)
    .values(staff.map(u => ({
      userId: u.id,
      serviceDate,
      clockInAt: now,
      isOnTime: null as boolean | null,
      isWithinGeofence: false,
      notes: note,
    })))
    .onConflictDoUpdate({
      target: [teacherClockInsTable.userId, teacherClockInsTable.serviceDate],
      set: { clockInAt: now, isOnTime: null, isWithinGeofence: false, notes: note },
      setWhere: sql`${teacherClockInsTable.clockInAt} IS NULL`,
    })
    .returning({ id: teacherClockInsTable.id });

  const marked = updated.length;
  const skipped = staff.length - marked;

  req.log.info({ adminId: adminUser.userId, serviceDate, marked, skipped }, "bulk-mark-present: admin marked staff attendance");
  res.json({ success: true, date: serviceDate, marked, skipped, total: staff.length });
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
  const parsed = exportQuery.safeParse(req.query);
  if (!parsed.success || !validDate(parsed.data?.from) || !validDate(parsed.data?.to)) { res.status(400).json({ error: "Invalid export date filters" }); return; }
  const { from, to } = parsed.data;
  if (from && to) {
    const days = (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000;
    if (days < 0 || days > MAX_EXPORT_DAYS) { res.status(400).json({ error: `Date range must be ordered and may not exceed ${MAX_EXPORT_DAYS} days` }); return; }
  }

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
      clockInLat: teacherClockInsTable.clockInLat,
    })
    .from(teacherClockInsTable)
    .innerJoin(usersTable, eq(teacherClockInsTable.userId, usersTable.id))
    .where(whereClause)
    .orderBy(desc(teacherClockInsTable.serviceDate), teacherClockInsTable.clockInAt)
    .limit(MAX_EXPORT_ROWS);

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
    // Location is optional at clock-in: distinguish "no GPS recorded" from a
    // measured outside-geofence position.
    r.clockInLat === null ? "Not recorded" : r.isWithinGeofence ? "Yes" : "No",
  ]);

  const csv = teacherClockInCsv([headers, ...csvRows]);

  const label = from && to ? `${from}-to-${to}` : from ?? to ?? "all";
  await db.insert(auditLogsTable).values({
    userId: req.user!.userId,
    action: "report_export",
    entityType: "teacher_clock_ins",
    ipAddress: req.ip?.slice(0, 64) || null,
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 512) : null,
    metadataJson: JSON.stringify({ role: req.user!.role, format: "csv", filters: { ...(from ? { from } : {}), ...(to ? { to } : {}) }, rowCount: rows.length, sensitivityClass: "operational" }),
  });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="teacher-time-log-${label}.csv"`);
  res.send(csv);
});

export default router;
