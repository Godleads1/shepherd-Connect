import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { CreateUserBody, UpdateUserBody, ListUsersQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

router.get("/users", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const params = ListUsersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "Bad request", message: params.error.message });
    return;
  }
  const { role, search, page = 1, limit = 20 } = params.data;
  const offset = (page - 1) * limit;

  const roleCondition = role ? eq(usersTable.role, role as "super_admin" | "admin" | "teacher" | "attendant" | "parent") : undefined;
  const searchCondition = search ? or(
    ilike(usersTable.firstName, `%${search}%`),
    ilike(usersTable.lastName, `%${search}%`),
    ilike(usersTable.email, `%${search}%`)
  ) : undefined;

  const whereClause = roleCondition && searchCondition
    ? and(roleCondition, searchCondition)
    : roleCondition ?? searchCondition;

  const users = await db.select().from(usersTable)
    .where(whereClause)
    .limit(limit).offset(offset);

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(whereClause);

  const sanitized = users.map((u) => ({
    id: u.id, email: u.email, phone: u.phone, role: u.role,
    firstName: u.firstName, lastName: u.lastName, isActive: u.isActive, createdAt: u.createdAt,
  }));
  res.json({ data: sanitized, total: Number(count), page, limit });
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
  }).returning();
  res.status(201).json({ id: user.id, email: user.email, phone: user.phone, role: user.role, firstName: user.firstName, lastName: user.lastName, isActive: user.isActive, createdAt: user.createdAt });
});

router.get("/users/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  res.json({ id: user.id, email: user.email, phone: user.phone, role: user.role, firstName: user.firstName, lastName: user.lastName, isActive: user.isActive, createdAt: user.createdAt });
});

router.put("/users/:id", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.firstName) updates.firstName = parsed.data.firstName;
  if (parsed.data.lastName) updates.lastName = parsed.data.lastName;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
  if (parsed.data.role) updates.role = parsed.data.role as "super_admin" | "admin" | "teacher" | "attendant" | "parent";
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  res.json({ id: user.id, email: user.email, phone: user.phone, role: user.role, firstName: user.firstName, lastName: user.lastName, isActive: user.isActive, createdAt: user.createdAt });
});

router.delete("/users/:id", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.id, id));
  res.json({ success: true, message: "User deactivated" });
});

export default router;
