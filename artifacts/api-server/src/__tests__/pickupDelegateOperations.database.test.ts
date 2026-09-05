import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import { generateToken } from "../middlewares/auth";
import { pickupDelegateRouteDependencies } from "../routes/pickupDelegates";
import { smsDelegateOtp } from "../services/sms";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `pickup-delegate-operation-${Date.now()}`;
let parent = 0, otherParent = 0, outsider = 0, family = 0, child = 0, otherChild = 0;
const operationId = () => crypto.randomUUID();
const auth = (id: number) => `Bearer ${generateToken({ userId: id, role: "parent", email: `${prefix}-${id}@test`, firstName: "Parent", lastName: "Test" })}`;
const body = (id: string, changes: Record<string, unknown> = {}) => ({
  operationId: id, childId: child, childIds: [child], name: "  Trusted Person  ", phone: " 08030000000 ", ...changes,
});
async function count(id: string) {
  const result = await db.execute(sql`
    SELECT (SELECT count(*)::int FROM command_operations WHERE operation_id=${id}::uuid) operations,
      (SELECT count(*)::int FROM pickup_delegates WHERE id = ((SELECT result_json->>'primaryId' FROM command_operations WHERE operation_id=${id}::uuid)::int)) primary_rows
  `);
  return result.rows[0] as { operations: number; primary_rows: number };
}
async function cleanup() {
  await db.execute(sql`DELETE FROM command_operations WHERE command='pickup_delegate_create' AND actor_user_id IN (${parent}, ${otherParent}, ${outsider})`);
  await db.execute(sql`DELETE FROM pickup_delegates WHERE child_id IN (${child}, ${otherChild})`);
  await db.execute(sql`DELETE FROM private_object_bindings WHERE uploader_id IN (${parent}, ${otherParent}, ${outsider})`);
}

beforeAll(async () => {
  const users = await db.execute(sql`INSERT INTO users (email,password_hash,first_name,last_name,role,status,is_active)
    VALUES (${`${prefix}-parent@test`},'x','Parent','One','parent','active',true), (${`${prefix}-other@test`},'x','Parent','Other','parent','active',true), (${`${prefix}-outsider@test`},'x','Parent','Outsider','parent','active',true) RETURNING id`);
  [parent, otherParent, outsider] = users.rows.map(row => Number(row.id));
  family = Number((await db.execute(sql`INSERT INTO families (family_code,parent_1_id,parent_2_id) VALUES (${`PD-${prefix.slice(-8)}`},${parent},${otherParent}) RETURNING id`)).rows[0].id);
  const children = await db.execute(sql`INSERT INTO children (family_id,first_name,last_name,dob,gender) VALUES
    (${family},'First','Child','2020-01-01','male'), (${family},'Second','Child','2020-01-01','female') RETURNING id`);
  child = Number(children.rows[0].id); otherChild = Number(children.rows[1].id);
});
beforeEach(async () => {
  pickupDelegateRouteDependencies.smsDelegateOtp = smsDelegateOtp;
  pickupDelegateRouteDependencies.beforePersist = null;
  pickupDelegateRouteDependencies.postCommitBeforeResponse = null;
  await cleanup();
});
afterAll(async () => {
  await cleanup();
  await db.execute(sql`DELETE FROM children WHERE id IN (${child},${otherChild})`);
  await db.execute(sql`DELETE FROM families WHERE id=${family}`);
  await db.execute(sql`DELETE FROM users WHERE id IN (${parent},${otherParent},${outsider})`);
});

