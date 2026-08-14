import { Router } from "express";
import { eq, and, isNull, ilike, or, sql } from "drizzle-orm";
import { db, childrenTable, classesTable, attendanceTable, classAssignmentsTable, pickupDelegatesTable, childAppraisalsTable, classChangeRequestsTable, classWaitlistTable, emergenciesTable, familiesTable } from "@workspace/db";
import { CreateChildBody, ListChildrenQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { getParentFamilyIds, parentOwnsChild, parentOwnsFamily } from "../lib/parentScope";

const router = Router();

/** For parent-role users, sends 403 unless the child belongs to their family. Returns true if allowed. */
async function assertParentOwnsChild(req: import("express").Request, res: import("express").Response, childId: number): Promise<boolean> {
  if (req.user!.role !== "parent") return true;
  if (await parentOwnsChild(req.user!.userId, childId)) return true;
  res.status(403).json({ error: "Forbidden", message: "You can only access your own children" });
  return false;
}

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
  try {
    const rawQuery = { ...req.query };
    if (rawQuery.unassigned === "false") delete rawQuery.unassigned;
    const params = ListChildrenQueryParams.safeParse(rawQuery);
    if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
    const { classId, familyId, unassigned, search, page = 1, limit = 300 } = params.data;
    const conditions: ReturnType<typeof eq>[] = [];
    if (classId) conditions.push(eq(childrenTable.currentClassId, classId));
    if (familyId) conditions.push(eq(childrenTable.familyId, familyId));
    if (unassigned) conditions.push(isNull(childrenTable.currentClassId));
    if (search) {
      const term = `%${search}%`;
      conditions.push(or(ilike(childrenTable.firstName, term), ilike(childrenTable.lastName, term))!);
    }
    // Parents only ever see their own family's children.
    if (req.user!.role === "parent") {
      const familyIds = await getParentFamilyIds(req.user!.userId);
      if (familyIds.length === 0) { res.json({ data: [], total: 0, page, limit }); return; }
      if (familyId && !familyIds.includes(familyId)) {
        res.status(403).json({ error: "Forbidden", message: "You can only access your own family" }); return;
      }
      conditions.push(sql`${childrenTable.familyId} IN (${sql.join(familyIds.map(id => sql`${id}`), sql`, `)})`);
    }
    const offset = (page - 1) * limit;
    const whereClause = conditions.length ? and(...conditions) : undefined;
    const children = await db.select().from(childrenTable)
      .where(whereClause)
      .limit(limit).offset(offset);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(childrenTable)
      .where(whereClause);
    const formatted = await Promise.all(children.map(formatChild));
    res.json({ data: formatted, total: Number(count), page, limit });
  } catch (err) {
    req.log.error({ err }, "Failed to list children");
    res.status(500).json({ error: "Failed to list children" });
  }
});

router.post("/children", authMiddleware, async (req, res): Promise<void> => {
  try {
    const parsed = CreateChildBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
    // Parents may only add children to their own family.
    if (req.user!.role === "parent" && !(await parentOwnsFamily(req.user!.userId, parsed.data.familyId))) {
      res.status(403).json({ error: "Forbidden", message: "You can only add children to your own family" }); return;
    }
    // Auto-assign class based on age calculated from DOB
    const age = calcAge(parsed.data.dob);
    const [matchedClass] = await db.select().from(classesTable)
      .where(and(eq(classesTable.ageMin, age), eq(classesTable.ageMax, age)));
    const dataWithClass = { ...parsed.data, currentClassId: matchedClass?.id ?? null };
    const [child] = await db.insert(childrenTable).values(dataWithClass).returning();
    res.status(201).json(await formatChild(child));
  } catch (err) {
    req.log.error({ err }, "Failed to create child");
    res.status(500).json({ error: "Failed to create child" });
  }
});

router.get("/children/:id", authMiddleware, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
    if (!(await assertParentOwnsChild(req, res, id))) return;
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, id));
    if (!child) { res.status(404).json({ error: "Not found", message: "Child not found" }); return; }
    res.json(await formatChild(child));
  } catch (err) {
    req.log.error({ err }, "Failed to get child");
    res.status(500).json({ error: "Failed to get child" });
  }
});

