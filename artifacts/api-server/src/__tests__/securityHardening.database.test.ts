import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import { generateToken } from "../middlewares/auth";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `hardening-${Date.now()}`;
const ids: Record<string, number> = {};

function auth(key: string, role = key) {
  return `Bearer ${generateToken({
    userId: ids[key]!, email: `${prefix}-${key}@test`, role: role as any, firstName: "Hardening", lastName: key,
  })}`;
}

beforeAll(async () => {
  if (process.env.RUN_DATABASE_ATTENDANCE_TESTS !== "true") return;
  const classes = await db.execute(sql`
    INSERT INTO classes (name, age_min, age_max, capacity, room_location, service_slot)
    VALUES (${`${prefix}-a`}, 1, 12, 100, 'A', '7am'), (${`${prefix}-b`}, 1, 12, 100, 'B', '7am') RETURNING id`);
  ids.classA = Number(classes.rows[0]!.id);
  ids.classB = Number(classes.rows[1]!.id);
  const users = await db.execute(sql`
    INSERT INTO users (email, password_hash, first_name, last_name, role, status, is_active, primary_class_id, phone)
    VALUES
      (${`${prefix}-parent@test`}, 'x', 'Own', 'Parent', 'parent', 'active', true, null, null),
      (${`${prefix}-otherParent@test`}, 'x', 'Other', 'Parent', 'parent', 'active', true, null, null),
      (${`${prefix}-teacher@test`}, 'x', 'Class', 'Teacher', 'teacher', 'active', true, ${ids.classA}, '+2348030001111'),
      (${`${prefix}-admin@test`}, 'x', 'Test', 'Admin', 'admin', 'active', true, null, null),
      (${`${prefix}-otherAdmin@test`}, 'x', 'Other', 'Admin', 'admin', 'active', true, null, null),
      (${`${prefix}-super_admin@test`}, 'x', 'Test', 'Super', 'super_admin', 'active', true, null, null),
      (${`${prefix}-pendingAdmin@test`}, 'x', 'Wants', 'Admin', 'admin', 'pending_approval', false, null, null)
    RETURNING id, email`);
  for (const row of users.rows as Array<{ id: number; email: string }>) {
    ids[row.email.slice(prefix.length + 1, row.email.indexOf("@"))] = Number(row.id);
  }
  await db.execute(sql`INSERT INTO teachers (user_id) VALUES (${ids.teacher})`);
  ids.ownFamily = Number((await db.execute(sql`
    INSERT INTO families (family_code, parent_1_id, notes, address) VALUES (${`FAMOWN${Date.now() % 1e6}`}, ${ids.parent}, 'staff only', '1 Own St') RETURNING id`)).rows[0]!.id);
  ids.otherFamily = Number((await db.execute(sql`
    INSERT INTO families (family_code, parent_1_id, notes, address) VALUES (${`FAMOTH${Date.now() % 1e6}`}, ${ids.otherParent}, 'staff only', '2 Other St') RETURNING id`)).rows[0]!.id);
  const kids = await db.execute(sql`
    INSERT INTO children (family_id, first_name, last_name, dob, gender, current_class_id, medical_notes, face_descriptor_json)
    VALUES (${ids.ownFamily}, 'Own', 'Child', '2020-01-01', 'female', ${ids.classA}, 'asthma', ${JSON.stringify(Array(128).fill(0.1))}),
           (${ids.otherFamily}, 'Other', 'Child', '2020-01-01', 'male', ${ids.classB}, 'epipen', ${JSON.stringify(Array(128).fill(0.2))})
    RETURNING id`);
  ids.ownChild = Number(kids.rows[0]!.id);
  ids.otherChild = Number(kids.rows[1]!.id);
  await db.execute(sql`
    INSERT INTO class_assignments (child_id, class_id, assigned_by, status)
    VALUES (${ids.ownChild}, ${ids.classA}, ${ids.admin}, 'active'), (${ids.otherChild}, ${ids.classB}, ${ids.admin}, 'active')`);
});

afterAll(async () => {
  if (process.env.RUN_DATABASE_ATTENDANCE_TESTS !== "true") return;
  for (const q of [
    sql`DELETE FROM class_assignments WHERE class_id IN (${ids.classA}, ${ids.classB})`,
    sql`DELETE FROM children WHERE id IN (${ids.ownChild}, ${ids.otherChild})`,
    sql`DELETE FROM families WHERE id IN (${ids.ownFamily}, ${ids.otherFamily})`,
    sql`DELETE FROM teachers WHERE user_id = ${ids.teacher}`,
    sql`DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE email LIKE ${`${prefix}-%`})`,
    sql`DELETE FROM users WHERE email LIKE ${`${prefix}-%`}`,
    sql`DELETE FROM classes WHERE id IN (${ids.classA}, ${ids.classB})`,
  ]) await db.execute(q).catch(() => {});
});

