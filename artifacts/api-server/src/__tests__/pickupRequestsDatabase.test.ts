import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import app from "../app";
import { generateToken } from "../middlewares/auth";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `pickup-db-${Date.now()}`;
let parentId = 0; let otherParentId = 0; let supportId = 0; let otherSupportId = 0; let familyId = 0; let otherFamilyId = 0;
let childId = 0; let otherChildId = 0; let classId = 0;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const token = (id: number, role: "parent" | "support" = "parent") =>
  `Bearer ${generateToken({ userId: id, email: `${prefix}-${id}@test`, role, firstName: "Test", lastName: role === "support" ? "Support" : "Parent" })}`;

beforeAll(async () => {
  const users = await db.execute(sql`INSERT INTO users (email,password_hash,first_name,last_name,role,status,is_active) VALUES
    (${`${prefix}-one@test`},'x','Parent','One','parent','active',true),
    (${`${prefix}-two@test`},'x','Parent','Two','parent','active',true),
    (${`${prefix}-support@test`},'x','Test','Support','support','active',true),
    (${`${prefix}-other-support@test`},'x','Other','Support','support','active',true) RETURNING id`);
  parentId = Number(users.rows[0].id); otherParentId = Number(users.rows[1].id);
  supportId = Number(users.rows[2].id);
  otherSupportId = Number(users.rows[3].id);
  familyId = Number((await db.execute(sql`INSERT INTO families (family_code,parent_1_id) VALUES (${`PK-${prefix.slice(-6)}`},${parentId}) RETURNING id`)).rows[0].id);
  otherFamilyId = Number((await db.execute(sql`INSERT INTO families (family_code,parent_1_id) VALUES (${`PO-${prefix.slice(-6)}`},${otherParentId}) RETURNING id`)).rows[0].id);
  classId = Number((await db.execute(sql`INSERT INTO classes (name,age_min,age_max,capacity,room_location,service_slot) VALUES (${prefix},1,12,30,'Room','7am') RETURNING id`)).rows[0].id);
  childId = Number((await db.execute(sql`INSERT INTO children (family_id,first_name,last_name,dob,gender,current_class_id) VALUES (${familyId},'Owned','Child','2020-01-01','female',${classId}) RETURNING id`)).rows[0].id);
  otherChildId = Number((await db.execute(sql`INSERT INTO children (family_id,first_name,last_name,dob,gender,current_class_id) VALUES (${otherFamilyId},'Other','Child','2020-01-01','female',${classId}) RETURNING id`)).rows[0].id);
});

beforeEach(async () => {
  await db.execute(sql`DELETE FROM pickup_requests WHERE child_id IN (${childId},${otherChildId})`);
  await db.execute(sql`DELETE FROM attendance WHERE child_id IN (${childId},${otherChildId})`);
  await db.execute(sql`INSERT INTO attendance (child_id,class_id,service_date,service_slot,status) VALUES
    (${childId},${classId},${today},'7am','in_class')`);
});

afterAll(async () => {
  for (const query of [
    sql`DELETE FROM pickup_requests WHERE child_id IN (${childId},${otherChildId})`,
    sql`DELETE FROM attendance WHERE child_id IN (${childId},${otherChildId})`,
    sql`DELETE FROM custody_episodes WHERE child_id IN (${childId},${otherChildId})`,
    sql`DELETE FROM children WHERE id IN (${childId},${otherChildId})`,
    sql`DELETE FROM families WHERE id IN (${familyId},${otherFamilyId})`,
    sql`DELETE FROM classes WHERE id=${classId}`,
    sql`DELETE FROM users WHERE email LIKE ${`${prefix}%`}`,
  ]) try { await db.execute(query); } catch {}
});

