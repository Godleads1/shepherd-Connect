import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import app from "../app";
import { generateToken } from "../middlewares/auth";
import {
  pickupRequestRouteDependencies,
} from "../routes/pickupRequests";
import {
  pickupDelegateRouteDependencies,
} from "../routes/pickupDelegates";
import {
  familyAssistRouteDependencies,
} from "../routes/familyAssist";
import { createNotificationDelivery } from "../services/notificationOutbox";
import { smsDelegateOtp } from "../services/sms";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `outcome-routes-${Date.now()}`;
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
let parentId = 0;
let adminId = 0;
let teacherUserId = 0;
let familyId = 0;
let childId = 0;
let classId = 0;
let teacherId = 0;

function token(id: number, role: "parent" | "admin") {
  return `Bearer ${generateToken({
    userId: id,
    email: `${prefix}-${id}@test`,
    role,
    firstName: "Route",
    lastName: "Test",
  })}`;
}

async function clearOwnedRows() {
  await db.execute(sql`DELETE FROM notification_outbox WHERE recipient_user_id IN (${parentId},${teacherUserId})`);
  await db.execute(sql`DELETE FROM notifications WHERE user_id IN (${parentId},${teacherUserId})`);
  await db.execute(sql`DELETE FROM pickup_requests WHERE child_id=${childId}`);
  await db.execute(sql`DELETE FROM pickup_delegates WHERE child_id=${childId}`);
  await db.execute(sql`DELETE FROM class_display_media WHERE class_id=${classId}`);
}

beforeAll(async () => {
  const users = await db.execute(sql`
    INSERT INTO users (email,password_hash,first_name,last_name,role,status,is_active,phone)
    VALUES
      (${`${prefix}-parent@test`},'x','Route','Parent','parent','active',true,'08010000001'),
      (${`${prefix}-admin@test`},'x','Route','Admin','admin','active',true,'08010000002'),
      (${`${prefix}-teacher@test`},'x','Route','Teacher','teacher','active',true,'08010000003')
    RETURNING id
  `);
  parentId = Number(users.rows[0].id);
  adminId = Number(users.rows[1].id);
  teacherUserId = Number(users.rows[2].id);
  familyId = Number((await db.execute(sql`
    INSERT INTO families (family_code,parent_1_id) VALUES (${`OR-${prefix.slice(-8)}`},${parentId}) RETURNING id
  `)).rows[0].id);
  classId = Number((await db.execute(sql`
    INSERT INTO classes (name,age_min,age_max,capacity,room_location,service_slot)
    VALUES (${prefix},1,12,30,'Room','7am') RETURNING id
  `)).rows[0].id);
  childId = Number((await db.execute(sql`
    INSERT INTO children (family_id,first_name,last_name,dob,gender,current_class_id)
    VALUES (${familyId},'Route','Child','2020-01-01','female',${classId}) RETURNING id
  `)).rows[0].id);
  teacherId = Number((await db.execute(sql`
    INSERT INTO teachers (user_id) VALUES (${teacherUserId}) RETURNING id
  `)).rows[0].id);
  await db.execute(sql`
    INSERT INTO teacher_allocations (teacher_id,class_id,service_date,service_slot,status)
    VALUES (${teacherId},${classId},${today},'7am','scheduled')
  `);
});

beforeEach(async () => {
  pickupRequestRouteDependencies.createNotificationDelivery = createNotificationDelivery;
  pickupRequestRouteDependencies.broadcastDisplayMedia = null;
  pickupDelegateRouteDependencies.createNotificationDelivery = createNotificationDelivery;
  pickupDelegateRouteDependencies.smsDelegateOtp = smsDelegateOtp;
  familyAssistRouteDependencies.smsDelegateOtp = smsDelegateOtp;
  await clearOwnedRows();
  await db.execute(sql`DELETE FROM attendance WHERE child_id=${childId}`);
  await db.execute(sql`
    INSERT INTO attendance (child_id,class_id,service_date,service_slot,status)
    VALUES (${childId},${classId},${today},'7am','in_class')
  `);
});

afterAll(async () => {
  pickupRequestRouteDependencies.createNotificationDelivery = createNotificationDelivery;
  pickupRequestRouteDependencies.broadcastDisplayMedia = null;
  pickupDelegateRouteDependencies.createNotificationDelivery = createNotificationDelivery;
  pickupDelegateRouteDependencies.smsDelegateOtp = smsDelegateOtp;
  familyAssistRouteDependencies.smsDelegateOtp = smsDelegateOtp;
  await clearOwnedRows();
  for (const query of [
    sql`DELETE FROM attendance WHERE child_id=${childId}`,
    sql`DELETE FROM teacher_allocations WHERE teacher_id=${teacherId}`,
    sql`DELETE FROM teachers WHERE id=${teacherId}`,
    sql`DELETE FROM children WHERE id=${childId}`,
    sql`DELETE FROM families WHERE id=${familyId}`,
    sql`DELETE FROM classes WHERE id=${classId}`,
    sql`DELETE FROM users WHERE id IN (${parentId},${adminId},${teacherUserId})`,
  ]) await db.execute(query);
});