databaseDescribe("class assignments are scoped like children", () => {
  it("parents only see their own children, without face data", async () => {
    const res = await request(app).get("/api/class-assignments").set("Authorization", auth("parent")).expect(200);
    expect(res.body.map((a: any) => a.childId)).toEqual([ids.ownChild]);
    expect(res.body[0].child.faceDescriptorJson).toBeUndefined();
    expect(res.body[0].child.hasFaceDescriptor).toBe(true);
    await request(app).get(`/api/class-assignments?childId=${ids.otherChild}`).set("Authorization", auth("parent")).expect(403);
  });

  it("teachers only see their class", async () => {
    const res = await request(app).get("/api/class-assignments").set("Authorization", auth("teacher")).expect(200);
    expect(res.body.every((a: any) => a.classId === ids.classA)).toBe(true);
    await request(app).get(`/api/class-assignments?classId=${ids.classB}`).set("Authorization", auth("teacher")).expect(403);
  });

  it("admins still see everything, without face data", async () => {
    const res = await request(app).get(`/api/class-assignments?classId=${ids.classB}`).set("Authorization", auth("admin")).expect(200);
    expect(res.body[0].childId).toBe(ids.otherChild);
    expect(JSON.stringify(res.body)).not.toContain("faceDescriptorJson");
  });
});

databaseDescribe("class waitlist has been removed", () => {
  it.each([
    ["get", () => `/api/classes/${ids.classA}/waitlist`],
    ["post", () => `/api/classes/${ids.classA}/waitlist`],
    ["get", () => `/api/classes/waitlist?familyId=${ids.ownFamily}`],
    ["post", () => `/api/classes/${ids.classA}/notify-waitlist`],
  ])("%s waitlist endpoint is gone", async (method, path) => {
    const res = await (request(app) as any)[method](path()).set("Authorization", auth("admin")).send({});
    expect([400, 404]).toContain(res.status);
  });

  it("class responses no longer carry a waitlist count", async () => {
    const res = await request(app).get(`/api/classes/${ids.classA}`).set("Authorization", auth("admin")).expect(200);
    expect(res.body.waitlistCount).toBeUndefined();
  });
});

databaseDescribe("admins cannot take over admin or super admin accounts", () => {
  it("blocks an admin resetting a super admin's or another admin's password", async () => {
    for (const target of ["super_admin", "otherAdmin"]) {
      await request(app).put(`/api/users/${ids[target]}/reset-password`).set("Authorization", auth("admin"))
        .send({ password: "takeover-123" }).expect(403);
    }
    const [row] = (await db.execute(sql`SELECT password_hash FROM users WHERE id=${ids.super_admin}`)).rows as Array<{ password_hash: string }>;
    expect(row!.password_hash).toBe("x");
  });

  it("still lets an admin reset a parent's password, and a super admin reset an admin's", async () => {
    await request(app).put(`/api/users/${ids.parent}/reset-password`).set("Authorization", auth("admin"))
      .send({ password: "new-password-1" }).expect(200);
    await request(app).put(`/api/users/${ids.otherAdmin}/reset-password`).set("Authorization", auth("super_admin"))
      .send({ password: "new-password-2" }).expect(200);
  });

  it("blocks an admin approving someone who registered as an admin", async () => {
    await request(app).put(`/api/users/${ids.pendingAdmin}/approve`).set("Authorization", auth("admin")).expect(403);
    await request(app).put(`/api/users/${ids.super_admin}/reject`).set("Authorization", auth("admin")).expect(403);
    const [row] = (await db.execute(sql`SELECT status FROM users WHERE id=${ids.pendingAdmin}`)).rows as Array<{ status: string }>;
    expect(row!.status).toBe("pending_approval");
  });
});

databaseDescribe("teacher contact details", () => {
  it("are hidden from parents but visible to staff", async () => {
    const asParent = await request(app).get("/api/teachers").set("Authorization", auth("otherParent", "parent")).expect(200);
    const mine = asParent.body.find((t: any) => t.userId === ids.teacher);
    expect(mine.user).toMatchObject({ firstName: "Class", email: null, phone: null });
    const asAdmin = await request(app).get("/api/teachers").set("Authorization", auth("admin")).expect(200);
    expect(asAdmin.body.find((t: any) => t.userId === ids.teacher).user.phone).toBe("+2348030001111");
  });
});

databaseDescribe("bad input gets 4xx, not 500", () => {
  it.each([
    ["get", "/api/children/99999999999999999999"],
    ["get", "/api/dashboard/stats?serviceDate=2026-99-99&date=2026-99-99"],
    ["put", "/api/teacher-allocations/1"],
    ["post", "/api/auth/forgot-password"],
  ])("%s %s", async (method, path) => {
    const res = await (request(app) as any)[method](path).set("Authorization", auth("admin")).send();
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

databaseDescribe("minimum password length", () => {
  it("rejects new passwords shorter than 8 but still signs in existing 6-character passwords", async () => {
    const bcrypt = (await import("bcryptjs")).default;
    const email = `${prefix}-legacy-pw@example.com`;
    await db.execute(sql`
      INSERT INTO users (email, password_hash, first_name, last_name, role, status, is_active)
      VALUES (${email}, ${await bcrypt.hash("abc123", 4)}, 'Legacy', 'Password', 'parent', 'active', true)`);
    const [{ id }] = (await db.execute(sql`SELECT id FROM users WHERE email = ${email}`)).rows as Array<{ id: number }>;

    const login = await request(app).post("/api/auth/login").set("x-forwarded-for", "203.0.113.80")
      .send({ email, password: "abc123" });
    expect(login.status).toBe(200);
    const tooShort = await request(app).put(`/api/users/${id}/reset-password`).set("Authorization", auth("super_admin"))
      .send({ password: "short12" });
    expect(tooShort.status).toBe(400);
    await request(app).put(`/api/users/${id}/reset-password`).set("Authorization", auth("super_admin"))
      .send({ password: "longer-pass" }).expect(200);
  });
});