databaseDescribe("pickup delegate command operations", () => {
  it("creates exactly one canonical multi-child command and sequential/concurrent retries replay it", async () => {
    const id = operationId();
    const first = await request(app).post("/api/pickup-delegates").set("Authorization", auth(parent)).send(body(id, { childIds: [otherChild, child, otherChild] })).expect(201);
    expect(first.body).toMatchObject({ operationId: id, outcome: "applied", childIds: [child, otherChild], name: "Trusted Person", phone: "08030000000", otpStatus: "active" });
    expect(first.body.otpCode).toMatch(/^\d{6}$/);
    const replay = await request(app).post("/api/pickup-delegates").set("Authorization", auth(parent)).send(body(id, { childIds: [child, otherChild] })).expect(200);
    expect(replay.body).toMatchObject({ id: first.body.id, otpCode: first.body.otpCode, childIds: [child, otherChild], outcome: "already_applied" });
    const concurrent = operationId();
    const responses = await Promise.all([request(app).post("/api/pickup-delegates").set("Authorization", auth(parent)).send(body(concurrent)),
      request(app).post("/api/pickup-delegates").set("Authorization", auth(parent)).send(body(concurrent))]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 201]);
    expect(await count(id)).toEqual({ operations: 1, primary_rows: 1 });
    const stored = await db.execute(sql`SELECT result_json FROM command_operations WHERE operation_id=${id}::uuid`);
    expect(stored.rows[0].result_json).toEqual({ primaryId: first.body.id, createdIds: expect.any(Array), childIds: [child, otherChild] });
    expect(Object.keys(stored.rows[0].result_json as object).sort()).toEqual(["childIds", "createdIds", "primaryId"]);
    expect(JSON.stringify(stored.rows[0].result_json)).not.toMatch(/Trusted|080300|otp|photo/i);
    expect(Number((await db.execute(sql`SELECT count(*)::int AS count FROM pickup_delegates WHERE id = ANY(ARRAY(SELECT jsonb_array_elements_text(result_json->'createdIds')::int FROM command_operations WHERE operation_id=${id}::uuid))`)).rows[0].count)).toBe(2);
  });

  it("rejects input, actor, payload, target and rolls back before persistence", async () => {
    const id = operationId();
    await request(app).post("/api/pickup-delegates").set("Authorization", auth(parent)).send(body(id)).expect(201);
    await request(app).post("/api/pickup-delegates").set("Authorization", auth(parent)).send(body(id, { phone: "08039999999" })).expect(409);
    await request(app).post("/api/pickup-delegates").set("Authorization", auth(parent)).send(body(id, { childIds: [otherChild], childId: otherChild })).expect(409);
    await request(app).post("/api/pickup-delegates").set("Authorization", auth(outsider)).send(body(id)).expect(409);
    await request(app).post("/api/pickup-delegates").set("Authorization", auth(parent)).send(body(operationId(), { operationId: "not-a-uuid" })).expect(400);
    await request(app).post("/api/pickup-delegates").set("Authorization", auth(outsider)).send(body(operationId())).expect(403);
    const rollback = operationId();
    pickupDelegateRouteDependencies.beforePersist = () => { throw new Error("rollback"); };
    await request(app).post("/api/pickup-delegates").set("Authorization", auth(parent)).send(body(rollback)).expect(500);
    expect(await count(rollback)).toEqual({ operations: 0, primary_rows: 0 });
    pickupDelegateRouteDependencies.beforePersist = null;
    await request(app).post("/api/pickup-delegates").set("Authorization", auth(parent)).send(body(operationId())).expect(201);
  });

  it("reconciles only the actor, recovers/expires OTP from recorded IDs, and supports a new UUID", async () => {
    const id = operationId();
    const created = await request(app).post("/api/pickup-delegates").set("Authorization", auth(otherParent)).send(body(id)).expect(201);
    // A separate row sharing the OTP must never influence replay lookup: replay
    // is constrained exclusively by the IDs persisted in command_operations.
    await db.execute(sql`INSERT INTO pickup_delegates (child_id,name,phone,otp_code,parent_approved)
      VALUES (${otherChild},'Unrelated OTP Collision','08039999999',${created.body.otpCode},false)`);
    const replay = await request(app).post("/api/pickup-delegates").set("Authorization", auth(otherParent)).send(body(id)).expect(200);
    expect(replay.body.id).toBe(created.body.id);
    await request(app).get(`/api/pickup-delegates/operations/${id}`).set("Authorization", auth(otherParent)).expect(200)
      .expect(response => expect(response.body).toMatchObject({ id: created.body.id, otpCode: created.body.otpCode, outcome: "already_applied" }));
    await request(app).get(`/api/pickup-delegates/operations/${id}`).set("Authorization", auth(outsider)).expect(404);
    await db.execute(sql`UPDATE pickup_delegates SET otp_expires_at=NOW()-INTERVAL '1 second' WHERE id=${created.body.id}`);
    await request(app).post("/api/pickup-delegates").set("Authorization", auth(otherParent)).send(body(id)).expect(200)
      .expect(response => expect(response.body).toMatchObject({ otpCode: null, otpStatus: "expired" }));
    await request(app).post("/api/pickup-delegates").set("Authorization", auth(otherParent)).send(body(operationId())).expect(201);
  });

  it("binds photos transactionally, rejects an unavailable binding without rows, sends SMS once, and survives response loss", async () => {
    const photo = `/objects/${prefix}-photo`;
    await db.execute(sql`INSERT INTO private_object_bindings (object_path,uploader_id) VALUES (${photo},${otherParent})`);
    const photoOperation = operationId();
    const created = await request(app).post("/api/pickup-delegates").set("Authorization", auth(otherParent)).send(body(photoOperation, { photoUrl: photo })).expect(201);
    const bound = await db.execute(sql`SELECT resource_type,resource_id FROM private_object_bindings WHERE object_path=${photo}`);
    expect(bound.rows[0]).toMatchObject({ resource_type: "pickup_delegate", resource_id: created.body.id });
    const unavailable = `/objects/${prefix}-unavailable`;
    await db.execute(sql`INSERT INTO private_object_bindings (object_path,uploader_id,revoked_at) VALUES (${unavailable},${otherParent},NOW())`);
    const denied = operationId();
    await request(app).post("/api/pickup-delegates").set("Authorization", auth(otherParent)).send(body(denied, { photoUrl: unavailable })).expect(403);
    expect(await count(denied)).toEqual({ operations: 0, primary_rows: 0 });
    const binding = await db.execute(sql`SELECT resource_type,resource_id FROM private_object_bindings WHERE object_path=${unavailable}`);
    expect(binding.rows[0]).toMatchObject({ resource_type: null, resource_id: null });
    const sms = vi.fn().mockRejectedValue(new Error("unavailable"));
    pickupDelegateRouteDependencies.smsDelegateOtp = sms as any;
    const smsOperation = operationId();
    await request(app).post("/api/pickup-delegates").set("Authorization", auth(otherParent)).send(body(smsOperation)).expect(201);
    await request(app).post("/api/pickup-delegates").set("Authorization", auth(otherParent)).send(body(smsOperation)).expect(200);
    expect(sms).toHaveBeenCalledTimes(1);
    const droppedSms = vi.fn().mockResolvedValue(undefined);
    pickupDelegateRouteDependencies.smsDelegateOtp = droppedSms as any;
    const dropped = operationId();
    pickupDelegateRouteDependencies.postCommitBeforeResponse = (_req, res) => res.socket?.destroy();
    await expect(request(app).post("/api/pickup-delegates").set("Authorization", auth(otherParent)).send(body(dropped))).rejects.toThrow();
    pickupDelegateRouteDependencies.postCommitBeforeResponse = null;
    expect(await count(dropped)).toEqual({ operations: 1, primary_rows: 1 });
    expect(droppedSms).toHaveBeenCalledTimes(1);
    const durable = await db.execute(sql`SELECT otp_code FROM pickup_delegates WHERE id=(SELECT (result_json->>'primaryId')::int FROM command_operations WHERE operation_id=${dropped}::uuid)`);
    const replay = await request(app).post("/api/pickup-delegates").set("Authorization", auth(otherParent)).send(body(dropped)).expect(200);
    expect(replay.body.otpCode).toBe(durable.rows[0].otp_code);
    expect(droppedSms).toHaveBeenCalledTimes(1);
  });
});