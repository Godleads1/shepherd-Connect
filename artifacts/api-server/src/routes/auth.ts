import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as OTPAuth from "otpauth";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { LoginBody, RegisterBody } from "@workspace/api-zod";
import { generateToken, authMiddleware } from "../middlewares/auth";
import { smsWelcome, smsPendingApproval, smsPasswordResetCode, smsRegistrationOtp, emailRegistrationOtp, emailWelcome, emailPendingApproval, emailPasswordResetCode } from "../services/sms";
import { withDbRetry } from "../lib/db-retry";

// ── In-memory OTP sessions (phone verification during registration) ────────────
// key: random session ID returned to client as "pinId"
// value: { otp, phone, expiresAt }
// For multi-instance deployments swap this for a Redis store or a DB table.
const otpSessions = new Map<string, { otp: string; phone: string; expiresAt: Date }>();
setInterval(() => {
  const now = new Date();
  for (const [key, s] of otpSessions) { if (s.expiresAt < now) otpSessions.delete(key); }
}, 60_000); // prune expired sessions every minute

const VALID_ROLES = ["super_admin", "admin", "teacher", "support", "parent"] as const;
type UserRole = typeof VALID_ROLES[number];

function parseSecondaryRoles(raw: string | null | undefined): UserRole[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as UserRole[]; } catch { return []; }
}

function buildUserPayload(user: typeof usersTable.$inferSelect, activeRole?: UserRole) {
  const secondary = parseSecondaryRoles(user.secondaryRoles).filter(r => r !== user.role);
  const allRoles: UserRole[] = [user.role, ...secondary];
  const role = activeRole ?? user.role;
  return {
    id: user.id, email: user.email, phone: user.phone, role,
    firstName: user.firstName, lastName: user.lastName,
    isActive: user.isActive, status: user.status, photoUrl: user.photoUrl,
    dob: user.dob, gender: user.gender, placeOfWork: user.placeOfWork,
    communicationPrefs: user.communicationPrefs,
    secondaryRoles: secondary,
    allRoles,
    createdAt: user.createdAt,
  };
}

const JWT_SECRET = process.env.SESSION_SECRET || "shepherd-connect-secret";

