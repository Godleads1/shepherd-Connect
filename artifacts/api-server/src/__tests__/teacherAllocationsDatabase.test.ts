import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import app from "../app";
import { generateToken } from "../middlewares/auth";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `allocation-boundary-${Date.now()}`;
const triggerSuffix = String(Date.now());
const triggerFunction = `fail_allocation_outbox_${triggerSuffix}`;
const triggerName = `fail_allocation_outbox_trigger_${triggerSuffix}`;
const dates = ["2098-01-04", "2098-01-11", "2098-01-18"] as const;
let adminId = 0;
let teacherUserId = 0;
let secondTeacherUserId = 0;
let teacherId = 0;
let secondTeacherId = 0;
let classId = 0;
let secondClassId = 0;
let authorization = "";

beforeAll(async () => {
  classId = Number((await db.execute(sql`
    INSERT INTO classes (name, age_min, age_max, capacity, room_location, service_slot)
    VALUES (${`${prefix}-one`}, 1, 12, 100, 'A', '7am') RETURNING id
  `)).rows[0].id);
  secondClassId = Number((await db.execute(sql`
    INSERT INTO classes (name, age_min, age_max, capacity, room_location, service_slot)
    VALUES (${`${prefix}-two`}, 1, 12, 100, 'B', '10:30am') RETURNING id
  `)).rows[0].id);
  const users = (await db.execute(sql`
    INSERT INTO users (email, password_hash, first_name, last_name, role, status, is_active, primary_class_id)
    VALUES
      (${`${prefix}-admin@test`}, 'x', 'Allocation', 'Admin', 'admin', 'active', true, null),
      (${`${prefix}-teacher@test`}, 'x', 'Allocation', 'Teacher', 'teacher', 'active', true, ${classId}),
      (${`${prefix}-teacher2@test`}, 'x', 'Second', 'Teacher', 'teacher', 'active', true, ${secondClassId})
    RETURNING id, role, email
  `)).rows as Array<{ id: number; role: string; email: string }>;
  adminId = Number(users.find(row => row.role === "admin")!.id);
  teacherUserId = Number(users.find(row => row.email.includes("-teacher@test"))!.id);
  secondTeacherUserId = Number(users.find(row => row.email.includes("-teacher2@test"))!.id);
  teacherId = Number((await db.execute(sql`INSERT INTO teachers (user_id) VALUES (${teacherUserId}) RETURNING id`)).rows[0].id);
  secondTeacherId = Number((await db.execute(sql`INSERT INTO teachers (user_id) VALUES (${secondTeacherUserId}) RETURNING id`)).rows[0].id);
  authorization = `Bearer ${generateToken({
    userId: adminId, email: `${prefix}-admin@test`, role: "admin", firstName: "Allocation", lastName: "Admin",
  })}`;
});

afterAll(async () => {
  try {
    await db.execute(sql`DELETE FROM notification_outbox WHERE domain_type = 'teacher_allocation'
      AND domain_identifier IN (SELECT id::text FROM teacher_allocations WHERE service_date IN (${dates[0]}, ${dates[1]}, ${dates[2]}))`);
    await db.execute(sql`DELETE FROM notifications WHERE metadata_json LIKE ${`%${dates[0]}%`}
      OR metadata_json LIKE ${`%${dates[1]}%`} OR metadata_json LIKE ${`%${dates[2]}%`}`);
    await db.execute(sql`DELETE FROM teacher_allocations WHERE service_date IN (${dates[0]}, ${dates[1]}, ${dates[2]})`);
    await db.execute(sql`DELETE FROM teachers WHERE id IN (${teacherId}, ${secondTeacherId})`);
    await db.execute(sql`DELETE FROM users WHERE id IN (${adminId}, ${teacherUserId}, ${secondTeacherUserId})`);
    await db.execute(sql`DELETE FROM classes WHERE id IN (${classId}, ${secondClassId})`);
  } catch {}
});

