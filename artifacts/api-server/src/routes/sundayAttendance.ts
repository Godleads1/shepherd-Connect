import { Router } from "express";
import { eq, and, isNull, sql } from "drizzle-orm";
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
import { createHash, randomBytes } from "node:crypto";
import { logger } from "../lib/logger";
import { sendNotification } from "../lib/notify";
import { createNotificationDelivery } from "../services/notificationOutbox";

const router = Router();

export const STAFF_ROLES = ["teacher", "support", "admin", "super_admin"] as const;
export const STAFF_QR_PURPOSE = "staff_attendance";
const SERVICE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function decideStaffScan(
  scans: Array<{ service: string | null; scanType: string }>,
  service: "1st" | "2nd",
  action: "check_in" | "clock_out",
): "checkpoint" | "clock_out" | "already_done" | "checkpoint_required" {
  const hasCheckpoint = scans.some(scan => scan.service === service && scan.scanType === "checkpoint");
  const hasClockOut = scans.some(scan => scan.service === service && scan.scanType === "clock_out");
  if (action === "check_in") return hasCheckpoint ? "already_done" : "checkpoint";
  if (!hasCheckpoint) return "checkpoint_required";
  return hasClockOut ? "already_done" : "clock_out";
}

export function hashStaffQrToken(token: string): string {
  return createHash("sha256").update(`staff-attendance:${token}`).digest("hex");
}

function isServiceDate(value: unknown): value is string {
  return typeof value === "string" && SERVICE_DATE_RE.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function hasOnlyKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every(key => keys.includes(key));
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

  if (!hasOnlyKeys(req.body, ["serviceDate", "force"])) {
    res.status(400).json({ error: "Invalid QR generation request" });
    return;
  }
  const body = req.body as { serviceDate?: unknown; force?: unknown };
  const serviceDate = body.serviceDate ?? todayWAT();
  if (!isServiceDate(serviceDate) || (body.force !== undefined && typeof body.force !== "boolean")) {
    res.status(400).json({ error: "serviceDate must be YYYY-MM-DD and force must be boolean" });
    return;
  }
  const force = body.force === true;
  const token = randomBytes(32).toString("base64url");
  const qr = await db.transaction(async tx => {
    const lockKey = Number(serviceDate.replace(/-/g, ""));
    await tx.execute(sql`SELECT pg_advisory_xact_lock(917, ${lockKey})`);
    const [existing] = await tx.select().from(sundayQrCodesTable)
      .where(eq(sundayQrCodesTable.serviceDate, serviceDate));
    if (existing && !force && existing.purpose === STAFF_QR_PURPOSE && !existing.revokedAt) {
      return null;
    }
    if (existing) {
      const [rotated] = await tx.update(sundayQrCodesTable)
        .set({ tokenHash: hashStaffQrToken(token), purpose: STAFF_QR_PURPOSE, revokedAt: null, createdById: req.user!.userId })
        .where(eq(sundayQrCodesTable.id, existing.id)).returning();
      return rotated;
    }
    const [created] = await tx.insert(sundayQrCodesTable).values({
      serviceDate, tokenHash: hashStaffQrToken(token), purpose: STAFF_QR_PURPOSE, createdById: req.user!.userId,
    }).returning();
    return created;
  });
  if (!qr) {
    // Bearer values are deliberately unrecoverable after issuance. Rotate to
    // issue a replacement rather than ever retaining a plaintext token.
    res.status(409).json({ error: "An active QR already exists; rotate it to issue a replacement" });
    return;
  }
  const qrPng = await generateQrPng(token, serviceDate);
  logger.info({ serviceDate, rotated: force }, "sunday-attendance: QR issued");
  res.status(201).json({ token, serviceDate, qrPng, existing: false });
});