const router = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad request", message: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await withDbRetry(() =>
    db.select().from(usersTable).where(eq(usersTable.email, email)).then(r => r),
  ).then(r => r);
  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return;
  }
  if (user.status === "pending_approval") {
    res.status(403).json({ error: "Forbidden", message: "Your account is pending admin approval. You will be notified once approved." });
    return;
  }
  if (user.status === "suspended") {
    res.status(403).json({ error: "Forbidden", message: "Your account has been suspended. Please contact the church administrator." });
    return;
  }
  if (!user.isActive) {
    res.status(401).json({ error: "Unauthorized", message: "Account is inactive" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return;
  }

  if (user.mfaEnabled && user.mfaSecret) {
    const mfaToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, mfaOnly: true },
      JWT_SECRET,
      { expiresIn: "5m" }
    );
    res.json({ requiresMfa: true, mfaToken });
    return;
  }

  const { requestedRole } = req.body as { requestedRole?: string };
  const secondary = parseSecondaryRoles(user.secondaryRoles).filter(r => r !== user.role);
  const allRoles: UserRole[] = [user.role, ...secondary];

  // If user has multiple roles and no requestedRole given, ask them to pick
  if (allRoles.length > 1 && !requestedRole) {
    res.json({ requiresRolePick: true, allRoles, firstName: user.firstName });
    return;
  }

  let activeRole: UserRole = user.role;
  if (requestedRole) {
    if (!allRoles.includes(requestedRole as UserRole)) {
      res.status(403).json({ error: "Forbidden", message: "You do not have access to that role" });
      return;
    }
    activeRole = requestedRole as UserRole;
  }

  const token = generateToken({
    userId: user.id, email: user.email, role: activeRole,
    firstName: user.firstName, lastName: user.lastName,
  });
  res.json({ token, user: buildUserPayload(user, activeRole) });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad request", message: parsed.error.message });
    return;
  }
  const { email, password, firstName, lastName, phone, role } = parsed.data;
  const primaryClassId = (req.body as any).primaryClassId ? Number((req.body as any).primaryClassId) : null;
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (existing) {
    // Email already registered — add role to pendingRoles if not already held
    const VALID_ROLES_LIST = ["super_admin", "admin", "teacher", "support", "parent"];
    if (!VALID_ROLES_LIST.includes(role)) {
      res.status(400).json({ error: "Bad request", message: "Invalid role" }); return;
    }
    if (existing.role === role) {
      res.status(409).json({ error: "Conflict", message: "You already have this role" }); return;
    }
    const currentSecondary: string[] = existing.secondaryRoles ? JSON.parse(existing.secondaryRoles) : [];
    if (currentSecondary.includes(role)) {
      res.status(409).json({ error: "Conflict", message: "You already have this role" }); return;
    }
    const currentPending: string[] = existing.pendingRoles ? JSON.parse(existing.pendingRoles) : [];
    if (currentPending.includes(role)) {
      res.status(409).json({ error: "Conflict", message: "A request for this role is already pending approval" }); return;
    }
    // Verify password matches existing account
    const passwordValid = await bcrypt.compare(password, existing.passwordHash);
    if (!passwordValid) {
      res.status(401).json({ error: "Unauthorized", message: "Incorrect password for this email address" }); return;
    }

    const newRoleRequiresApproval = role === "admin" || role === "teacher";

    if (newRoleRequiresApproval) {
      // Queue for admin approval
      const updatedPending = [...currentPending, role];
      await db.update(usersTable)
        .set({ pendingRoles: JSON.stringify(updatedPending) })
        .where(eq(usersTable.id, existing.id));
      smsPendingApproval(existing.phone ?? "", existing.firstName, req.log).catch(() => {});
      emailPendingApproval(existing.email, existing.firstName, req.log).catch(() => {});
      res.status(201).json({
        pending: true,
        message: `Your request to join as ${role} has been submitted. An admin will review and approve it. You will be notified once approved.`,
      });
    } else {
      // Grant immediately — no approval needed for parent / support
      const updatedSecondary = [...currentSecondary, role];
      await db.update(usersTable)
        .set({ secondaryRoles: JSON.stringify(updatedSecondary) })
        .where(eq(usersTable.id, existing.id));
      smsWelcome(existing.phone ?? "", existing.firstName, req.log).catch(() => {});
      emailWelcome(existing.email, existing.firstName, req.log).catch(() => {});
      const roleLabel = role === "support" ? "Support" : "Parent";
      res.status(201).json({
        roleAdded: true,
        role,
        message: `Your ${roleLabel} role has been added. Sign in and select the "${roleLabel}" tab to access your ${roleLabel} dashboard.`,
      });
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const requiresApproval = role === "admin" || role === "teacher";
  const userStatus = requiresApproval ? "pending_approval" : "active";
  const isActive = !requiresApproval;

  const [user] = await db
    .insert(usersTable)
    .values({
      email,
      passwordHash,
      firstName,
      lastName,
      phone,
      role: role as "super_admin" | "admin" | "teacher" | "support" | "parent",
      status: userStatus,
      isActive,
      ...(role === "teacher" && primaryClassId ? { primaryClassId } : {}),
    })
    .returning();

  if (requiresApproval) {
    smsPendingApproval(user.phone, user.firstName, req.log).catch(() => {});
    emailPendingApproval(user.email, user.firstName, req.log).catch(() => {});
    res.status(201).json({
      pending: true,
      message: "Registration submitted. Your account is pending admin approval. You will be notified once approved.",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
      },
    });
    return;
  }

  smsWelcome(user.phone, user.firstName, req.log).catch(() => {});
  emailWelcome(user.email, user.firstName, req.log).catch(() => {});

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  });
  res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      status: user.status,
      photoUrl: user.photoUrl,
      createdAt: user.createdAt,
    },
  });
});

router.get("/auth/me", authMiddleware, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "Not found", message: "User not found" });
    return;
  }
  res.json(buildUserPayload(user));
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true, message: "Logged out" });
});

