import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { attendanceTable, db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { createAttendanceNotificationIntents } from "../lib/attendanceNotificationIntents";

const effects = vi.hoisted(() => ({
  checkedIn: vi.fn(async () => undefined),
  arrived: vi.fn(async () => undefined),
  pickedUp: vi.fn(async () => undefined),
  emergency: vi.fn(async () => undefined),
}));

vi.mock("../lib/notify", () => ({
  notifyChildCheckedIn: effects.checkedIn,
  notifyChildInTransit: vi.fn(async () => undefined),
  notifyChildArrivedInClass: effects.arrived,
  notifyChildPickedUp: effects.pickedUp,
  notifyTeachersChildDroppedOff: vi.fn(async () => undefined),
  notifyTeachersChildInTransit: vi.fn(async () => undefined),
  notifyTeachersChildPickedUp: vi.fn(async () => undefined),
  sendNotification: effects.emergency,
}));
vi.mock("../services/sms", () => {
  const accepted = vi.fn(async () => true);
  return {
    smsRegistrationOtp: accepted, emailRegistrationOtp: accepted,
    smsWelcome: accepted, smsPendingApproval: accepted,
    smsPasswordResetCode: accepted, emailWelcome: accepted,
    emailPendingApproval: accepted, emailPasswordResetCode: accepted,
    smsAccountApproved: accepted, smsAccountRejected: accepted,
    emailAccountApproved: accepted, emailAccountRejected: accepted,
    smsDelegateOtp: accepted, smsChildCheckedIn: accepted,
    smsChildCheckedOut: accepted, smsPreDismissal: accepted,
    emailChildCheckedIn: accepted, emailChildCheckedOut: accepted,
    emailShepherdsReport: accepted,
  };
});
vi.mock("../services/push", () => ({ pushToUsers: vi.fn(async () => undefined) }));

import app from "../app";
import { generateToken } from "../middlewares/auth";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `phase4-attendance-${Date.now()}`;
const serviceDate = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
const priorServiceDate = new Date(Date.now() - 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString().slice(0, 10);
let adminId = 0;
let otherId = 0;
let familyId = 0;
let classId = 0;
let childId = 0;
let authorization = "";
let staffAuthorization = "";
const qrToken = `${prefix}-qr`;

function auth(userId: number, email: string, role: "admin" | "support") {
  return `Bearer ${generateToken({
    userId, email, role, firstName: "Phase", lastName: "Four",
  })}`;
}

async function count(table: "attendance" | "attendance_events" | "staff_scans" | "notification_outbox", condition: ReturnType<typeof sql>) {
  const result = await db.execute(sql`SELECT count(*)::int AS count FROM ${sql.identifier(table)} WHERE ${condition}`);
  return Number((result.rows[0] as { count: number }).count);
}

function countCurrentChildAttendanceIntents() {
  return count(
    "notification_outbox",
    sql`domain_type = 'attendance'
      AND domain_identifier IN (SELECT id::text FROM attendance WHERE child_id = ${childId})`,
  );
}

async function seedAttendance(status: "dropped_off" | "in_transit" | "in_class" | "picked_up" = "in_class") {
  const result = await db.execute(sql`
    INSERT INTO attendance
      (child_id, class_id, service_date, service_slot, check_in_time, checked_in_by, status)
    VALUES (${childId}, ${classId}, ${serviceDate}, '7am', now(), ${adminId}, ${status})
    RETURNING id
  `);
  return Number((result.rows[0] as { id: number }).id);
}

function checkInBody(overrides: Record<string, unknown> = {}) {
  return { childId, classId, serviceDate, serviceSlot: "7am", ...overrides };
}

function eventBody(eventId: string, overrides: Record<string, unknown> = {}) {
  return checkInBody({
    eventId,
    originatingUserId: adminId,
    originatingRole: "admin",
    queuedAt: new Date().toISOString(),
    ...overrides,
  });
}

beforeAll(async () => {
  const users = await db.execute(sql`
    INSERT INTO users
      (email, password_hash, first_name, last_name, role, status, is_active)
    VALUES
      (${`${prefix}-admin@example.test`}, 'not-used', 'Phase', 'Admin', 'admin', 'active', true),
      (${`${prefix}-support@example.test`}, 'not-used', 'Phase', 'Support', 'support', 'active', true)
    RETURNING id, role
  `);
  for (const row of users.rows as Array<{ id: number; role: string }>) {
    if (row.role === "admin") adminId = row.id;
    else otherId = row.id;
  }
  const family = await db.execute(sql`
    INSERT INTO families (family_code, parent_1_id)
    VALUES (${`${prefix}-family`}, ${adminId}) RETURNING id
  `);
  familyId = Number((family.rows[0] as { id: number }).id);
  const classroom = await db.execute(sql`
    INSERT INTO classes (name, age_min, age_max, capacity, room_location, service_slot)
    VALUES (${prefix}, 1, 12, 20, 'Test room', '7am') RETURNING id
  `);
  classId = Number((classroom.rows[0] as { id: number }).id);
  const child = await db.execute(sql`
    INSERT INTO children (family_id, first_name, last_name, dob, gender, current_class_id)
    VALUES (${familyId}, 'Phase', 'Child', '2020-01-01', 'female', ${classId}) RETURNING id
  `);
  childId = Number((child.rows[0] as { id: number }).id);
  await db.execute(sql`
    INSERT INTO sunday_qr_codes (service_date, token, created_by_id)
    VALUES (${serviceDate}, ${qrToken}, ${adminId})
  `);
  authorization = auth(adminId, `${prefix}-admin@example.test`, "admin");
  staffAuthorization = auth(otherId, `${prefix}-support@example.test`, "support");
});

beforeEach(async () => {
  await db.execute(sql`DELETE FROM drop_off_intents WHERE family_id = ${familyId}`);
  await db.execute(sql`DELETE FROM attendance_events WHERE user_id IN (${adminId}, ${otherId})`);
  await db.execute(sql`DELETE FROM notification_outbox WHERE recipient_user_id IN (${adminId}, ${otherId})`);
  await db.execute(sql`DELETE FROM notifications WHERE user_id IN (${adminId}, ${otherId})`);
  await db.execute(sql`DELETE FROM notification_outbox WHERE domain_type = 'attendance' AND domain_identifier IN (SELECT id::text FROM attendance WHERE child_id = ${childId})`);
  await db.execute(sql`DELETE FROM notification_outbox WHERE domain_type = 'staff_scan' AND domain_identifier IN (SELECT id::text FROM staff_scans WHERE user_id IN (${adminId}, ${otherId}))`);
  await db.execute(sql`DELETE FROM attendance WHERE child_id = ${childId}`);
  await db.execute(sql`DELETE FROM staff_scans WHERE user_id IN (${adminId}, ${otherId})`);
  vi.clearAllMocks();
});

afterAll(async () => {
  // Cleanup remains best-effort per table so a missing newly-added table does
  // not prevent removal of already-seeded rows from older tables.
  const cleanup = [
    sql`DELETE FROM notification_outbox WHERE recipient_user_id IN (${adminId}, ${otherId})`,
    sql`DELETE FROM notifications WHERE user_id IN (${adminId}, ${otherId})`,
    sql`DELETE FROM notification_outbox WHERE domain_type = 'attendance' AND domain_identifier IN (SELECT id::text FROM attendance WHERE child_id = ${childId})`,
    sql`DELETE FROM notification_outbox WHERE domain_type = 'staff_scan' AND domain_identifier IN (SELECT id::text FROM staff_scans WHERE user_id IN (${adminId}, ${otherId}))`,
    sql`DELETE FROM attendance_events WHERE user_id IN (${adminId}, ${otherId})`,
    sql`DELETE FROM drop_off_intents WHERE family_id = ${familyId}`,
    sql`DELETE FROM attendance WHERE child_id = ${childId}`,
    sql`DELETE FROM staff_scans WHERE user_id IN (${adminId}, ${otherId})`,
    sql`DELETE FROM sunday_qr_codes WHERE token = ${qrToken}`,
    sql`DELETE FROM children WHERE id = ${childId}`,
    sql`DELETE FROM families WHERE id = ${familyId}`,
    sql`DELETE FROM classes WHERE id = ${classId}`,
    sql`DELETE FROM users WHERE email LIKE ${`${prefix}%`}`,
  ];
  for (const statement of cleanup) {
    try { await db.execute(statement); } catch { /* setup may have failed before this table existed */ }
  }
});

databaseDescribe("attendance PostgreSQL concurrency integrity", () => {
  it("makes sequential and four-way checkout one transition with one timestamp and actor", async () => {
    const id = await seedAttendance();
    const first = await request(app).put(`/api/attendance/${id}/checkout`).set("Authorization", authorization).send({});
    const firstTime = first.body.checkOutTime;
    const retries = await Promise.all(Array.from({ length: 4 }, () =>
      request(app).put(`/api/attendance/${id}/checkout`).set("Authorization", authorization).send({}),
    ));
    expect([first, ...retries].every(reply => reply.status === 200)).toBe(true);
    expect(retries.every(reply => reply.body.checkOutTime === firstTime && reply.body.checkedOutBy === adminId)).toBe(true);
    expect(await count("notification_outbox", sql`domain_type = 'attendance' AND domain_identifier = ${String(id)}`)).toBe(3);
  });

  it("makes four-way arrival one transition and one notification", async () => {
    const id = await seedAttendance("dropped_off");
    const replies = await Promise.all(Array.from({ length: 4 }, () =>
      request(app).put(`/api/attendance/${id}/arrive`).set("Authorization", authorization),
    ));
    expect(replies.every(reply => reply.status === 200)).toBe(true);
    expect(new Set(replies.map(reply => reply.body.classArrivalTime)).size).toBe(1);
    expect(new Set(replies.map(reply => reply.body.confirmedByTeacherId))).toEqual(new Set([adminId]));
    expect(await count("notification_outbox", sql`domain_type = 'attendance' AND domain_identifier = ${String(id)}`)).toBe(3);
  });

  it("deduplicates four same-slot check-ins", async () => {
    const replies = await Promise.all(Array.from({ length: 4 }, () =>
      request(app).post("/api/attendance").set("Authorization", authorization).send(checkInBody()),
    ));
    expect(replies.filter(reply => reply.status === 201)).toHaveLength(1);
    expect(replies.filter(reply => reply.status === 200)).toHaveLength(3);
    expect(await count("attendance", sql`child_id = ${childId}`)).toBe(1);
    expect(await countCurrentChildAttendanceIntents()).toBe(3);
  });

  it("makes four family-assist same-slot check-ins one winner with one outbox intent", async () => {
    const replies = await Promise.all(Array.from({ length: 4 }, () =>
      request(app).post("/api/family-assist/checkin").set("Authorization", authorization)
        .send({ childId, serviceSlot: "7am" }),
    ));
    expect(replies.every(reply => reply.status === 200)).toBe(true);
    expect(await count("attendance", sql`child_id = ${childId}`)).toBe(1);
    expect(await countCurrentChildAttendanceIntents()).toBe(3);
  });

  it("commits QR auto check-in and escort intents with the attendance transitions", async () => {
    await db.execute(sql`
      INSERT INTO drop_off_intents (family_id, service_date, status, child_ids, service_slot, created_by)
      VALUES (${familyId}, ${serviceDate}, 'on_the_way', ${JSON.stringify([childId])}::jsonb, '7am', ${adminId})
    `);
    const reply = await request(app).post("/api/attendance/scan-qr")
      .set("Authorization", authorization)
      .send({ qrCode: `QR:${familyId}`, serviceDate, serviceSlot: "7am" });
    expect(reply.status).toBe(200);
    expect(reply.body.autoProcessed).toEqual([
      expect.objectContaining({ childId, slots: ["7am"] }),
    ]);
    const rows = await db.execute(sql`
      SELECT status FROM attendance WHERE child_id = ${childId} AND service_date = ${serviceDate}
    `);
    expect((rows.rows[0] as { status: string }).status).toBe("in_transit");
    expect(await countCurrentChildAttendanceIntents()).toBe(6);
  });

  it("rolls back a family-assist-style attendance winner and its notification intent together", async () => {
    const intentsBefore = await count("notification_outbox", sql`domain_type = 'attendance'`);
    await expect(db.transaction(async tx => {
      const [record] = await tx.insert(attendanceTable).values({
        childId, classId, serviceDate, serviceSlot: "7am", checkInTime: new Date(),
        checkedInBy: adminId, status: "dropped_off",
      }).returning();
      await createAttendanceNotificationIntents(tx, record, "checked_in");
      throw new Error("force attendance rollback");
    })).rejects.toThrow("force attendance rollback");
    expect(await count("attendance", sql`child_id = ${childId}`)).toBe(0);
    expect(await count("notification_outbox", sql`domain_type = 'attendance'`)).toBe(intentsBefore);
  });

  it("allows only one of concurrent opposing slots unless bothServices is explicit", async () => {
    const opposing = await Promise.all([
      request(app).post("/api/attendance").set("Authorization", authorization).send(checkInBody()),
      request(app).post("/api/attendance").set("Authorization", authorization).send(checkInBody({ serviceSlot: "10:30am" })),
    ]);
    expect(opposing.filter(reply => reply.status === 201)).toHaveLength(1);
    expect(opposing.filter(reply => reply.status === 409)).toHaveLength(1);
    await db.execute(sql`DELETE FROM attendance WHERE child_id = ${childId}`);
    const both = await Promise.all([
      request(app).post("/api/attendance").set("Authorization", authorization).send(checkInBody({ bothServices: true })),
      request(app).post("/api/attendance").set("Authorization", authorization).send(checkInBody({ serviceSlot: "10:30am", bothServices: true })),
    ]);
    expect(both.every(reply => reply.status === 201)).toBe(true);
    expect(await count("attendance", sql`child_id = ${childId}`)).toBe(2);
  });

  it("replays duplicate events sequentially and simultaneously without side effects", async () => {
    const body = eventBody(`${prefix}-event-replay`);
    const first = await request(app).post("/api/attendance").set("Authorization", authorization).send(body);
    const intentsAfterWinner = await countCurrentChildAttendanceIntents();
    const sequential = await request(app).post("/api/attendance").set("Authorization", authorization).send(body);
    const simultaneousBody = eventBody(`${prefix}-event-simultaneous`);
    const simultaneous = await Promise.all(Array.from({ length: 4 }, () =>
      request(app).post("/api/attendance").set("Authorization", authorization).send(simultaneousBody),
    ));
    expect(first.status).toBe(201);
    expect(sequential.status).toBe(200);
    expect(simultaneous.every(reply => reply.status === 200)).toBe(true);
    expect(await count("attendance_events", sql`user_id = ${adminId}`)).toBe(2);
    expect(await countCurrentChildAttendanceIntents()).toBe(intentsAfterWinner);
  });

  it("treats a genuinely new event after pickup as a fresh check-in", async () => {
    const first = await request(app).post("/api/attendance").set("Authorization", authorization)
      .send(eventBody(`${prefix}-event-before-pickup`));
    await request(app).put(`/api/attendance/${first.body.id}/checkout`).set("Authorization", authorization).send({});
    const fresh = await request(app).post("/api/attendance").set("Authorization", authorization)
      .send(eventBody(`${prefix}-event-after-pickup`));
    expect(fresh.status).toBe(200);
    expect(fresh.body.status).toBe("dropped_off");
    expect(await count("attendance_events", sql`user_id = ${adminId}`)).toBe(2);
    expect(await countCurrentChildAttendanceIntents()).toBe(9);
  });

  it("replays a processed event before evaluating a newer opposing active slot", async () => {
    const originalBody = eventBody(`${prefix}-event-original-7am`);
    const original = await request(app).post("/api/attendance").set("Authorization", authorization).send(originalBody);
    await request(app).put(`/api/attendance/${original.body.id}/checkout`).set("Authorization", authorization).send({});
    const opposing = await request(app).post("/api/attendance").set("Authorization", authorization).send(
      eventBody(`${prefix}-event-new-1030`, { serviceSlot: "10:30am" }),
    );
    expect(opposing.status).toBe(201);
    const notificationsBeforeReplay = effects.checkedIn.mock.calls.length;

    const replay = await request(app).post("/api/attendance").set("Authorization", authorization).send(originalBody);
    expect(replay.status).toBe(200);
    expect(replay.body.id).toBe(original.body.id);
    expect(replay.body.status).toBe("picked_up");
    expect(await count("attendance", sql`child_id = ${childId}`)).toBe(2);
    expect(effects.checkedIn).toHaveBeenCalledTimes(notificationsBeforeReplay);
  });

  it("rejects cross-user, role-mismatch, stale, and prior-WAT-date events", async () => {
    const attempts = [
      eventBody(`${prefix}-cross-user`, { originatingUserId: otherId }),
      eventBody(`${prefix}-role`, { originatingRole: "support" }),
      eventBody(`${prefix}-stale`, { queuedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 - 1).toISOString() }),
      eventBody(`${prefix}-prior-date`, { serviceDate: priorServiceDate }),
    ];
    for (const body of attempts) {
      expect((await request(app).post("/api/attendance").set("Authorization", authorization).send(body)).status).toBe(400);
    }
    expect(await count("attendance_events", sql`user_id IN (${adminId}, ${otherId})`)).toBe(0);
    expect(await count("attendance", sql`child_id = ${childId}`)).toBe(0);
  });

  it("records one checkpoint for four simultaneous first staff scans", async () => {
    const replies = await Promise.all(Array.from({ length: 4 }, () =>
      request(app).post("/api/sunday-attendance/scan").set("Authorization", staffAuthorization)
        .send({ token: qrToken, date: serviceDate }),
    ));
    expect(replies.every(reply => reply.status === 200)).toBe(true);
    expect(await count("staff_scans", sql`user_id = ${otherId} AND scan_type = 'checkpoint'`)).toBe(1);
    expect(await count("staff_scans", sql`user_id = ${otherId} AND scan_type = 'clock_out'`)).toBe(0);
  });

  it("records one clockout after sequential setup followed by four simultaneous scans", async () => {
    expect((await request(app).post("/api/sunday-attendance/scan").set("Authorization", staffAuthorization)
      .send({ token: qrToken, date: serviceDate })).body.action).toBe("checked_in");
    await db.execute(sql`
      UPDATE staff_scans
      SET scanned_at = now() - interval '31 seconds',
          created_at = now() - interval '31 seconds'
      WHERE user_id = ${otherId} AND service_date = ${serviceDate} AND scan_type = 'checkpoint'
    `);
    const replies = await Promise.all(Array.from({ length: 4 }, () =>
      request(app).post("/api/sunday-attendance/scan").set("Authorization", staffAuthorization)
        .send({ token: qrToken, date: serviceDate }),
    ));
    expect(replies.every(reply => reply.status === 200)).toBe(true);
    expect(await count("staff_scans", sql`user_id = ${otherId} AND scan_type = 'clock_out'`)).toBe(1);
  });

  it("records and notifies one emergency exit for four simultaneous requests", async () => {
    const activeAdmins = await db.execute(sql`
      SELECT count(*)::int AS count FROM users
      WHERE is_active = true AND role IN ('admin', 'super_admin')
    `);
    const replies = await Promise.all(Array.from({ length: 4 }, () =>
      request(app).post("/api/sunday-attendance/emergency-out").set("Authorization", staffAuthorization)
        .send({ date: serviceDate, service: "1st", reason: "Synthetic test" }),
    ));
    expect(replies.every(reply => reply.status === 200)).toBe(true);
    expect(await count("staff_scans", sql`user_id = ${otherId} AND scan_type = 'emergency_out'`)).toBe(1);
    expect(await count("notification_outbox", sql`domain_type = 'staff_scan'`)).toBe(Number((activeAdmins.rows[0] as { count: number }).count));
  });

  it("rejects a suspended authenticated user before attendance mutation", async () => {
    await db.execute(sql`UPDATE users SET is_active = false WHERE id = ${adminId}`);
    try {
      const response = await request(app).post("/api/attendance").set("Authorization", authorization).send(checkInBody());
      expect(response.status).toBe(401);
      expect(await count("attendance", sql`child_id = ${childId}`)).toBe(0);
    } finally {
      await db.execute(sql`UPDATE users SET is_active = true WHERE id = ${adminId}`);
    }
  });

  it("rejects a token whose selected role was removed before attendance mutation", async () => {
    await db.execute(sql`UPDATE users SET role = 'parent' WHERE id = ${otherId}`);
    try {
      const response = await request(app).post("/api/attendance").set("Authorization", staffAuthorization).send(checkInBody());
      expect(response.status).toBe(401);
      expect(await count("attendance", sql`child_id = ${childId}`)).toBe(0);
    } finally {
      await db.execute(sql`UPDATE users SET role = 'support' WHERE id = ${otherId}`);
    }
  });
});