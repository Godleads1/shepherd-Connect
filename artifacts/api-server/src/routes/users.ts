import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { CreateUserBody, UpdateUserBody, ListUsersQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { smsAccountApproved, smsAccountRejected } from "../services/sms";

const router = Router();

const VALID_ROLES = ["super_admin", "admin", "teacher", "attendant", "parent"] as const;
type UserRole = typeof VALID_ROLES[number];

function parseSecondaryRoles(raw: string | null | undefined): UserRole[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as UserRole[]; } catch { return []; }
}

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
    secondaryRoles: parseSecondaryRoles(u.secondaryRoles),
    createdAt: u.createdAt,
  };
}

router.get("/users", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const params = ListUsersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "Bad request", message: params.error.message });
    return;
  }
  const { role, search, page = 1, limit = 300 } = params.data;
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

router.put("/users/:id/approve", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [user] = await db.update(usersTable)
    .set({ status: "active", isActive: true })
    .where(eq(usersTable.id, id))
    .returning();
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  smsAccountApproved(user.phone, user.firstName, req.log).catch(() => {});
  res.json({ success: true, message: "User approved", user: sanitizeUser(user) });
});

router.put("/users/:id/reject", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [user] = await db.update(usersTable)
    .set({ status: "suspended", isActive: false })
    .where(eq(usersTable.id, id))
    .returning();
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  smsAccountRejected(user.phone, user.firstName, req.log).catch(() => {});
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

router.post("/users/:id/reassign-role", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const { role } = req.body as { role: string };
  if (!role) { res.status(400).json({ error: "Bad request", message: "role is required" }); return; }

  const requesterRole = req.user!.role;
  const requesterId = req.user!.userId;

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  if (requesterId === id) { res.status(400).json({ error: "Bad request", message: "Cannot reassign your own role" }); return; }

  const adminAllowed = ["parent", "teacher"];
  if (requesterRole === "admin") {
    if (!adminAllowed.includes(target.role) || !adminAllowed.includes(role)) {
      res.status(403).json({ error: "Forbidden", message: "Admins can only reassign between parent and teacher" }); return;
    }
  }

  const validRoles = ["super_admin", "admin", "teacher", "attendant", "parent"];
  if (!validRoles.includes(role)) { res.status(400).json({ error: "Bad request", message: "Invalid role" }); return; }

  const [updated] = await db.update(usersTable)
    .set({ role: role as "super_admin" | "admin" | "teacher" | "attendant" | "parent" })
    .where(eq(usersTable.id, id))
    .returning();

  res.json({ success: true, user: sanitizeUser(updated), message: `Role updated to ${role}` });
});

router.post("/users/:id/grant-role", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  if (req.user!.userId === id) { res.status(400).json({ error: "Bad request", message: "Cannot modify your own secondary roles" }); return; }

  const { role } = req.body as { role: string };
  if (!role || !VALID_ROLES.includes(role as UserRole)) {
    res.status(400).json({ error: "Bad request", message: "Invalid role" }); return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  if (target.role === role) { res.status(400).json({ error: "Bad request", message: "This is already the user's primary role" }); return; }

  const existing = parseSecondaryRoles(target.secondaryRoles);
  if (existing.includes(role as UserRole)) { res.status(400).json({ error: "Conflict", message: "User already has this secondary role" }); return; }

  const updated = [...existing, role as UserRole];
  const [saved] = await db.update(usersTable).set({ secondaryRoles: JSON.stringify(updated) }).where(eq(usersTable.id, id)).returning();
  res.json({ success: true, user: sanitizeUser(saved), message: `Secondary role ${role} granted` });
});

router.delete("/users/:id/grant-role/:role", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const role = req.params.role as string;
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }

  const existing = parseSecondaryRoles(target.secondaryRoles);
  const updated = existing.filter(r => r !== role);
  const [saved] = await db.update(usersTable).set({ secondaryRoles: JSON.stringify(updated) }).where(eq(usersTable.id, id)).returning();
  res.json({ success: true, user: sanitizeUser(saved), message: `Secondary role ${role} revoked` });
});

router.delete("/users/:id", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const requesterRole = req.user!.role;
  const requesterId = req.user!.userId;
  if (requesterId === id) { res.status(400).json({ error: "Bad request", message: "Cannot deactivate your own account" }); return; }
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  if (requesterRole === "admin" && (target.role === "super_admin" || target.role === "admin")) {
    res.status(403).json({ error: "Forbidden", message: "Admins cannot deactivate super admins or other admins" }); return;
  }
  await db.update(usersTable).set({ isActive: false, status: "suspended" }).where(eq(usersTable.id, id));
  res.json({ success: true, message: "User deactivated" });
});

export default router;
