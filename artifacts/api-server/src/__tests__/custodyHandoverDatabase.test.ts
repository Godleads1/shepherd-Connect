import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import app from "../app";
import { generateToken } from "../middlewares/auth";
import { acceptPhysicalCustody } from "../services/custodyHandover";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `custody-${Date.now()}`;
const serviceDate = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
let parentId = 0; let otherParentId = 0; let supportId = 0; let otherSupportId = 0; let adminId = 0;
let teacherUserId = 0; let teacherId = 0;
let familyId = 0; let childId = 0; let otherFamilyId = 0; let otherChildId = 0; let firstClassId = 0; let secondClassId = 0;
const token = (id: number, role: "parent" | "support" | "admin") => `Bearer ${generateToken({ userId: id, email: `${prefix}-${id}@test`, role, firstName: "Test", lastName: "User" })}`;
const count = async (table: string, where: ReturnType<typeof sql>) => Number((await db.execute(sql`SELECT count(*)::int count FROM ${sql.identifier(table)} WHERE ${where}`)).rows[0].count);

beforeAll(async () => {
  const users = await db.execute(sql`INSERT INTO users (email,password_hash,first_name,last_name,role,status,is_active) VALUES
    (${`${prefix}-parent@test`},'x','Parent','One','parent','active',true), (${`${prefix}-other@test`},'x','Parent','Other','parent','active',true),
    (${`${prefix}-support@test`},'x','Support','One','support','active',true), (${`${prefix}-support2@test`},'x','Support','Two','support','active',true),
    (${`${prefix}-admin@test`},'x','Admin','One','admin','active',true),
    (${`${prefix}-teacher@test`},'x','Teacher','One','teacher','active',true) RETURNING id,role`);
  const rows = users.rows as Array<{ id: number; role: string }>;
  const parents = rows.filter(x => x.role === "parent");
  const supports = rows.filter(x => x.role === "support");
  parentId = Number(parents[0].id); otherParentId = Number(parents[1].id);
  supportId = Number(supports[0].id); otherSupportId = Number(supports[1].id);
  adminId = Number(rows.find(x => x.role === "admin")!.id);
  teacherUserId = Number(rows.find(x => x.role === "teacher")!.id);
  familyId = Number((await db.execute(sql`INSERT INTO families (family_code,parent_1_id) VALUES (${`FAM-${prefix.slice(-6).toUpperCase()}`},${parentId}) RETURNING id`)).rows[0].id);
  otherFamilyId = Number((await db.execute(sql`INSERT INTO families (family_code,parent_1_id) VALUES (${`OTH-${prefix.slice(-6).toUpperCase()}`},${otherParentId}) RETURNING id`)).rows[0].id);
  firstClassId = Number((await db.execute(sql`INSERT INTO classes (name,age_min,age_max,capacity,room_location,service_slot) VALUES (${`${prefix}-first`},1,12,20,'A','7am') RETURNING id`)).rows[0].id);
  secondClassId = Number((await db.execute(sql`INSERT INTO classes (name,age_min,age_max,capacity,room_location,service_slot) VALUES (${`${prefix}-second`},1,12,20,'B','10:30am') RETURNING id`)).rows[0].id);
  childId = Number((await db.execute(sql`INSERT INTO children (family_id,first_name,last_name,dob,gender,current_class_id) VALUES (${familyId},'Child','One','2020-01-01','female',${firstClassId}) RETURNING id`)).rows[0].id);
  otherChildId = Number((await db.execute(sql`INSERT INTO children (family_id,first_name,last_name,dob,gender,current_class_id) VALUES (${otherFamilyId},'Other','Child','2020-01-01','female',${firstClassId}) RETURNING id`)).rows[0].id);
  teacherId = Number((await db.execute(sql`INSERT INTO teachers (user_id) VALUES (${teacherUserId}) RETURNING id`)).rows[0].id);
});
beforeEach(async () => {
  await db.execute(sql`DELETE FROM notification_outbox WHERE domain_type = 'attendance' AND domain_identifier IN (SELECT id::text FROM attendance WHERE child_id=${childId})`);
  await db.execute(sql`DELETE FROM attendance WHERE child_id=${childId}`);
  await db.execute(sql`DELETE FROM pickup_requests WHERE child_id=${childId}`);
  await db.execute(sql`DELETE FROM custody_episode_events WHERE episode_id IN (SELECT id FROM custody_episodes WHERE child_id=${childId})`);
  await db.execute(sql`DELETE FROM custody_episodes WHERE child_id=${childId}`);
  await db.execute(sql`DELETE FROM class_change_requests WHERE child_id IN (${childId},${otherChildId})`);
  await db.execute(sql`DELETE FROM parent_feedback WHERE parent_id IN (${parentId},${otherParentId})`);
});
afterAll(async () => { for (const q of [
  sql`DELETE FROM notification_outbox WHERE recipient_user_id IN (${parentId},${otherParentId},${supportId},${otherSupportId},${adminId},${teacherUserId})`,
  sql`DELETE FROM notifications WHERE user_id IN (${parentId},${otherParentId},${supportId},${otherSupportId},${adminId},${teacherUserId})`,
  sql`DELETE FROM teacher_allocations WHERE teacher_id=${teacherId}`,
  sql`DELETE FROM teachers WHERE id=${teacherId}`,
  sql`DELETE FROM class_merges WHERE source_class_id=${firstClassId} OR target_class_id IN (${firstClassId},${secondClassId})`,
  sql`DELETE FROM pickup_requests WHERE child_id IN (${childId},${otherChildId})`,
  sql`DELETE FROM children WHERE id IN (${childId},${otherChildId})`, sql`DELETE FROM families WHERE id IN (${familyId},${otherFamilyId})`,
  sql`DELETE FROM classes WHERE id IN (${firstClassId},${secondClassId})`, sql`DELETE FROM users WHERE email LIKE ${`${prefix}%`}`,
] ) try { await db.execute(q); } catch {} });

