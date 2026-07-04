import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  sundayQrCodesTable,
  staffScansTable,
  usersTable,
  teacherAllocationsTable,
  teachersTable,
  substituteRequestsTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import QRCode from "qrcode";
import crypto from "crypto";
import { logger } from "../lib/logger";
import { sendNotification } from "../lib/notify";

const router = Router();

export const STAFF_ROLES = ["teacher", "support", "attendant", "admin", "super_admin"];

const WAT_OFFSET_MS = 60 * 60 * 1000;

function toWAT(date: Date): Date {
  return new Date(date.getTime() + WAT_OFFSET_MS);
}

function getService(watHour: number): "1st" | "2nd" {
  return watHour < 10 ? "1st" : "2nd";
}

function formatWAT(date: Date): string {
  const wat = toWAT(date);
  return `${String(wat.getUTCHours()).padStart(2, "0")}:${String(wat.getUTCMinutes()).padStart(2, "0")}`;
}

function getAppUrl(): string {
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const first = domains.split(",")[0]?.trim();
    if (first) return `https://${first}`;
  }
  return "https://shepherdconnect.name.ng";
}

async function generateQrPng(token: string, date: string): Promise<string> {
  const url = `${getAppUrl()}/scan?token=${token}&date=${encodeURIComponent(date)}`;
  return QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: "M" });
}

