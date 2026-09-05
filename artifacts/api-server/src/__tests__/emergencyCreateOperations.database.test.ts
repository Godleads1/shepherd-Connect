import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import { generateToken } from "../middlewares/auth";
import { emergencyCreateRouteDependencies } from "../routes/emergencies";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `emergency-create-operation-${Date.now()}`;
let firstActor = 0;
let secondActor = 0;
let parentActor = 0;
const operationId = () => crypto.randomUUID();
const auth = (userId: number, role: string) => `Bearer ${generateToken({
  userId, role, email: `${prefix}-${userId}@test`, firstName: "Emergency", lastName: "Tester",
})}`;
const body = (id: string, changes: Record<string, unknown> = {}) => ({
  operationId: id, type: "medical", level: "L1", description: `${prefix} incident`, ...changes,
});

async function counts(id: string) {
  const rows = await db.execute(sql`
    WITH op AS (
      SELECT (result_json->>'primaryId')::int AS emergency_id
      FROM command_operations WHERE operation_id=${id}::uuid
    )
    SELECT
      (SELECT count(*)::int FROM emergencies WHERE id=(SELECT emergency_id FROM op)) AS emergencies,
      (SELECT count(*)::int FROM emergency_updates WHERE emergency_id=(SELECT emergency_id FROM op)) AS updates,
      (SELECT count(DISTINCT domain_identifier)::int FROM notification_outbox
       WHERE domain_type='emergency' AND domain_identifier=(SELECT emergency_id::text || ':L1' FROM op)) AS logical_outbox,
      (SELECT count(*)::int FROM command_operations WHERE operation_id=${id}::uuid) AS operations
  `);
  return rows.rows[0] as { emergencies: number; updates: number; logical_outbox: number; operations: number };
}

async function cleanup() {
  await db.execute(sql`
    DELETE FROM notification_outbox o USING emergencies e
    WHERE o.domain_type='emergency' AND o.domain_identifier=e.id::text || ':L1'
      AND e.description LIKE ${`${prefix}%`}
  `);
  await db.execute(sql`
    DELETE FROM notifications n USING emergencies e
    WHERE n.type='emergency_alert' AND n.metadata_json LIKE ('%"emergencyId":' || e.id::text || ',%')
      AND e.description LIKE ${`${prefix}%`}
  `);
  await db.execute(sql`DELETE FROM emergency_updates WHERE emergency_id IN (SELECT id FROM emergencies WHERE description LIKE ${`${prefix}%`})`);
  await db.execute(sql`DELETE FROM command_operations WHERE command='emergency_create' AND actor_user_id IN (${firstActor}, ${secondActor})`);
  await db.execute(sql`DELETE FROM emergencies WHERE description LIKE ${`${prefix}%`}`);
}

beforeAll(async () => {
  const users = await db.execute(sql`
    INSERT INTO users (email,password_hash,first_name,last_name,role,status,is_active)
    VALUES (${`${prefix}-one@test`},'x','First','Admin','admin','active',true),
           (${`${prefix}-two@test`},'x','Second','Admin','admin','active',true),
           (${`${prefix}-parent@test`},'x','Parent','User','parent','active',true)
    RETURNING id
  `);
  firstActor = Number(users.rows[0].id);
  secondActor = Number(users.rows[1].id);
  parentActor = Number(users.rows[2].id);
});

beforeEach(async () => {
  emergencyCreateRouteDependencies.beforePersist = null;
  emergencyCreateRouteDependencies.requiredOutboxFailure = null;
  emergencyCreateRouteDependencies.postCommitBeforeResponse = null;
  await cleanup();
});

afterAll(async () => {
  emergencyCreateRouteDependencies.beforePersist = null;
  emergencyCreateRouteDependencies.requiredOutboxFailure = null;
  emergencyCreateRouteDependencies.postCommitBeforeResponse = null;
  await cleanup();
  await db.execute(sql`DELETE FROM users WHERE id IN (${firstActor}, ${secondActor}, ${parentActor})`);
});

