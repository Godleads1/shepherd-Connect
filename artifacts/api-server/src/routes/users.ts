import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { db, usersTable, teachersTable, classesTable, pool } from "@workspace/db";
import { CreateUserBody, UpdateUserBody, ListUsersQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { bindObjectToResource } from "../lib/privateObjectAccess";
import { createNotificationDelivery } from "../services/notificationOutbox";
import {
  canonicalPendingRoles,
  canonicalSecondaryRoles,
  lockUserById,
  USER_ROLES,
  type UserRole,
} from "../lib/roleMutations";

const router = Router();

const VALID_ROLES = USER_ROLES;

async function createDecisionDelivery(
  tx: any,
  user: typeof usersTable.$inferSelect,
  requestedRole: UserRole,
  decision: "approved" | "rejected",
  scope: "account" | "role",
) {
  const approved = decision === "approved";
  const type = `${scope}_${decision}`;
  const subject = scope === "account" ? "account" : `${requestedRole} role request`;
  await createNotificationDelivery(tx, {
    // This identity is the decision generation boundary. It intentionally
    // contains no clock/random value, so retries and racing decisions share
    // the one projection and one set of delivery intents.
    logicalIdentity: `${scope}-decision:${user.id}:${requestedRole}:${decision}`,
    domainType: `${scope}_approval`,
    domainIdentifier: `${user.id}:${requestedRole}`,
    projection: {
      userId: user.id,
      type,
      title: approved ? "Approval Confirmed" : "Request Rejected",
      message: approved
        ? `Your ${subject} has been approved.`
        : `Your ${subject} has been rejected.`,
      metadata: { role: requestedRole, decision },
    },
    channels: ["sms", "email"],
    templateKey: type,
  });
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
    secondaryRoles: canonicalSecondaryRoles(u.secondaryRoles, u.role),
    pendingRoles: canonicalPendingRoles(u.pendingRoles),
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
    .map(u => ({ ...sanitizeUser(u), pendingRoles: canonicalPendingRoles(u.pendingRoles) }))
    .filter(u => u.pendingRoles.length > 0);
  res.json({ data: withPending, total: withPending.length });
});

