import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as OTPAuth from "otpauth";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { LoginBody, RegisterBody } from "@workspace/api-zod";
import { generateToken, authMiddleware } from "../middlewares/auth";
import { smsWelcome, smsPendingApproval, smsPasswordResetCode } from "../services/sms";

const VALID_ROLES = ["super_admin", "admin", "teacher", "attendant", "parent"] as const;
type UserRole = typeof VALID_ROLES[number];

function parseSecondaryRoles(raw: string | null | undefined): UserRole[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as UserRole[]; } catch { return []; }
}

function buildUserPayload(user: typeof usersTable.$inferSelect, activeRole?: UserRole) {
  const secondary = parseSecondaryRoles(user.secondaryRoles);
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
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
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
  const secondary = parseSecondaryRoles(user.secondaryRoles);
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
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "Conflict", message: "Email already registered" });
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
      role: role as "super_admin" | "admin" | "teacher" | "attendant" | "parent",
      status: userStatus,
      isActive,
    })
    .returning();

  if (requiresApproval) {
    smsPendingApproval(user.phone, user.firstName, req.log).catch(() => {});
    res.status(201).json({
      pending: true,
      message: "Registration successful. Your account is pending admin approval. You will be notified once approved.",
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
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 15 * 60 * 1000);
  const hashedCode = await bcrypt.hash(code, 10);
  await db.update(usersTable)
    .set({ resetToken: hashedCode, resetTokenExpiry: expiry })
    .where(eq(usersTable.id, user.id));

  smsPasswordResetCode(user.phone, code, req.log).catch(() => {});

  res.json({ success: true, code, expiresInMinutes: 15, message: "Reset code generated successfully." });
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
  const valid = await bcrypt.compare(code, user.resetToken);
  if (!valid) {
    res.status(400).json({ error: "Bad request", message: "Incorrect reset code. Please check and try again." });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable)
    .set({ passwordHash, resetToken: null, resetTokenExpiry: null })
    .where(eq(usersTable.id, user.id));
  res.json({ success: true, message: "Password reset successfully. You can now sign in with your new password." });
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

export default router;