databaseDescribe("owned route commit-outcome boundaries", () => {
  it("commits pickup request and required outbox together, and rolls both back on outbox failure", async () => {
    pickupRequestRouteDependencies.createNotificationDelivery = vi.fn().mockRejectedValue(
      new Error("fault-injected outbox failure"),
    ) as any;
    await request(app).post("/api/pickup-requests")
      .set("Authorization", token(parentId, "parent")).send({ childId }).expect(500);
    expect((await db.execute(sql`SELECT count(*)::int count FROM pickup_requests WHERE child_id=${childId}`)).rows[0])
      .toMatchObject({ count: 0 });

    pickupRequestRouteDependencies.createNotificationDelivery = createNotificationDelivery;
    const response = await request(app).post("/api/pickup-requests")
      .set("Authorization", token(parentId, "parent")).send({ childId }).expect(200);
    expect(response.body.request.childId).toBe(childId);
    expect((await db.execute(sql`
      SELECT count(*)::int count FROM notification_outbox
      WHERE domain_type='pickup_request' AND domain_identifier=${String(response.body.request.id)}
    `)).rows[0]).toMatchObject({ count: 1 });
  });

  it("commits notify-parent state and required outbox together, and rolls both back on outbox failure", async () => {
    const delegateId = Number((await db.execute(sql`
      INSERT INTO pickup_delegates (child_id,name,phone,otp_code,parent_approved)
      VALUES (${childId},'Pickup Person','08020000000','123456',false) RETURNING id
    `)).rows[0].id);
    pickupDelegateRouteDependencies.createNotificationDelivery = vi.fn().mockRejectedValue(
      new Error("fault-injected outbox failure"),
    ) as any;
    await request(app).post(`/api/pickup-delegates/${delegateId}/notify-parent`)
      .set("Authorization", token(parentId, "parent")).expect(500);
    expect((await db.execute(sql`
      SELECT approval_status,approval_requested_at FROM pickup_delegates WHERE id=${delegateId}
    `)).rows[0]).toMatchObject({ approval_status: null, approval_requested_at: null });

    pickupDelegateRouteDependencies.createNotificationDelivery = createNotificationDelivery;
    await request(app).post(`/api/pickup-delegates/${delegateId}/notify-parent`)
      .set("Authorization", token(parentId, "parent")).expect(200);
    expect((await db.execute(sql`
      SELECT approval_status FROM pickup_delegates WHERE id=${delegateId}
    `)).rows[0]).toMatchObject({ approval_status: "pending" });
    expect((await db.execute(sql`
      SELECT count(*)::int count FROM notification_outbox
      WHERE domain_type='pickup_delegate' AND domain_identifier=${String(delegateId)}
    `)).rows[0]).toMatchObject({ count: 1 });
  });

  it("returns 201 with committed pickup-delegate rows when optional SMS throws", async () => {
    pickupDelegateRouteDependencies.smsDelegateOtp = vi.fn().mockRejectedValue(
      new Error("fault-injected SMS failure"),
    ) as any;
    const response = await request(app).post("/api/pickup-delegates")
      .set("Authorization", token(parentId, "parent"))
      .send({ childId, name: "Pickup Person", phone: "08020000000", photoUrl: null })
      .expect(201);
    expect((await db.execute(sql`SELECT child_id,name FROM pickup_delegates WHERE id=${response.body.id}`)).rows[0])
      .toMatchObject({ child_id: childId, name: "Pickup Person" });
  });

  it("returns 201 with a committed assisted delegate when optional SMS throws", async () => {
    familyAssistRouteDependencies.smsDelegateOtp = vi.fn().mockRejectedValue(
      new Error("fault-injected SMS failure"),
    ) as any;
    const response = await request(app).post("/api/family-assist/delegate")
      .set("Authorization", token(adminId, "admin"))
      .send({ childId, delegateName: "Assisted Person", delegatePhone: "08030000000" })
      .expect(201);
    expect((await db.execute(sql`SELECT child_id,name FROM pickup_delegates WHERE id=${response.body.id}`)).rows[0])
      .toMatchObject({ child_id: childId, name: "Assisted Person" });
  });

  it("keeps PUT and DELETE successful and persisted when display broadcast throws", async () => {
    pickupRequestRouteDependencies.broadcastDisplayMedia = vi.fn().mockRejectedValue(
      new Error("fault-injected broadcast failure"),
    );
    await request(app).put(`/api/pickup-requests/display-media/${classId}`)
      .set("Authorization", token(adminId, "admin"))
      .send({ kind: "youtube", youtubeVideoId: "abcdefghijk" })
      .expect(200, { success: true });
    expect((await db.execute(sql`
      SELECT kind,youtube_video_id FROM class_display_media WHERE class_id=${classId}
    `)).rows[0]).toMatchObject({ kind: "youtube", youtube_video_id: "abcdefghijk" });
    const read = await request(app).get(`/api/pickup-requests/display-media/${classId}`)
      .set("Authorization", token(adminId, "admin")).expect(200);
    expect(read.body.media).toMatchObject({ kind: "youtube", youtubeVideoId: "abcdefghijk" });

    await request(app).delete(`/api/pickup-requests/display-media/${classId}`)
      .set("Authorization", token(adminId, "admin")).expect(200, { success: true });
    expect((await db.execute(sql`
      SELECT count(*)::int count FROM class_display_media WHERE class_id=${classId}
    `)).rows[0]).toMatchObject({ count: 0 });
    const afterDelete = await request(app).get(`/api/pickup-requests/display-media/${classId}`)
      .set("Authorization", token(adminId, "admin")).expect(200);
    expect(afterDelete.body).toEqual({ media: null });
  });
});