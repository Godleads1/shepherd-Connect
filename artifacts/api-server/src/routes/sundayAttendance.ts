import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
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
import { createNotificationDelivery } from "../services/notificationOutbox";

const router = Router();

export const STAFF_ROLES = ["teacher", "support", "admin", "super_admin"];
export const STAFF_SCAN_DEBOUNCE_MS = 30_000;

export function decideStaffScan(
  scans: Array<{ service: string | null; scanType: string; scannedAt: Date }>,
  service: "1st" | "2nd",
  now: Date,
): "checkpoint" | "duplicate_checkpoint" | "clock_out" | "already_done" {
  const checkpoint = scans.find(scan => scan.service === service && scan.scanType === "checkpoint");
  const clockOut = scans.some(scan => scan.service === service && scan.scanType === "clock_out");
  if (checkpoint && clockOut) return "already_done";
  if (!checkpoint) return "checkpoint";
  if (now.getTime() - checkpoint.scannedAt.getTime() < STAFF_SCAN_DEBOUNCE_MS) {
    return "duplicate_checkpoint";
  }
  return "clock_out";
}

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

function todayWAT(): string {
  return toWAT(new Date()).toISOString().slice(0, 10);
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
    (req.body.serviceDate as string) ?? todayWAT();
  const force: boolean = req.body.force === true;

  const [existing] = await db
    .select()
    .from(sundayQrCodesTable)
    .where(eq(sundayQrCodesTable.serviceDate, serviceDate));

  if (existing && !force) {
    const qrPng = await generateQrPng(existing.token, serviceDate);
    res.json({ token: existing.token, serviceDate, qrPng, existing: true });
    return;
  }

  if (existing && force) {
    const newToken = crypto.randomUUID();
    const [qr] = await db
      .update(sundayQrCodesTable)
      .set({ token: newToken, createdById: req.user!.userId })
      .where(eq(sundayQrCodesTable.serviceDate, serviceDate))
      .returning();

    const qrPng = await generateQrPng(qr.token, serviceDate);
    logger.info({ serviceDate, token: qr.token }, "sunday-attendance: QR regenerated");
    res.status(201).json({ token: qr.token, serviceDate, qrPng, existing: false });
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

  const date = (req.query.date as string) ?? todayWAT();
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

// POST /sunday-attendance/scan — staff scans QR code (toggles check-in → clock-out)
router.post("/sunday-attendance/scan", authMiddleware, async (req, res): Promise<void> => {
  if (!STAFF_ROLES.includes(req.user!.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
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

  const scanLockKey = Number(date.replace(/-/g, "")) * 10 + (service === "1st" ? 1 : 2);
  const outcome = await db.transaction(async (tx) => {
    // The lock covers the read/decision/write sequence. In particular, four
    // simultaneous first scans must all see the same winning checkpoint rather
    // than interpreting one another as sequential clock-out scans.
    const lock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(${userId}, ${scanLockKey}) AS acquired`);
    if (!(lock.rows[0] as { acquired: boolean }).acquired) return "concurrent_duplicate" as const;
    const todayScans = await tx.select().from(staffScansTable)
      .where(and(eq(staffScansTable.serviceDate, date), eq(staffScansTable.userId, userId)));
    const decision = decideStaffScan(todayScans, service, now);
    if (decision === "already_done" || decision === "duplicate_checkpoint") return decision;
    const scanType = decision;
    const inserted = await tx.insert(staffScansTable).values({
      serviceDate: date, userId, scannedAt: now, scanType, intervalLabel: null, service,
    }).onConflictDoNothing().returning({ id: staffScansTable.id });
    return inserted.length === 0 ? "already_done" as const : scanType;
  });

  if (outcome === "already_done" || outcome === "concurrent_duplicate" || outcome === "duplicate_checkpoint") {
    const duplicateCheckIn = outcome === "concurrent_duplicate" || outcome === "duplicate_checkpoint";
    res.json({
      ok: true,
      duplicate: true,
      action: duplicateCheckIn ? "checked_in" : "already_done",
      message: duplicateCheckIn
        ? `Check-in is already being recorded for the ${service} service`
        : `You've already checked in and clocked out for the ${service} service`,
      service,
      scannedAt: formatWAT(now),
    });
    return;
  }

  if (outcome === "checkpoint") {
    logger.info({ userId, date, service }, "sunday-attendance: check-in recorded");

    res.json({
      ok: true,
      duplicate: false,
      action: "checked_in",
      message: `Checked in at ${formatWAT(now)} WAT`,
      service,
      scannedAt: formatWAT(now),
    });
    return;
  }

  logger.info({ userId, date, service }, "sunday-attendance: clock-out recorded via scan");

  res.json({
    ok: true,
    duplicate: false,
    action: "clocked_out",
    message: `Clocked out from ${service} service at ${formatWAT(now)} WAT`,
    service,
    scannedAt: formatWAT(now),
  });
});

// POST /sunday-attendance/emergency-out — staff leaves early due to emergency
router.post("/sunday-attendance/emergency-out", authMiddleware, async (req, res): Promise<void> => {
  if (!STAFF_ROLES.includes(req.user!.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { date, service, reason } = req.body as { date?: string; service?: string; reason?: string };
  if (!date) {
    res.status(400).json({ error: "date is required" });
    return;
  }

  const userId = req.user!.userId;
  const now = new Date();
  const wat = toWAT(now);
  const derivedService = service ?? getService(wat.getUTCHours());

  const emergencyLockKey = Number(date.replace(/-/g, "")) * 10 + (derivedService === "1st" ? 1 : 2);
  const inserted = await db.transaction(async (tx) => {
    const lock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(${userId}, ${emergencyLockKey}) AS acquired`);
    if (!(lock.rows[0] as { acquired: boolean }).acquired) return [];
    const rows = await tx.insert(staffScansTable).values({
      serviceDate: date,
      userId,
      scannedAt: now,
      scanType: "emergency_out",
      intervalLabel: reason ?? null,
      service: derivedService,
    }).onConflictDoNothing().returning({ id: staffScansTable.id });
    if (rows.length === 0) return rows;
    // The emergency scan is the stable domain identity.  Resolve both the
    // recipients and content before commit so no committed exit can lose its
    // operator alert, and replay/losers cannot create another alert.
    const admins = await tx.select({ id: usersTable.id, role: usersTable.role }).from(usersTable)
      .where(eq(usersTable.isActive, true));
    for (const admin of admins) {
      if (admin.role !== "admin" && admin.role !== "super_admin") continue;
      await createNotificationDelivery(tx, {
        logicalIdentity: `staff_scan:${rows[0].id}:emergency_out:${admin.id}`,
        domainType: "staff_scan",
        domainIdentifier: String(rows[0].id),
        projection: {
          userId: admin.id, type: "warning", title: "⚠️ Emergency Exit",
          message: `A staff member has made an emergency exit from the ${derivedService} service.${reason ? ` Reason: ${reason}` : ""}`,
          metadata: { staffScanId: rows[0].id, userId, serviceDate: date, service: derivedService, reason: reason ?? null },
        },
        channels: ["whatsapp"],
        templateKey: "staff_emergency_out",
      });
    }
    return rows;
  });

  if (inserted.length === 0) {
    res.json({
      ok: true,
      duplicate: true,
      message: `Emergency exit already recorded for ${derivedService} service`,
    });
    return;
  }

  logger.info(
    { userId, date, service: derivedService, reason },
    "sunday-attendance: emergency exit recorded"
  );

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

  const date = (req.query.date as string) ?? todayWAT();

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
  const date = (req.query.date as string) ?? todayWAT();
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