databaseDescribe("emergency create command operations", () => {
  it("applies once, sequentially/concurrently replays, and creates one emergency, audit, and logical outbox effect", async () => {
    const id = operationId();
    const first = await request(app).post("/api/emergencies").set("Authorization", auth(firstActor, "admin")).send(body(id)).expect(201);
    expect(first.body).toMatchObject({ operationId: id, outcome: "applied" });
    await request(app).post("/api/emergencies").set("Authorization", auth(firstActor, "admin")).send(body(id)).expect(200)
      .expect(({ body: response }) => expect(response).toMatchObject({ id: first.body.id, outcome: "already_applied" }));
    expect(await counts(id)).toEqual({ emergencies: 1, updates: 1, logical_outbox: 1, operations: 1 });

    const concurrentId = operationId();
    const pair = await Promise.all([
      request(app).post("/api/emergencies").set("Authorization", auth(firstActor, "admin")).send(body(concurrentId)),
      request(app).post("/api/emergencies").set("Authorization", auth(firstActor, "admin")).send(body(concurrentId)),
    ]);
    expect(pair.map(response => response.status).sort()).toEqual([200, 201]);
    expect(await counts(concurrentId)).toEqual({ emergencies: 1, updates: 1, logical_outbox: 1, operations: 1 });
  });

  it("rejects payload, target, and actor collisions without another mutation", async () => {
    const id = operationId();
    await request(app).post("/api/emergencies").set("Authorization", auth(firstActor, "admin")).send(body(id)).expect(201);
    await request(app).post("/api/emergencies").set("Authorization", auth(firstActor, "admin")).send(body(id, { description: `${prefix} substituted` })).expect(409);
    await request(app).post("/api/emergencies").set("Authorization", auth(firstActor, "admin")).send(body(id, { childId: 999999 })).expect(409);
    await request(app).post("/api/emergencies").set("Authorization", auth(secondActor, "admin")).send(body(id)).expect(409);
    expect(await counts(id)).toEqual({ emergencies: 1, updates: 1, logical_outbox: 1, operations: 1 });
  });

  it("validates, authorizes, rolls back required intent, reconciles actor-bound, and allows an intentional new ID", async () => {
    await request(app).post("/api/emergencies").set("Authorization", auth(firstActor, "admin"))
      .send({ ...body(operationId()), operationId: "bad" }).expect(400);
    await request(app).post("/api/emergencies").set("Authorization", auth(parentActor, "parent")).send(body(operationId())).expect(403);
    const rollbackId = operationId();
    // This seam is after the required broadcast/outbox intent is written but
    // before commit, proving required-outbox failure rolls all effects back.
    emergencyCreateRouteDependencies.requiredOutboxFailure = () => { throw new Error("required outbox rollback"); };
    await request(app).post("/api/emergencies").set("Authorization", auth(firstActor, "admin")).send(body(rollbackId)).expect(500);
    expect(await counts(rollbackId)).toEqual({ emergencies: 0, updates: 0, logical_outbox: 0, operations: 0 });
    emergencyCreateRouteDependencies.requiredOutboxFailure = null;

    const id = operationId();
    await request(app).post("/api/emergencies").set("Authorization", auth(firstActor, "admin")).send(body(id)).expect(201);
    await request(app).get(`/api/emergencies/operations/${id}`).set("Authorization", auth(firstActor, "admin")).expect(200);
    await request(app).get(`/api/emergencies/operations/${id}`).set("Authorization", auth(secondActor, "admin")).expect(404);
    await request(app).get(`/api/emergencies/operations/${id}`).set("Authorization", auth(parentActor, "parent")).expect(403);
    const newId = operationId();
    await request(app).post("/api/emergencies").set("Authorization", auth(firstActor, "admin")).send(body(newId)).expect(201);
    expect(await counts(newId)).toEqual({ emergencies: 1, updates: 1, logical_outbox: 1, operations: 1 });
  });

  it("survives a real post-commit socket drop and same-ID replay without duplicate effects", async () => {
    const id = operationId();
    emergencyCreateRouteDependencies.postCommitBeforeResponse = (_req, res) => res.socket?.destroy();
    await expect(request(app).post("/api/emergencies").set("Authorization", auth(firstActor, "admin")).send(body(id))).rejects.toThrow();
    emergencyCreateRouteDependencies.postCommitBeforeResponse = null;
    expect(await counts(id)).toEqual({ emergencies: 1, updates: 1, logical_outbox: 1, operations: 1 });
    await request(app).post("/api/emergencies").set("Authorization", auth(firstActor, "admin")).send(body(id)).expect(200);
    expect(await counts(id)).toEqual({ emergencies: 1, updates: 1, logical_outbox: 1, operations: 1 });
  });
});