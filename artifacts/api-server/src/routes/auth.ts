import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as OTPAuth from "otpauth";
import { createHmac, randomInt, randomUUID } from "node:crypto";
import rateLimit from "express-rate-limit";
import { and, eq, sql } from "drizzle-orm";
import { db, usersTable, otpSessionsTable } from "@workspace/db";
import { LoginBody, RegisterBody } from "@workspace/api-zod";
import { generateToken, authMiddleware } from "../middlewares/auth";
import { smsPasswordResetCode, smsRegistrationOtp, whatsappRegistrationOtp, emailRegistrationOtp, emailPasswordResetCode } from "../services/sms";
import { withDbRetry } from "../lib/db-retry";
import { getPublicRegistrationPolicy } from "../lib/registrationPolicy";
import { createNotificationDelivery } from "../services/notificationOutbox";
import {
  canonicalPendingRoles,
  canonicalSecondaryRoles,
  lockUserById,
  type UserRole,
} from "../lib/roleMutations";
import { closeUserConnections } from "../lib/sse";
import { securityAudit } from "../lib/securityAudit";
import { lockSessionRevocation, notifySessionRevocation } from "../lib/sessionRevocation";

// Tight limiter for password-reset verification — prevents brute-forcing the
// 6-digit code (1,000,000 combinations) by capping to 5 attempts / 15 min / IP.
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts", message: "Too many password reset attempts. Please wait 15 minutes before trying again." },
});
const mfaAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts", message: "Please wait before trying again." },
});

// ── DB-backed OTP sessions (phone/email verification during registration) ──────
// Stored in the otp_sessions table so they survive restarts and work across
// multiple API instances. Keep an hour of issuance history for abuse controls.
setInterval(async () => {
  try {
    await db.execute(sql`DELETE FROM otp_sessions WHERE created_at < now() - interval '1 hour'`);
  } catch { /* non-fatal */ }
}, 5 * 60_000);

function buildUserPayload(user: typeof usersTable.$inferSelect, activeRole?: UserRole) {
  const secondary = canonicalSecondaryRoles(user.secondaryRoles, user.role);
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
const RESET_HMAC_KEY = createHmac("sha256", JWT_SECRET).update("password-reset").digest();

function canonicalPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const national = digits.startsWith("0") ? digits.slice(1) : digits.startsWith("234") ? digits.slice(3) : "";
  return /^(?:7|8|9)\d{9}$/.test(national) ? `234${national}` : null;
}

function typedEmail(email: string): string {
  return `email:${email.trim().toLowerCase()}`;
}

function typedPhone(phone: string): string | null {
  const canonical = canonicalPhone(phone);
  return canonical ? `phone:${canonical}` : null;
}

function registrationOtpDigest(pinId: string, purpose: string, channel: string, contact: string, otp: string): string {
  return `v1:${createHmac("sha256", OTP_HMAC_KEY)
    .update(`${pinId}\0${purpose}\0${channel}\0${contact}\0${otp}`)
    .digest("hex")}`;
}

function legacyRegistrationOtpDigest(pinId: string, contact: string, otp: string): string {
  return `v1:${createHmac("sha256", OTP_HMAC_KEY).update(`${pinId}\0${contact}\0${otp}`).digest("hex")}`;
}

function resetCodeDigest(userId: number, code: string): string {
  return `v1:${createHmac("sha256", RESET_HMAC_KEY).update(`${userId}\0password-reset\0${code}`).digest("hex")}`;
}

const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", message: "Please wait before requesting another code." },
});

const router = Router();

