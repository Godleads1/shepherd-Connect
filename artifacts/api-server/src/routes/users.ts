import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { db, usersTable, teachersTable, pool } from "@workspace/db";
import { CreateUserBody, UpdateUserBody, ListUsersQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { smsAccountApproved, smsAccountRejected, emailAccountApproved, emailAccountRejected } from "../services/sms";

const router = Router();

const VALID_ROLES = ["super_admin", "admin", "teacher", "support", "parent"] as const;
type UserRole = typeof VALID_ROLES[number];

function parseSecondaryRoles(raw: string | null | undefined): UserRole[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as UserRole[]; } catch { return []; }
}

function parsePendingRoles(raw: string | null | undefined): UserRole[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as UserRole[]; } catch { return []; }
}

function sanitizeUser(
  u: typeof usersTable.$inferSelect,
  viewer?: { role: string; userId: number },
) {
  const isSelf = viewer?.userId === u.id;
  const viewerIsAdmin = viewer?.role === "admin" || viewer?.role === "super_admin";
  const contactHidden = u.hideContactFromAdmin && viewerIsAdmin && !isSelf;

  return {
    id: u.id,
    email: contactHidden ? "Hidden by user" : u.email,
    phone: contactHidden ? null : u.phone,
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
    hideContactFromAdmin: isSelf ? u.hideContactFromAdmin : undefined,
    secondaryRoles: parseSecondaryRoles(u.secondaryRoles),
    pendingRoles: parsePendingRoles(u.pendingRoles),
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
  if (role) conditions.push(eq(usersTable.role, role as "super_admin" | "admin" | "teacher" | "support" | "parent"));
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

  const viewer = { role: req.user!.role, userId: req.user!.userId };
  res.json({ data: users.map(u => sanitizeUser(u, viewer)), total: Number(count), page, limit });
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
    role: role as "super_admin" | "admin" | "teacher" | "support" | "parent",
    status: "active",
    isActive: true,
  }).returning();
  res.status(201).json(sanitizeUser(user));
});

router.get("/users/pending", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const pending = await db.select().from(usersTable)
    .where(eq(usersTable.status, "pending_approval"))
    .orderBy(usersTable.createdAt);
  const viewer = { role: req.user!.role, userId: req.user!.userId };
  res.json({ data: pending.map(u => sanitizeUser(u, viewer)), total: pending.length });
});

router.get("/users/pending-roles", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const allUsers = await db.select().from(usersTable);
  const withPending = allUsers
    .filter(u => u.pendingRoles && u.pendingRoles !== "[]")
    .map(u => ({ ...sanitizeUser(u), pendingRoles: parsePendingRoles(u.pendingRoles) }))
    .filter(u => u.pendingRoles.length > 0);
  res.json({ data: withPending, total: withPending.length });
});

router.get("/users/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  const viewer = { role: req.user!.role, userId: req.user!.userId };
  res.json(sanitizeUser(user, viewer));
});

router.put("/users/:id/approve", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [user] = await db.update(usersTable)
    .set({ status: "active", isActive: true })
    .where(eq(usersTable.id, id))
    .returning();
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  // Auto-create teacher profile when a teacher account is approved
  if (user.role === "teacher") {
    const [existing] = await db.select().from(teachersTable).where(eq(teachersTable.userId, user.id));
    if (!existing) await db.insert(teachersTable).values({ userId: user.id });
  }
  smsAccountApproved(user.phone, user.firstName, req.log).catch(() => {});
  emailAccountApproved(user.email, user.firstName, req.log).catch(() => {});
  const viewer = { role: req.user!.role, userId: req.user!.userId };
  res.json({ success: true, message: "User approved", user: sanitizeUser(user, viewer) });
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
  emailAccountRejected(user.email, user.firstName, req.log).catch(() => {});
  const viewer = { role: req.user!.role, userId: req.user!.userId };
  res.json({ success: true, message: "User rejected", user: sanitizeUser(user, viewer) });
});