router.post("/auth/change-password", authMiddleware, async (req, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Bad request", message: "currentPassword and newPassword are required" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "Bad request", message: "New password must be at least 6 characters" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Bad request", message: "Current password is incorrect" });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
  req.log.info({ userId: user.id }, "User changed their password");
  res.json({ success: true, message: "Password changed successfully" });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Bad request", message: "Email is required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.trim().toLowerCase()));
  if (!user) {
    res.json({ success: true, message: "If this email is registered, a reset code has been generated." });
    return;
  }
  // App generates the code — Termii is only the delivery channel
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 15 * 60 * 1000);
  // Store plaintext — verified by direct string comparison (same pattern as delegate OTP)
  await db.update(usersTable)
    .set({ resetToken: code, resetTokenExpiry: expiry })
    .where(eq(usersTable.id, user.id));

  smsPasswordResetCode(user.phone, code, req.log).catch(() => {});
  emailPasswordResetCode(user.email, user.firstName, code, req.log).catch(() => {});

  // Do NOT return the code in the response — the user must check their SMS / email
  res.json({ success: true, expiresInMinutes: 15, message: "Reset code sent to your phone and email." });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { email, code, newPassword } = req.body as { email?: string; code?: string; newPassword?: string };
  if (!email || !code || !newPassword) {
    res.status(400).json({ error: "Bad request", message: "email, code, and newPassword are required" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "Bad request", message: "Password must be at least 6 characters" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.trim().toLowerCase()));
  if (!user || !user.resetToken || !user.resetTokenExpiry) {
    res.status(400).json({ error: "Bad request", message: "Invalid or expired reset code. Please request a new one." });
    return;
  }
  if (new Date() > user.resetTokenExpiry) {
    res.status(400).json({ error: "Bad request", message: "Reset code has expired. Please request a new one." });
    return;
  }
  if (code.trim() !== user.resetToken) {
    res.status(400).json({ error: "Bad request", message: "Incorrect reset code. Please check and try again." });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable)
    .set({ passwordHash, resetToken: null, resetTokenExpiry: null })
    .where(eq(usersTable.id, user.id));
  res.json({ success: true, message: "Password reset successfully. You can now sign in with your new password." });
});

// ── OTP endpoints (phone verification) ───────────────────────────────────────

router.post("/auth/send-otp", async (req, res): Promise<void> => {
  const { phone, email, channel } = req.body as { phone?: string; email?: string; channel?: "sms" | "whatsapp" | "email" };

  // Email-only delivery: phone not required
  if (channel === "email") {
    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "Bad request", message: "email is required for email delivery" });
      return;
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const pinId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
    otpSessions.set(pinId, { otp, phone: email.trim(), expiresAt });
    await emailRegistrationOtp(email.trim(), otp, req.log);
    res.json({ pinId, message: "OTP sent to your email" });
    return;
  }

  if (!phone || typeof phone !== "string") {
    res.status(400).json({ error: "Bad request", message: "phone is required" });
    return;
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const pinId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
  otpSessions.set(pinId, { otp, phone: phone.trim(), expiresAt });

  // Fire SMS/WhatsApp in background — don't block the response on it
  smsRegistrationOtp(phone.trim(), otp, req.log).catch(() => {});

  // Always send email backup so the user gets the code even if SMS/WhatsApp fails
  if (email && typeof email === "string") {
    await emailRegistrationOtp(email.trim(), otp, req.log);
    res.json({ pinId, message: "OTP sent to your phone and email" });
  } else {
    res.json({ pinId, message: "OTP sent to your phone" });
  }
});

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const { pinId, otp } = req.body as { pinId?: string; otp?: string };
  if (!pinId || !otp) {
    res.status(400).json({ error: "Bad request", message: "pinId and otp are required" });
    return;
  }
  const session = otpSessions.get(pinId);
  if (!session || session.expiresAt < new Date() || session.otp !== otp.trim()) {
    res.status(400).json({ error: "Bad request", message: "Incorrect or expired code. Please try again." });
    return;
  }
  otpSessions.delete(pinId); // one-time use — invalidate immediately after verification
  res.json({ verified: true });
});