router.put("/children/:id", authMiddleware, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
    if (!(await assertParentOwnsChild(req, res, id))) return;
    const parsed = CreateChildBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
    // Auto-assign class based on updated DOB (ignore any manually-supplied currentClassId)
    const age = calcAge(parsed.data.dob);
    const [matchedClass] = await db.select().from(classesTable)
      .where(and(eq(classesTable.ageMin, age), eq(classesTable.ageMax, age)));
    const { currentClassId: _ignored, ...rest } = parsed.data as any;
    const updateData = { ...rest, currentClassId: matchedClass?.id ?? null };
    const [child] = await db.update(childrenTable).set(updateData).where(eq(childrenTable.id, id)).returning();
    if (!child) { res.status(404).json({ error: "Not found", message: "Child not found" }); return; }
    res.json(await formatChild(child));
  } catch (err) {
    req.log.error({ err }, "Failed to update child");
    res.status(500).json({ error: "Failed to update child" });
  }
});

router.get("/children/:id/qr-code", authMiddleware, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
    if (!(await assertParentOwnsChild(req, res, id))) return;
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, id));
    if (!child) { res.status(404).json({ error: "Not found", message: "Child not found" }); return; }
    const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
    const familyCode = family?.familyCode ?? `FAM-${child.familyId}`;
    res.json({ qrCode: `QR:${child.familyId}:${child.id}`, familyCode, childId: child.id });
  } catch (err) {
    req.log.error({ err }, "Failed to get child QR code");
    res.status(500).json({ error: "Failed to get QR code" });
  }
});

router.put("/children/:id/face-descriptor", authMiddleware, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
    if (!(await assertParentOwnsChild(req, res, id))) return;
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
  } catch (err) {
    req.log.error({ err }, "Failed to update face descriptor");
    res.status(500).json({ error: "Failed to update face descriptor" });
  }
});

router.delete("/children/:id", authMiddleware, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, id));
    if (!child) { res.status(404).json({ error: "Not found", message: "Child not found" }); return; }

    const { role, userId } = req.user!;
    if (role === "parent") {
      // Parents may only delete children who belong to their own family
      const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
      if (!family || (family.parent1Id !== userId && family.parent2Id !== userId)) {
        res.status(403).json({ error: "Forbidden", message: "You can only delete your own children" });
        return;
      }
    } else if (!["super_admin", "admin"].includes(role)) {
      res.status(403).json({ error: "Forbidden", message: "Insufficient permissions" });
      return;
    }

    // Cascade delete all dependent records
    await db.delete(attendanceTable).where(eq(attendanceTable.childId, id));
    await db.delete(classAssignmentsTable).where(eq(classAssignmentsTable.childId, id));
    await db.delete(pickupDelegatesTable).where(eq(pickupDelegatesTable.childId, id));
    await db.delete(childAppraisalsTable).where(eq(childAppraisalsTable.childId, id));
    await db.delete(classChangeRequestsTable).where(eq(classChangeRequestsTable.childId, id));
    await db.delete(classWaitlistTable).where(eq(classWaitlistTable.childId, id));
    await db.update(emergenciesTable).set({ childId: null }).where(eq(emergenciesTable.childId, id));
    await db.delete(childrenTable).where(eq(childrenTable.id, id));
    res.json({ success: true, message: "Child deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete child");
    res.status(500).json({ error: "Failed to delete child" });
  }
});

