import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { db } from "@workspace/db";
import { attendanceTable, childrenTable, classesTable, usersTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";

const router = Router();

// In-memory store: classId → list of SSE response objects
const classClients = new Map<number, Set<any>>();

// In-memory pickup queue: classId → array of pickup request items
// Each item: { id, childId, childName, parentName, classId, className, requestedAt }
const pickupQueue = new Map<number, any[]>();

function broadcastToClass(classId: number, data: any) {
  const clients = classClients.get(classId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch {}
  }
}

// SSE endpoint — TV screen connects here (no auth required, just needs classId)
router.get("/pickup-requests/stream/:classId", async (req, res): Promise<void> => {
  const classId = Number(req.params.classId);
  if (isNaN(classId)) { res.status(400).end(); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  if (!classClients.has(classId)) classClients.set(classId, new Set());
  classClients.get(classId)!.add(res);

  // Look up class name for the TV header (public, no auth needed here)
  const [cls] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, classId));

  // Send current queue immediately on connect
  const queue = pickupQueue.get(classId) ?? [];
  res.write(`data: ${JSON.stringify({ type: "init", queue, className: cls?.name ?? null })}\n\n`);

  // Keep-alive ping every 25s
  const ping = setInterval(() => {
    try { res.write(": ping\n\n"); } catch {}
  }, 25000);

  req.on("close", () => {
    clearInterval(ping);
    classClients.get(classId)?.delete(res);
  });
});

// Parent calls this to signal "I'm here to pick up"
router.post("/pickup-requests", authMiddleware, async (req, res): Promise<void> => {
  const { childId } = req.body as { childId?: number };
  if (!childId || typeof childId !== "number") {
    res.status(400).json({ error: "Bad request", message: "childId is required" });
    return;
  }

  // Verify child belongs to this parent's family and is currently in class
  const [child] = await db
    .select()
    .from(childrenTable)
    .leftJoin(classesTable, eq(childrenTable.currentClassId, classesTable.id))
    .where(eq(childrenTable.id, childId));

  if (!child) {
    res.status(404).json({ error: "Not found", message: "Child not found" });
    return;
  }

  // Check child is currently checked in (status in_class or dropped_off or in_transit)
  const today = new Date().toISOString().split("T")[0];
  const [activeAttendance] = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.childId, childId),
        eq(attendanceTable.serviceDate, today)
      )
    )
    .orderBy(attendanceTable.checkInTime);

  if (!activeAttendance || activeAttendance.status === "picked_up") {
    res.status(400).json({ error: "Bad request", message: "Child is not currently checked in" });
    return;
  }

  const classId = child.children.currentClassId;
  if (!classId) {
    res.status(400).json({ error: "Bad request", message: "Child has no assigned class" });
    return;
  }

  const childName = `${child.children.firstName} ${child.children.lastName}`;
  const className = child.classes?.name ?? "Unknown Class";

  // Get parent name
  const [parent] = await db
    .select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));

  const parentName = parent ? `${parent.firstName} ${parent.lastName}` : "A parent";

  const request = {
    id: `${childId}-${Date.now()}`,
    childId,
    childName,
    parentName,
    classId,
    className,
    requestedAt: new Date().toISOString(),
  };

  // Add to queue
  if (!pickupQueue.has(classId)) pickupQueue.set(classId, []);
  const queue = pickupQueue.get(classId)!;
  // Avoid duplicates for same child
  const existingIdx = queue.findIndex(q => q.childId === childId);
  if (existingIdx !== -1) queue.splice(existingIdx, 1);
  queue.push(request);

  // Broadcast to TV screen
  broadcastToClass(classId, { type: "pickup", request, queue });

  req.log.info({ childId, classId, parentName }, "Parent signalled pickup");
  res.json({ success: true, message: "Pickup signal sent to classroom" });
});

// Remove from queue (teacher dismisses it or child is checked out)
router.delete("/pickup-requests/:id", authMiddleware, async (req, res): Promise<void> => {
  const { id } = req.params;
  for (const [classId, queue] of pickupQueue.entries()) {
    const idx = queue.findIndex(q => q.id === id);
    if (idx !== -1) {
      queue.splice(idx, 1);
      broadcastToClass(classId, { type: "dismissed", id, queue });
      res.json({ success: true });
      return;
    }
  }
  res.status(404).json({ error: "Not found" });
});

// Get current queue for a class (REST fallback for TV initial load)
router.get("/pickup-requests/:classId", async (req, res): Promise<void> => {
  const classId = Number(req.params.classId);
  if (isNaN(classId)) { res.status(400).json({ error: "Bad request" }); return; }
  res.json({ queue: pickupQueue.get(classId) ?? [] });
});

export default router;
