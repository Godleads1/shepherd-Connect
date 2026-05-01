import { Router } from "express";
import { eq, ilike, or, sql } from "drizzle-orm";
import { db, familiesTable, usersTable, childrenTable, classesTable, attendanceTable, childAppraisalsTable } from "@workspace/db";
import { CreateFamilyBody, ListFamiliesQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { nanoid } from "../lib/utils";

const router = Router();

function generateFamilyCode(): string {
  return "FAM-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function formatFamily(family: typeof familiesTable.$inferSelect) {
  const [parent1] = family.parent1Id
    ? await db.select().from(usersTable).where(eq(usersTable.id, family.parent1Id))
    : [null];
  const [parent2] = family.parent2Id
    ? await db.select().from(usersTable).where(eq(usersTable.id, family.parent2Id))
    : [null];
  const children = await db
    .select()
    .from(childrenTable)
    .where(eq(childrenTable.familyId, family.id));

  const childrenWithAge = await Promise.all(
    children.map(async (child) => {
      const dob = new Date(child.dob);
      const now = new Date();
      const age = now.getFullYear() - dob.getFullYear() -
        (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
      let currentClass = null;
      if (child.currentClassId) {
        const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, child.currentClassId));
        currentClass = cls || null;
      }
      return { ...child, age, currentClass };
    })
  );

  const sanitizeUser = (u: typeof usersTable.$inferSelect | null) => u ? {
    id: u.id, email: u.email, phone: u.phone, role: u.role,
    firstName: u.firstName, lastName: u.lastName, isActive: u.isActive, createdAt: u.createdAt,
  } : null;

  return {
    ...family,
    parent1: sanitizeUser(parent1),
    parent2: sanitizeUser(parent2),
    children: childrenWithAge,
  };
}

router.get("/families", authMiddleware, async (req, res): Promise<void> => {
  const params = ListFamiliesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "Bad request", message: params.error.message });
    return;
  }
  const { search, page = 1, limit = 20 } = params.data;
  const offset = (page - 1) * limit;
  let families: typeof familiesTable.$inferSelect[] = [];
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(familiesTable);
  if (search) {
    const searchedParents = await db.select().from(usersTable).where(
      or(ilike(usersTable.firstName, `%${search}%`), ilike(usersTable.lastName, `%${search}%`))
    );
    const parentIds = searchedParents.map(p => p.id);
    if (parentIds.length > 0) {
      families = await db.select().from(familiesTable)
        .where(or(...parentIds.map(id => eq(familiesTable.parent1Id, id))))
        .limit(limit).offset(offset);
    }
  } else {
    families = await db.select().from(familiesTable).limit(limit).offset(offset);
  }
  const formatted = await Promise.all(families.map(formatFamily));
  res.json({ data: formatted, total: Number(count), page, limit });
});

router.post("/families", authMiddleware, async (req, res): Promise<void> => {
  const parsed = CreateFamilyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad request", message: parsed.error.message });
    return;
  }
  const familyCode = generateFamilyCode();
  const [family] = await db.insert(familiesTable).values({ ...parsed.data, familyCode }).returning();
  const formatted = await formatFamily(family);
  res.status(201).json(formatted);
});

router.get("/families/my", authMiddleware, requireRoles("parent"), async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const [family] = await db.select().from(familiesTable).where(
    or(eq(familiesTable.parent1Id, userId), eq(familiesTable.parent2Id, userId))
  );
  if (!family) {
    res.status(404).json({ error: "Not found", message: "Family not found" });
    return;
  }
  const formatted = await formatFamily(family);
  res.json(formatted);
});

router.get("/families/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, id));
  if (!family) { res.status(404).json({ error: "Not found", message: "Family not found" }); return; }
  const formatted = await formatFamily(family);
  res.json(formatted);
});

router.put("/families/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = CreateFamilyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [family] = await db.update(familiesTable).set(parsed.data).where(eq(familiesTable.id, id)).returning();
  if (!family) { res.status(404).json({ error: "Not found", message: "Family not found" }); return; }
  const formatted = await formatFamily(family);
  res.json(formatted);
});

router.get("/families/:id/tree", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, id));
  if (!family) { res.status(404).json({ error: "Not found", message: "Family not found" }); return; }

  const parents = [];
  if (family.parent1Id) {
    const [p] = await db.select().from(usersTable).where(eq(usersTable.id, family.parent1Id));
    if (p) parents.push({ id: p.id, email: p.email, phone: p.phone, role: p.role, firstName: p.firstName, lastName: p.lastName, isActive: p.isActive, createdAt: p.createdAt });
  }
  if (family.parent2Id) {
    const [p] = await db.select().from(usersTable).where(eq(usersTable.id, family.parent2Id));
    if (p) parents.push({ id: p.id, email: p.email, phone: p.phone, role: p.role, firstName: p.firstName, lastName: p.lastName, isActive: p.isActive, createdAt: p.createdAt });
  }

  const children = await db.select().from(childrenTable).where(eq(childrenTable.familyId, id));
  const childrenWithDetails = await Promise.all(
    children.map(async (child) => {
      const dob = new Date(child.dob);
      const now = new Date();
      const age = now.getFullYear() - dob.getFullYear() -
        (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
      let currentClass = null;
      let teacher = null;
      if (child.currentClassId) {
        const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, child.currentClassId));
        currentClass = cls || null;
      }
      const lastAttendanceRecord = await db.select().from(attendanceTable)
        .where(eq(attendanceTable.childId, child.id))
        .orderBy(attendanceTable.serviceDate).limit(1);
      const lastAttendance = lastAttendanceRecord[0]?.serviceDate || null;
      const attendanceHistory = await db.select().from(attendanceTable)
        .where(eq(attendanceTable.childId, child.id))
        .orderBy(attendanceTable.createdAt);
      return { ...child, age, currentClass, teacher, lastAttendance, attendanceHistory };
    })
  );

  res.json({ family, parents, children: childrenWithDetails });
});

export default router;