router.put("/users/:id/reset-password", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const { password } = req.body as { password?: string };
  if (!password || password.length < 6) {
    res.status(400).json({ error: "Bad request", message: "Password must be at least 6 characters" }); return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, id))
    .returning();
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  res.json({ success: true, message: "Password reset successfully" });
});

router.put("/users/:id/suspend", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [user] = await db.update(usersTable)
    .set({ status: "suspended", isActive: false })
    .where(eq(usersTable.id, id))
    .returning();
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  const viewer = { role: req.user!.role, userId: req.user!.userId };
  res.json({ success: true, message: "User suspended", user: sanitizeUser(user, viewer) });
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
  if (isAdmin && parsed.data.role) updates.role = parsed.data.role as "super_admin" | "admin" | "teacher" | "support" | "parent";

  const body = req.body as Record<string, unknown>;
  if (body["photoUrl"] !== undefined) updates.photoUrl = body["photoUrl"] as string | null;
  if (body["dob"] !== undefined) updates.dob = body["dob"] as string | null;
  if (body["gender"] !== undefined) updates.gender = body["gender"] as string | null;
  if (body["placeOfWork"] !== undefined) updates.placeOfWork = body["placeOfWork"] as string | null;
  if (body["communicationPrefs"] !== undefined) updates.communicationPrefs = body["communicationPrefs"] as string | null;
  if (isSelf && body["hideContactFromAdmin"] !== undefined) updates.hideContactFromAdmin = Boolean(body["hideContactFromAdmin"]);

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  const viewer = { role: requesterRole, userId: requesterId };
  res.json(sanitizeUser(user, viewer));
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

  const validRoles = ["super_admin", "admin", "teacher", "support", "parent"];
  if (!validRoles.includes(role)) { res.status(400).json({ error: "Bad request", message: "Invalid role" }); return; }

  const [updated] = await db.update(usersTable)
    .set({ role: role as "super_admin" | "admin" | "teacher" | "support" | "parent" })
    .where(eq(usersTable.id, id))
    .returning();

  if (role === "teacher") {
    const [existingTeacher] = await db.select().from(teachersTable).where(eq(teachersTable.userId, id));
    if (!existingTeacher) await db.insert(teachersTable).values({ userId: id });
  }

  res.json({ success: true, user: sanitizeUser(updated), message: `Role updated to ${role}` });
});

router.post("/users/:id/approve-role", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const { role } = req.body as { role: string };
  if (!role || !VALID_ROLES.includes(role as UserRole)) {
    res.status(400).json({ error: "Bad request", message: "Invalid role" }); return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }

  const pending = parsePendingRoles(target.pendingRoles);
  if (!pending.includes(role as UserRole)) {
    res.status(400).json({ error: "Bad request", message: "This role is not pending for this user" }); return;
  }

  const existing = parseSecondaryRoles(target.secondaryRoles);
  const updatedSecondary = existing.includes(role as UserRole) ? existing : [...existing, role as UserRole];
  const updatedPending = pending.filter(r => r !== role);

  const [saved] = await db.update(usersTable)
    .set({ secondaryRoles: JSON.stringify(updatedSecondary), pendingRoles: JSON.stringify(updatedPending) })
    .where(eq(usersTable.id, id))
    .returning();

  // Auto-create teacher profile when a teacher secondary role is approved
  if (role === "teacher") {
    const [existingTeacher] = await db.select().from(teachersTable).where(eq(teachersTable.userId, id));
    if (!existingTeacher) await db.insert(teachersTable).values({ userId: id });
  }

  // Notify user
  const { smsAccountApproved: smsApproved, emailAccountApproved: emailApproved } = await import("../services/sms");
  smsApproved(target.phone ?? "", target.firstName, req.log).catch(() => {});
  emailApproved(target.email, target.firstName, req.log).catch(() => {});

  res.json({ success: true, user: sanitizeUser(saved), message: `Role ${role} approved and granted` });
});

