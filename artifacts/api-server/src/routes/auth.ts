import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as OTPAuth from "otpauth";
import { createHmac, randomInt, randomUUID } from "node:crypto";
import rateLimit from "express-rate-limit";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, otpSessionsTable } from "@workspace/db";
import { LoginBody, RegisterBody } from "@workspace/api-zod";
import { generateToken, authMiddleware } from "../middlewares/auth";
import { smsWelcome, smsPendingApproval, smsPasswordResetCode, smsRegistrationOtp, emailRegistrationOtp, emailWelcome, emailPendingApproval, emailPasswordResetCode } from "../services/sms";
import { withDbRetry } from "../lib/db-retry";
import { getPublicRegistrationPolicy } from "../lib/registrationPolicy";

// Tight limiter for password-reset verification — prevents brute-forcing the
// 6-digit code (1,000,000 combinations) by capping to 5 attempts / 15 min / IP.
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts", message: "Too many password reset attempts. Please wait 15 minutes before trying again." },
});

// ── DB-backed OTP sessions (phone/email verification during registration) ──────
// Stored in the otp_sessions table so they survive restarts and work across
// multiple API instances. Keep an hour of issuance history for abuse controls.
setInterval(async () => {
  try {
    await db.execute(sql`DELETE FROM otp_sessions WHERE created_at < now() - interval '1 hour'`);
  } catch { /* non-fatal */ }
}, 5 * 60_000);

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

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) throw new Error("SESSION_SECRET environment variable is required but not set.");
const OTP_HMAC_KEY = createHmac("sha256", JWT_SECRET)
  .update("registration-otp")
  .digest();

function canonicalPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

function typedEmail(email: string): string {
  return `email:${email.trim().toLowerCase()}`;
}

function typedPhone(phone: string): string | null {
  const canonical = canonicalPhone(phone);
  return canonical ? `phone:${canonical}` : null;
}

function registrationOtpDigest(pinId: string, contact: string, otp: string): string {
  return `v1:${createHmac("sha256", OTP_HMAC_KEY)
    .update(`${pinId}\0${contact}\0${otp}`)
    .digest("hex")}`;
}