router.get("/users/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const isSelf = req.user!.userId === id;
  const isAdmin = req.user!.role === "admin" || req.user!.role === "super_admin";
  if (!isSelf && !isAdmin) {
    res.status(404).json({ error: "Not found", message: "User not found" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  const viewer = { role: req.user!.role, userId: req.user!.userId };
  let primaryClass: { id: number; name: string; ageMin: number; ageMax: number } | null = null;
  if (user.primaryClassId != null) {
    const [assignedClass] = await db
      .select({
        id: classesTable.id,
        name: classesTable.name,
        ageMin: classesTable.ageMin,
        ageMax: classesTable.ageMax,
      })
      .from(classesTable)
      .where(eq(classesTable.id, user.primaryClassId));
    primaryClass = assignedClass ?? null;
  }
  res.json({ ...sanitizeUser(user, viewer), primaryClass });
});

router.put("/users/:id/approve", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const user = await db.transaction(async tx => {
    const target = await lockUserById(tx, id);
    if (!target) return undefined;
    const [approved] = await tx.update(usersTable)
      .set({ status: "active", isActive: true })
      .where(eq(usersTable.id, id))
      .returning();
    if (target.role === "teacher") {
      await tx.insert(teachersTable).values({ userId: target.id }).onConflictDoNothing();
    }
    await createDecisionDelivery(tx, approved, target.role, "approved", "account");
    return approved;
  });
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  const viewer = { role: req.user!.role, userId: req.user!.userId };
  res.json({ success: true, message: "User approved", user: sanitizeUser(user, viewer) });
});

router.put("/users/:id/reject", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const user = await db.transaction(async tx => {
    const target = await lockUserById(tx, id);
    if (!target) return undefined;
    const [rejected] = await tx.update(usersTable)
      .set({ status: "suspended", isActive: false })
      .where(eq(usersTable.id, id))
      .returning();
    await createDecisionDelivery(tx, rejected, target.role, "rejected", "account");
    return rejected;
  });
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
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
  const [existingUser] = await db.select({ photoUrl: usersTable.photoUrl })
    .from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!existingUser) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.firstName) updates.firstName = parsed.data.firstName;
  if (parsed.data.lastName) updates.lastName = parsed.data.lastName;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (isAdmin && parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
  if (isAdmin && parsed.data.role) updates.role = parsed.data.role as "super_admin" | "admin" | "teacher" | "support" | "parent";

  const body = req.body as Record<string, unknown>;
  if (
    typeof body["photoUrl"] === "string"
    && body["photoUrl"] !== existingUser.photoUrl
    && !(await bindObjectToResource(body["photoUrl"], "user", id, req.user!))
  ) {
    res.status(403).json({ error: "Forbidden", message: "This uploaded photo cannot be attached to this profile" });
    return;
  }
  if (body["photoUrl"] !== undefined) updates.photoUrl = body["photoUrl"] as string | null;
  if (body["dob"] !== undefined) updates.dob = body["dob"] as string | null;
  if (body["gender"] !== undefined) updates.gender = body["gender"] as string | null;
  if (body["placeOfWork"] !== undefined) updates.placeOfWork = body["placeOfWork"] as string | null;
  if (body["communicationPrefs"] !== undefined) updates.communicationPrefs = body["communicationPrefs"] as string | null;
  if (isSelf && body["hideContactFromAdmin"] !== undefined) updates.hideContactFromAdmin = Boolean(body["hideContactFromAdmin"]);

  const [user] = updates.role
    ? await db.transaction(async tx => {
        const locked = await lockUserById(tx, id);
        if (!locked) return [];
        const primaryRole = updates.role as UserRole;
        return tx.update(usersTable).set({
          ...updates,
          secondaryRoles: JSON.stringify(canonicalSecondaryRoles(locked.secondaryRoles, primaryRole)),
          pendingRoles: JSON.stringify(canonicalPendingRoles(locked.pendingRoles)),
        }).where(eq(usersTable.id, id)).returning();
      })
    : await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
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

  if (requesterId === id) { res.status(400).json({ error: "Bad request", message: "Cannot reassign your own role" }); return; }

  const validRoles = ["super_admin", "admin", "teacher", "support", "parent"];
  if (!validRoles.includes(role)) { res.status(400).json({ error: "Bad request", message: "Invalid role" }); return; }

  const result = await db.transaction(async tx => {
    const target = await lockUserById(tx, id);
    if (!target) return { kind: "notFound" as const };
    const adminAllowed = ["parent", "teacher"];
    if (requesterRole === "admin" && (!adminAllowed.includes(target.role) || !adminAllowed.includes(role))) {
      return { kind: "forbidden" as const };
    }
    const primaryRole = role as UserRole;
    const [updated] = await tx.update(usersTable)
      .set({
        role: primaryRole,
        secondaryRoles: JSON.stringify(canonicalSecondaryRoles(target.secondaryRoles, primaryRole)),
        pendingRoles: JSON.stringify(canonicalPendingRoles(target.pendingRoles)),
      })
      .where(eq(usersTable.id, id))
      .returning();
    if (role === "teacher") {
      await tx.insert(teachersTable).values({ userId: id }).onConflictDoNothing();
    }
    return { kind: "updated" as const, user: updated };
  });
  if (result.kind === "notFound") { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  if (result.kind === "forbidden") {
    res.status(403).json({ error: "Forbidden", message: "Admins can only reassign between parent and teacher" }); return;
  }

  res.json({ success: true, user: sanitizeUser(result.user), message: `Role updated to ${role}` });
});

router.post("/users/:id/approve-role", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const { role } = req.body as { role: string };
  if (!role || !VALID_ROLES.includes(role as UserRole)) {
    res.status(400).json({ error: "Bad request", message: "Invalid role" }); return;
  }

  const result = await db.transaction(async tx => {
    const target = await lockUserById(tx, id);
    if (!target) return { kind: "notFound" as const };
    const pending = canonicalPendingRoles(target.pendingRoles);
    if (!pending.includes(role as UserRole)) return { kind: "notPending" as const };
    const existing = canonicalSecondaryRoles(target.secondaryRoles, target.role);
    const updatedSecondary = target.role === role || existing.includes(role as UserRole)
      ? existing
      : [...existing, role as UserRole];
    const updatedPending = pending.filter(entry => entry !== role);
    const [saved] = await tx.update(usersTable)
      .set({ secondaryRoles: JSON.stringify(updatedSecondary), pendingRoles: JSON.stringify(updatedPending) })
      .where(eq(usersTable.id, id))
      .returning();
    if (role === "teacher") {
      await tx.insert(teachersTable).values({ userId: id }).onConflictDoNothing();
    }
    await createDecisionDelivery(tx, saved, role as UserRole, "approved", "role");
    return { kind: "approved" as const, target, user: saved };
  });
  if (result.kind === "notFound") { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  if (result.kind === "notPending") {
    res.status(400).json({ error: "Bad request", message: "This role is not pending for this user" }); return;
  }

  res.json({ success: true, user: sanitizeUser(result.user), message: `Role ${role} approved and granted` });
});