router.get("/children/age-out", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const children = await db.select().from(childrenTable).where(sql`${childrenTable.currentClassId} IS NOT NULL`);
    const classes = await db.select().from(classesTable);
    const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
    const agedOut = [];
    for (const child of children) {
      if (!child.currentClassId) continue;
      const cls = classMap[child.currentClassId];
      if (!cls) continue;
      const dob = new Date(child.dob);
      const now = new Date();
      const age = now.getFullYear() - dob.getFullYear() - (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
      if (age > cls.ageMax) {
        const suggestedClass = classes.filter(c => c.id !== cls.id && c.ageMin <= age && c.ageMax >= age && c.serviceSlot === cls.serviceSlot).sort((a, b) => a.ageMin - b.ageMin)[0] || null;
        agedOut.push({ childId: child.id, childName: `${child.firstName} ${child.lastName}`, age, currentClass: { id: cls.id, name: cls.name, ageMin: cls.ageMin, ageMax: cls.ageMax }, suggestedClass: suggestedClass ? { id: suggestedClass.id, name: suggestedClass.name, ageMin: suggestedClass.ageMin, ageMax: suggestedClass.ageMax } : null });
      }
    }
    res.json({ total: agedOut.length, children: agedOut });
  } catch (err) {
    req.log.error({ err }, "Failed to get aged-out children");
    res.status(500).json({ error: "Failed to get aged-out children" });
  }
});

router.post("/children/auto-promote", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    // Auto-promote all aged-out children by recalculating their class from DOB
    const children = await db.select().from(childrenTable).where(sql`${childrenTable.currentClassId} IS NOT NULL`);
    const classes = await db.select().from(classesTable);
    const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
    const results = [];
    for (const child of children) {
      if (!child.currentClassId) continue;
      const age = calcAge(child.dob);
      const currentClass = classMap[child.currentClassId];
      if (!currentClass || (age >= currentClass.ageMin && age <= currentClass.ageMax)) continue;
      const [matchedClass] = classes.filter(c => c.ageMin <= age && c.ageMax >= age).sort((a, b) => a.ageMin - b.ageMin);
      if (!matchedClass) continue;
      const [updated] = await db.update(childrenTable).set({ currentClassId: matchedClass.id }).where(eq(childrenTable.id, child.id)).returning();
      results.push({ childId: child.id, childName: updated ? `${updated.firstName} ${updated.lastName}` : null, newClass: matchedClass.name });
    }
    res.json({ promoted: results.length, results });
  } catch (err) {
    req.log.error({ err }, "Failed to auto-promote children");
    res.status(500).json({ error: "Failed to auto-promote children" });
  }
});

router.post("/children/bulk-import", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    const { children: rows } = req.body as { children?: Array<{ firstName: string; lastName: string; dob: string; gender: string; familyId: number; allergies?: string; medicalNotes?: string }> };
    if (!Array.isArray(rows) || rows.length === 0) { res.status(400).json({ error: "Bad request", message: "children array required" }); return; }
    const classes = await db.select().from(classesTable);
    const inserted = [];
    const errors: Array<{ row: number; error: string }> = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const age = calcAge(row.dob);
        const matchedClass = classes.find(c => c.ageMin <= age && c.ageMax >= age) ?? null;
        const [child] = await db.insert(childrenTable).values({
          firstName: row.firstName, lastName: row.lastName, dob: row.dob,
          gender: (row.gender as "male" | "female") || "male", familyId: row.familyId,
          allergies: row.allergies || null, medicalNotes: row.medicalNotes || null,
          currentClassId: matchedClass?.id ?? null,
        }).returning();
        inserted.push(child);
      } catch (err: any) {
        errors.push({ row: i + 1, error: err.message || "Insert failed" });
      }
    }
    res.json({ inserted: inserted.length, errors });
  } catch (err) {
    req.log.error({ err }, "Failed to bulk import children");
    res.status(500).json({ error: "Failed to bulk import children" });
  }
});

router.delete("/children/:id/face-descriptor", authMiddleware, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
    if (!(await assertParentOwnsChild(req, res, id))) return;
    const [child] = await db.update(childrenTable)
      .set({ faceDescriptorJson: null })
      .where(eq(childrenTable.id, id))
      .returning();
    if (!child) { res.status(404).json({ error: "Not found", message: "Child not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete face descriptor");
    res.status(500).json({ error: "Failed to delete face descriptor" });
  }
});

export default router;