// ── MFA endpoints ─────────────────────────────────────────────────────────────

router.post("/auth/mfa/setup", authMiddleware, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: "Shepherd Connect",
    label: user.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });

  await db.update(usersTable).set({ mfaSecret: secret.base32 }).where(eq(usersTable.id, user.id));
  res.json({ qrCodeUri: totp.toString(), secret: secret.base32 });
});

router.post("/auth/mfa/confirm", authMiddleware, async (req, res): Promise<void> => {
  const { totpCode } = req.body as { totpCode: string };
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user?.mfaSecret) { res.status(400).json({ error: "Bad request", message: "Run /auth/mfa/setup first" }); return; }

  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.mfaSecret), algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: totpCode, window: 1 });
  if (delta === null) { res.status(400).json({ error: "Bad request", message: "Invalid authenticator code" }); return; }

  await db.update(usersTable).set({ mfaEnabled: true }).where(eq(usersTable.id, user.id));
  res.json({ success: true, message: "Two-factor authentication is now enabled." });
});

router.post("/auth/mfa/disable", authMiddleware, async (req, res): Promise<void> => {
  const { totpCode } = req.body as { totpCode: string };
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user?.mfaEnabled || !user.mfaSecret) { res.status(400).json({ error: "Bad request", message: "MFA is not enabled" }); return; }

  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.mfaSecret), algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: totpCode, window: 1 });
  if (delta === null) { res.status(400).json({ error: "Bad request", message: "Invalid authenticator code" }); return; }

  await db.update(usersTable).set({ mfaEnabled: false, mfaSecret: null }).where(eq(usersTable.id, user.id));
  res.json({ success: true, message: "Two-factor authentication disabled." });
});

router.get("/auth/mfa/status", authMiddleware, async (req, res): Promise<void> => {
  const [user] = await db.select({ mfaEnabled: usersTable.mfaEnabled }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
  res.json({ mfaEnabled: user?.mfaEnabled || false });
});

router.post("/auth/mfa/verify-login", async (req, res): Promise<void> => {
  const { mfaToken, totpCode } = req.body as { mfaToken: string; totpCode: string };
  if (!mfaToken || !totpCode) { res.status(400).json({ error: "Bad request", message: "mfaToken and totpCode are required" }); return; }

  let payload: any;
  try {
    payload = jwt.verify(mfaToken, JWT_SECRET) as any;
    if (!payload.mfaOnly) { res.status(400).json({ error: "Bad request", message: "Invalid token type" }); return; }
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "MFA token expired or invalid. Please log in again." }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user?.mfaEnabled || !user.mfaSecret) { res.status(400).json({ error: "Bad request", message: "MFA not configured" }); return; }

  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.mfaSecret), algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: totpCode, window: 1 });
  if (delta === null) { res.status(401).json({ error: "Unauthorized", message: "Invalid authenticator code" }); return; }

  const token = generateToken({ userId: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName });
  res.json({ token, user: buildUserPayload(user) });
});

// POST /auth/switch-role — swap active role within the user's allRoles (no re-login needed)
router.post("/auth/switch-role", authMiddleware, async (req, res): Promise<void> => {
  const { role: requestedRole } = req.body as { role?: string };
  if (!requestedRole) { res.status(400).json({ error: "Bad request", message: "role is required" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) { res.status(404).json({ error: "Not found", message: "User not found" }); return; }

  const secondary = parseSecondaryRoles(user.secondaryRoles).filter(r => r !== user.role);
  const allRoles: UserRole[] = [user.role, ...secondary];

  if (!allRoles.includes(requestedRole as UserRole)) {
    res.status(403).json({ error: "Forbidden", message: "You do not have access to that role" }); return;
  }

  const token = generateToken({ userId: user.id, email: user.email, role: requestedRole as UserRole, firstName: user.firstName, lastName: user.lastName });
  res.json({ token, user: buildUserPayload(user, requestedRole as UserRole) });
});

export default router;
