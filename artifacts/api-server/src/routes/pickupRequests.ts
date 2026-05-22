import { Router } from "express";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { db } from "@workspace/db";
import {
  attendanceTable, childrenTable, classesTable, usersTable,
  notificationsTable, teachersTable, teacherAllocationsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

const classClients = new Map<number, Set<any>>();
const pickupQueue = new Map<number, any[]>();

function broadcastToClass(classId: number, data: any) {
  const clients = classClients.get(classId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch {}
  }
}

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

  const [cls] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, classId));
  const queue = pickupQueue.get(classId) ?? [];
  res.write(`data: ${JSON.stringify({ type: "init", queue, className: cls?.name ?? null })}\n\n`);

  const ping = setInterval(() => {
    try { res.write(": ping\n\n"); } catch {}
  }, 25000);

  req.on("close", () => {
    clearInterval(ping);
    classClients.get(classId)?.delete(res);
  });
});

router.get("/pickup-requests", authMiddleware, requireRoles("super_admin", "admin", "attendant"), async (req, res): Promise<void> => {
  const all: any[] = [];
  for (const queue of pickupQueue.values()) {
    all.push(...queue);
  }
  all.sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());
  res.json({ queue: all });
});

router.post("/pickup-requests", authMiddleware, async (req, res): Promise<void> => {
  const { childId } = req.body as { childId?: number };
  if (!childId || typeof childId !== "number") {
    res.status(400).json({ error: "Bad request", message: "childId is required" });
    return;
  }

  const [child] = await db
    .select()
    .from(childrenTable)
    .leftJoin(classesTable, eq(childrenTable.currentClassId, classesTable.id))
    .where(eq(childrenTable.id, childId));

  if (!child) {
    res.status(404).json({ error: "Not found", message: "Child not found" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const [activeAttendance] = await db
    .select()
    .from(attendanceTable)
    .where(and(
      eq(attendanceTable.childId, childId),
      eq(attendanceTable.serviceDate, today)
    ))
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

  if (!pickupQueue.has(classId)) pickupQueue.set(classId, []);
  const queue = pickupQueue.get(classId)!;
  const existingIdx = queue.findIndex(q => q.childId === childId);
  if (existingIdx !== -1) queue.splice(existingIdx, 1);
  queue.push(request);

  broadcastToClass(classId, { type: "pickup", request, queue });

  const allocations = await db
    .select({ userId: teachersTable.userId })
    .from(teacherAllocationsTable)
    .innerJoin(teachersTable, eq(teacherAllocationsTable.teacherId, teachersTable.id))
    .where(and(
      eq(teacherAllocationsTable.classId, classId),
      eq(teacherAllocationsTable.serviceDate, today),
    ));

  if (allocations.length > 0) {
    await db.insert(notificationsTable).values(
      allocations.map(a => ({
        userId: a.userId,
        type: "pickup_request",
        title: "Pickup Request",
        message: `${parentName} is here to collect ${childName} from ${className}. Please prepare for handover.`,
        channel: "in_app" as const,
      }))
    );
  }

  req.log.info({ childId, classId, parentName }, "Parent signalled pickup");
  res.json({ success: true, message: "Pickup signal sent to classroom" });
});

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

router.get("/pickup-requests/:classId", async (req, res): Promise<void> => {
  const classId = Number(req.params.classId);
  if (isNaN(classId)) { res.status(400).json({ error: "Bad request" }); return; }
  res.json({ queue: pickupQueue.get(classId) ?? [] });
});

export default router;