// POST /sunday-attendance/qr/generate — super_admin / admin
router.post("/sunday-attendance/qr/generate", authMiddleware, async (req, res): Promise<void> => {
  const role = req.user!.role;
  if (role !== "super_admin" && role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const serviceDate: string =
    (req.body.serviceDate as string) ?? new Date().toISOString().slice(0, 10);

  const [existing] = await db
    .select()
    .from(sundayQrCodesTable)
    .where(eq(sundayQrCodesTable.serviceDate, serviceDate));

  if (existing) {
    const qrPng = await generateQrPng(existing.token, serviceDate);
    res.json({ token: existing.token, serviceDate, qrPng, existing: true });
    return;
  }

  const token = crypto.randomUUID();
  const [qr] = await db
    .insert(sundayQrCodesTable)
    .values({ serviceDate, token, createdById: req.user!.userId })
    .returning();

  const qrPng = await generateQrPng(token, serviceDate);
  logger.info({ serviceDate, token }, "sunday-attendance: QR generated");
  res.status(201).json({ token: qr.token, serviceDate, qrPng, existing: false });
});

// GET /sunday-attendance/qr?date= — admin sees QR for a date
router.get("/sunday-attendance/qr", authMiddleware, async (req, res): Promise<void> => {
  const role = req.user!.role;
  if (role !== "super_admin" && role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
  const [qr] = await db
    .select()
    .from(sundayQrCodesTable)
    .where(eq(sundayQrCodesTable.serviceDate, date));

  if (!qr) {
    res.status(404).json({ error: "No QR code generated for this date" });
    return;
  }

  const qrPng = await generateQrPng(qr.token, date);
  res.json({ token: qr.token, serviceDate: date, qrPng });
});

// POST /sunday-attendance/scan — staff scans QR code
router.post("/sunday-attendance/scan", authMiddleware, async (req, res): Promise<void> => {
  const { token, date } = req.body as { token?: string; date?: string };
  if (!token || !date) {
    res.status(400).json({ error: "token and date are required" });
    return;
  }

  const [qr] = await db
    .select()
    .from(sundayQrCodesTable)
    .where(and(eq(sundayQrCodesTable.token, token), eq(sundayQrCodesTable.serviceDate, date)));

  if (!qr) {
    res.status(400).json({ error: "Invalid QR code or date mismatch" });
    return;
  }

  const userId = req.user!.userId;
  const now = new Date();
  const wat = toWAT(now);
  const service = getService(wat.getUTCHours());

  const todayScans = await db
    .select()
    .from(staffScansTable)
    .where(and(eq(staffScansTable.serviceDate, date), eq(staffScansTable.userId, userId)));

  const alreadyScanned = todayScans.some(
    s => s.service === service && s.scanType === "checkpoint"
  );

  if (alreadyScanned) {
    res.json({
      ok: true,
      duplicate: true,
      message: `Already checked in for the ${service} service`,
      service,
      scannedAt: formatWAT(now),
    });
    return;
  }

  await db.insert(staffScansTable).values({
    serviceDate: date,
    userId,
    scannedAt: now,
    scanType: "checkpoint",
    intervalLabel: null,
    service,
  });

  logger.info({ userId, date, service }, "sunday-attendance: check-in recorded");

  res.json({
    ok: true,
    duplicate: false,
    message: `Checked in at ${formatWAT(now)} WAT`,
    service,
    scannedAt: formatWAT(now),
  });
});

// POST /sunday-attendance/clock-out — staff clocks out after service
router.post("/sunday-attendance/clock-out", authMiddleware, async (req, res): Promise<void> => {
  const { date, service } = req.body as { date?: string; service?: string };
  if (!date) {
    res.status(400).json({ error: "date is required" });
    return;
  }

  const userId = req.user!.userId;
  const now = new Date();
  const wat = toWAT(now);
  const derivedService = service ?? getService(wat.getUTCHours());

  const existing = await db
    .select()
    .from(staffScansTable)
    .where(
      and(
        eq(staffScansTable.serviceDate, date),
        eq(staffScansTable.userId, userId),
        eq(staffScansTable.scanType, "clock_out")
      )
    );

  const alreadyOut = existing.some(s => s.service === derivedService);
  if (alreadyOut) {
    res.json({
      ok: true,
      duplicate: true,
      message: `Already clocked out from ${derivedService} service`,
    });
    return;
  }

  await db.insert(staffScansTable).values({
    serviceDate: date,
    userId,
    scannedAt: now,
    scanType: "clock_out",
    intervalLabel: null,
    service: derivedService,
  });

  logger.info({ userId, date, service: derivedService }, "sunday-attendance: clock-out recorded");
  res.json({
    ok: true,
    duplicate: false,
    message: `Clocked out from ${derivedService} service at ${formatWAT(now)} WAT`,
    service: derivedService,
    clockedOutAt: formatWAT(now),
  });
});

// POST /sunday-attendance/emergency-out — staff leaves early due to emergency
router.post("/sunday-attendance/emergency-out", authMiddleware, async (req, res): Promise<void> => {
  const { date, service, reason } = req.body as { date?: string; service?: string; reason?: string };
  if (!date) {
    res.status(400).json({ error: "date is required" });
    return;
  }

  const userId = req.user!.userId;
  const now = new Date();
  const wat = toWAT(now);
  const derivedService = service ?? getService(wat.getUTCHours());

  const existing = await db
    .select()
    .from(staffScansTable)
    .where(
      and(
        eq(staffScansTable.serviceDate, date),
        eq(staffScansTable.userId, userId),
        eq(staffScansTable.scanType, "emergency_out")
      )
    );

  const alreadyOut = existing.some(s => s.service === derivedService);
  if (alreadyOut) {
    res.json({
      ok: true,
      duplicate: true,
      message: `Emergency exit already recorded for ${derivedService} service`,
    });
    return;
  }

  await db.insert(staffScansTable).values({
    serviceDate: date,
    userId,
    scannedAt: now,
    scanType: "emergency_out",
    intervalLabel: reason ?? null,
    service: derivedService,
  });

  const user = req.user!;
  logger.info(
    { userId, date, service: derivedService, reason },
    "sunday-attendance: emergency exit recorded"
  );

  // Notify admins about the emergency exit
  try {
    const admins = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.isActive, true));
    const adminUsers = admins.filter(
      u => (u as typeof u & { role: string }).role === "admin" ||
           (u as typeof u & { role: string }).role === "super_admin"
    );
    for (const admin of adminUsers) {
      await sendNotification({
        userId: admin.id,
        type: "warning",
        title: "⚠️ Emergency Exit",
        message: `A staff member has made an emergency exit from the ${derivedService} service.${reason ? ` Reason: ${reason}` : ""}`,
      });
    }
  } catch (err) {
    logger.error({ err }, "sunday-attendance: failed to notify admins of emergency exit");
  }

  res.json({
    ok: true,
    duplicate: false,
    message: `Emergency exit recorded at ${formatWAT(now)} WAT from ${derivedService} service`,
    service: derivedService,
    exitedAt: formatWAT(now),
  });
});

