import { Router } from "express";
import { db } from "@workspace/db";
import { staffCheckpointWindowsTable, staffCheckpointLogsTable, usersTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

function nowWAT(): { date: string; time: string } {
  const now = new Date();
  const wat = new Date(now.getTime() + 60 * 60 * 1000);
  const date = wat.toISOString().slice(0, 10);
  const hh = String(wat.getUTCHours()).padStart(2, "0");
  const mm = String(wat.getUTCMinutes()).padStart(2, "0");
  return { date, time: `${hh}:${mm}` };
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

// ── Admin: create a checkpoint window ──────────────────────────────────────
// POST /staff-checkpoints/windows
router.post("/staff-checkpoints/windows", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const { serviceDate, serviceSlot, label, opensAt, closesAt } = req.body as {
    serviceDate: string; serviceSlot: string; label: string; opensAt: string; closesAt: string;
  };
  if (!serviceDate || !serviceSlot || !label || !opensAt || !closesAt) {
    res.status(400).json({ error: "Bad request", message: "serviceDate, serviceSlot, label, opensAt, closesAt are required" });
    return;
  }
  const [row] = await db.insert(staffCheckpointWindowsTable)
    .values({ serviceDate, serviceSlot, label, opensAt, closesAt })
    .returning();
  res.status(201).json(row);
});

// ── Admin: delete a checkpoint window ──────────────────────────────────────
// DELETE /staff-checkpoints/windows/:id
router.delete("/staff-checkpoints/windows/:id", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(staffCheckpointWindowsTable).where(eq(staffCheckpointWindowsTable.id, id));
  res.json({ success: true });
});

// ── Staff: get today's open windows + own check-in status ──────────────────
// GET /staff-checkpoints/today
router.get("/staff-checkpoints/today", authMiddleware, requireRoles("teacher", "support", "admin", "super_admin"), async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { date, time } = nowWAT();
  const currentMins = timeToMins(time);

  const windows = await db.select().from(staffCheckpointWindowsTable)
    .where(eq(staffCheckpointWindowsTable.serviceDate, date));

  const myLogs = await db.select().from(staffCheckpointLogsTable)
    .where(and(
      eq(staffCheckpointLogsTable.userId, userId),
      inArray(staffCheckpointLogsTable.windowId, windows.length ? windows.map(w => w.id) : [-1]),
    ));

  const logMap = new Map(myLogs.map(l => [l.windowId, l]));

  const result = windows.map(w => {
    const openMins  = timeToMins(w.opensAt);
    const closeMins = timeToMins(w.closesAt);
    const log = logMap.get(w.id) ?? null;
    const isOpen = currentMins >= openMins && currentMins <= closeMins;
    const isPast = currentMins > closeMins;
    return {
      ...w,
      isOpen,
      isPast,
      checkedIn: !!log,
      checkedInAt: log?.checkedInAt ?? null,
      isOnTime: log?.isOnTime ?? null,
    };
  }).sort((a, b) => a.opensAt.localeCompare(b.opensAt));

  res.json({ date, windows: result });
});

