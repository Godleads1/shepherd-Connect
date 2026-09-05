import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import { generateToken } from "../middlewares/auth";
import { emergencyUpdateRouteDependencies } from "../routes/emergencies";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `emergency-operation-${Date.now()}`;
let firstActor = 0;
let secondActor = 0;
let parentActor = 0;
let firstEmergency = 0;
let secondEmergency = 0;

const operationId = () => crypto.randomUUID();
const auth = (userId: number, role: string) => `Bearer ${generateToken({
  userId,
  role,
  email: `${prefix}-${userId}@test`,
  firstName: "Operation",
  lastName: "Tester",
})}`;

async function counts(id: string) {
  const rows = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM emergency_updates WHERE event_id=${id}) updates,
      (SELECT count(*)::int FROM command_operations WHERE operation_id=${id}::uuid) operations
  `);
  return rows.rows[0] as { updates: number; operations: number };
}

beforeAll(async () => {
  const users = await db.execute(sql`
    INSERT INTO users (email,password_hash,first_name,last_name,role,status,is_active)
    VALUES
      (${`${prefix}-one@test`},'x','First','Admin','admin','active',true),
      (${`${prefix}-two@test`},'x','Second','Admin','admin','active',true),
      (${`${prefix}-parent@test`},'x','Parent','User','parent','active',true)
    RETURNING id
  `);
  firstActor = Number(users.rows[0].id);
  secondActor = Number(users.rows[1].id);
  parentActor = Number(users.rows[2].id);
  const emergencies = await db.execute(sql`
    INSERT INTO emergencies (type,level,triggered_by,status,description)
    VALUES ('general','L1',${firstActor},'active','First test incident'),
           ('general','L1',${firstActor},'active','Second test incident')
    RETURNING id
  `);
  firstEmergency = Number(emergencies.rows[0].id);
  secondEmergency = Number(emergencies.rows[1].id);
});

beforeEach(async () => {
  emergencyUpdateRouteDependencies.beforePersist = null;
  emergencyUpdateRouteDependencies.postCommitBeforeResponse = null;
  await db.execute(sql`DELETE FROM command_operations WHERE target_type='emergency' AND target_id IN (${String(firstEmergency)},${String(secondEmergency)})`);
  await db.execute(sql`DELETE FROM emergency_updates WHERE emergency_id IN (${firstEmergency},${secondEmergency})`);
});

afterAll(async () => {
  emergencyUpdateRouteDependencies.beforePersist = null;
  emergencyUpdateRouteDependencies.postCommitBeforeResponse = null;
  await db.execute(sql`DELETE FROM command_operations WHERE target_type='emergency' AND target_id IN (${String(firstEmergency)},${String(secondEmergency)})`);
  await db.execute(sql`DELETE FROM emergency_updates WHERE emergency_id IN (${firstEmergency},${secondEmergency})`);
  await db.execute(sql`DELETE FROM emergencies WHERE id IN (${firstEmergency},${secondEmergency})`);
  await db.execute(sql`DELETE FROM users WHERE id IN (${firstActor},${secondActor},${parentActor})`);
});

databaseDescribe("emergency update command operations", () => {
  it("applies once, replays sequential and concurrent retries, and binds eventId", async () => {
    const id = operationId();
    const body = { operationId: id, message: "Status stable", updateType: "update" };
    const first = await request(app).post(`/api/emergencies/${firstEmergency}/update`)
      .set("Authorization", auth(firstActor, "admin")).send(body).expect(201);
    expect(first.body).toMatchObject({ operationId: id, outcome: "applied", eventId: id });
    const replay = await request(app).post(`/api/emergencies/${firstEmergency}/update`)
      .set("Authorization", auth(firstActor, "admin")).send(body).expect(200);
    expect(replay.body).toMatchObject({ id: first.body.id, outcome: "already_applied", eventId: id });
    const concurrentId = operationId();
    const concurrentBody = { ...body, operationId: concurrentId };
    const pair = await Promise.all([
      request(app).post(`/api/emergencies/${firstEmergency}/update`).set("Authorization", auth(firstActor, "admin")).send(concurrentBody),
      request(app).post(`/api/emergencies/${firstEmergency}/update`).set("Authorization", auth(firstActor, "admin")).send(concurrentBody),
    ]);
    expect(pair.map(value => value.status).sort()).toEqual([200, 201]);
    expect(await counts(id)).toEqual({ updates: 1, operations: 1 });
    expect(await counts(concurrentId)).toEqual({ updates: 1, operations: 1 });
    const stored = await db.execute(sql`
      SELECT result_version,result_json FROM command_operations WHERE operation_id=${id}::uuid
    `);
    expect(stored.rows[0]).toMatchObject({ result_version: 1, result_json: { primaryId: first.body.id } });
    expect(JSON.stringify(stored.rows[0].result_json)).not.toContain("Status stable");
  });

  it("rejects changed payload, target, and actor without another mutation", async () => {
    const id = operationId();
    const body = { operationId: id, message: "Original", updateType: "note" };
    await request(app).post(`/api/emergencies/${firstEmergency}/update`)
      .set("Authorization", auth(firstActor, "admin")).send(body).expect(201);
    await request(app).post(`/api/emergencies/${firstEmergency}/update`)
      .set("Authorization", auth(firstActor, "admin")).send({ ...body, message: "Substituted" }).expect(409);
    await request(app).post(`/api/emergencies/${secondEmergency}/update`)
      .set("Authorization", auth(firstActor, "admin")).send(body).expect(409);
    await request(app).post(`/api/emergencies/${firstEmergency}/update`)
      .set("Authorization", auth(secondActor, "admin")).send(body).expect(409);
    expect(await counts(id)).toEqual({ updates: 1, operations: 1 });
  });

  it("validates, authorizes, rolls back, reconciles actor-bound, and permits a new ID", async () => {
    await request(app).post(`/api/emergencies/${firstEmergency}/update`)
      .set("Authorization", auth(firstActor, "admin")).send({ operationId: "bad", message: "" }).expect(400);
    await request(app).post(`/api/emergencies/${firstEmergency}/update`)
      .set("Authorization", auth(parentActor, "parent"))
      .send({ operationId: operationId(), message: "No" }).expect(403);
    const rollbackId = operationId();
    emergencyUpdateRouteDependencies.beforePersist = () => { throw new Error("rollback test"); };
    await request(app).post(`/api/emergencies/${firstEmergency}/update`)
      .set("Authorization", auth(firstActor, "admin"))
      .send({ operationId: rollbackId, message: "Rollback" }).expect(500);
    expect(await counts(rollbackId)).toEqual({ updates: 0, operations: 0 });
    emergencyUpdateRouteDependencies.beforePersist = null;

    const id = operationId();
    await request(app).post(`/api/emergencies/${firstEmergency}/update`)
      .set("Authorization", auth(firstActor, "admin"))
      .send({ operationId: id, message: "Committed" }).expect(201);
    await request(app).get(`/api/emergencies/${firstEmergency}/update-operations/${id}`)
      .set("Authorization", auth(firstActor, "admin")).expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ operationId: id, outcome: "already_applied" }));
    await request(app).get(`/api/emergencies/${firstEmergency}/update-operations/${id}`)
      .set("Authorization", auth(secondActor, "admin")).expect(404);
    await request(app).get(`/api/emergencies/${firstEmergency}/update-operations/${id}`)
      .set("Authorization", auth(parentActor, "parent")).expect(403);

    const newId = operationId();
    await request(app).post(`/api/emergencies/${firstEmergency}/update`)
      .set("Authorization", auth(firstActor, "admin"))
      .send({ operationId: newId, message: "Intentional second update" }).expect(201);
    expect(await counts(newId)).toEqual({ updates: 1, operations: 1 });
  });

  it("survives a real post-commit HTTP socket drop and replays the same ID", async () => {
    const id = operationId();
    const body = { operationId: id, message: "Committed before response loss", updateType: "update" };
    emergencyUpdateRouteDependencies.postCommitBeforeResponse = (_req, res) => res.socket?.destroy();
    await expect(request(app).post(`/api/emergencies/${firstEmergency}/update`)
      .set("Authorization", auth(firstActor, "admin")).send(body)).rejects.toThrow();
    emergencyUpdateRouteDependencies.postCommitBeforeResponse = null;
    expect(await counts(id)).toEqual({ updates: 1, operations: 1 });
    await request(app).post(`/api/emergencies/${firstEmergency}/update`)
      .set("Authorization", auth(firstActor, "admin")).send(body).expect(200)
      .expect(({ body: responseBody }) => expect(responseBody).toMatchObject({
        operationId: id,
        eventId: id,
        outcome: "already_applied",
      }));
    expect(await counts(id)).toEqual({ updates: 1, operations: 1 });
  });
});