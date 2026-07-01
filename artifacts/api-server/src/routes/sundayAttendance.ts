import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, sundayQrCodesTable, staffScansTable, usersTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import QRCode from "qrcode";
import crypto from "crypto";
import { logger } from "../lib/logger";
import { sendNotification } from "../lib/notify";

const router = Router();

export const STAFF_ROLES = ["teacher", "support", "attendant", "admin", "super_admin"];
export const INTERVALS = ["07:00", "08:30", "09:30", "10:00", "11:00", "12:00"] as const;

const WAT_OFFSET_MS = 60 * 60 * 1000;

function toWAT(date: Date): Date {
  return new Date(date.getTime() + WAT_OFFSET_MS);
}

function getIntervalLabel(watHour: number, watMinute: number): string {
  const totalMin = watHour * 60 + watMinute;
  if (totalMin < 8 * 60 + 15) return "07:00";
  if (totalMin < 9 * 60 + 15) return "08:30";
  if (totalMin < 10 * 60)     return "09:30";
  if (totalMin < 10 * 60 + 45) return "10:00";
  if (totalMin < 11 * 60 + 45) return "11:00";
  return "12:00";
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
  const intervalLabel = getIntervalLabel(wat.getUTCHours(), wat.getUTCMinutes());
  const service = getService(wat.getUTCHours());

  const todayScans = await db
    .select()
    .from(staffScansTable)
    .where(and(eq(staffScansTable.serviceDate, date), eq(staffScansTable.userId, userId)));

  const alreadyScanned = todayScans.some(
    s => s.intervalLabel === intervalLabel && s.scanType === "checkpoint"
  );

  if (alreadyScanned) {
    res.json({
      ok: true,
      duplicate: true,
      message: `Already recorded for the ${intervalLabel} checkpoint`,
      intervalLabel,
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
    intervalLabel,
    service,
  });

  logger.info({ userId, date, intervalLabel, service }, "sunday-attendance: scan recorded");

  res.json({
    ok: true,
    duplicate: false,
    message: `Scan recorded at ${formatWAT(now)} WAT`,
    intervalLabel,
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

  const staffRows = staff.map(s => {
    const userScans = scans.filter(sc => sc.userId === s.id);
    const checkpoints = INTERVALS.map(label => {
      const scan = userScans.find(
        sc => sc.intervalLabel === label && sc.scanType === "checkpoint"
      );
      return { intervalLabel: label, scanned: !!scan, scannedAt: scan?.scannedAt ?? null };
    });
    const clockOuts = userScans
      .filter(sc => sc.scanType === "clock_out")
      .map(co => ({ service: co.service, scannedAt: co.scannedAt }));
    const totalScans = userScans.filter(sc => sc.scanType === "checkpoint").length;
    return {
      userId: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      role: s.role,
      photoUrl: s.photoUrl,
      checkpoints,
      clockOuts,
      totalScans,
    };
  });

  const present = staffRows.filter(s => s.totalScans > 0).length;

  res.json({
    date,
    hasQr: !!qr,
    intervals: INTERVALS,
    staff: staffRows,
    stats: {
      total: staff.length,
      present,
      absent: staff.length - present,
      fullDay: staffRows.filter(s => s.totalScans >= 6).length,
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
