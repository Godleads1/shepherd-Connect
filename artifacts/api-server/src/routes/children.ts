import { Router } from "express";
import { eq, and, isNull, ilike, or, sql } from "drizzle-orm";
import { db, childrenTable, classesTable, attendanceTable } from "@workspace/db";
import { CreateChildBody, ListChildrenQueryParams } from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

function calcAge(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  return now.getFullYear() - d.getFullYear() -
    (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
}

async function formatChild(child: typeof childrenTable.$inferSelect) {
  const age = calcAge(child.dob);
  let currentClass = null;
  if (child.currentClassId) {
    const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, child.currentClassId));
    if (cls) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(childrenTable).where(eq(childrenTable.currentClassId, cls.id));
      currentClass = { ...cls, enrollmentCount: Number(count) };
    }
  }
  return { ...child, age, currentClass };
}

router.get("/children", authMiddleware, async (req, res): Promise<void> => {
  const params = ListChildrenQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { classId, familyId, unassigned, search, page = 1, limit = 50 } = params.data;
  const conditions: ReturnType<typeof eq>[] = [];
  if (classId) conditions.push(eq(childrenTable.currentClassId, classId));
  if (familyId) conditions.push(eq(childrenTable.familyId, familyId));
  if (unassigned) conditions.push(isNull(childrenTable.currentClassId));
  const offset = (page - 1) * limit;
  let children = await db.select().from(childrenTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(limit).offset(offset);
  if (search) {
    children = children.filter(c =>
      c.firstName.toLowerCase().includes(search.toLowerCase()) ||
      c.lastName.toLowerCase().includes(search.toLowerCase())
    );
  }
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(childrenTable)
    .where(conditions.length ? and(...conditions) : undefined);
  const formatted = await Promise.all(children.map(formatChild));
  res.json({ data: formatted, total: Number(count), page, limit });
});

router.post("/children", authMiddleware, async (req, res): Promise<void> => {
  const parsed = CreateChildBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [child] = await db.insert(childrenTable).values(parsed.data).returning();
  res.status(201).json(await formatChild(child));
});

router.get("/children/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, id));
  if (!child) { res.status(404).json({ error: "Not found", message: "Child not found" }); return; }
  res.json(await formatChild(child));
});

router.put("/children/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = CreateChildBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [child] = await db.update(childrenTable).set(parsed.data).where(eq(childrenTable.id, id)).returning();
  if (!child) { res.status(404).json({ error: "Not found", message: "Child not found" }); return; }
  res.json(await formatChild(child));
});

router.get("/children/:id/qr-code", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, id));
  if (!child) { res.status(404).json({ error: "Not found", message: "Child not found" }); return; }
  res.json({ qrCode: `QR:${child.familyId}:${child.id}`, familyCode: `FAM-${child.familyId}`, childId: child.id });
});

router.put("/children/:id/face-descriptor", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const { descriptorJson, consentGiven } = req.body as { descriptorJson: string; consentGiven: boolean };
  if (!descriptorJson || typeof descriptorJson !== "string") {
    res.status(400).json({ error: "Bad request", message: "descriptorJson is required" }); return;
  }
  if (!consentGiven) {
    res.status(400).json({ error: "Bad request", message: "Biometric consent is required" }); return;
  }
  // Validate the descriptor JSON is a valid 128-element float array
  try {
    const arr = JSON.parse(descriptorJson);
    if (!Array.isArray(arr) || arr.length !== 128) {
      res.status(400).json({ error: "Bad request", message: "descriptor must be a 128-element float array" }); return;
    }
  } catch {
    res.status(400).json({ error: "Bad request", message: "Invalid descriptor JSON" }); return;
  }
  const [child] = await db.update(childrenTable)
    .set({ faceDescriptorJson: descriptorJson })
    .where(eq(childrenTable.id, id))
    .returning();
  if (!child) { res.status(404).json({ error: "Not found", message: "Child not found" }); return; }
  res.json(await formatChild(child));
});

router.delete("/children/:id/face-descriptor", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [child] = await db.update(childrenTable)
    .set({ faceDescriptorJson: null })
    .where(eq(childrenTable.id, id))
    .returning();
  if (!child) { res.status(404).json({ error: "Not found", message: "Child not found" }); return; }
  res.json({ success: true });
});

export default router;
