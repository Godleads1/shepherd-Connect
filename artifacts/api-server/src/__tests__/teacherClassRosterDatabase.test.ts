import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import app from "../app";
import { generateToken } from "../middlewares/auth";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `teacher-roster-${Date.now()}`;
let teacherId = 0;
let adminId = 0;
let familyId = 0;
let assignedClassId = 0;
let otherClassId = 0;
let assignedChildId = 0;
let otherChildId = 0;

function token(id: number, role: "teacher" | "admin") {
  return `Bearer ${generateToken({
    userId: id,
    email: `${prefix}-${id}@test`,
    role,
    firstName: "Test",
    lastName: "User",
  })}`;
}

beforeAll(async () => {
  assignedClassId = Number((await db.execute(sql`
    INSERT INTO classes (name, age_min, age_max, capacity, room_location, service_slot)
    VALUES (${`${prefix}-assigned`}, 1, 12, 500, 'A', '7am') RETURNING id
  `)).rows[0].id);
  otherClassId = Number((await db.execute(sql`
    INSERT INTO classes (name, age_min, age_max, capacity, room_location, service_slot)
    VALUES (${`${prefix}-other`}, 1, 12, 500, 'B', '10:30am') RETURNING id
  `)).rows[0].id);

  const users = await db.execute(sql`
    INSERT INTO users (email, password_hash, first_name, last_name, role, status, is_active, primary_class_id)
    VALUES
      (${`${prefix}-teacher@test`}, 'x', 'Roster', 'Teacher', 'teacher', 'active', true, ${assignedClassId}),
      (${`${prefix}-admin@test`}, 'x', 'Roster', 'Admin', 'admin', 'active', true, null)
    RETURNING id, role
  `);
  const userRows = users.rows as Array<{ id: number; role: string }>;
  teacherId = Number(userRows.find(row => row.role === "teacher")!.id);
  adminId = Number(userRows.find(row => row.role === "admin")!.id);

  familyId = Number((await db.execute(sql`
    INSERT INTO families (family_code) VALUES (${`FAM-${prefix.slice(-8).toUpperCase()}`}) RETURNING id
  `)).rows[0].id);
  const children = await db.execute(sql`
    INSERT INTO children (family_id, first_name, last_name, dob, gender, current_class_id)
    VALUES
      (${familyId}, 'Assigned', 'Child', '2020-01-01', 'female', ${assignedClassId}),
      (${familyId}, 'Private', 'OtherClass', '2019-01-01', 'male', ${otherClassId})
    RETURNING id, first_name
  `);
  const childRows = children.rows as Array<{ id: number; first_name: string }>;
  assignedChildId = Number(childRows.find(row => row.first_name === "Assigned")!.id);
  otherChildId = Number(childRows.find(row => row.first_name === "Private")!.id);
});

afterAll(async () => {
  for (const query of [
    sql`DELETE FROM children WHERE id IN (${assignedChildId}, ${otherChildId})`,
    sql`DELETE FROM families WHERE id = ${familyId}`,
    sql`DELETE FROM users WHERE id IN (${teacherId}, ${adminId})`,
    sql`DELETE FROM classes WHERE id IN (${assignedClassId}, ${otherClassId})`,
  ]) {
    try { await db.execute(query); } catch {}
  }
});

databaseDescribe("GET /api/children/my-class-roster", () => {
  it("derives the class from the authenticated teacher and excludes other classes", async () => {
    const response = await request(app)
      .get(`/api/children/my-class-roster?classId=${otherClassId}`)
      .set("Authorization", token(teacherId, "teacher"))
      .expect(200);

    expect(response.body.class).toEqual({ id: assignedClassId, name: `${prefix}-assigned` });
    expect(response.body.total).toBe(1);
    expect(response.body.data).toEqual([
      expect.objectContaining({
        id: assignedChildId,
        firstName: "Assigned",
        lastName: "Child",
        class: { id: assignedClassId, name: `${prefix}-assigned` },
      }),
    ]);
    expect(response.body.data.some((child: { id: number }) => child.id === otherChildId)).toBe(false);
    expect(response.body.data[0]).not.toHaveProperty("familyId");
    expect(response.body.data[0]).not.toHaveProperty("medicalNotes");
    expect(response.body.data[0]).not.toHaveProperty("allergies");
  });

  it("rejects non-teacher roles", async () => {
    await request(app)
      .get("/api/children/my-class-roster")
      .set("Authorization", token(adminId, "admin"))
      .expect(403);
  });
});