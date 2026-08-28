import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const provider = vi.hoisted(() => ({ accepted: true, codes: new Map<string, string>() }));
vi.mock("../services/sms", () => {
  const yes = vi.fn(async () => true);
  return {
    smsRegistrationOtp: vi.fn(async (to: string, otp: string) => { provider.codes.set(to, otp); return provider.accepted; }),
    emailRegistrationOtp: vi.fn(async (to: string, otp: string) => { provider.codes.set(to, otp); return provider.accepted; }),
    smsWelcome: yes, smsPendingApproval: yes, smsPasswordResetCode: yes, emailWelcome: yes, emailPendingApproval: yes, emailPasswordResetCode: yes,
    smsAccountApproved: yes, smsAccountRejected: yes, emailAccountApproved: yes, emailAccountRejected: yes, smsDelegateOtp: yes,
    smsChildCheckedIn: yes, smsChildCheckedOut: yes, smsPreDismissal: yes, emailChildCheckedIn: yes, emailChildCheckedOut: yes, emailShepherdsReport: yes,
  };
});
import app from "../app";

const prefix = `phase2-otp-${Date.now()}-`;
const distinctProofPhone = `+234802${String(Date.now()).slice(-7)}`;
const emails: string[] = [];
const email = (label: string) => { const value = `${prefix}${label}-${emails.length}@example.test`; emails.push(value); return value; };
const body = (address: string, otpPinId?: string, role = "parent") => ({
  firstName: "Phase", lastName: "Two", email: address, phone: "08012345678", password: "correct-horse-battery", role, ...(otpPinId ? { otpPinId } : {}),
});
async function issueEmail(address: string, ip = "198.18.0.1") {
  return request(app).post("/api/auth/send-otp").set("X-Forwarded-For", ip).send({ email: address, channel: "email" });
}
async function verifiedProof(address: string) {
  const issued = await issueEmail(address, `198.18.1.${emails.length}`);
  expect(issued.status).toBe(200);
  const verified = await request(app).post("/api/auth/verify-otp").send({ pinId: issued.body.pinId, otp: provider.codes.get(address) });
  expect(verified.status).toBe(200);
  return issued.body.pinId as string;
}
async function verifiedPhoneProof(phone: string) {
  const issued = await request(app)
    .post("/api/auth/send-otp")
    .set("X-Forwarded-For", `198.18.7.${emails.length}`)
    .send({ phone, channel: "sms" });
  expect(issued.status).toBe(200);
  const verified = await request(app)
    .post("/api/auth/verify-otp")
    .send({ pinId: issued.body.pinId, otp: provider.codes.get(phone) });
  expect(verified.status).toBe(200);
  return issued.body.pinId as string;
}
beforeAll(() => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for registration OTP database tests");
  process.env.SESSION_SECRET ??= "development-test-session-secret";
});
afterAll(async () => {
  await db.execute(sql`DELETE FROM otp_sessions WHERE contact LIKE ${`email:${prefix}%`}`);
  await db.execute(sql`DELETE FROM otp_sessions WHERE contact = 'phone:2348012345678'`);
  await db.execute(sql`DELETE FROM otp_sessions WHERE contact = ${`phone:${distinctProofPhone.replace(/\D/g, "").replace(/^2340?/, "234")}`}`);
  await db.execute(sql`DELETE FROM users WHERE email LIKE ${`${prefix}%`}`);
});

// Database integration tests are intentionally opt-in so ordinary unit-suite
// runs never point at an unknown DATABASE_URL. CI/development evidence uses
// RUN_DATABASE_OTP_TESTS=true against the approved development database.
const databaseDescribe = process.env.RUN_DATABASE_OTP_TESTS === "true" ? describe : describe.skip;

