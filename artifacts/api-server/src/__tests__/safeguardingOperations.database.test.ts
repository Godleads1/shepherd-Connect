import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import { generateToken } from "../middlewares/auth";
import { safeguardingRouteDependencies } from "../routes/safeguarding";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `safeguarding-operation-${Date.now()}`;
let firstActor = 0;
let secondActor = 0;
let parentActor = 0;
let teacher = 0;
let nonTeacher = 0;
const operationId = () => crypto.randomUUID();
const auth = (userId: number, role: string) => `Bearer ${generateToken({
  userId, role, email: `${prefix}-${userId}@test`, firstName: "Operation", lastName: "Tester",
})}`;

async function counts(id: string) {
  const result = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM safeguarding_records WHERE created_by IN (${firstActor}, ${secondActor})) records,
      (SELECT count(*)::int FROM command_operations WHERE operation_id=${id}::uuid) operations
  `);
  return result.rows[0] as { records: number; operations: number };
}

beforeAll(async () => {
  const users = await db.execute(sql`
    INSERT INTO users (email,password_hash,first_name,last_name,role,status,is_active)
    VALUES
      (${`${prefix}-one@test`},'x','First','Admin','admin','active',true),
      (${`${prefix}-two@test`},'x','Second','Admin','admin','active',true),
      (${`${prefix}-parent@test`},'x','Parent','User','parent','active',true),
      (${`${prefix}-teacher@test`},'x','Teacher','User','teacher','active',true),
      (${`${prefix}-not-teacher@test`},'x','Not','Teacher','parent','active',true)
    RETURNING id
  `);
  [firstActor, secondActor, parentActor, teacher, nonTeacher] = users.rows.map(row => Number(row.id));
});

beforeEach(async () => {
  safeguardingRouteDependencies.beforePersist = null;
  safeguardingRouteDependencies.postCommitBeforeResponse = null;
  await db.execute(sql`DELETE FROM command_operations WHERE target_type='teacher' AND target_id IN (${String(teacher)}, ${String(nonTeacher)})`);
  await db.execute(sql`DELETE FROM safeguarding_records WHERE created_by IN (${firstActor}, ${secondActor})`);
});

afterAll(async () => {
  safeguardingRouteDependencies.beforePersist = null;
  safeguardingRouteDependencies.postCommitBeforeResponse = null;
  await db.execute(sql`DELETE FROM command_operations WHERE target_type='teacher' AND target_id IN (${String(teacher)}, ${String(nonTeacher)})`);
  await db.execute(sql`DELETE FROM safeguarding_records WHERE created_by IN (${firstActor}, ${secondActor})`);
  await db.execute(sql`DELETE FROM users WHERE id IN (${firstActor}, ${secondActor}, ${parentActor}, ${teacher}, ${nonTeacher})`);
});

databaseDescribe("safeguarding command operations", () => {
  const body = (id: string, teacherUserId = teacher) => ({
    operationId: id, teacherUserId, checkType: "DBS Enhanced", referenceNumber: "private-reference",
    notes: "private safeguarding notes", status: "clear",
  });

  it("applies once, replays sequentially and concurrently, and stores only primaryId", async () => {
    const id = operationId();
    const first = await request(app).post("/api/safeguarding").set("Authorization", auth(firstActor, "admin")).send(body(id)).expect(201);
    expect(first.body).toMatchObject({ operationId: id, outcome: "applied", teacherUserId: teacher });
    await request(app).post("/api/safeguarding").set("Authorization", auth(firstActor, "admin")).send(body(id)).expect(200)
      .expect(({ body: response }) => expect(response).toMatchObject({ id: first.body.id, outcome: "already_applied" }));
    const concurrentId = operationId();
    const responses = await Promise.all([
      request(app).post("/api/safeguarding").set("Authorization", auth(firstActor, "admin")).send(body(concurrentId)),
      request(app).post("/api/safeguarding").set("Authorization", auth(firstActor, "admin")).send(body(concurrentId)),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 201]);
    expect(await counts(id)).toEqual({ records: 2, operations: 1 });
    const stored = await db.execute(sql`SELECT result_version,result_json FROM command_operations WHERE operation_id=${id}::uuid`);
    expect(stored.rows[0]).toMatchObject({ result_version: 1, result_json: { primaryId: first.body.id } });
    expect(JSON.stringify(stored.rows[0].result_json)).not.toMatch(/private|notes|reference|email/i);
  });

  it("rejects substitution, validates eligible teachers, and rolls back", async () => {
    const id = operationId();
    await request(app).post("/api/safeguarding").set("Authorization", auth(firstActor, "admin")).send(body(id)).expect(201);
    await request(app).post("/api/safeguarding").set("Authorization", auth(firstActor, "admin")).send({ ...body(id), notes: "changed" }).expect(409);
    await request(app).post("/api/safeguarding").set("Authorization", auth(firstActor, "admin")).send(body(id, nonTeacher)).expect(409);
    await request(app).post("/api/safeguarding").set("Authorization", auth(secondActor, "admin")).send(body(id)).expect(409);
    await request(app).post("/api/safeguarding").set("Authorization", auth(firstActor, "admin")).send(body(operationId(), nonTeacher)).expect(400);
    await request(app).post("/api/safeguarding").set("Authorization", auth(parentActor, "parent")).send(body(operationId())).expect(403);
    const rollbackId = operationId();
    safeguardingRouteDependencies.beforePersist = () => { throw new Error("rollback test"); };
    await request(app).post("/api/safeguarding").set("Authorization", auth(firstActor, "admin")).send(body(rollbackId)).expect(500);
    expect(await counts(rollbackId)).toEqual({ records: 1, operations: 0 });
  });

  it("reconciles only its authorized actor and permits a distinct new operation", async () => {
    const id = operationId();
    await request(app).post("/api/safeguarding").set("Authorization", auth(firstActor, "admin")).send(body(id)).expect(201);
    await request(app).get(`/api/safeguarding/operations/${id}`).set("Authorization", auth(firstActor, "admin")).expect(200)
      .expect(({ body: response }) => expect(response).toMatchObject({ operationId: id, outcome: "already_applied" }));
    await request(app).get(`/api/safeguarding/operations/${id}`).set("Authorization", auth(secondActor, "admin")).expect(404);
    await request(app).get(`/api/safeguarding/operations/${id}`).set("Authorization", auth(parentActor, "parent")).expect(403);
    const newId = operationId();
    await request(app).post("/api/safeguarding").set("Authorization", auth(firstActor, "admin")).send(body(newId)).expect(201);
    expect(await counts(newId)).toEqual({ records: 2, operations: 1 });
  });

  it("survives a genuine post-commit HTTP socket drop and replays the same ID", async () => {
    const id = operationId();
    safeguardingRouteDependencies.postCommitBeforeResponse = (_req, res) => res.socket?.destroy();
    await expect(request(app).post("/api/safeguarding").set("Authorization", auth(firstActor, "admin")).send(body(id))).rejects.toThrow();
    safeguardingRouteDependencies.postCommitBeforeResponse = null;
    expect(await counts(id)).toEqual({ records: 1, operations: 1 });
    await request(app).post("/api/safeguarding").set("Authorization", auth(firstActor, "admin")).send(body(id)).expect(200);
    expect(await counts(id)).toEqual({ records: 1, operations: 1 });
  });
});