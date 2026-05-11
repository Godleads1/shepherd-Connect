import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, attendanceTable, childrenTable, classesTable, familiesTable } from "@workspace/db";
import { CheckInBody, CheckOutBody, ListAttendanceQueryParams, ScanQrCodeBody } from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";
import { notifyChildCheckedIn, notifyChildInTransit, notifyChildArrivedInClass, notifyChildPickedUp } from "../lib/notify";

const router = Router();

async function formatAttendance(a: typeof attendanceTable.$inferSelect) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, a.childId));
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, a.classId));
  return { ...a, child: child || null, class: cls || null };
}

router.get("/attendance", authMiddleware, async (req, res): Promise<void> => {
  const params = ListAttendanceQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { classId, childId, serviceDate, serviceSlot, status } = params.data;
  const conditions = [];
  if (classId) conditions.push(eq(attendanceTable.classId, classId));
  if (childId) conditions.push(eq(attendanceTable.childId, childId));
  if (serviceDate) conditions.push(eq(attendanceTable.serviceDate, serviceDate));
  if (serviceSlot) conditions.push(eq(attendanceTable.serviceSlot, serviceSlot));
  if (status) conditions.push(eq(attendanceTable.status, status as "dropped_off" | "in_transit" | "in_class" | "picked_up"));
  const records = await db.select().from(attendanceTable)
    .where(conditions.length ? and(...conditions) : undefined);
  const formatted = await Promise.all(records.map(formatAttendance));
  res.json(formatted);
});

router.post("/attendance", authMiddleware, async (req, res): Promise<void> => {
  const parsed = CheckInBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { childId, classId, serviceDate, serviceSlot } = parsed.data;
  const [existing] = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.childId, childId), eq(attendanceTable.serviceDate, serviceDate), eq(attendanceTable.serviceSlot, serviceSlot)));
  if (existing) {
    res.json(await formatAttendance(existing));
    return;
  }
  const [record] = await db.insert(attendanceTable).values({
    childId, classId, serviceDate, serviceSlot,
    checkedInBy: req.user!.userId,
    checkInTime: new Date(),
    status: "dropped_off",
  }).returning();

  notifyChildCheckedIn(childId, classId, serviceSlot).catch(() => {});

  res.status(201).json(await formatAttendance(record));
});

router.put("/attendance/:id/escort", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [record] = await db.update(attendanceTable).set({
    status: "in_transit",
    escortTime: new Date(),
    escortedBy: req.user!.userId,
  }).where(and(eq(attendanceTable.id, id), eq(attendanceTable.status, "dropped_off"))).returning();
  if (!record) { res.status(404).json({ error: "Not found", message: "Attendance record not found or not in dropped_off state" }); return; }

  notifyChildInTransit(record.childId, record.classId).catch(() => {});

  res.json(await formatAttendance(record));
});

router.put("/attendance/:id/arrive", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const [existing] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found", message: "Attendance record not found" }); return; }
  if (existing.status === "picked_up") { res.status(400).json({ error: "Bad request", message: "Child has already been picked up" }); return; }
  if (existing.status === "in_class") { res.json(await formatAttendance(existing)); return; }

  const now = new Date();
  const [record] = await db.update(attendanceTable).set({
    status: "in_class",
    classArrivalTime: now,
    confirmedByTeacherId: req.user!.userId,
  }).where(eq(attendanceTable.id, id)).returning();

  notifyChildArrivedInClass(record.childId, record.classId).catch(() => {});

  res.json(await formatAttendance(record));
});

router.put("/attendance/:id/checkout", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = CheckOutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [record] = await db.update(attendanceTable).set({
    status: "picked_up",
    checkOutTime: new Date(),
    checkedOutBy: req.user!.userId,
  }).where(eq(attendanceTable.id, id)).returning();
  if (!record) { res.status(404).json({ error: "Not found", message: "Attendance record not found" }); return; }

  notifyChildPickedUp(record.childId).catch(() => {});

  res.json(await formatAttendance(record));
});

