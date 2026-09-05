import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import { generateToken } from "../middlewares/auth";
import { familyAssistRouteDependencies } from "../routes/familyAssist";
import { smsDelegateOtp } from "../services/sms";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `family-assist-delegate-operation-${Date.now()}`;
let firstActor = 0;
let secondActor = 0;
let parentActor = 0;
let family = 0;
let child = 0;
let otherChild = 0;
const operationId = () => crypto.randomUUID();
const auth = (userId: number, role: string) => `Bearer ${generateToken({
  userId, role, email: `${prefix}-${userId}@test`, firstName: "Family", lastName: "Assist",
})}`;
const body = (id: string, changes: Record<string, unknown> = {}) => ({
  operationId: id, childId: child, delegateName: "  Assisted Person  ", delegatePhone: " 08030000000 ", ...changes,
});

async function counts(id: string) {
  const result = await db.execute(sql`
    WITH op AS (
      SELECT (result_json->>'primaryId')::int AS delegate_id
      FROM command_operations WHERE operation_id=${id}::uuid
    )
    SELECT
      (SELECT count(*)::int FROM pickup_delegates WHERE id=(SELECT delegate_id FROM op)) delegates,
      (SELECT count(*)::int FROM command_operations WHERE operation_id=${id}::uuid) operations
  `);
  return result.rows[0] as { delegates: number; operations: number };
}

async function cleanup() {
  await db.execute(sql`DELETE FROM command_operations WHERE command='family_assist_delegate_create' AND actor_user_id IN (${firstActor}, ${secondActor})`);
  await db.execute(sql`DELETE FROM pickup_delegates WHERE child_id IN (${child}, ${otherChild})`);
}

beforeAll(async () => {
  const users = await db.execute(sql`
    INSERT INTO users (email,password_hash,first_name,last_name,role,status,is_active)
    VALUES (${`${prefix}-one@test`},'x','First','Support','support','active',true),
           (${`${prefix}-two@test`},'x','Second','Admin','admin','active',true),
           (${`${prefix}-parent@test`},'x','Parent','User','parent','active',true)
    RETURNING id
  `);
  [firstActor, secondActor, parentActor] = users.rows.map(row => Number(row.id));
  family = Number((await db.execute(sql`
    INSERT INTO families (family_code) VALUES (${`FA-${prefix.slice(-8)}`}) RETURNING id
  `)).rows[0].id);
  const children = await db.execute(sql`
    INSERT INTO children (family_id,first_name,last_name,dob,gender)
    VALUES (${family},'First','Child','2020-01-01','male'),
           (${family},'Second','Child','2020-01-01','female')
    RETURNING id
  `);
  child = Number(children.rows[0].id);
  otherChild = Number(children.rows[1].id);
});

beforeEach(async () => {
  familyAssistRouteDependencies.smsDelegateOtp = smsDelegateOtp;
  familyAssistRouteDependencies.beforePersist = null;
  familyAssistRouteDependencies.postCommitBeforeResponse = null;
  await cleanup();
});

afterAll(async () => {
  familyAssistRouteDependencies.smsDelegateOtp = smsDelegateOtp;
  familyAssistRouteDependencies.beforePersist = null;
  familyAssistRouteDependencies.postCommitBeforeResponse = null;
  await cleanup();
  await db.execute(sql`DELETE FROM children WHERE id IN (${child}, ${otherChild})`);
  await db.execute(sql`DELETE FROM families WHERE id=${family}`);
  await db.execute(sql`DELETE FROM users WHERE id IN (${firstActor}, ${secondActor}, ${parentActor})`);
});