async function createRegistrationDelivery(
  tx: any,
  user: typeof usersTable.$inferSelect,
  role: UserRole,
  kind: "pendingUser" | "pendingRole" | "activeUser" | "secondaryRole",
) {
  const pending = kind === "pendingUser" || kind === "pendingRole";
  const decision = pending ? "requested" : "registered";
  const type = pending ? "registration_pending_approval" : "registration_completed";
  const title = pending ? "Registration Pending Approval" : "Welcome to Shepherd Connect";
  const message = pending
    ? `Your ${role} registration request is pending administrator approval.`
    : kind === "secondaryRole"
      ? `Your ${role} role has been added to your account.`
      : "Your account has been created successfully.";
  const identity = `registration:${user.id}:${role}:${decision}`;
  await createNotificationDelivery(tx, {
    logicalIdentity: identity,
    domainType: "user_registration",
    domainIdentifier: `${user.id}:${role}`,
    projection: { userId: user.id, type, title, message, metadata: { role } },
    channels: ["sms", "email"],
    templateKey: type,
  });

  // Approval requests are also actionable in-app for the administrators who
  // can decide them. Resolve that recipient set through this same transaction.
  if (pending) {
    const admins = await tx.select({ id: usersTable.id }).from(usersTable)
      .where(sql`${usersTable.isActive} = true AND ${usersTable.role} IN ('admin', 'super_admin')`);
    for (const admin of admins) {
      await createNotificationDelivery(tx, {
        logicalIdentity: `registration-review:${user.id}:${role}:requested:${admin.id}`,
        domainType: "user_registration",
        domainIdentifier: `${user.id}:${role}`,
        projection: {
          userId: admin.id,
          type: "registration_review_required",
          title: "Registration Review Required",
          message: `${user.firstName} ${user.lastName} requested the ${role} role.`,
          metadata: { userId: user.id, role },
        },
        channels: ["sms", "email"],
        templateKey: "registration_review_required",
      });
    }
  }
}

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
    await securityAudit(req, "login_failed", undefined, { reason: "invalid_credentials" });
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
    await securityAudit(req, "login_failed", user.id, { reason: "invalid_credentials" });
    res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return;
  }

  if (user.mfaEnabled && user.mfaSecret) {
    const mfaToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, sessionVersion: user.sessionVersion, mfaOnly: true },
      JWT_SECRET,
      { expiresIn: "5m" }
    );
    res.json({ requiresMfa: true, mfaToken });
    return;
  }

  const { requestedRole } = req.body as { requestedRole?: string };
  const secondary = canonicalSecondaryRoles(user.secondaryRoles, user.role);
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
    sessionVersion: user.sessionVersion,
  });
  await securityAudit(req, "login_succeeded", user.id, { role: activeRole });
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
          AND purpose = 'registration'
          AND (contact = ${emailContact}
            OR (${phoneContact}::text IS NOT NULL AND contact = ${phoneContact}))
        RETURNING pin_id, contact, channel
      `);
      if (consumed.rowCount !== 1) {
        throw new RegistrationFailure(400, "Registration verification is invalid or expired.");
      }

      const candidate = await tx.query.usersTable.findFirst({ where: eq(usersTable.email, email) });
      if (candidate) await lockSessionRevocation(tx, candidate.id);
      const existing = candidate ? await lockUserById(tx, candidate.id) : undefined;
      if (existing) {
        if (existing.role === role) throw new RegistrationFailure(409, "You already have this role");
        const currentSecondary = canonicalSecondaryRoles(existing.secondaryRoles, existing.role);
        if (currentSecondary.includes(role)) throw new RegistrationFailure(409, "You already have this role");
        const currentPending = canonicalPendingRoles(existing.pendingRoles);
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
          await createRegistrationDelivery(tx, existing, role as UserRole, "pendingRole");
          return { kind: "pendingRole" as const, user: existing };
        }
        await tx.update(usersTable)
          .set({ secondaryRoles: JSON.stringify([...currentSecondary, role]) })
          .where(eq(usersTable.id, existing.id));
        await notifySessionRevocation(tx, existing.id);
        await createRegistrationDelivery(tx, existing, role as UserRole, "secondaryRole");
        return { kind: "secondaryRole" as const, user: existing };
      }

      const requiresApproval = registrationPolicy.requiresApproval;
      const [user] = await tx.insert(usersTable).values({
        email,
        passwordHash,
        firstName,
        lastName,
        phone: phone ? `+${canonicalPhone(phone)!}` : null,
        // A WhatsApp identity is only trusted when the registration OTP was
        // delivered to this exact normalized telephone contact.
        whatsappVerified: consumed.rows[0]?.channel === "whatsapp" && consumed.rows[0]?.contact === phoneContact,
        whatsappVerifiedAt: consumed.rows[0]?.channel === "whatsapp" && consumed.rows[0]?.contact === phoneContact ? new Date() : null,
        role: role as UserRole,
        status: requiresApproval ? "pending_approval" : "active",
        isActive: !requiresApproval,
        ...(role === "teacher" && primaryClassId ? { primaryClassId } : {}),
      }).returning();
      const kind = requiresApproval ? "pendingUser" as const : "activeUser" as const;
      await createRegistrationDelivery(tx, user, role as UserRole, kind);
      return { kind, user };
    });

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
        sessionVersion: user.sessionVersion,
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
  res.json(buildUserPayload(user, req.user!.role as UserRole));
});

router.post("/auth/logout", authMiddleware, async (req, res): Promise<void> => {
  const revoked = await db.transaction(async tx => {
    await lockSessionRevocation(tx, req.user!.userId);
    const rows = await tx.update(usersTable)
      .set({ sessionVersion: sql`${usersTable.sessionVersion} + 1` })
      .where(and(eq(usersTable.id, req.user!.userId), eq(usersTable.sessionVersion, (req.user!.sessionVersion ?? 1))))
      .returning({ id: usersTable.id });
    if (rows.length === 1) await notifySessionRevocation(tx, req.user!.userId);
    return rows;
  });
  if (revoked.length !== 1) { res.status(401).json({ error: "Unauthorized", message: "Session has been revoked" }); return; }
  closeUserConnections(req.user!.userId);
  await securityAudit(req, "logout");
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
  const [updated] = await db.transaction(async tx => {
    await lockSessionRevocation(tx, user.id);
    const rows = await tx.update(usersTable).set({
      passwordHash, sessionVersion: sql`${usersTable.sessionVersion} + 1`,
    }).where(and(eq(usersTable.id, user.id), eq(usersTable.sessionVersion, (req.user!.sessionVersion ?? 1)))).returning();
    if (rows.length === 1) await notifySessionRevocation(tx, user.id);
    return rows;
  });
  if (!updated) { res.status(401).json({ error: "Unauthorized", message: "Session has been revoked" }); return; }
  closeUserConnections(user.id);
  const token = generateToken({
    userId: updated.id, email: updated.email, role: req.user!.role,
    firstName: updated.firstName, lastName: updated.lastName,
    sessionVersion: updated.sessionVersion,
  });
  await securityAudit(req, "password_changed", user.id);
  req.log.info({ userId: user.id }, "User changed their password");
  res.json({ success: true, message: "Password changed successfully", token });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Bad request", message: "Email is required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.trim().toLowerCase()));
  const response = { success: true, expiresInMinutes: 15, message: "If this email is registered, a reset code has been generated." };
  if (!user) {
    res.json(response);
    return;
  }
  // App generates the code — Termii is only the delivery channel
  const code = randomInt(100000, 1000000).toString();
  const expiry = new Date(Date.now() + 15 * 60 * 1000);
  await db.update(usersTable)
    .set({ resetToken: resetCodeDigest(user.id, code), resetTokenExpiry: expiry, resetTokenAttempts: 0 })
    .where(eq(usersTable.id, user.id));

  smsPasswordResetCode(user.phone, code, req.log).catch(() => {});
  emailPasswordResetCode(user.email, user.firstName, code, req.log).catch(() => {});
  await securityAudit(req, "password_reset_requested", user.id);

  // Do NOT return the code in the response — the user must check their SMS / email
  res.json(response);
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
  const digest = resetCodeDigest(user.id, code.trim());
  if (digest !== user.resetToken || user.resetTokenAttempts >= 5) {
    await db.update(usersTable).set({
      resetTokenAttempts: sql`${usersTable.resetTokenAttempts} + 1`,
      resetTokenExpiry: sql`CASE WHEN ${usersTable.resetTokenAttempts} + 1 >= 5 THEN now() ELSE ${usersTable.resetTokenExpiry} END`,
    }).where(eq(usersTable.id, user.id));
    res.status(400).json({ error: "Bad request", message: "Incorrect reset code. Please check and try again." });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const consumed = await db.transaction(async tx => {
    await lockSessionRevocation(tx, user.id);
    const rows = await tx.update(usersTable).set({
      passwordHash, resetToken: null, resetTokenExpiry: null, resetTokenAttempts: 0,
      sessionVersion: sql`${usersTable.sessionVersion} + 1`,
    }).where(sql`${usersTable.id} = ${user.id} AND ${usersTable.resetToken} = ${digest} AND ${usersTable.resetTokenExpiry} > now()`)
      .returning({ id: usersTable.id });
    if (rows.length === 1) await notifySessionRevocation(tx, user.id);
    return rows;
  });
  if (consumed.length !== 1) {
    res.status(400).json({ error: "Bad request", message: "Invalid or expired reset code. Please request a new one." });
    return;
  }
  closeUserConnections(user.id);
  await securityAudit(req, "password_reset_completed", user.id);
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
    await securityAudit(req, "otp_send_failed", undefined, { channel: channel ?? "sms", reason: "invalid_contact" });
    res.status(400).json({ error: "Bad request", message: isEmail ? "A valid email is required" : "A valid phone is required" });
    return;
  }

  const otp = randomInt(100000, 1000000).toString();
  const pinId = randomUUID();
  const otpChannel = isEmail ? "email" : channel === "whatsapp" ? "whatsapp" : "sms";
  const digest = registrationOtpDigest(pinId, "registration", otpChannel, contact, otp);

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
        INSERT INTO otp_sessions (pin_id, otp, contact, purpose, channel, expires_at, created_at, attempt_count)
        VALUES (${pinId}, ${digest}, ${contact}, 'registration', ${otpChannel}, now() + interval '10 minutes', now(), 0)
      `);
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "CONTACT_LIMIT" || error.message === "CONTACT_COOLDOWN")) {
      await securityAudit(req, "otp_send_limited", undefined, { channel: otpChannel });
      res.status(429).json({ error: "Too many requests", message: "Please wait before requesting another code." });
      return;
    }
    throw error;
  }

  const accepted = isEmail
    ? await emailRegistrationOtp(destination, otp, req.log)
    : otpChannel === "whatsapp"
      ? await whatsappRegistrationOtp(destination, otp, req.log)
      : await smsRegistrationOtp(destination, otp, req.log);
  if (!accepted) {
    await securityAudit(req, "otp_send_failed", undefined, { channel: otpChannel, reason: "provider_unavailable" });
    await db.execute(sql`UPDATE otp_sessions SET expires_at = now() WHERE pin_id = ${pinId}`);
    res.status(503).json({ error: "Service unavailable", message: "Verification service is temporarily unavailable. Please try again later." });
    return;
  }
  await securityAudit(req, "otp_send_succeeded", undefined, { channel: otpChannel });
  res.json({ pinId, message: "Verification code accepted for sending." });
});

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const { pinId, otp } = req.body as { pinId?: string; otp?: string };
  if (!pinId || !otp) {
    await securityAudit(req, "otp_verify_failed", undefined, { reason: "malformed" });
    res.status(400).json({ error: "Bad request", message: "pinId and otp are required" });
    return;
  }
  const candidate = otp.trim();
  const session = await db.execute(sql`
    SELECT contact, purpose, channel FROM otp_sessions WHERE pin_id = ${pinId}
  `);
  const challenge = session.rows[0] as { contact?: string; purpose?: string; channel?: string } | undefined;
  const contact = challenge?.contact;
  if (!contact || challenge?.purpose !== "registration") {
    await securityAudit(req, "otp_verify_failed", undefined, { reason: "invalid_challenge" });
    res.status(400).json({ error: "Bad request", message: "Incorrect or expired code. Please try again." });
    return;
  }
  // A challenge already in flight when the migration lands has no channel.
  // Honor it with the old digest once; all newly issued challenges are bound.
  const digest = challenge.channel
    ? registrationOtpDigest(pinId, challenge.purpose, challenge.channel, contact, candidate)
    : legacyRegistrationOtpDigest(pinId, contact, candidate);
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
    await securityAudit(req, "otp_verify_succeeded", undefined, { channel: challenge.channel ?? "legacy" });
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
  await securityAudit(req, "otp_verify_failed", undefined, { reason: "mismatch" });
  res.status(400).json({ error: "Bad request", message: "Incorrect or expired code. Please try again." });
});