const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", message: "Please wait before requesting another code." },
});

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
  // Preserve the public-role policy boundary before detailed body validation.
  const earlyPolicy = getPublicRegistrationPolicy(req.body?.role as UserRole);
  if (!earlyPolicy.allowed) {
    res.status(403).json({
      error: "Forbidden",
      message: "Super administrator accounts cannot be created through public registration.",
    });
    return;
  }
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad request", message: parsed.error.message });
    return;
  }
  const { email, password, firstName, lastName, phone, role, otpPinId } = parsed.data;
  const registrationPolicy = getPublicRegistrationPolicy(role);
  const primaryClassId = (req.body as any).primaryClassId ? Number((req.body as any).primaryClassId) : null;
  const passwordHash = await bcrypt.hash(password, 12);
  const emailContact = typedEmail(email);
  const phoneContact = phone ? typedPhone(phone) : null;

  class RegistrationFailure extends Error {
    constructor(public status: number, message: string) { super(message); }
  }

  try {
    const outcome = await db.transaction(async tx => {
      const consumed = await tx.execute(sql`
        DELETE FROM otp_sessions
        WHERE pin_id = ${otpPinId}
          AND verified_at IS NOT NULL
          AND expires_at > now()
          AND (contact = ${emailContact}
            OR (${phoneContact}::text IS NOT NULL AND contact = ${phoneContact}))
        RETURNING pin_id
      `);
      if (consumed.rowCount !== 1) {
        throw new RegistrationFailure(400, "Registration verification is invalid or expired.");
      }

      const [existing] = await tx.select().from(usersTable).where(eq(usersTable.email, email));
      if (existing) {
        if (existing.role === role) throw new RegistrationFailure(409, "You already have this role");
        const currentSecondary = parseSecondaryRoles(existing.secondaryRoles);
        if (currentSecondary.includes(role)) throw new RegistrationFailure(409, "You already have this role");
        const currentPending: string[] = (() => {
          try { return existing.pendingRoles ? JSON.parse(existing.pendingRoles) : []; } catch { return []; }
        })();
        if (currentPending.includes(role)) {
          throw new RegistrationFailure(409, "A request for this role is already pending approval");
        }
        if (!(await bcrypt.compare(password, existing.passwordHash))) {
          throw new RegistrationFailure(401, "Incorrect password for this email address");
        }

        if (registrationPolicy.requiresApproval) {
          await tx.update(usersTable).set({
            pendingRoles: JSON.stringify([...currentPending, role]),
            ...(role === "teacher" && primaryClassId ? { primaryClassId } : {}),
          }).where(eq(usersTable.id, existing.id));
          return { kind: "pendingRole" as const, user: existing };
        }
        await tx.update(usersTable)
          .set({ secondaryRoles: JSON.stringify([...currentSecondary, role]) })
          .where(eq(usersTable.id, existing.id));
        return { kind: "secondaryRole" as const, user: existing };
      }

      const requiresApproval = registrationPolicy.requiresApproval;
      const [user] = await tx.insert(usersTable).values({
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        role: role as UserRole,
        status: requiresApproval ? "pending_approval" : "active",
        isActive: !requiresApproval,
        ...(role === "teacher" && primaryClassId ? { primaryClassId } : {}),
      }).returning();
      return { kind: requiresApproval ? "pendingUser" as const : "activeUser" as const, user };
    });

    // Notifications occur only after the registration transaction commits.
    if (outcome.kind === "pendingRole" || outcome.kind === "pendingUser") {
      smsPendingApproval(outcome.user.phone, outcome.user.firstName, req.log).catch(() => {});
      emailPendingApproval(outcome.user.email, outcome.user.firstName, req.log).catch(() => {});
    } else {
      smsWelcome(outcome.user.phone, outcome.user.firstName, req.log).catch(() => {});
      emailWelcome(outcome.user.email, outcome.user.firstName, req.log).catch(() => {});
    }

    if (outcome.kind === "pendingRole") {
      res.status(201).json({
        pending: true,
        message: `Your request to join as ${role} has been submitted. An admin will review and approve it. You will be notified once approved.`,
      });
    } else if (outcome.kind === "secondaryRole") {
      const roleLabel = role === "support" ? "Support" : "Parent";
      res.status(201).json({
        roleAdded: true, role,
        message: `Your ${roleLabel} role has been added. Sign in and select the "${roleLabel}" tab to access your ${roleLabel} dashboard.`,
      });
    } else if (outcome.kind === "pendingUser") {
      res.status(201).json({
        pending: true,
        message: "Registration submitted. Your account is pending admin approval. You will be notified once approved.",
        user: {
          id: outcome.user.id, email: outcome.user.email, role: outcome.user.role,
          firstName: outcome.user.firstName, lastName: outcome.user.lastName, status: outcome.user.status,
        },
      });
    } else {
      const user = outcome.user;
      const token = generateToken({
        userId: user.id, email: user.email, role: user.role,
        firstName: user.firstName, lastName: user.lastName,
      });
      res.status(201).json({
        token,
        user: {
          id: user.id, email: user.email, phone: user.phone, role: user.role,
          firstName: user.firstName, lastName: user.lastName, isActive: user.isActive,
          status: user.status, photoUrl: user.photoUrl, createdAt: user.createdAt,
        },
      });
    }
  } catch (error) {
    if (error instanceof RegistrationFailure) {
      res.status(error.status).json({ error: error.status === 400 ? "Bad request" : "Registration failed", message: error.message });
      return;
    }
    throw error;
  }
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
  const code = crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000;
  const expiry = new Date(Date.now() + 15 * 60 * 1000);
  // Store plaintext — verified by direct string comparison (same pattern as delegate OTP)
  await db.update(usersTable)
    .set({ resetToken: String(code), resetTokenExpiry: expiry })
    .where(eq(usersTable.id, user.id));

  smsPasswordResetCode(user.phone, String(code), req.log).catch(() => {});
  emailPasswordResetCode(user.email, user.firstName, String(code), req.log).catch(() => {});

  // Do NOT return the code in the response — the user must check their SMS / email
  res.json({ success: true, expiresInMinutes: 15, message: "Reset code sent to your phone and email." });
});

