import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import app from "../app";
import { generateToken } from "../middlewares/auth";
import { addConnection, connectionCount, pushEvent, removeConnection } from "../lib/sse";
import { SESSION_REVOCATION_LOCK_NAMESPACE } from "../lib/sessionRevocation";
import { createHmac } from "node:crypto";
import * as OTPAuth from "otpauth";

const enabled = process.env.RUN_DATABASE_ROLE_TESTS === "true";
const suite = enabled ? describe : describe.skip;
const prefix = `phase4-cas-${process.pid}-${Date.now()}`;

suite("session-version CAS routes", () => {
  let userId: number;
  let passwordHash: string;
  let adminId: number;
  let baselineAuditId = 0;
  const password = "Initial-password-1";
  const email = `${prefix}@example.test`;

  beforeAll(async () => {
    const baseline = await db.execute(sql`SELECT coalesce(max(id), 0)::int AS id FROM audit_logs`);
    baselineAuditId = Number(baseline.rows[0]?.id);
    passwordHash = await bcrypt.hash(password, 4);
    const inserted = await db.execute(sql`
      INSERT INTO users (email, password_hash, first_name, last_name, role, status, is_active, secondary_roles, pending_roles)
      VALUES (${email}, ${passwordHash}, 'CAS', 'User', 'parent', 'active', true, '["support"]', '[]')
      RETURNING id
    `);
    userId = Number(inserted.rows[0]!.id);
    const admin = await db.execute(sql`
      INSERT INTO users (email, password_hash, first_name, last_name, role, status, is_active)
      VALUES (${`${prefix}-admin@example.test`}, ${passwordHash}, 'CAS', 'Admin', 'super_admin', 'active', true)
      RETURNING id
    `);
    adminId = Number(admin.rows[0]!.id);
  });
  beforeEach(async () => {
    await db.execute(sql`UPDATE users SET password_hash = ${passwordHash}, session_version = 1,
      mfa_enabled = false, mfa_secret = NULL WHERE id = ${userId}`);
  });
  afterAll(async () => {
    await db.execute(sql`DELETE FROM otp_sessions WHERE pin_id LIKE ${`${prefix}%`}`);
    await db.execute(sql`DELETE FROM audit_logs WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM audit_logs WHERE user_id = ${adminId}`);
    await db.execute(sql`DELETE FROM audit_logs WHERE id > ${baselineAuditId} AND entity_type = 'authentication'`);
    await db.execute(sql`DELETE FROM users WHERE id IN (${userId}, ${adminId})`);
  });

  const token = () => generateToken({
    userId, email, role: "parent", firstName: "CAS", lastName: "User", sessionVersion: 1,
  });

  it("allows only one of two concurrent password changes and rejects the old token", async () => {
    const authorization = `Bearer ${token()}`;
    const replies = await Promise.all([
      request(app).post("/api/auth/change-password").set("Authorization", authorization)
        .send({ currentPassword: password, newPassword: "Winner-password-A" }),
      request(app).post("/api/auth/change-password").set("Authorization", authorization)
        .send({ currentPassword: password, newPassword: "Winner-password-B" }),
    ]);
    expect(replies.filter(reply => reply.status === 200)).toHaveLength(1);
    expect(replies.filter(reply => reply.status === 401)).toHaveLength(1);
    const winner = replies.find(reply => reply.status === 200)!;
    expect((await request(app).get("/api/auth/me").set("Authorization", authorization)).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${winner.body.token}`)).status).toBe(200);
  });

  it("does not let concurrent logout and role switch resurrect a revoked session", async () => {
    const authorization = `Bearer ${token()}`;
    const [logout, switched] = await Promise.all([
      request(app).post("/api/auth/logout").set("Authorization", authorization),
      request(app).post("/api/auth/switch-role").set("Authorization", authorization).send({ role: "support" }),
    ]);
    expect(logout.status).toBe(200);
    expect([200, 401]).toContain(switched.status);
    if (switched.status === 200) {
      expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${switched.body.token}`)).status).toBe(401);
    }
  });

  it("orders protected SSE writes before or after revocation without post-revoke delivery", async () => {
    const active = { write: vi.fn(), end: vi.fn() } as any;
    addConnection(userId, active, 1, "parent");
    await pushEvent(userId, "test", { ok: true });
    expect(active.write).toHaveBeenCalledOnce();
    removeConnection(userId, active);

    const stale = { write: vi.fn(), end: vi.fn() } as any;
    addConnection(userId, stale, 1, "parent");
    const client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [SESSION_REVOCATION_LOCK_NAMESPACE, userId]);
    const pendingPush = pushEvent(userId, "forbidden", { secret: false });
    await client.query("UPDATE users SET session_version = session_version + 1 WHERE id = $1", [userId]);
    await client.query("COMMIT");
    client.release();
    await pendingPush;
    expect(stale.write).not.toHaveBeenCalled();
    expect(stale.end).toHaveBeenCalledOnce();
    expect(connectionCount()).toBe(0);
  });

  it("enforces reset-code expiry, attempt limit, one-time use, and token revocation", async () => {
    const unknown = await request(app).post("/api/auth/forgot-password").send({ email: `${prefix}-missing@example.test` });
    const known = await request(app).post("/api/auth/forgot-password").send({ email });
    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);

    const code = "246810";
    const key = createHmac("sha256", process.env.SESSION_SECRET!).update("password-reset").digest();
    const digest = `v1:${createHmac("sha256", key).update(`${userId}\0password-reset\0${code}`).digest("hex")}`;
    const seed = async (expiry: string, attempts = 0) => db.execute(sql`
      UPDATE users SET reset_token = ${digest}, reset_token_expiry = now() + ${expiry}::interval,
        reset_token_attempts = ${attempts}, session_version = 1, password_hash = ${passwordHash}
      WHERE id = ${userId}
    `);
    await seed("-1 minute");
    expect((await request(app).post("/api/auth/reset-password").send({ email, code, newPassword: "Reset-password-1" })).status).toBe(400);
    await seed("10 minutes", 5);
    expect((await request(app).post("/api/auth/reset-password").send({ email, code, newPassword: "Reset-password-1" })).status).toBe(400);
    await seed("10 minutes");
    const old = token();
    expect((await request(app).post("/api/auth/reset-password").send({ email, code, newPassword: "Reset-password-1" })).status).toBe(200);
    expect((await request(app).post("/api/auth/reset-password").send({ email, code, newPassword: "Reset-password-2" })).status).toBe(400);
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${old}`)).status).toBe(401);
  });

  it("administrator reset revokes only the target session", async () => {
    const targetToken = token();
    const adminToken = generateToken({
      userId: adminId, email: `${prefix}-admin@example.test`, role: "super_admin",
      firstName: "CAS", lastName: "Admin", sessionVersion: 1,
    });
    expect((await request(app).put(`/api/users/${userId}/reset-password`)
      .set("Authorization", `Bearer ${adminToken}`).send({ password: "Admin-reset-1" })).status).toBe(200);
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${targetToken}`)).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${adminToken}`)).status).toBe(200);
  });

  it("serializes reset against an admitted password change without resurrection", async () => {
    const code = "135790";
    const key = createHmac("sha256", process.env.SESSION_SECRET!).update("password-reset").digest();
    const digest = `v1:${createHmac("sha256", key).update(`${userId}\0password-reset\0${code}`).digest("hex")}`;
    await db.execute(sql`UPDATE users SET reset_token = ${digest}, reset_token_expiry = now() + interval '10 minutes',
      reset_token_attempts = 0, session_version = 1, password_hash = ${passwordHash} WHERE id = ${userId}`);
    const blocker = await pool.connect();
    await blocker.query("BEGIN");
    await blocker.query("SELECT pg_advisory_xact_lock($1, $2)", [SESSION_REVOCATION_LOCK_NAMESPACE, userId]);
    const resetPromise = request(app).post("/api/auth/reset-password")
      .send({ email, code, newPassword: "Reset-race-winner" }).then(reply => reply);
    await new Promise(resolve => setTimeout(resolve, 50));
    const changePromise = request(app).post("/api/auth/change-password").set("Authorization", `Bearer ${token()}`)
      .send({ currentPassword: password, newPassword: "Change-race-loser" }).then(reply => reply);
    await blocker.query("COMMIT");
    blocker.release();
    const [reset, change] = await Promise.all([resetPromise, changePromise]);
    expect(reset.status).toBe(200);
    expect(change.status).toBe(401);
    expect(change.body.token).toBeUndefined();
  });

  it("cannot mint a usable MFA-confirm replacement concurrently with logout", async () => {
    const secret = new OTPAuth.Secret({ size: 20 });
    await db.execute(sql`UPDATE users SET mfa_enabled = false, mfa_secret = ${secret.base32}, session_version = 1 WHERE id = ${userId}`);
    const totp = new OTPAuth.TOTP({ secret, algorithm: "SHA1", digits: 6, period: 30 }).generate();
    const authorization = `Bearer ${token()}`;
    const blocker = await pool.connect();
    await blocker.query("BEGIN");
    await blocker.query("SELECT pg_advisory_xact_lock($1, $2)", [SESSION_REVOCATION_LOCK_NAMESPACE, userId]);
    const logoutPromise = request(app).post("/api/auth/logout").set("Authorization", authorization).then(reply => reply);
    await new Promise(resolve => setTimeout(resolve, 100));
    const confirmPromise = request(app).post("/api/auth/mfa/confirm").set("Authorization", authorization)
      .send({ totpCode: totp }).then(reply => reply);
    await blocker.query("COMMIT");
    blocker.release();
    const [logout, confirm] = await Promise.all([logoutPromise, confirmPromise]);
    expect(logout.status).toBe(200);
    expect([400, 401, 409]).toContain(confirm.status);
    expect(confirm.body.token).toBeUndefined();
  });

  it("persists secret-free auth and OTP audit metadata", async () => {
    const sensitive = "Never-store-this-password-or-code-97531";
    await request(app).post("/api/auth/login").send({ email, password: sensitive });
    await request(app).post("/api/auth/send-otp").send({ channel: "sms", phone: sensitive });
    const login = await request(app).post("/api/auth/login").send({ email, password, requestedRole: "parent" });
    expect(login.status).toBe(200);
    await request(app).post("/api/auth/switch-role").set("Authorization", `Bearer ${login.body.token}`).send({ role: "support" });
    await request(app).post("/api/auth/mfa/setup").set("Authorization", `Bearer ${login.body.token}`).send({ currentPassword: password });
    await request(app).post("/api/auth/mfa/confirm").set("Authorization", `Bearer ${login.body.token}`).send({ totpCode: "000000" });
    const pinId = `${prefix}-audit-pin`;
    const otp = "975310";
    const contact = `email:${email}`;
    const otpKey = createHmac("sha256", process.env.SESSION_SECRET!).update("registration-otp").digest();
    const otpDigest = `v1:${createHmac("sha256", otpKey).update(`${pinId}\0registration\0email\0${contact}\0${otp}`).digest("hex")}`;
    await db.execute(sql`INSERT INTO otp_sessions (pin_id, otp, contact, purpose, channel, expires_at)
      VALUES (${pinId}, ${otpDigest}, ${contact}, 'registration', 'email', now() + interval '10 minutes')`);
    expect((await request(app).post("/api/auth/verify-otp").send({ pinId, otp })).status).toBe(200);
    await request(app).post("/api/auth/verify-otp").send({ pinId: `${pinId}-missing`, otp: sensitive });
    await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${login.body.token}`);
    const rows = await db.execute(sql`
      SELECT action, metadata_json FROM audit_logs
      WHERE user_id IN (${userId}, ${adminId}) OR action LIKE 'otp_%' OR action = 'login_failed'
      ORDER BY id DESC LIMIT 100
    `);
    const actions = new Set((rows.rows as Array<{ action: string }>).map(row => row.action));
    expect(actions).toContain("login_failed");
    expect(actions).toContain("otp_send_failed");
    expect(actions).toContain("login_succeeded");
    expect(actions).toContain("otp_verify_succeeded");
    expect(actions).toContain("otp_verify_failed");
    expect(actions).toContain("mfa_setup_started");
    expect(actions).toContain("mfa_confirm_failed");
    expect(actions).toContain("role_switched");
    expect(actions).toContain("password_reset_completed");
    expect(actions).toContain("admin_password_reset");
    expect(actions).toContain("logout");
    const serialized = JSON.stringify((rows.rows as Array<{ metadata_json: unknown }>).map(row => row.metadata_json)).toLowerCase();
    expect(serialized).not.toContain(sensitive.toLowerCase());
    for (const forbidden of ["password", "token", "totp", "secret", "\"code\"", "\"contact\""]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});