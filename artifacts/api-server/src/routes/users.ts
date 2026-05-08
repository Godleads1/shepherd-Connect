import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { CreateUserBody, UpdateUserBody, ListUsersQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

function sanitizeUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    role: u.role,
    firstName: u.firstName,
    lastName: u.lastName,
    isActive: u.isActive,
    status: u.status,
    photoUrl: u.photoUrl,
    dob: u.dob,
    gender: u.gender,
    placeOfWork: u.placeOfWork,
    communicationPrefs: u.communicationPrefs,
    createdAt: u.createdAt,
  };
}

router.get("/users", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const params = ListUsersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "Bad request", message: params.error.message });
    return;
  }
  const { role, search, page = 1, limit = 20 } = params.data;
  const statusFilter = req.query["status"] as string | undefined;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (role) conditions.push(eq(usersTable.role, role as "super_admin" | "admin" | "teacher" | "attendant" | "parent"));
  if (statusFilter) conditions.push(eq(usersTable.status, statusFilter as "active" | "pending_approval" | "suspended"));

  const searchCondition = search ? or(
    ilike(usersTable.firstName, `%${search}%`),
    ilike(usersTable.lastName, `%${search}%`),
    ilike(usersTable.email, `%${search}%`)
  ) : undefined;

  const whereClause = conditions.length > 0 && searchCondition
    ? and(...conditions, searchCondition)
    : conditions.length > 0
    ? and(...conditions)
    : searchCondition;

  const users = await db.select().from(usersTable)
    .where(whereClause)
    .limit(limit).offset(offset);

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(whereClause);

  res.json({ data: users.map(sanitizeUser), total: Number(count), page, limit });
});

router.post("/users", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad request", message: parsed.error.message });
    return;
  }
  const { email, password, firstName, lastName, phone, role } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({
    email, passwordHash, firstName, lastName, phone,
    role: role as "super_admin" | "admin" | "teacher" | "attendant" | "parent",
    status: "active",
    isActive: true,
  }).returning();
  res.status(201).json(sanitizeUser(user));
});

router.get("/users/pending", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const pending = await db.select().from(usersTable)
    .where(eq(usersTable.status, "pending_approval"))
    .orderBy(usersTable.createdAt);
  res.json({ data: pending.map(sanitizeUser), total: pending.length });
});

router.get("/users/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  res.json(sanitizeUser(user));
});

router.put("/users/:id/approve", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [user] = await db.update(usersTable)
    .set({ status: "active", isActive: true })
    .where(eq(usersTable.id, id))
    .returning();
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  res.json({ success: true, message: "User approved", user: sanitizeUser(user) });
});

router.put("/users/:id/reject", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [user] = await db.update(usersTable)
    .set({ status: "suspended", isActive: false })
    .where(eq(usersTable.id, id))
    .returning();
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  res.json({ success: true, message: "User rejected", user: sanitizeUser(user) });
});

router.put("/users/:id/suspend", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [user] = await db.update(usersTable)
    .set({ status: "suspended", isActive: false })
    .where(eq(usersTable.id, id))
    .returning();
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  res.json({ success: true, message: "User suspended", user: sanitizeUser(user) });
});

router.put("/users/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const requesterId = req.user!.userId;
  const requesterRole = req.user!.role;
  const isSelf = requesterId === id;
  const isAdmin = requesterRole === "super_admin";

  if (!isSelf && !isAdmin) {
    res.status(403).json({ error: "Forbidden", message: "Cannot edit another user's profile" });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.firstName) updates.firstName = parsed.data.firstName;
  if (parsed.data.lastName) updates.lastName = parsed.data.lastName;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (isAdmin && parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
  if (isAdmin && parsed.data.role) updates.role = parsed.data.role as "super_admin" | "admin" | "teacher" | "attendant" | "parent";

  const body = req.body as Record<string, unknown>;
  if (body["photoUrl"] !== undefined) updates.photoUrl = body["photoUrl"] as string | null;
  if (body["dob"] !== undefined) updates.dob = body["dob"] as string | null;
  if (body["gender"] !== undefined) updates.gender = body["gender"] as string | null;
  if (body["placeOfWork"] !== undefined) updates.placeOfWork = body["placeOfWork"] as string | null;
  if (body["communicationPrefs"] !== undefined) updates.communicationPrefs = body["communicationPrefs"] as string | null;

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  res.json(sanitizeUser(user));
});

router.delete("/users/:id", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  await db.update(usersTable).set({ isActive: false, status: "suspended" }).where(eq(usersTable.id, id));
  res.json({ success: true, message: "User deactivated" });
});

export default router;