databaseDescribe("teacher allocation real route/database boundaries", () => {
  it("exercises root create and update with their transactional formatter reads", async () => {
    const created = await request(app).post("/api/teacher-allocations").set("Authorization", authorization).send({
      teacherId, classId, serviceDate: dates[0], serviceSlot: "7am", status: "scheduled",
    }).expect(201);
    expect(created.body.teacher.user.id).toBe(teacherUserId);
    expect(created.body.class.id).toBe(classId);
    const updated = await request(app).put(`/api/teacher-allocations/${created.body.id}`).set("Authorization", authorization)
      .send({ status: "confirmed" }).expect(200);
    expect(updated.body.status).toBe("confirmed");
  });

  it("persists assign-duty allocation and required outbox together", async () => {
    const response = await request(app).post("/api/teacher-allocations/assign-duty").set("Authorization", authorization)
      .send({ serviceDate: dates[1], serviceSlots: ["7am"], teacherIds: [teacherId] }).expect(200);
    expect(response.body.created).toBe(1);
    const outbox = await db.execute(sql`SELECT id FROM notification_outbox
      WHERE domain_type = 'teacher_allocation' AND domain_identifier = ${String(response.body.allocationIds[0])}`);
    expect(outbox.rows).toHaveLength(1);
  });

  it("keeps an earlier assign-duty commit when a later required outbox insert fails", async () => {
    await db.execute(sql.raw(`
      CREATE FUNCTION ${triggerFunction}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.recipient_user_id = ${secondTeacherUserId} THEN
          RAISE EXCEPTION 'injected allocation outbox failure';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER ${triggerName} BEFORE INSERT ON notification_outbox
      FOR EACH ROW EXECUTE FUNCTION ${triggerFunction}();
    `));
    try {
      await request(app).post("/api/teacher-allocations/assign-duty").set("Authorization", authorization)
        .send({ serviceDate: dates[1], serviceSlots: ["10:30am"], teacherIds: [teacherId, secondTeacherId] })
        .expect(500);
      const rows = await db.execute(sql`SELECT teacher_id FROM teacher_allocations
        WHERE service_date = ${dates[1]} AND service_slot = '10:30am'
          AND teacher_id IN (${teacherId}, ${secondTeacherId})`);
      expect(rows.rows).toEqual([{ teacher_id: teacherId }]);
    } finally {
      await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${triggerName} ON notification_outbox;
        DROP FUNCTION IF EXISTS ${triggerFunction}();`));
    }
  });

  it("persists auto-schedule allocations only with required outbox intents", async () => {
    const response = await request(app).post("/api/teacher-allocations/auto-schedule").set("Authorization", authorization)
      .send({ serviceDate: dates[2], serviceSlots: ["7am"], teachersPerClass: 1 }).expect(200);
    expect(response.body.created).toBeGreaterThan(0);
    const outbox = await db.execute(sql`SELECT id FROM notification_outbox
      WHERE domain_type = 'teacher_allocation' AND domain_identifier IN
        (SELECT id::text FROM teacher_allocations WHERE service_date = ${dates[2]})`);
    expect(outbox.rows.length).toBeGreaterThan(0);
  });

  it("persists swap and unavailable transitions with deterministic required outbox", async () => {
    const allocation = (await db.execute(sql`INSERT INTO teacher_allocations
      (teacher_id, class_id, service_date, service_slot, status)
      VALUES (${teacherId}, ${classId}, ${dates[0]}, '10:30am', 'scheduled') RETURNING id`)).rows[0] as { id: number };
    await request(app).post(`/api/teacher-allocations/${allocation.id}/swap`).set("Authorization", authorization)
      .send({ newTeacherId: secondTeacherId }).expect(200);
    await request(app).post(`/api/teacher-allocations/${allocation.id}/mark-unavailable`).set("Authorization", authorization)
      .send({ reason: "Test" }).expect(200);
    const identities = (await db.execute(sql`SELECT logical_dedup_key FROM notification_outbox
      WHERE domain_type = 'teacher_allocation' AND domain_identifier = ${String(allocation.id)}`)).rows as Array<{ logical_dedup_key: string }>;
    expect(identities.some(row => row.logical_dedup_key.includes(`swap:${teacherId}:to:${secondTeacherId}`))).toBe(true);
    expect(identities.some(row => row.logical_dedup_key.includes("unavailable:scheduled:to:cancelled"))).toBe(true);
  });
});