databaseDescribe("custody handover PostgreSQL integrity", () => {
  const createFor = (requestedServices: "first" | "second" | "both", eventId: string) =>
    request(app).post("/api/custody-requests").set("Authorization", token(parentId, "parent"))
      .send({ childId, serviceDate, requestedServices, eventId });
  const create = (eventId: string) => createFor("both", eventId);

  it("enforces parent ownership and idempotent per-child requests", async () => {
    const denied = await request(app).post("/api/custody-requests").set("Authorization", token(otherParentId, "parent"))
      .send({ childId, serviceDate, requestedServices: "first", eventId: "not-owner" });
    expect(denied.status).toBe(403);
    const [first, replay] = await Promise.all([create("request-once"), create("request-once")]);
    expect([first.status, replay.status].sort()).toEqual([200, 201]);
    expect(await count("custody_episodes", sql`child_id=${childId}`)).toBe(1);
  });

  it("notifies a teacher allocated to both divergent merge hosts exactly once", async () => {
    await db.execute(sql`INSERT INTO class_merges (source_class_id,target_class_id,service_date,service_slot,created_by) VALUES
      (${firstClassId},${firstClassId},${serviceDate},'7am',${adminId}),
      (${firstClassId},${secondClassId},${serviceDate},'10:30am',${adminId})`);
    await db.execute(sql`INSERT INTO teacher_allocations (teacher_id,class_id,service_date,service_slot,status) VALUES
      (${teacherId},${firstClassId},${serviceDate},'7am','confirmed'),
      (${teacherId},${secondClassId},${serviceDate},'10:30am','confirmed')`);
    const response = await create("dual-host-notification");
    expect(response.status).toBe(201);
    const episodeId = response.body.episode.id;
    const outbox = await db.execute(sql`SELECT logical_dedup_key FROM notification_outbox
      WHERE domain_type='custody_request' AND domain_identifier=${String(episodeId)} AND recipient_user_id=${teacherUserId}`);
    expect(outbox.rows).toHaveLength(1);
    expect(outbox.rows[0]).toMatchObject({
      logical_dedup_key: `custody-request:${episodeId}:teacher:${teacherUserId}:whatsapp`,
    });
    const notifications = await db.execute(sql`SELECT count(*)::int count FROM notifications
      WHERE user_id=${teacherUserId} AND metadata_json::jsonb->>'episodeId'=${String(episodeId)}`);
    expect(Number(notifications.rows[0].count)).toBe(1);
    await db.execute(sql`DELETE FROM teacher_allocations WHERE teacher_id=${teacherId} AND service_date=${serviceDate}`);
    await db.execute(sql`DELETE FROM class_merges WHERE source_class_id=${firstClassId} AND service_date=${serviceDate}`);
  });

  it("scopes the parent request center and class-change writes to owned children", async () => {
    await request(app).post("/api/class-change-requests").set("Authorization", token(parentId, "parent"))
      .send({ childId: otherChildId, requestedClassId: secondClassId }).expect(403);
    await request(app).post("/api/class-change-requests").set("Authorization", token(parentId, "parent"))
      .send({ childId, currentClassId: secondClassId, requestedClassId: secondClassId, reason: "Age review" }).expect(201);
    await db.execute(sql`UPDATE class_change_requests SET admin_notes='staff-only note' WHERE child_id=${childId}`);
    await db.execute(sql`INSERT INTO parent_feedback (parent_id,service_date,rating,class_experience,teacher_engagement,safety_rating,sentiment_note)
      VALUES (${parentId},${serviceDate},5,5,5,5,'staff-only sentiment'),(${otherParentId},${serviceDate},1,1,1,1,'other-family sentiment')`);

    const center = await request(app).get("/api/parent-requests").set("Authorization", token(parentId, "parent")).expect(200);
    expect(center.body.children.map((child: { id: number }) => child.id)).toEqual([childId]);
    expect(center.body.items.some((item: { requestType: string }) => item.requestType === "class_change")).toBe(true);
    expect(JSON.stringify(center.body)).not.toContain("staff-only");
    expect(JSON.stringify(center.body)).not.toContain("other-family");

    const feedback = await request(app).get("/api/feedback").set("Authorization", token(parentId, "parent")).expect(200);
    expect(feedback.body.total).toBe(1);
    expect(feedback.body.data[0]).not.toHaveProperty("sentimentNote");
  });

  it.each([
    ["first", "7am", "First Service"],
    ["second", "10:30am", "Second Service"],
  ] as const)("preserves %s-service custody scope and names its authoritative checkout occurrence", async (requestedServices, serviceSlot, serviceName) => {
    const requested = await createFor(requestedServices, `scope-${requestedServices}`);
    expect(requested.status).toBe(201);
    const episodeId = requested.body.episode.id;
    await request(app).post("/api/custody-episodes").set("Authorization", token(supportId, "support"))
      .send({ episodeId, eventId: `accept-${requestedServices}` }).expect(201);

    const active = await db.execute(sql`
      SELECT id,service_slot,status FROM attendance WHERE custody_episode_id=${episodeId}
    `);
    expect(active.rows).toEqual([
      expect.objectContaining({ service_slot: serviceSlot, status: "in_class" }),
    ]);

    await request(app).post(`/api/custody-episodes/${episodeId}/pickup`)
      .set("Authorization", token(supportId, "support"))
      .expect(200);
    expect(await count("attendance", sql`custody_episode_id=${episodeId} AND service_slot=${serviceSlot} AND status='picked_up'`)).toBe(1);
    expect(await count("attendance", sql`custody_episode_id=${episodeId}`)).toBe(1);

    const notifications = await db.execute(sql`
      SELECT message,metadata_json FROM notifications
      WHERE user_id=${parentId}
        AND type='child_picked_up'
        AND metadata_json::jsonb->>'attendanceId' IN (
          SELECT id::text FROM attendance WHERE custody_episode_id=${episodeId}
        )
    `);
    expect(notifications.rows).toHaveLength(1);
    expect(String(notifications.rows[0].message)).toContain(`checked out from ${serviceName}`);
    expect(JSON.parse(String((notifications.rows[0] as any).metadata_json))).toMatchObject({ serviceSlot });
  });

  it("accepts both services once, immediately marks class attendance, and preserves custody through checkout races", async () => {
    const requested = await create("accept-both");
    const episodeId = requested.body.episode.id;
    await expect(db.transaction(async tx => {
      await acceptPhysicalCustody(tx, { episodeId, custodianUserId: supportId });
      throw new Error("force custody rollback");
    })).rejects.toThrow("force custody rollback");
    expect(await count("attendance", sql`custody_episode_id=${episodeId}`)).toBe(0);
    expect(await count("notification_outbox", sql`domain_type='attendance' AND domain_identifier IN (SELECT id::text FROM attendance WHERE custody_episode_id=${episodeId})`)).toBe(0);
    const accept = (id: number, eventId: string) => request(app).post("/api/custody-episodes").set("Authorization", token(id, "support")).send({ episodeId, eventId });
    const replies = await Promise.all([accept(supportId, "support-one"), accept(otherSupportId, "support-two")]);
    expect(replies.map(r => r.status).sort()).toEqual([201, 403]);
    const attendance = await db.execute(sql`SELECT a.class_id,a.status,a.custody_episode_id,a.service_slot,c.service_slot assigned_slot FROM attendance a JOIN classes c ON c.id=a.class_id WHERE a.child_id=${childId} ORDER BY a.service_slot`);
    expect(attendance.rows).toHaveLength(2);
    expect(attendance.rows.map((r: any) => r.status)).toEqual(["in_class", "in_class"]);
    expect(attendance.rows.map((r: any) => r.service_slot).sort()).toEqual(["10:30am", "7am"]);
    expect(new Set(attendance.rows.map((r: any) => r.class_id)).size).toBe(1);
    expect(new Set(attendance.rows.map((r: any) => r.custody_episode_id))).toEqual(new Set([episodeId]));
    const episode = (await db.execute(sql`SELECT custodian_user_id FROM custody_episodes WHERE id=${episodeId}`)).rows[0] as any;
    expect([supportId, otherSupportId]).toContain(Number(episode.custodian_user_id));
    const wrongSupport = episode.custodian_user_id === supportId ? otherSupportId : supportId;
    await db.execute(sql`INSERT INTO pickup_requests
      (child_id,class_id,service_date,requested_by,child_name,parent_name,class_name,status)
      VALUES (${childId},${firstClassId},${serviceDate},${parentId},'Child One','Parent One',${prefix},'requested')`);
    expect((await request(app).post(`/api/custody-episodes/${episodeId}/pickup`).set("Authorization", token(wrongSupport, "support"))).status).toBe(403);
    expect(await count("pickup_requests", sql`child_id=${childId} AND status='requested'`)).toBe(1);
    const winner = Number(episode.custodian_user_id);
    await Promise.all([
      request(app).post(`/api/custody-episodes/${episodeId}/pickup`).set("Authorization", token(winner, "support")),
      request(app).post(`/api/custody-episodes/${episodeId}/override-pickup`).set("Authorization", token(adminId, "admin")).send({ reason: "Duty manager verified pickup" }),
    ]);
    const closed = (await db.execute(sql`SELECT status,custodian_user_id,checkout_mode,override_reason FROM custody_episodes WHERE id=${episodeId}`)).rows[0] as any;
    expect(closed.status).toBe("picked_up"); expect(Number(closed.custodian_user_id)).toBe(winner);
    expect(await count("pickup_requests", sql`child_id=${childId} AND status='resolved'`)).toBe(1);
    expect(await count("notification_outbox", sql`domain_type='attendance' AND domain_identifier IN (SELECT id::text FROM attendance WHERE custody_episode_id=${episodeId})`)).toBe(12);
    const pickupMessages = (await db.execute(sql`
      SELECT message,metadata_json FROM notifications
      WHERE user_id=${parentId}
        AND type='child_picked_up'
        AND metadata_json::jsonb->>'attendanceId' IN (
          SELECT id::text FROM attendance WHERE custody_episode_id=${episodeId}
        )
      ORDER BY metadata_json::jsonb->>'serviceSlot'
    `)).rows as Array<{ message: string; metadata_json: string }>;
    expect(pickupMessages).toHaveLength(2);
    expect(pickupMessages.map(row => JSON.parse(row.metadata_json).serviceSlot).sort()).toEqual(["10:30am", "7am"]);
    expect(pickupMessages.map(row => row.message)).toEqual(expect.arrayContaining([
      expect.stringContaining("checked out from First Service"),
      expect.stringContaining("checked out from Second Service"),
    ]));
    expect(pickupMessages.every(row => !row.message.includes("pickup request"))).toBe(true);
    const next = await request(app).post("/api/custody-requests").set("Authorization", token(parentId, "parent"))
      .send({ childId, serviceDate, requestedServices: "first", eventId: "return-after-pickup" });
    expect(next.status).toBe(201);
    expect(next.body.episode.id).not.toBe(episodeId);
    const nextAcceptance = await request(app).post("/api/custody-episodes").set("Authorization", token(supportId, "support"))
      .send({ episodeId: next.body.episode.id, eventId: "return-acceptance" });
    expect(nextAcceptance.status).toBe(201);
    expect(await count("attendance", sql`custody_episode_id=${next.body.episode.id} AND status='in_class'`)).toBe(1);
  });

  it("requires an admin reason and records an override without replacing the custodian", async () => {
    const requested = await create("admin-override");
    const episodeId = requested.body.episode.id;
    await request(app).post("/api/custody-episodes").set("Authorization", token(supportId, "support"))
      .send({ episodeId, eventId: "admin-override-accept" }).expect(201);
    await request(app).post(`/api/custody-episodes/${episodeId}/override-pickup`).set("Authorization", token(adminId, "admin"))
      .send({ reason: " " }).expect(400);
    await request(app).post(`/api/custody-episodes/${episodeId}/override-pickup`).set("Authorization", token(adminId, "admin"))
      .send({ reason: "Verified parent identity at desk" }).expect(200);
    const row = (await db.execute(sql`SELECT custodian_user_id,checkout_mode,override_reason,overridden_by FROM custody_episodes WHERE id=${episodeId}`)).rows[0] as any;
    expect(Number(row.custodian_user_id)).toBe(supportId);
    expect(row.checkout_mode).toBe("admin_override");
    expect(row.override_reason).toBe("Verified parent identity at desk");
    expect(Number(row.overridden_by)).toBe(adminId);
  });

  it("routes legacy attendance checkout through the custody episode rather than closing one row", async () => {
    const requested = await create("legacy-checkout");
    const episodeId = requested.body.episode.id;
    await request(app).post("/api/custody-episodes").set("Authorization", token(supportId, "support"))
      .send({ episodeId, eventId: "legacy-checkout-accept" }).expect(201);
    const attendance = (await db.execute(sql`SELECT id FROM attendance WHERE custody_episode_id=${episodeId} ORDER BY id LIMIT 1`)).rows[0] as any;

    // The legacy endpoint cannot provide an override reason, so an admin is
    // directed to the explicit custody override endpoint instead.
    await request(app).put(`/api/attendance/${attendance.id}/checkout`).set("Authorization", token(adminId, "admin"))
      .send({ operationId: randomUUID() }).expect(409);
    const operationId = randomUUID();
    const checkout = await request(app).put(`/api/attendance/${attendance.id}/checkout`).set("Authorization", token(supportId, "support"))
      .send({ operationId }).expect(200);
    const replay = await request(app).put(`/api/attendance/${attendance.id}/checkout`).set("Authorization", token(supportId, "support"))
      .send({ operationId }).expect(200);

    const episode = (await db.execute(sql`SELECT status,checkout_mode,picked_up_by FROM custody_episodes WHERE id=${episodeId}`)).rows[0] as any;
    expect(checkout.body).toMatchObject({
      outcome: "applied",
      alreadyApplied: false,
      attendance: { id: Number(attendance.id), status: "picked_up" },
    });
    expect(replay.body).toMatchObject({
      operationId,
      outcome: "already_applied",
      alreadyApplied: true,
      attendance: {
        id: Number(attendance.id),
        status: "picked_up",
        checkOutTime: checkout.body.attendance.checkOutTime,
        checkedOutBy: supportId,
      },
      resolvedPickupRequestIds: checkout.body.resolvedPickupRequestIds,
    });
    expect(episode.status).toBe("picked_up");
    expect(episode.checkout_mode).toBe("normal");
    expect(Number(episode.picked_up_by)).toBe(supportId);
    expect(await count("attendance", sql`custody_episode_id=${episodeId} AND status='picked_up'`)).toBe(2);
  });
});