// GET /sunday-attendance/summary?date= — admin compliance grid
router.get("/sunday-attendance/summary", authMiddleware, async (req, res): Promise<void> => {
  const role = req.user!.role;
  if (role !== "super_admin" && role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);

  const [qr] = await db
    .select()
    .from(sundayQrCodesTable)
    .where(eq(sundayQrCodesTable.serviceDate, date));

  const allActive = await db.select().from(usersTable).where(eq(usersTable.isActive, true));
  const staff = allActive.filter(u =>
    ["teacher", "support", "attendant"].includes(u.role as string)
  );

  const scans = await db
    .select()
    .from(staffScansTable)
    .where(eq(staffScansTable.serviceDate, date));

  // Build teacher allocation map: userId → serviceSlots[]
  const allocationRows = await db
    .select({
      userId: teachersTable.userId,
      serviceSlot: teacherAllocationsTable.serviceSlot,
    })
    .from(teacherAllocationsTable)
    .innerJoin(teachersTable, eq(teachersTable.id, teacherAllocationsTable.teacherId))
    .where(eq(teacherAllocationsTable.serviceDate, date));

  const allocationMap = new Map<number, Set<string>>();
  for (const row of allocationRows) {
    if (!allocationMap.has(row.userId)) allocationMap.set(row.userId, new Set());
    allocationMap.get(row.userId)!.add(row.serviceSlot as string);
  }

  // Build substitute map for this date
  const confirmedSubs = await db
    .select()
    .from(substituteRequestsTable)
    .where(
      and(
        eq(substituteRequestsTable.serviceDate, date),
        eq(substituteRequestsTable.status, "confirmed")
      )
    );
  const substituteIds = new Set(
    confirmedSubs
      .filter(s => s.substituteTeacherId !== null)
      .map(s => s.substituteTeacherId!)
  );
  const excusedIds = new Set(confirmedSubs.map(s => s.requestingTeacherId));

  function getScheduledService(userId: number, role: string): "1st" | "2nd" | "both" {
    // Non-teacher roles (support, attendant) serve both services by default
    if (role !== "teacher") return "both";
    const slots = allocationMap.get(userId);
    if (!slots || slots.size === 0) return "both";
    const has1st = slots.has("7am");
    const has2nd = slots.has("10:30am");
    if (has1st && has2nd) return "both";
    if (has1st) return "1st";
    if (has2nd) return "2nd";
    return "both";
  }

  const SERVICES = ["1st", "2nd"] as const;

  const staffRows = staff.map(s => {
    const userScans = scans.filter(sc => sc.userId === s.id);
    const checkIns = SERVICES.map(svc => {
      const scan = userScans.find(
        sc => sc.service === svc && sc.scanType === "checkpoint"
      );
      return { service: svc, scanned: !!scan, scannedAt: scan?.scannedAt ?? null };
    });
    const clockOuts = userScans
      .filter(sc => sc.scanType === "clock_out")
      .map(co => ({ service: co.service, scannedAt: co.scannedAt }));

    const emergencyScans = userScans.filter(sc => sc.scanType === "emergency_out");
    const emergencyOut = emergencyScans.length > 0
      ? { service: emergencyScans[0]!.service, exitedAt: emergencyScans[0]!.scannedAt, reason: emergencyScans[0]!.intervalLabel }
      : null;

    const scheduledService = getScheduledService(s.id, s.role as string);

    // Score: count service check-ins relevant to their scheduled service
    const relevantServices: readonly string[] =
      scheduledService === "both" ? SERVICES : [scheduledService];
    const totalScans = userScans.filter(
      sc => sc.scanType === "checkpoint" && sc.service !== null && relevantServices.includes(sc.service)
    ).length;
    const scoreMax = scheduledService === "both" ? 2 : 1;

    return {
      userId: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      role: s.role,
      photoUrl: s.photoUrl,
      checkIns,
      clockOuts,
      emergencyOut,
      scheduledService,
      totalScans,
      scoreMax,
      isSubstitute: substituteIds.has(s.id),
      isExcused: excusedIds.has(s.id),
    };
  });

  const present = staffRows.filter(s => s.totalScans > 0).length;

  res.json({
    date,
    hasQr: !!qr,
    services: SERVICES,
    staff: staffRows,
    stats: {
      total: staff.length,
      present,
      absent: staff.length - present,
      fullDay: staffRows.filter(s => s.totalScans >= s.scoreMax).length,
    },
  });
});

// GET /sunday-attendance/my-scans?date= — staff see their own record
router.get("/sunday-attendance/my-scans", authMiddleware, async (req, res): Promise<void> => {
  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
  const userId = req.user!.userId;

  const scans = await db
    .select()
    .from(staffScansTable)
    .where(and(eq(staffScansTable.serviceDate, date), eq(staffScansTable.userId, userId)));

  res.json({ date, scans });
});

// GET /sunday-attendance/dates — list of Sundays that have QR codes
router.get("/sunday-attendance/dates", authMiddleware, async (req, res): Promise<void> => {
  const role = req.user!.role;
  if (role !== "super_admin" && role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rows = await db
    .select({ serviceDate: sundayQrCodesTable.serviceDate, createdAt: sundayQrCodesTable.createdAt })
    .from(sundayQrCodesTable);
  res.json({ dates: rows });
});

export { sendNotification };
export default router;