databaseDescribe("registration OTP PostgreSQL security controls", () => {
  it("stores a v1 HMAC and typed normalized contact", async () => {
    const address = email("normalized").toUpperCase();
    const response = await issueEmail(address);
    const row = await db.execute(sql`SELECT otp, contact FROM otp_sessions WHERE pin_id = ${response.body.pinId}`);
    expect(row.rows[0]).toMatchObject({ contact: `email:${address.toLowerCase()}` });
    expect((row.rows[0] as { otp: string }).otp).toMatch(/^v1:[0-9a-f]{64}$/);
    expect((row.rows[0] as { otp: string }).otp).not.toBe(provider.codes.get(address.toLowerCase()));
  });

  it("enforces cooldown, canonical phone binding, and expires prior active session after permitted resend", async () => {
    const first = await request(app).post("/api/auth/send-otp").send({ phone: "+234 801 234 5678", channel: "sms" });
    expect(first.status).toBe(200);
    expect((await request(app).post("/api/auth/send-otp").send({ phone: "08012345678", channel: "sms" })).status).toBe(429);
    expect((await request(app).post("/api/auth/verify-otp").send({ pinId: first.body.pinId, otp: provider.codes.get("+234 801 234 5678") })).status).toBe(200);
    await db.execute(sql`UPDATE otp_sessions SET created_at = now() - interval '61 seconds' WHERE pin_id = ${first.body.pinId}`);
    const second = await request(app).post("/api/auth/send-otp").send({ phone: "08012345678", channel: "sms" });
    expect(second.status).toBe(200);
    const row = await db.execute(sql`SELECT contact, expires_at <= now() AS expired FROM otp_sessions WHERE pin_id = ${first.body.pinId}`);
    expect(row.rows[0]).toMatchObject({ contact: "phone:2348012345678", expired: true });
  });

  it("limits five hourly issuances across forwarded IPs", async () => {
    const address = email("hour");
    for (let index = 0; index < 5; index++) {
      const response = await issueEmail(address, `198.18.2.${index + 1}`);
      expect(response.status).toBe(200);
      await db.execute(sql`UPDATE otp_sessions SET created_at = now() - interval '61 seconds' WHERE pin_id = ${response.body.pinId}`);
    }
    expect((await issueEmail(address, "198.18.2.99")).status).toBe(429);
  });

  it("returns generic 503 and retains an expired history row when provider rejects", async () => {
    provider.accepted = false;
    const address = email("provider-failure");
    const response = await issueEmail(address, "198.18.3.1");
    provider.accepted = true;
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain(provider.codes.get(address)!);
    const row = await db.execute(sql`SELECT expires_at <= now() AS expired FROM otp_sessions WHERE contact = ${`email:${address}`}`);
    expect(row.rows[0]).toMatchObject({ expired: true });
  });

  it("verifies only once, persists five failed attempts, and fails legacy plaintext closed", async () => {
    const good = email("good");
    const goodPin = await verifiedProof(good);
    expect((await request(app).post("/api/auth/verify-otp").send({ pinId: goodPin, otp: provider.codes.get(good) })).status).toBe(400);
    const wrong = email("wrong");
    const wrongIssue = await issueEmail(wrong, "198.18.4.1");
    for (let attempt = 0; attempt < 5; attempt++) expect((await request(app).post("/api/auth/verify-otp").send({ pinId: wrongIssue.body.pinId, otp: "000000" })).status).toBe(400);
    const exhausted = await db.execute(sql`SELECT attempt_count, expires_at <= now() AS expired FROM otp_sessions WHERE pin_id = ${wrongIssue.body.pinId}`);
    expect(exhausted.rows[0]).toMatchObject({ attempt_count: 5, expired: true });
    expect((await request(app).post("/api/auth/verify-otp").send({ pinId: wrongIssue.body.pinId, otp: provider.codes.get(wrong) })).status).toBe(400);
    const legacy = `legacy-${prefix}`;
    await db.execute(sql`INSERT INTO otp_sessions (pin_id, otp, contact, expires_at, created_at, attempt_count) VALUES (${legacy}, '123456', ${`email:${email("legacy")}`}, now() + interval '10 minutes', now(), 0)`);
    expect((await request(app).post("/api/auth/verify-otp").send({ pinId: legacy, otp: "123456" })).status).toBe(400);
  });

  it("allows exactly one concurrent correct verification", async () => {
    const address = email("concurrent-verify");
    const issued = await issueEmail(address, "198.18.5.1");
    const replies = await Promise.all(Array.from({ length: 2 }, () => request(app).post("/api/auth/verify-otp").send({ pinId: issued.body.pinId, otp: provider.codes.get(address) })));
    expect(replies.filter(reply => reply.status === 200)).toHaveLength(1);
  });

  it("requires verified matching unexpired proof, consumes it once, and preserves proof on mutation failure", async () => {
    const noProof = email("no-proof");
    expect((await request(app).post("/api/auth/register").send(body(noProof))).status).toBe(400);
    const unverified = email("unverified");
    const unverifiedPin = (await issueEmail(unverified, "198.18.6.1")).body.pinId;
    expect((await request(app).post("/api/auth/register").send(body(unverified, unverifiedPin))).status).toBe(400);
    const expired = email("expired");
    const expiredPin = await verifiedProof(expired);
    await db.execute(sql`UPDATE otp_sessions SET expires_at = now() - interval '1 second' WHERE pin_id = ${expiredPin}`);
    expect((await request(app).post("/api/auth/register").send(body(expired, expiredPin))).status).toBe(400);
    const mismatch = email("mismatch");
    const mismatchPin = await verifiedProof(mismatch);
    expect((await request(app).post("/api/auth/register").send(body(email("different"), mismatchPin))).status).toBe(400);
    const successful = email("new-user");
    const proof = await verifiedProof(successful);
    expect((await request(app).post("/api/auth/register").send(body(successful, proof))).status).toBe(201);
    expect((await request(app).post("/api/auth/register").send(body(successful, proof))).status).toBe(400);
    const existing = email("rollback");
    await db.execute(sql`INSERT INTO users (email, password_hash, first_name, last_name, role, status, is_active) VALUES (${existing}, ${await bcrypt.hash("correct-horse-battery", 4)}, 'Phase', 'Two', 'parent', 'active', true)`);
    const rollbackProof = await verifiedProof(existing);
    expect((await request(app).post("/api/auth/register").send(body(existing, rollbackProof))).status).toBe(409);
    expect((await db.execute(sql`SELECT verified_at IS NOT NULL AS verified FROM otp_sessions WHERE pin_id = ${rollbackProof}`)).rows[0]).toMatchObject({ verified: true });
  });

  it("consumes one concurrent proof once and retains pending/secondary role behavior", async () => {
    const concurrent = email("concurrent-register");
    const proof = await verifiedProof(concurrent);
    const replies = await Promise.all(Array.from({ length: 2 }, () => request(app).post("/api/auth/register").send(body(concurrent, proof))));
    expect(replies.filter(reply => reply.status === 201)).toHaveLength(1);
    const pendingAddress = email("pending-role");
    await db.execute(sql`INSERT INTO users (email, password_hash, first_name, last_name, role, status, is_active) VALUES (${pendingAddress}, ${await bcrypt.hash("correct-horse-battery", 4)}, 'Phase', 'Two', 'parent', 'active', true)`);
    expect((await request(app).post("/api/auth/register").send(body(pendingAddress, await verifiedProof(pendingAddress), "teacher"))).status).toBe(201);
    expect((await db.execute(sql`SELECT pending_roles FROM users WHERE email = ${pendingAddress}`)).rows[0]).toMatchObject({ pending_roles: '["teacher"]' });

    const secondaryAddress = email("secondary-role");
    await db.execute(sql`INSERT INTO users (email, password_hash, first_name, last_name, role, status, is_active) VALUES (${secondaryAddress}, ${await bcrypt.hash("correct-horse-battery", 4)}, 'Phase', 'Two', 'teacher', 'active', true)`);
    expect((await request(app).post("/api/auth/register").send(body(secondaryAddress, await verifiedProof(secondaryAddress), "parent"))).status).toBe(201);
    expect((await db.execute(sql`SELECT secondary_roles FROM users WHERE email = ${secondaryAddress}`)).rows[0]).toMatchObject({ secondary_roles: '["parent"]' });
  });

  it("preserves two role requests backed by distinct verified proofs", async () => {
    const address = email("distinct-proofs");
    const phone = distinctProofPhone;
    await db.execute(sql`
      INSERT INTO users (email, phone, password_hash, first_name, last_name, role, status, is_active)
      VALUES (${address}, ${phone}, ${await bcrypt.hash("correct-horse-battery", 4)}, 'Phase', 'Three', 'parent', 'active', true)
    `);

    const teacherProof = await verifiedProof(address);
    const supportProof = await verifiedPhoneProof(phone);
    const replies = await Promise.all([
      request(app).post("/api/auth/register").send({ ...body(address, teacherProof, "teacher"), phone }),
      request(app).post("/api/auth/register").send({ ...body(address, supportProof, "support"), phone }),
    ]);

    expect(replies.every(reply => reply.status === 201)).toBe(true);
    const result = await db.execute(sql`
      SELECT pending_roles
      FROM users
      WHERE email = ${address}
    `);
    expect(JSON.parse((result.rows[0] as { pending_roles: string }).pending_roles).sort()).toEqual(["support", "teacher"]);
    const proofs = await db.execute(sql`
      SELECT count(*)::int AS remaining
      FROM otp_sessions
      WHERE pin_id IN (${teacherProof}, ${supportProof})
    `);
    expect(proofs.rows[0]).toMatchObject({ remaining: 0 });
  });
});