router.post("/users/:id/reject-role", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const { role } = req.body as { role: string };
  if (!role) { res.status(400).json({ error: "Bad request", message: "role is required" }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }

  const pending = parsePendingRoles(target.pendingRoles);
  const updatedPending = pending.filter(r => r !== role);

  const [saved] = await db.update(usersTable)
    .set({ pendingRoles: JSON.stringify(updatedPending) })
    .where(eq(usersTable.id, id))
    .returning();

  const { smsAccountRejected: smsRejected, emailAccountRejected: emailRejected } = await import("../services/sms");
  smsRejected(target.phone ?? "", target.firstName, req.log).catch(() => {});
  emailRejected(target.email, target.firstName, req.log).catch(() => {});

  res.json({ success: true, user: sanitizeUser(saved), message: `Role ${role} request rejected` });
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
  if (requesterId === id) { res.status(400).json({ error: "Bad request", message: "Cannot delete your own account" }); return; }
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  if (requesterRole === "admin" && (target.role === "super_admin" || target.role === "admin")) {
    res.status(403).json({ error: "Forbidden", message: "Admins cannot delete super admins or other admins" }); return;
  }
  // Permanently delete the user and nullify / remove all FK references.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const stmts = [
      "UPDATE attendance SET checked_in_by = NULL WHERE checked_in_by = $1",
      "UPDATE attendance SET escorted_by = NULL WHERE escorted_by = $1",
      "UPDATE attendance SET confirmed_by_teacher_id = NULL WHERE confirmed_by_teacher_id = $1",
      "UPDATE attendance SET checked_out_by = NULL WHERE checked_out_by = $1",
      "UPDATE class_assignments SET assigned_by = NULL WHERE assigned_by = $1",
      "UPDATE class_change_requests SET requested_by = NULL WHERE requested_by = $1",
      "UPDATE class_change_requests SET reviewed_by = NULL WHERE reviewed_by = $1",
      "DELETE FROM emergency_updates WHERE emergency_id IN (SELECT id FROM emergencies WHERE triggered_by = $1)",
      "DELETE FROM emergency_updates WHERE user_id = $1",
      "DELETE FROM emergencies WHERE triggered_by = $1",
      "UPDATE safeguarding_records SET teacher_user_id = NULL WHERE teacher_user_id = $1",
      "UPDATE safeguarding_records SET created_by = NULL WHERE created_by = $1",
      "UPDATE substitute_requests SET requesting_teacher_id = NULL WHERE requesting_teacher_id = $1",
      "UPDATE substitute_requests SET substitute_teacher_id = NULL WHERE substitute_teacher_id = $1",
      "UPDATE families SET parent_1_id = NULL WHERE parent_1_id = $1",
      "UPDATE families SET parent_2_id = NULL WHERE parent_2_id = $1",
      "DELETE FROM teacher_allocations WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = $1)",
      "DELETE FROM child_appraisals WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = $1)",
      "DELETE FROM teachers WHERE user_id = $1",
      "DELETE FROM notifications WHERE user_id = $1",
      "DELETE FROM audit_logs WHERE user_id = $1",
      "DELETE FROM parent_feedback WHERE parent_id = $1",
      "DELETE FROM consent_forms WHERE parent_id = $1",
      "DELETE FROM messages WHERE sender_id = $1 OR recipient_id = $1",
      "DELETE FROM push_subscriptions WHERE user_id = $1",
      "UPDATE support_requests SET assigned_support_id = NULL WHERE assigned_support_id = $1",
      "DELETE FROM support_requests WHERE parent_user_id = $1",
      "DELETE FROM users WHERE id = $1",
    ];
    for (const stmt of stmts) await client.query(stmt, [id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  res.json({ success: true, message: "User permanently deleted" });
});

export default router;