// ── MFA endpoints ─────────────────────────────────────────────────────────────

router.post("/auth/mfa/setup", authMiddleware, mfaAttemptLimiter, async (req, res): Promise<void> => {
  const { currentPassword } = req.body as { currentPassword?: string };
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    res.status(401).json({ error: "Unauthorized", message: "Current password is required" }); return;
  }
  if (user.mfaEnabled) {
    res.status(409).json({ error: "Conflict", message: "Disable existing MFA before configuring a replacement" }); return;
  }

  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: "Shepherd Connect",
    label: user.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });

  const setup = await db.transaction(async tx => {
    await lockSessionRevocation(tx, user.id);
    return tx.update(usersTable).set({ mfaSecret: secret.base32 })
      .where(and(eq(usersTable.id, user.id), eq(usersTable.sessionVersion, (req.user!.sessionVersion ?? 1)))).returning({ id: usersTable.id });
  });
  if (setup.length !== 1) { res.status(401).json({ error: "Unauthorized", message: "Session has been revoked" }); return; }
  await securityAudit(req, "mfa_setup_started", user.id);
  res.json({ qrCodeUri: totp.toString(), secret: secret.base32 });
});

router.post("/auth/mfa/confirm", authMiddleware, mfaAttemptLimiter, async (req, res): Promise<void> => {
  const { totpCode } = req.body as { totpCode: string };
  const [user] = await db.transaction(async tx => {
    await lockSessionRevocation(tx, req.user!.userId, true);
    return tx.select().from(usersTable).where(and(
      eq(usersTable.id, req.user!.userId),
      eq(usersTable.sessionVersion, req.user!.sessionVersion ?? 1),
    ));
  });
  if (!user?.mfaSecret) { res.status(400).json({ error: "Bad request", message: "Run /auth/mfa/setup first" }); return; }

  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.mfaSecret), algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: totpCode, window: 1 });
  if (delta === null) {
    await securityAudit(req, "mfa_confirm_failed", user.id, { reason: "invalid_code" });
    res.status(400).json({ error: "Bad request", message: "Invalid authenticator code" }); return;
  }

  const [updated] = await db.transaction(async tx => {
    await lockSessionRevocation(tx, user.id);
    const rows = await tx.update(usersTable).set({
      mfaEnabled: true, sessionVersion: sql`${usersTable.sessionVersion} + 1`,
    }).where(and(eq(usersTable.id, user.id), eq(usersTable.sessionVersion, (req.user!.sessionVersion ?? 1)), eq(usersTable.mfaEnabled, false))).returning();
    if (rows.length === 1) await notifySessionRevocation(tx, user.id);
    return rows;
  });
  if (!updated) { res.status(409).json({ error: "Conflict", message: "MFA state changed; please sign in again" }); return; }
  closeUserConnections(user.id);
  const token = generateToken({ userId: updated.id, email: updated.email, role: req.user!.role, firstName: updated.firstName, lastName: updated.lastName, sessionVersion: updated.sessionVersion });
  await securityAudit(req, "mfa_enabled", user.id);
  res.json({ success: true, message: "Two-factor authentication is now enabled.", token });
});