router.post("/auth/reset-password", resetPasswordLimiter, async (req, res): Promise<void> => {
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

router.post("/auth/send-otp", otpSendLimiter, async (req, res): Promise<void> => {
  const { phone, email, channel } = req.body as { phone?: string; email?: string; channel?: "sms" | "whatsapp" | "email" };
  const isEmail = channel === "email";
  const destination = isEmail
    ? (typeof email === "string" ? email.trim().toLowerCase() : "")
    : (typeof phone === "string" ? phone.trim() : "");
  const contact = isEmail
    ? (destination.includes("@") ? typedEmail(destination) : null)
    : typedPhone(destination);
  if (!contact) {
    res.status(400).json({ error: "Bad request", message: isEmail ? "A valid email is required" : "A valid phone is required" });
    return;
  }

  const otp = randomInt(100000, 1000000).toString();
  const pinId = randomUUID();
  const digest = registrationOtpDigest(pinId, contact, otp);

  try {
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${contact}))`);
      const history = await tx.execute(sql`
        SELECT
          count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS hour_count,
          coalesce(bool_or(created_at > now() - interval '60 seconds'), false) AS cooling_down
        FROM otp_sessions
        WHERE contact = ${contact}
      `);
      const row = history.rows[0] as { hour_count: number; cooling_down: boolean };
      if (Number(row.hour_count) >= 5) throw new Error("CONTACT_LIMIT");
      if (row.cooling_down) throw new Error("CONTACT_COOLDOWN");

      await tx.execute(sql`
        UPDATE otp_sessions SET expires_at = now()
        WHERE contact = ${contact} AND expires_at > now()
      `);
      await tx.execute(sql`
        INSERT INTO otp_sessions (pin_id, otp, contact, expires_at, created_at, attempt_count)
        VALUES (${pinId}, ${digest}, ${contact}, now() + interval '10 minutes', now(), 0)
      `);
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "CONTACT_LIMIT" || error.message === "CONTACT_COOLDOWN")) {
      res.status(429).json({ error: "Too many requests", message: "Please wait before requesting another code." });
      return;
    }
    throw error;
  }

  const accepted = isEmail
    ? await emailRegistrationOtp(destination, otp, req.log)
    : await smsRegistrationOtp(destination, otp, req.log);
  if (!accepted) {
    await db.execute(sql`UPDATE otp_sessions SET expires_at = now() WHERE pin_id = ${pinId}`);
    res.status(503).json({ error: "Service unavailable", message: "Verification service is temporarily unavailable. Please try again later." });
    return;
  }
  res.json({ pinId, message: "Verification code accepted for sending." });
});

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const { pinId, otp } = req.body as { pinId?: string; otp?: string };
  if (!pinId || !otp) {
    res.status(400).json({ error: "Bad request", message: "pinId and otp are required" });
    return;
  }
  const candidate = otp.trim();
  const session = await db.execute(sql`
    SELECT contact FROM otp_sessions WHERE pin_id = ${pinId}
  `);
  const contact = (session.rows[0] as { contact?: string } | undefined)?.contact;
  if (!contact) {
    res.status(400).json({ error: "Bad request", message: "Incorrect or expired code. Please try again." });
    return;
  }
  const digest = registrationOtpDigest(pinId, contact, candidate);
  const verified = await db.execute(sql`
    UPDATE otp_sessions
    SET verified_at = now()
    WHERE pin_id = ${pinId}
      AND otp = ${digest}
      AND otp LIKE 'v1:%'
      AND expires_at > now()
      AND attempt_count < 5
      AND verified_at IS NULL
    RETURNING pin_id
  `);
  if (verified.rowCount === 1) {
    res.json({ verified: true });
    return;
  }
  await db.execute(sql`
    UPDATE otp_sessions
    SET attempt_count = attempt_count + 1,
        expires_at = CASE WHEN attempt_count + 1 >= 5 THEN now() ELSE expires_at END
    WHERE pin_id = ${pinId}
      AND otp <> ${digest}
      AND expires_at > now()
      AND attempt_count < 5
      AND verified_at IS NULL
  `);
  res.status(400).json({ error: "Bad request", message: "Incorrect or expired code. Please try again." });
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
    if (payload.mfaOnly !== true) { res.status(400).json({ error: "Bad request", message: "Invalid token type" }); return; }
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