// ── Staff: check in for a window ───────────────────────────────────────────
// POST /staff-checkpoints/checkin
router.post("/staff-checkpoints/checkin", authMiddleware, requireRoles("teacher", "support", "admin", "super_admin"), async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { windowId } = req.body as { windowId: number };
  if (!windowId) { res.status(400).json({ error: "Bad request", message: "windowId is required" }); return; }

  const [win] = await db.select().from(staffCheckpointWindowsTable)
    .where(eq(staffCheckpointWindowsTable.id, windowId));
  if (!win) { res.status(404).json({ error: "Not found", message: "Checkpoint window not found" }); return; }

  // Must be today
  const { date, time } = nowWAT();
  if (win.serviceDate !== date) {
    res.status(400).json({ error: "Bad request", message: "This checkpoint is not for today" });
    return;
  }

  const currentMins = timeToMins(time);
  const openMins  = timeToMins(win.opensAt);
  const closeMins = timeToMins(win.closesAt);
  if (currentMins < openMins) {
    res.status(400).json({ error: "Bad request", message: `This checkpoint window opens at ${win.opensAt} WAT` });
    return;
  }
  if (currentMins > closeMins) {
    res.status(400).json({ error: "Bad request", message: `This checkpoint window closed at ${win.closesAt} WAT` });
    return;
  }

  // Check for duplicate
  const [existing] = await db.select().from(staffCheckpointLogsTable)
    .where(and(eq(staffCheckpointLogsTable.windowId, windowId), eq(staffCheckpointLogsTable.userId, userId)));
  if (existing) {
    res.status(409).json({ error: "Conflict", message: "You have already checked in for this checkpoint" });
    return;
  }

  const isOnTime = currentMins <= timeToMins(win.opensAt) + 15; // 15-min grace after window opens = on time
  const [log] = await db.insert(staffCheckpointLogsTable)
    .values({ windowId, userId, isOnTime })
    .returning();

  req.log.info({ userId, windowId, label: win.label }, "Staff checkpoint check-in");
  res.status(201).json({ success: true, log, isOnTime });
});

// ── Admin: full grid summary for a date ────────────────────────────────────
// GET /staff-checkpoints/summary?date=YYYY-MM-DD
router.get("/staff-checkpoints/summary", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const date = (req.query["date"] as string) || nowWAT().date;

  const [windows, staff, logs] = await Promise.all([
    db.select().from(staffCheckpointWindowsTable)
      .where(eq(staffCheckpointWindowsTable.serviceDate, date)),
    db.select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      photoUrl: usersTable.photoUrl,
    }).from(usersTable)
      .where(and(eq(usersTable.isActive, true), inArray(usersTable.role, ["teacher", "support"]))),
    db.select().from(staffCheckpointLogsTable)
      .where(
        inArray(
          staffCheckpointLogsTable.windowId,
          // avoid empty inArray
          (await db.select({ id: staffCheckpointWindowsTable.id })
            .from(staffCheckpointWindowsTable)
            .where(eq(staffCheckpointWindowsTable.serviceDate, date))
          ).map(w => w.id).concat([-1])
        )
      ),
  ]);

  // Build a map: userId -> windowId -> log
  const logMap = new Map<number, Map<number, typeof logs[0]>>();
  for (const log of logs) {
    if (!logMap.has(log.userId)) logMap.set(log.userId, new Map());
    logMap.get(log.userId)!.set(log.windowId, log);
  }

  const grid = staff.map(u => ({
    userId: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    photoUrl: u.photoUrl,
    checkpoints: windows.map(w => {
      const log = logMap.get(u.id)?.get(w.id) ?? null;
      return {
        windowId: w.id,
        label: w.label,
        opensAt: w.opensAt,
        closesAt: w.closesAt,
        serviceSlot: w.serviceSlot,
        checkedIn: !!log,
        checkedInAt: log?.checkedInAt ?? null,
        isOnTime: log?.isOnTime ?? null,
      };
    }),
    totalCheckins: windows.filter(w => logMap.get(u.id)?.has(w.id)).length,
  }));

  const totalPossible = windows.length;
  res.json({
    date,
    windows: windows.sort((a, b) => a.opensAt.localeCompare(b.opensAt)),
    staff: grid.sort((a, b) => b.totalCheckins - a.totalCheckins || a.firstName.localeCompare(b.firstName)),
    stats: {
      totalStaff: staff.length,
      totalWindows: totalPossible,
      fullCompliance: grid.filter(u => u.totalCheckins === totalPossible && totalPossible > 0).length,
      partialCompliance: grid.filter(u => u.totalCheckins > 0 && u.totalCheckins < totalPossible).length,
      zeroCompliance: grid.filter(u => u.totalCheckins === 0).length,
    },
  });
});

export default router;