router.post("/auth/mfa/disable", authMiddleware, mfaAttemptLimiter, async (req, res): Promise<void> => {
  const { totpCode, currentPassword } = req.body as { totpCode: string; currentPassword?: string };
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user?.mfaEnabled || !user.mfaSecret) { res.status(400).json({ error: "Bad request", message: "MFA is not enabled" }); return; }
  if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    res.status(401).json({ error: "Unauthorized", message: "Current password is required" }); return;
  }

  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.mfaSecret), algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: totpCode, window: 1 });
  if (delta === null) {
    await securityAudit(req, "mfa_disable_failed", user.id, { reason: "invalid_code" });
    res.status(400).json({ error: "Bad request", message: "Invalid authenticator code" }); return;
  }

  const [updated] = await db.transaction(async tx => {
    await lockSessionRevocation(tx, user.id);
    const rows = await tx.update(usersTable).set({
      mfaEnabled: false, mfaSecret: null, sessionVersion: sql`${usersTable.sessionVersion} + 1`,
    }).where(and(eq(usersTable.id, user.id), eq(usersTable.sessionVersion, (req.user!.sessionVersion ?? 1)), eq(usersTable.mfaEnabled, true))).returning();
    if (rows.length === 1) await notifySessionRevocation(tx, user.id);
    return rows;
  });
  if (!updated) { res.status(409).json({ error: "Conflict", message: "MFA state changed; please sign in again" }); return; }
  closeUserConnections(user.id);
  const token = generateToken({ userId: updated.id, email: updated.email, role: req.user!.role, firstName: updated.firstName, lastName: updated.lastName, sessionVersion: updated.sessionVersion });
  await securityAudit(req, "mfa_disabled", user.id);
  res.json({ success: true, message: "Two-factor authentication disabled.", token });
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
  // MFA challenge tokens are intentionally not migration-compatible: they are
  // only valid for five minutes and must be tied to the live session version.
  if (!user?.mfaEnabled || !user.mfaSecret || !user.isActive || user.status !== "active" ||
    typeof payload.sessionVersion !== "number" || payload.sessionVersion !== user.sessionVersion) {
    res.status(401).json({ error: "Unauthorized", message: "MFA login is no longer valid" }); return;
  }

  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.mfaSecret), algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: totpCode, window: 1 });
  if (delta === null) { res.status(401).json({ error: "Unauthorized", message: "Invalid authenticator code" }); return; }

  const token = generateToken({ userId: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, sessionVersion: user.sessionVersion });
  await securityAudit(req, "login_succeeded", user.id, { role: user.role, mfa: true });
  res.json({ token, user: buildUserPayload(user) });
});