databaseDescribe("family assist delegate command operations", () => {
  it("applies once, sequentially/concurrently replays one durable delegate and OTP, and stores only primaryId", async () => {
    const id = operationId();
    const first = await request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send(body(id)).expect(201);
    expect(first.body).toMatchObject({ operationId: id, outcome: "applied", parentApproved: true, name: "Assisted Person", phone: "08030000000", otpStatus: "active" });
    expect(first.body.otpCode).toMatch(/^\d{6}$/);
    const replay = await request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send(body(id)).expect(200);
    expect(replay.body).toMatchObject({ id: first.body.id, otpCode: first.body.otpCode, outcome: "already_applied" });
    const concurrentId = operationId();
    const responses = await Promise.all([
      request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send(body(concurrentId)),
      request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send(body(concurrentId)),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 201]);
    expect(await counts(id)).toEqual({ delegates: 1, operations: 1 });
    expect(await counts(concurrentId)).toEqual({ delegates: 1, operations: 1 });
    const stored = await db.execute(sql`SELECT result_json FROM command_operations WHERE operation_id=${id}::uuid`);
    expect(stored.rows[0]).toMatchObject({ result_json: { primaryId: first.body.id } });
    expect(JSON.stringify(stored.rows[0].result_json)).not.toMatch(/Assisted|080300|otp/i);
  });

  it("rejects payload, target, and actor substitutions; validates, authorizes, and rolls back", async () => {
    const id = operationId();
    await request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send(body(id)).expect(201);
    await request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send(body(id, { delegatePhone: "08039999999" })).expect(409);
    await request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send(body(id, { childId: otherChild })).expect(409);
    await request(app).post("/api/family-assist/delegate").set("Authorization", auth(secondActor, "admin")).send(body(id)).expect(409);
    await request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send({ ...body(operationId()), operationId: "bad" }).expect(400);
    await request(app).post("/api/family-assist/delegate").set("Authorization", auth(parentActor, "parent")).send(body(operationId())).expect(403);
    const rollbackId = operationId();
    familyAssistRouteDependencies.beforePersist = () => { throw new Error("rollback"); };
    await request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send(body(rollbackId)).expect(500);
    expect(await counts(rollbackId)).toEqual({ delegates: 0, operations: 0 });
  });

  it("reconciles only its original actor, recovers unexpired OTP, returns explicit expiry, and permits an intentional new operation", async () => {
    const id = operationId();
    const created = await request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send(body(id)).expect(201);
    const reconciled = await request(app).get(`/api/family-assist/delegate/operations/${id}`).set("Authorization", auth(firstActor, "support")).expect(200);
    expect(reconciled.body).toMatchObject({ id: created.body.id, otpCode: created.body.otpCode, otpStatus: "active", outcome: "already_applied" });
    await request(app).get(`/api/family-assist/delegate/operations/${id}`).set("Authorization", auth(secondActor, "admin")).expect(404);
    await request(app).get(`/api/family-assist/delegate/operations/${id}`).set("Authorization", auth(parentActor, "parent")).expect(403);
    await db.execute(sql`UPDATE pickup_delegates SET otp_expires_at=NOW() - INTERVAL '1 second' WHERE id=${created.body.id}`);
    await request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send(body(id)).expect(200)
      .expect(({ body: response }) => expect(response).toMatchObject({ otpCode: null, otpStatus: "expired" }));
    await request(app).get(`/api/family-assist/delegate/operations/${id}`).set("Authorization", auth(firstActor, "support")).expect(200)
      .expect(({ body: response }) => expect(response).toMatchObject({ otpCode: null, otpStatus: "expired" }));
    const newId = operationId();
    await request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send(body(newId)).expect(201);
    expect(await counts(newId)).toEqual({ delegates: 1, operations: 1 });
  });

  it("treats SMS as optional and sends only first execution, then survives a real post-commit socket drop", async () => {
    const sms = vi.fn().mockRejectedValue(new Error("SMS unavailable"));
    familyAssistRouteDependencies.smsDelegateOtp = sms as any;
    const id = operationId();
    await request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send(body(id)).expect(201);
    await request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send(body(id)).expect(200);
    expect(sms).toHaveBeenCalledTimes(1);
    expect(await counts(id)).toEqual({ delegates: 1, operations: 1 });
    const droppedSms = vi.fn().mockResolvedValue(undefined);
    familyAssistRouteDependencies.smsDelegateOtp = droppedSms as any;
    const droppedId = operationId();
    familyAssistRouteDependencies.postCommitBeforeResponse = (_req, res) => res.socket?.destroy();
    await expect(request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send(body(droppedId))).rejects.toThrow();
    familyAssistRouteDependencies.postCommitBeforeResponse = null;
    expect(await counts(droppedId)).toEqual({ delegates: 1, operations: 1 });
    expect(droppedSms).toHaveBeenCalledTimes(1);
    const durable = await db.execute(sql`SELECT otp_code FROM pickup_delegates WHERE id=(SELECT (result_json->>'primaryId')::int FROM command_operations WHERE operation_id=${droppedId}::uuid)`);
    const replay = await request(app).post("/api/family-assist/delegate").set("Authorization", auth(firstActor, "support")).send(body(droppedId)).expect(200);
    expect(replay.body.otpCode).toBe(durable.rows[0].otp_code);
    expect(droppedSms).toHaveBeenCalledTimes(1);
    expect(await counts(droppedId)).toEqual({ delegates: 1, operations: 1 });
  });
});