databaseDescribe("pickup request PostgreSQL persistence", () => {
  it("accepts pickup when the first attendance is picked up and a second is active", async () => {
    await db.execute(sql`DELETE FROM attendance WHERE child_id=${childId}`);
    await db.execute(sql`
      INSERT INTO attendance
        (child_id,class_id,service_date,service_slot,status,check_in_time,check_out_time,checked_out_by)
      VALUES
        (${childId},${classId},${today},'7am','picked_up',now() - interval '2 hours',now() - interval '90 minutes',${supportId}),
        (${childId},${classId},${today},'10:30am','in_class',now() - interval '1 hour',NULL,NULL)
    `);

    const pickup = await request(app).post("/api/pickup-requests")
      .set("Authorization", token(parentId))
      .send({ childId })
      .expect(200);

    expect(pickup.body).toMatchObject({
      duplicate: false,
      request: { childId, classId },
    });
    expect((await db.execute(sql`
      SELECT count(*)::int AS count FROM pickup_requests
      WHERE child_id=${childId} AND service_date=${today} AND status='requested'
    `)).rows[0]).toMatchObject({ count: 1 });

    const second = (await db.execute(sql`
      SELECT id FROM attendance
      WHERE child_id=${childId} AND service_date=${today} AND service_slot='10:30am'
    `)).rows[0] as { id: number };
    await request(app).put(`/api/attendance/${second.id}/checkout`)
      .set("Authorization", token(supportId, "support"))
      .send({ operationId: randomUUID() })
      .expect(200);
    const statuses = await db.execute(sql`
      SELECT service_slot,status FROM attendance
      WHERE child_id=${childId} AND service_date=${today}
      ORDER BY service_slot
    `);
    expect(statuses.rows).toEqual([
      expect.objectContaining({ service_slot: "10:30am", status: "picked_up" }),
      expect.objectContaining({ service_slot: "7am", status: "picked_up" }),
    ]);
    const [notification] = (await db.execute(sql`
      SELECT message FROM notifications
      WHERE user_id=${parentId}
        AND type='child_picked_up'
        AND metadata_json::jsonb->>'attendanceId'=${String(second.id)}
    `)).rows as Array<{ message: string }>;
    expect(notification.message).toContain("checked out from Second Service");
  });

  it("accepts pickup when the second attendance is picked up and the first is active", async () => {
    await db.execute(sql`DELETE FROM attendance WHERE child_id=${childId}`);
    await db.execute(sql`
      INSERT INTO attendance
        (child_id,class_id,service_date,service_slot,status,check_in_time,check_out_time,checked_out_by)
      VALUES
        (${childId},${classId},${today},'10:30am','picked_up',now() - interval '2 hours',now() - interval '90 minutes',${supportId}),
        (${childId},${classId},${today},'7am','in_class',now() - interval '1 hour',NULL,NULL)
    `);

    await request(app).post("/api/pickup-requests")
      .set("Authorization", token(parentId))
      .send({ childId })
      .expect(200);
    const first = (await db.execute(sql`
      SELECT id FROM attendance
      WHERE child_id=${childId} AND service_date=${today} AND service_slot='7am'
    `)).rows[0] as { id: number };
    const checkout = await request(app).put(`/api/attendance/${first.id}/checkout`)
      .set("Authorization", token(supportId, "support"))
      .send({ operationId: randomUUID() })
      .expect(200);

    expect(checkout.body.attendance).toMatchObject({
      id: Number(first.id),
      serviceSlot: "7am",
      status: "picked_up",
    });
    const [notification] = (await db.execute(sql`
      SELECT message FROM notifications
      WHERE user_id=${parentId}
        AND type='child_picked_up'
        AND metadata_json::jsonb->>'attendanceId'=${String(first.id)}
    `)).rows as Array<{ message: string }>;
    expect(notification.message).toContain("checked out from First Service");
  });

  it("rejects pickup when both service occurrences are active and no pickup granularity rule exists", async () => {
    await db.execute(sql`
      INSERT INTO attendance (child_id,class_id,service_date,service_slot,status)
      VALUES (${childId},${classId},${today},'10:30am','in_class')
    `);

    const pickup = await request(app).post("/api/pickup-requests")
      .set("Authorization", token(parentId))
      .send({ childId })
      .expect(409);

    expect(pickup.body.message).toBe("Multiple active service attendances require staff assistance");
    expect((await db.execute(sql`
      SELECT count(*)::int AS count FROM pickup_requests
      WHERE child_id=${childId} AND service_date=${today} AND status='requested'
    `)).rows[0]).toMatchObject({ count: 0 });
  });

  it("has one durable active request under concurrent parent retries", async () => {
    const create = () => request(app).post("/api/pickup-requests").set("Authorization", token(parentId)).send({ childId });
    const replies = await Promise.all([create(), create(), create(), create()]);
    expect(replies.every(reply => reply.status === 200)).toBe(true);
    expect(replies.filter(reply => reply.body.duplicate).length).toBe(3);
    const rows = await db.execute(sql`SELECT id,status,requested_by,service_date FROM pickup_requests WHERE child_id=${childId}`);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ status: "requested", requested_by: parentId, service_date: today });
  });

  it("returns the authoritative checkout result and resolves the pickup request", async () => {
    const pickup = await request(app).post("/api/pickup-requests")
      .set("Authorization", token(parentId))
      .send({ childId })
      .expect(200);
    const attendance = (await db.execute(sql`
      SELECT id FROM attendance WHERE child_id=${childId} AND service_date=${today}
    `)).rows[0] as { id: number };

    const checkout = await request(app).put(`/api/attendance/${attendance.id}/checkout`)
      .set("Authorization", token(supportId, "support"))
      .send({ operationId: randomUUID() })
      .expect(200);

    expect(checkout.body).toMatchObject({
      outcome: "applied",
      alreadyApplied: false,
      attendance: { id: Number(attendance.id), status: "picked_up" },
      resolvedPickupRequestIds: [Number(pickup.body.request.id)],
    });
    const [resolved] = (await db.execute(sql`
      SELECT status,resolved_by FROM pickup_requests WHERE id=${pickup.body.request.id}
    `)).rows as Array<{ status: string; resolved_by: number }>;
    expect(resolved).toMatchObject({ status: "resolved", resolved_by: supportId });
  });

  it("returns already_applied for a duplicate checkout without creating invalid state", async () => {
    const attendance = (await db.execute(sql`
      SELECT id FROM attendance WHERE child_id=${childId} AND service_date=${today}
    `)).rows[0] as { id: number };
    const checkout = () => request(app).put(`/api/attendance/${attendance.id}/checkout`)
      .set("Authorization", token(supportId, "support"))
      .send({ operationId: randomUUID() });

    const first = await checkout().expect(200);
    const second = await checkout().expect(200);

    expect(first.body).toMatchObject({ outcome: "applied", alreadyApplied: false });
    expect(second.body).toMatchObject({
      outcome: "already_applied",
      alreadyApplied: true,
      attendance: { id: Number(attendance.id), status: "picked_up" },
      resolvedPickupRequestIds: [],
    });
    const rows = await db.execute(sql`SELECT id,status FROM attendance WHERE id=${attendance.id}`);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ status: "picked_up" });
  });

  it("never leaves an active pickup request when request creation races checkout", async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await db.execute(sql`DELETE FROM pickup_requests WHERE child_id=${childId}`);
      await db.execute(sql`DELETE FROM attendance WHERE child_id=${childId}`);
      const attendance = (await db.execute(sql`
        INSERT INTO attendance (child_id,class_id,service_date,service_slot,status)
        VALUES (${childId},${classId},${today},'both','in_class')
        RETURNING id
      `)).rows[0] as { id: number };

      const pickup = request(app).post("/api/pickup-requests")
        .set("Authorization", token(parentId))
        .send({ childId });
      await new Promise(resolve => setTimeout(resolve, attempt + 1));
      const checkout = request(app).put(`/api/attendance/${attendance.id}/checkout`)
        .set("Authorization", token(supportId, "support"))
        .send({ operationId: randomUUID() });

      const [pickupReply, checkoutReply] = await Promise.all([pickup, checkout]);
      expect([200, 400]).toContain(pickupReply.status);
      expect(checkoutReply.status).toBe(200);
      expect(checkoutReply.body.attendance.status).toBe("picked_up");
      const active = await db.execute(sql`
        SELECT id FROM pickup_requests
        WHERE child_id=${childId} AND service_date=${today} AND status='requested'
      `);
      expect(active.rows).toHaveLength(0);
    }
  });

  it("recovers a discarded response with the same operation result and no duplicate effects", async () => {
    const pickup = await request(app).post("/api/pickup-requests")
      .set("Authorization", token(parentId))
      .send({ childId })
      .expect(200);
    const attendance = (await db.execute(sql`
      SELECT id FROM attendance WHERE child_id=${childId} AND service_date=${today}
    `)).rows[0] as { id: number };
    const operationId = randomUUID();

    // The response is deliberately not read, simulating a client that lost it
    // after the server committed the transaction.
    await request(app).put(`/api/attendance/${attendance.id}/checkout`)
      .set("Authorization", token(supportId, "support"))
      .send({ operationId })
      .expect(200);
    const committed = (await db.execute(sql`
      SELECT check_out_time,checked_out_by FROM attendance WHERE id=${attendance.id}
    `)).rows[0] as { check_out_time: Date; checked_out_by: number };
    const intentsAfterCommit = (await db.execute(sql`
      SELECT count(*)::int AS count FROM notification_outbox
      WHERE domain_type='attendance' AND domain_identifier=${String(attendance.id)}
    `)).rows[0] as { count: number };

    const reconciled = await request(app)
      .get(`/api/attendance/${attendance.id}/checkout-operations/${operationId}`)
      .set("Authorization", token(supportId, "support"))
      .expect(200);
    const retried = await request(app).put(`/api/attendance/${attendance.id}/checkout`)
      .set("Authorization", token(supportId, "support"))
      .send({ operationId })
      .expect(200);

    for (const recovered of [reconciled, retried]) {
      expect(recovered.body).toMatchObject({
        operationId,
        outcome: "already_applied",
        alreadyApplied: true,
        attendance: {
          id: Number(attendance.id),
          status: "picked_up",
          checkedOutBy: supportId,
          checkOutTime: new Date(committed.check_out_time).toISOString(),
        },
        resolvedPickupRequestIds: [Number(pickup.body.request.id)],
      });
    }
    expect((await db.execute(sql`
      SELECT count(*)::int AS count FROM checkout_operations WHERE operation_id=${operationId}
    `)).rows[0]).toMatchObject({ count: 1 });
    const storedResult = (await db.execute(sql`
      SELECT authoritative_result FROM checkout_operations WHERE operation_id=${operationId}
    `)).rows[0] as { authoritative_result: Record<string, any> };
    expect(Object.keys(storedResult.authoritative_result).sort()).toEqual([
      "alreadyApplied",
      "attendance",
      "operationId",
      "outcome",
      "resolvedPickupRequestIds",
    ]);
    expect(Object.keys(storedResult.authoritative_result.attendance).sort()).toEqual([
      "checkInTime",
      "checkOutTime",
      "checkedInBy",
      "checkedOutBy",
      "childId",
      "classId",
      "escortTime",
      "escortedBy",
      "id",
      "serviceDate",
      "serviceSlot",
      "status",
    ]);
    expect(storedResult.authoritative_result.attendance).not.toHaveProperty("child");
    expect(storedResult.authoritative_result.attendance).not.toHaveProperty("class");
    expect(JSON.stringify(storedResult.authoritative_result)).not.toMatch(
      /family|otp|token|medicalNotes|faceDescriptor|photoUrl/i,
    );
    await expect(db.execute(sql`
      UPDATE checkout_operations
      SET authoritative_result = authoritative_result || '{"family":"prohibited"}'::jsonb
      WHERE operation_id=${operationId}
    `)).rejects.toThrow();
    expect((await db.execute(sql`
      SELECT count(*)::int AS count FROM notification_outbox
      WHERE domain_type='attendance' AND domain_identifier=${String(attendance.id)}
    `)).rows[0]).toMatchObject({ count: intentsAfterCommit.count });
    expect((await db.execute(sql`
      SELECT check_out_time,checked_out_by FROM attendance WHERE id=${attendance.id}
    `)).rows[0]).toMatchObject(committed);
  });

  it("serializes concurrent same-operation requests into one durable operation", async () => {
    const attendance = (await db.execute(sql`
      SELECT id FROM attendance WHERE child_id=${childId} AND service_date=${today}
    `)).rows[0] as { id: number };
    const operationId = randomUUID();
    const checkout = () => request(app).put(`/api/attendance/${attendance.id}/checkout`)
      .set("Authorization", token(supportId, "support"))
      .send({ operationId });

    const replies = await Promise.all([checkout(), checkout(), checkout(), checkout()]);
    expect(replies.every(reply => reply.status === 200)).toBe(true);
    expect(replies.filter(reply => reply.body.outcome === "applied")).toHaveLength(1);
    expect(replies.filter(reply => reply.body.outcome === "already_applied")).toHaveLength(3);
    expect(new Set(replies.map(reply => reply.body.attendance.checkOutTime)).size).toBe(1);
    expect((await db.execute(sql`
      SELECT count(*)::int AS count FROM checkout_operations WHERE operation_id=${operationId}
    `)).rows[0]).toMatchObject({ count: 1 });
    expect((await db.execute(sql`
      SELECT count(*)::int AS count FROM notification_outbox
      WHERE domain_type='attendance' AND domain_identifier=${String(attendance.id)}
    `)).rows[0]).toMatchObject({ count: 3 });
  });

  it("records a different operation after checkout without repeating the transition", async () => {
    const attendance = (await db.execute(sql`
      SELECT id FROM attendance WHERE child_id=${childId} AND service_date=${today}
    `)).rows[0] as { id: number };
    const firstOperationId = randomUUID();
    const secondOperationId = randomUUID();
    const first = await request(app).put(`/api/attendance/${attendance.id}/checkout`)
      .set("Authorization", token(supportId, "support"))
      .send({ operationId: firstOperationId })
      .expect(200);
    const second = await request(app).put(`/api/attendance/${attendance.id}/checkout`)
      .set("Authorization", token(supportId, "support"))
      .send({ operationId: secondOperationId })
      .expect(200);

    expect(first.body.outcome).toBe("applied");
    expect(second.body).toMatchObject({
      operationId: secondOperationId,
      outcome: "already_applied",
      alreadyApplied: true,
      resolvedPickupRequestIds: [],
      attendance: {
        checkOutTime: first.body.attendance.checkOutTime,
        checkedOutBy: supportId,
      },
    });
    expect((await db.execute(sql`
      SELECT count(*)::int AS count FROM checkout_operations
      WHERE operation_id IN (${firstOperationId},${secondOperationId})
    `)).rows[0]).toMatchObject({ count: 2 });
  });

  it("prevents operation collisions and hides another actor's operation", async () => {
    const firstAttendance = (await db.execute(sql`
      SELECT id FROM attendance WHERE child_id=${childId} AND service_date=${today}
    `)).rows[0] as { id: number };
    const secondAttendance = (await db.execute(sql`
      INSERT INTO attendance (child_id,class_id,service_date,service_slot,status)
      VALUES (${otherChildId},${classId},${today},'both','in_class') RETURNING id
    `)).rows[0] as { id: number };
    const operationId = randomUUID();
    await request(app).put(`/api/attendance/${firstAttendance.id}/checkout`)
      .set("Authorization", token(supportId, "support"))
      .send({ operationId })
      .expect(200);

    const collision = await request(app).put(`/api/attendance/${secondAttendance.id}/checkout`)
      .set("Authorization", token(supportId, "support"))
      .send({ operationId })
      .expect(409);
    expect(JSON.stringify(collision.body)).not.toContain(String(firstAttendance.id));
    await request(app)
      .get(`/api/attendance/${firstAttendance.id}/checkout-operations/${operationId}`)
      .set("Authorization", token(otherSupportId, "support"))
      .expect(404);
    const otherActorCollision = await request(app).put(`/api/attendance/${firstAttendance.id}/checkout`)
      .set("Authorization", token(otherSupportId, "support"))
      .send({ operationId })
      .expect(409);
    expect(JSON.stringify(otherActorCollision.body)).not.toContain(String(supportId));
  });

  it("returns generic absence for unknown operations and rejects malformed UUIDs", async () => {
    const attendance = (await db.execute(sql`
      SELECT id FROM attendance WHERE child_id=${childId} AND service_date=${today}
    `)).rows[0] as { id: number };
    await request(app)
      .get(`/api/attendance/${attendance.id}/checkout-operations/${randomUUID()}`)
      .set("Authorization", token(supportId, "support"))
      .expect(404);
    await request(app)
      .get(`/api/attendance/${attendance.id}/checkout-operations/not-a-uuid`)
      .set("Authorization", token(supportId, "support"))
      .expect(400);
    await request(app).put(`/api/attendance/${attendance.id}/checkout`)
      .set("Authorization", token(supportId, "support"))
      .send({ operationId: "not-a-uuid" })
      .expect(400);
  });

  it("rolls back the attendance transition if durable result persistence fails", async () => {
    const attendance = (await db.execute(sql`
      SELECT id FROM attendance WHERE child_id=${childId} AND service_date=${today}
    `)).rows[0] as { id: number };
    const operationId = randomUUID();

    await expect(db.transaction(async tx => {
      await tx.execute(sql`
        UPDATE attendance SET status='picked_up',check_out_time=now(),checked_out_by=${supportId}
        WHERE id=${attendance.id}
      `);
      await tx.execute(sql`
        INSERT INTO checkout_operations
          (operation_id,actor_user_id,command,attendance_id,original_outcome,authoritative_result,resolved_pickup_request_ids)
        VALUES
          (${operationId},${supportId},'attendance_checkout',${attendance.id},'applied','[]'::jsonb,'{}'::integer[])
      `);
    })).rejects.toThrow();

    expect((await db.execute(sql`
      SELECT status,check_out_time,checked_out_by FROM attendance WHERE id=${attendance.id}
    `)).rows[0]).toMatchObject({
      status: "in_class",
      check_out_time: null,
      checked_out_by: null,
    });
    expect((await db.execute(sql`
      SELECT count(*)::int AS count FROM checkout_operations WHERE operation_id=${operationId}
    `)).rows[0]).toMatchObject({ count: 0 });
  });

  it("does not expose a custody row whose family no longer owns its child", async () => {
    await db.execute(sql`INSERT INTO custody_episodes (child_id,family_id,service_date,requested_services,requested_by,status)
      VALUES (${otherChildId},${familyId},${today},'both',${parentId},'requested')`);
    const center = await request(app).get("/api/parent-requests").set("Authorization", token(parentId)).expect(200);
    expect(center.body.items.some((item: { requestType: string; childId: number }) =>
      item.requestType === "custody" && item.childId === otherChildId,
    )).toBe(false);
  });
});