// POST /auth/switch-role — swap active role within the user's allRoles (no re-login needed)
router.post("/auth/switch-role", authMiddleware, async (req, res): Promise<void> => {
  const { role: requestedRole } = req.body as { role?: string };
  if (!requestedRole) { res.status(400).json({ error: "Bad request", message: "role is required" }); return; }

  const outcome = await db.transaction(async tx => {
    await lockSessionRevocation(tx, req.user!.userId, true);
    const [user] = await tx.select().from(usersTable).where(and(
      eq(usersTable.id, req.user!.userId),
      eq(usersTable.sessionVersion, req.user!.sessionVersion ?? 1),
    ));
    if (!user) return undefined;
    const allRoles: UserRole[] = [user.role, ...canonicalSecondaryRoles(user.secondaryRoles, user.role)];
    if (!allRoles.includes(requestedRole as UserRole)) return { user, forbidden: true as const };
    return {
      user,
      token: generateToken({ userId: user.id, email: user.email, role: requestedRole as UserRole, firstName: user.firstName, lastName: user.lastName, sessionVersion: user.sessionVersion }),
    };
  });
  if (!outcome) { res.status(401).json({ error: "Unauthorized", message: "Session has been revoked" }); return; }
  if ("forbidden" in outcome) {
    res.status(403).json({ error: "Forbidden", message: "You do not have access to that role" }); return;
  }
  await securityAudit(req, "role_switched", outcome.user.id, { role: requestedRole });
  res.json({ token: outcome.token, user: buildUserPayload(outcome.user, requestedRole as UserRole) });
});

export default router;