router.post("/attendance/scan-qr", authMiddleware, async (req, res): Promise<void> => {
  const parsed = ScanQrCodeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { qrCode, serviceDate, serviceSlot } = parsed.data;
  let family = null;
  let children: typeof childrenTable.$inferSelect[] = [];
  const qrParts = qrCode.split(":");
  if (qrParts[0] === "QR" && qrParts.length >= 2) {
    const familyId = parseInt(qrParts[1], 10);
    if (!isNaN(familyId)) {
      const [f] = await db.select().from(familiesTable).where(eq(familiesTable.id, familyId));
      family = f;
      children = await db.select().from(childrenTable).where(eq(childrenTable.familyId, familyId));
    }
  }
  if (!family) {
    res.status(404).json({ error: "Not found", message: "QR code not recognized" });
    return;
  }
  const alerts: string[] = [];
  const childrenWithDetails = await Promise.all(children.map(async (child) => {
    const dob = new Date(child.dob);
    const now = new Date();
    const age = now.getFullYear() - dob.getFullYear() -
      (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
    if (child.allergies) alerts.push(`${child.firstName} has allergies: ${child.allergies}`);
    if (child.medicalNotes) alerts.push(`${child.firstName} has medical notes`);
    let currentClass = null;
    if (child.currentClassId) {
      const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, child.currentClassId));
      currentClass = cls || null;
    }
    return { ...child, age, currentClass, teacher: null, lastAttendance: null, attendanceHistory: [] };
  }));
  res.json({ family, children: childrenWithDetails, hasAlerts: alerts.length > 0, alerts });
});

router.post("/attendance/scan-face", authMiddleware, async (req, res): Promise<void> => {
  const { descriptor } = req.body as { descriptor: number[] };
  if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
    res.status(400).json({ error: "Bad request", message: "descriptor must be a 128-element float array" });
    return;
  }
  const allChildren = await db.select().from(childrenTable);
  const enrolled = allChildren.filter(c => c.faceDescriptorJson);

  let bestMatch: typeof childrenTable.$inferSelect | null = null;
  let bestDist = Infinity;

  for (const child of enrolled) {
    try {
      const stored: number[] = JSON.parse(child.faceDescriptorJson!);
      if (stored.length !== 128) continue;
      const dist = Math.sqrt(stored.reduce((sum, v, i) => sum + Math.pow(v - descriptor[i], 2), 0));
      if (dist < bestDist) { bestDist = dist; bestMatch = child; }
    } catch { continue; }
  }

  if (!bestMatch || bestDist > 0.6) {
    res.status(404).json({ error: "Not found", message: "No matching child found" });
    return;
  }

  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, bestMatch.familyId));
  if (!family) { res.status(404).json({ error: "Not found", message: "Family not found" }); return; }

  const familyChildren = await db.select().from(childrenTable).where(eq(childrenTable.familyId, family.id));
  const alerts: string[] = [];
  const childrenWithDetails = await Promise.all(familyChildren.map(async (child) => {
    const dob = new Date(child.dob);
    const now = new Date();
    const age = now.getFullYear() - dob.getFullYear() -
      (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
    if (child.allergies) alerts.push(`${child.firstName} has allergies: ${child.allergies}`);
    if (child.medicalNotes) alerts.push(`${child.firstName} has medical notes`);
    let currentClass = null;
    if (child.currentClassId) {
      const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, child.currentClassId));
      currentClass = cls || null;
    }
    return { ...child, age, currentClass, teacher: null, lastAttendance: null, attendanceHistory: [] };
  }));

  res.json({ family, children: childrenWithDetails, hasAlerts: alerts.length > 0, alerts, matchedChildId: bestMatch.id, confidence: Math.max(0, Math.round((1 - bestDist / 0.6) * 100)) });
});

export default router;