// GET /sunday-attendance/qr?date= — admin sees QR for a date
router.get("/sunday-attendance/qr", authMiddleware, async (req, res): Promise<void> => {
  const role = req.user!.role;
  if (role !== "super_admin" && role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const date = (req.query.date as string) ?? todayWAT();
  if (!isServiceDate(date)) {
    res.status(400).json({ error: "date must be YYYY-MM-DD" });
    return;
  }
  const [qr] = await db
    .select()
    .from(sundayQrCodesTable)
    .where(eq(sundayQrCodesTable.serviceDate, date));

  if (!qr) {
    res.status(404).json({ error: "No QR code generated for this date" });
    return;
  }

  // The bearer token is hashed and cannot be retrieved after issuance.
  res.json({ serviceDate: date, active: qr.purpose === STAFF_QR_PURPOSE && !qr.revokedAt });
});

// POST /sunday-attendance/qr/revoke — super_admin / admin
router.post("/sunday-attendance/qr/revoke", authMiddleware, async (req, res): Promise<void> => {
  if (req.user!.role !== "super_admin" && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!hasOnlyKeys(req.body, ["serviceDate"]) || !isServiceDate(req.body.serviceDate)) {
    res.status(400).json({ error: "serviceDate must be YYYY-MM-DD" });
    return;
  }
  const [revoked] = await db.update(sundayQrCodesTable).set({ revokedAt: new Date() })
    .where(and(eq(sundayQrCodesTable.serviceDate, req.body.serviceDate), eq(sundayQrCodesTable.purpose, STAFF_QR_PURPOSE), isNull(sundayQrCodesTable.revokedAt)))
    .returning({ id: sundayQrCodesTable.id });
  if (!revoked) {
    res.status(404).json({ error: "No active QR code generated for this date" });
    return;
  }
  logger.info({ serviceDate: req.body.serviceDate }, "sunday-attendance: QR revoked");
  res.json({ ok: true, serviceDate: req.body.serviceDate });
});

// POST /sunday-attendance/scan — staff records one attendance row per service
router.post("/sunday-attendance/scan", authMiddleware, async (req, res): Promise<void> => {
  if (!STAFF_ROLES.includes(req.user!.role as typeof STAFF_ROLES[number])) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!hasOnlyKeys(req.body, ["token", "date", "action"])) {
    res.status(400).json({ error: "Invalid scan request" });
    return;
  }
  const { token, date, action } = req.body as { token?: unknown; date?: unknown; action?: unknown };
  if (typeof token !== "string" || token.length < 32 || token.length > 128 || !isServiceDate(date) ||
    (action !== "check_in" && action !== "clock_out")) {
    res.status(400).json({ error: "token, date, and action (check_in or clock_out) are required" });
    return;
  }
  if (date !== todayWAT()) {
    res.status(400).json({ error: "QR code is valid only on its service date" });
    return;
  }

  const [qr] = await db
    .select()
    .from(sundayQrCodesTable)
    .where(and(
      eq(sundayQrCodesTable.tokenHash, hashStaffQrToken(token)),
      eq(sundayQrCodesTable.serviceDate, date),
      eq(sundayQrCodesTable.purpose, STAFF_QR_PURPOSE),
      isNull(sundayQrCodesTable.revokedAt),
    ));

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
    // The lock covers the read/decision/write sequence for the independently
    // reportable service. Concurrent requests cannot turn one another into a
    // second attendance transition.
    const lock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(${userId}, ${scanLockKey}) AS acquired`);
    if (!(lock.rows[0] as { acquired: boolean }).acquired) return "concurrent_duplicate" as const;
    const todayScans = await tx.select().from(staffScansTable)
      .where(and(eq(staffScansTable.serviceDate, date), eq(staffScansTable.userId, userId)));
    const decision = decideStaffScan(todayScans, service, action);
    if (decision === "checkpoint_required") return decision;
    if (decision === "already_done") {
      const existing = todayScans.find(scan => scan.service === service &&
        scan.scanType === (action === "check_in" ? "checkpoint" : "clock_out"));
      return { kind: decision, scannedAt: existing!.scannedAt } as const;
    }
    const inserted = await tx.insert(staffScansTable).values({
      serviceDate: date, userId, scanType: decision, intervalLabel: null, service,
    }).onConflictDoNothing().returning({ id: staffScansTable.id, scannedAt: staffScansTable.scannedAt });
    return inserted.length === 0 ? "concurrent_duplicate" as const : { kind: decision, scannedAt: inserted[0]!.scannedAt } as const;
  });

  if (outcome === "checkpoint_required") {
    res.status(409).json({
      error: `Check-in is required before clocking out of the ${service} service`,
      service,
    });
    return;
  }
  if (outcome === "concurrent_duplicate") {
    res.json({
      ok: true,
      duplicate: true,
      action: action === "check_in" ? "checked_in" : "clocked_out",
      message: `${action === "check_in" ? "Check-in" : "Clock-out"} is already being recorded for the ${service} service`,
      service,
    });
    return;
  }

  if (outcome.kind === "already_done") {
    res.json({
      ok: true,
      duplicate: true,
      action: "already_done",
      message: `${action === "check_in" ? "Check-in" : "Clock-out"} already recorded for the ${service} service`,
      service,
      scannedAt: formatWAT(outcome.scannedAt),
    });
    return;
  }

  logger.info({ userId, date, service, action }, "sunday-attendance: attendance recorded");
  res.json({
    ok: true,
    duplicate: false,
    action: outcome.kind === "checkpoint" ? "checked_in" : "clocked_out",
    message: `${outcome.kind === "checkpoint" ? "Checked in" : `Clocked out from ${service} service`} at ${formatWAT(outcome.scannedAt)} WAT`,
    service,
    scannedAt: formatWAT(outcome.scannedAt),
  });
});

// POST /sunday-attendance/emergency-out — staff leaves early due to emergency
router.post("/sunday-attendance/emergency-out", authMiddleware, async (req, res): Promise<void> => {
  if (!STAFF_ROLES.includes(req.user!.role as typeof STAFF_ROLES[number])) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!hasOnlyKeys(req.body, ["date", "service", "reason"])) {
    res.status(400).json({ error: "Invalid emergency exit request" });
    return;
  }
  const { date, service, reason } = req.body as { date?: unknown; service?: unknown; reason?: unknown };
  if (!isServiceDate(date) || (service !== undefined && service !== "1st" && service !== "2nd") ||
    (reason !== undefined && (typeof reason !== "string" || reason.length > 500))) {
    res.status(400).json({ error: "date must be YYYY-MM-DD; service must be 1st or 2nd" });
    return;
  }
  if (date !== todayWAT()) {
    res.status(400).json({ error: "Emergency exit is valid only on its service date" });
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
      scanType: "emergency_out",
      intervalLabel: reason ?? null,
      service: derivedService,
    }).onConflictDoNothing().returning({ id: staffScansTable.id, scannedAt: staffScansTable.scannedAt });
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
    message: `Emergency exit recorded at ${formatWAT(inserted[0]!.scannedAt)} WAT from ${derivedService} service`,
    service: derivedService,
    exitedAt: formatWAT(inserted[0]!.scannedAt),
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
    hasQr: !!qr && qr.purpose === STAFF_QR_PURPOSE && !qr.revokedAt,
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
  if (!STAFF_ROLES.includes(req.user!.role as typeof STAFF_ROLES[number])) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const date = (req.query.date as string) ?? todayWAT();
  if (!isServiceDate(date)) {
    res.status(400).json({ error: "date must be YYYY-MM-DD" });
    return;
  }
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