router.post("/users/:id/reject-role", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const { role } = req.body as { role: string };
  if (!role) { res.status(400).json({ error: "Bad request", message: "role is required" }); return; }

  const result = await db.transaction(async tx => {
    const target = await lockUserById(tx, id);
    if (!target) return { kind: "notFound" as const };
    const pending = canonicalPendingRoles(target.pendingRoles);
    const updatedPending = pending.filter(entry => entry !== role);
    const [saved] = await tx.update(usersTable)
      .set({
        secondaryRoles: JSON.stringify(canonicalSecondaryRoles(target.secondaryRoles, target.role)),
        pendingRoles: JSON.stringify(updatedPending),
      })
      .where(eq(usersTable.id, id))
      .returning();
    await createDecisionDelivery(tx, saved, role as UserRole, "rejected", "role");
    return { kind: "rejected" as const, target, user: saved };
  });
  if (result.kind === "notFound") { res.status(404).json({ error: "Not found", message: "User not found" }); return; }

  res.json({ success: true, user: sanitizeUser(result.user), message: `Role ${role} request rejected` });
});

router.post("/users/:id/grant-role", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  if (req.user!.userId === id) { res.status(400).json({ error: "Bad request", message: "Cannot modify your own secondary roles" }); return; }

  const { role } = req.body as { role: string };
  if (!role || !VALID_ROLES.includes(role as UserRole)) {
    res.status(400).json({ error: "Bad request", message: "Invalid role" }); return;
  }

  const result = await db.transaction(async tx => {
    const target = await lockUserById(tx, id);
    if (!target) return { kind: "notFound" as const };
    if (target.role === role) return { kind: "primary" as const };
    const existing = canonicalSecondaryRoles(target.secondaryRoles, target.role);
    if (existing.includes(role as UserRole)) return { kind: "duplicate" as const };
    const [saved] = await tx.update(usersTable).set({
      secondaryRoles: JSON.stringify([...existing, role as UserRole]),
      pendingRoles: JSON.stringify(canonicalPendingRoles(target.pendingRoles)),
    }).where(eq(usersTable.id, id)).returning();
    return { kind: "granted" as const, user: saved };
  });
  if (result.kind === "notFound") { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  if (result.kind === "primary") { res.status(400).json({ error: "Bad request", message: "This is already the user's primary role" }); return; }
  if (result.kind === "duplicate") { res.status(400).json({ error: "Conflict", message: "User already has this secondary role" }); return; }
  res.json({ success: true, user: sanitizeUser(result.user), message: `Secondary role ${role} granted` });
});

router.delete("/users/:id/grant-role/:role", authMiddleware, requireRoles("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const role = req.params.role as string;
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const result = await db.transaction(async tx => {
    const target = await lockUserById(tx, id);
    if (!target) return { kind: "notFound" as const };
    const existing = canonicalSecondaryRoles(target.secondaryRoles, target.role);
    const [saved] = await tx.update(usersTable).set({
      secondaryRoles: JSON.stringify(existing.filter(entry => entry !== role)),
      pendingRoles: JSON.stringify(canonicalPendingRoles(target.pendingRoles)),
    }).where(eq(usersTable.id, id)).returning();
    return { kind: "revoked" as const, user: saved };
  });
  if (result.kind === "notFound") { res.status(404).json({ error: "Not found", message: "User not found" }); return; }
  res.json({ success: true, user: sanitizeUser(result.user), message: `Secondary role ${role} revoked` });
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
      "DELETE FROM sse_tickets WHERE user_id = $1",
      "DELETE FROM notification_outbox WHERE recipient_user_id = $1",
      "DELETE FROM notifications WHERE user_id = $1",
      "DELETE FROM audit_logs WHERE user_id = $1",
      "DELETE FROM parent_feedback WHERE parent_id = $1",
      "DELETE FROM consent_forms WHERE parent_id = $1",
      "DELETE FROM messages WHERE sender_id = $1 OR recipient_id = $1",
      "DELETE FROM push_subscriptions WHERE user_id = $1",
      "UPDATE support_requests SET assigned_support_id = NULL WHERE assigned_support_id = $1",
      "DELETE FROM support_requests WHERE parent_user_id = $1",
      "DELETE FROM bot_pending_approvals WHERE parent_user_id = $1",
      "UPDATE bot_pending_approvals SET assigned_support_id = NULL WHERE assigned_support_id = $1",
      "DELETE FROM bot_sessions WHERE active_user_id = $1",
      "DELETE FROM bot_lid_cache WHERE user_id = $1",
      "DELETE FROM parent_concerns WHERE parent_user_id = $1",
      "DELETE FROM safeguarding_acknowledgements WHERE user_id = $1",
      "DELETE FROM staff_checkpoint_logs WHERE user_id = $1",
      "DELETE FROM staff_scans WHERE user_id = $1",
      "UPDATE sunday_qr_codes SET created_by_id = NULL WHERE created_by_id = $1",
      "DELETE FROM teacher_clock_ins WHERE user_id = $1",
      "DELETE FROM teacher_incidents WHERE teacher_user_id = $1",
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
