import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import { generateToken } from "../middlewares/auth";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `authorization-routes-${Date.now()}`;
const ids: Record<string, number> = {};

function auth(role: string, id = ids[role]) {
  return `Bearer ${generateToken({
    userId: id,
    email: `${prefix}-${role}@test`,
    role,
    firstName: "Authorization",
    lastName: role,
  })}`;
}

beforeAll(async () => {
  const classes = await db.execute(sql`
    INSERT INTO classes (name, age_min, age_max, capacity, room_location, service_slot)
    VALUES (${`${prefix}-assigned`}, 1, 12, 100, 'A', '7am'),
           (${`${prefix}-other`}, 1, 12, 100, 'B', '10:30am')
    RETURNING id
  `);
  ids.assignedClass = Number(classes.rows[0].id);
  ids.otherClass = Number(classes.rows[1].id);

  const users = await db.execute(sql`
    INSERT INTO users (email, password_hash, first_name, last_name, role, status, is_active, primary_class_id)
    VALUES
      (${`${prefix}-parent@test`}, 'x', 'Own', 'Parent', 'parent', 'active', true, null),
      (${`${prefix}-other-parent@test`}, 'x', 'Other', 'Parent', 'parent', 'active', true, null),
      (${`${prefix}-teacher@test`}, 'x', 'Own', 'Teacher', 'teacher', 'active', true, ${ids.assignedClass}),
      (${`${prefix}-other-teacher@test`}, 'x', 'Other', 'Teacher', 'teacher', 'active', true, ${ids.otherClass}),
      (${`${prefix}-support@test`}, 'x', 'Test', 'Support', 'support', 'active', true, null),
      (${`${prefix}-admin@test`}, 'x', 'Test', 'Admin', 'admin', 'active', true, null),
      (${`${prefix}-super_admin@test`}, 'x', 'Test', 'Super', 'super_admin', 'active', true, null)
    RETURNING id, role, email
  `);
  for (const row of users.rows as Array<{ id: number; role: string; email: string }>) {
    const key = row.email.includes("other-parent") ? "otherParent"
      : row.email.includes("other-teacher") ? "otherTeacher" : row.role;
    ids[key] = Number(row.id);
  }

  ids.ownFamily = Number((await db.execute(sql`
    INSERT INTO families (family_code, parent_1_id, notes) VALUES (${`OWN-${prefix.slice(-8)}`}, ${ids.parent}, 'internal only') RETURNING id
  `)).rows[0].id);
  ids.otherFamily = Number((await db.execute(sql`
    INSERT INTO families (family_code, parent_1_id) VALUES (${`OTH-${prefix.slice(-8)}`}, ${ids.otherParent}) RETURNING id
  `)).rows[0].id);
  ids.ownChild = Number((await db.execute(sql`
    INSERT INTO children (family_id, first_name, last_name, dob, gender, current_class_id)
    VALUES (${ids.ownFamily}, 'Assigned', 'Child', '2020-01-01', 'female', ${ids.assignedClass}) RETURNING id
  `)).rows[0].id);
  ids.otherChild = Number((await db.execute(sql`
    INSERT INTO children (family_id, first_name, last_name, dob, gender, current_class_id)
    VALUES (${ids.otherFamily}, 'Unrelated', 'Child', '2020-01-01', 'male', ${ids.otherClass}) RETURNING id
  `)).rows[0].id);
  ids.ownDelegate = Number((await db.execute(sql`
    INSERT INTO pickup_delegates (child_id, name, phone, parent_approved)
    VALUES (${ids.ownChild}, 'Own Delegate', '08030000000', false) RETURNING id
  `)).rows[0].id);
  ids.otherDelegate = Number((await db.execute(sql`
    INSERT INTO pickup_delegates (child_id, name, phone, parent_approved)
    VALUES (${ids.otherChild}, 'Other Delegate', '08030000001', false) RETURNING id
  `)).rows[0].id);
  await db.execute(sql`UPDATE children SET face_descriptor_json=${JSON.stringify(Array(128).fill(0.25))} WHERE id IN (${ids.ownChild}, ${ids.otherChild})`);
});

afterAll(async () => {
  for (const query of [
    sql`DELETE FROM safeguarding_records WHERE teacher_user_id IN (${ids.teacher}, ${ids.otherTeacher})`,
    sql`DELETE FROM pickup_delegates WHERE id IN (${ids.ownDelegate}, ${ids.otherDelegate})`,
    sql`DELETE FROM children WHERE id IN (${ids.createdChild ?? -1}, ${ids.ownChild}, ${ids.otherChild})`,
    sql`DELETE FROM families WHERE id IN (${ids.ownFamily}, ${ids.otherFamily})`,
    sql`DELETE FROM users WHERE email LIKE ${`${prefix}-%`}`,
    sql`DELETE FROM classes WHERE id IN (${ids.assignedClass}, ${ids.otherClass})`,
  ]) {
    try { await db.execute(query); } catch {}
  }
});

databaseDescribe("explicit family and child route authorization", () => {
  it("uses 401 without authentication and scopes parents to owned resources", async () => {
    await request(app).get(`/api/families/${ids.ownFamily}`).expect(401);
    await request(app).get(`/api/families/${ids.ownFamily}`).set("Authorization", auth("parent")).expect(200);
    await request(app).get(`/api/families/${ids.otherFamily}`).set("Authorization", auth("parent")).expect(403);
    await request(app).get(`/api/children/${ids.ownChild}`).set("Authorization", auth("parent")).expect(200);
    await request(app).get(`/api/children/${ids.otherChild}`).set("Authorization", auth("parent")).expect(403);
  });

  it.each(["parent", "teacher", "support", "admin"] as const)(
    "never discloses biometric templates in %s generic child or family responses",
    async role => {
      const token = auth(role);
      const child = await request(app).get(`/api/children/${ids.ownChild}`).set("Authorization", token).expect(200);
      expect(child.body).not.toHaveProperty("faceDescriptorJson");
      expect(child.body).toHaveProperty("hasFaceDescriptor", true);
      const childList = await request(app).get(`/api/children?familyId=${ids.ownFamily}`).set("Authorization", token).expect(200);
      const listedChild = childList.body.data.find((item: { id: number }) => item.id === ids.ownChild);
      expect(listedChild, `child ${ids.ownChild} missing from child list`).toBeDefined();
      expect(listedChild).not.toHaveProperty("faceDescriptorJson");
      expect(listedChild).toHaveProperty("hasFaceDescriptor", true);
      const family = await request(app).get(`/api/families/${ids.ownFamily}`).set("Authorization", token).expect(200);
      expect(family.body.children[0]).not.toHaveProperty("faceDescriptorJson");
      expect(family.body.children[0]).toHaveProperty("hasFaceDescriptor", true);
      expect(family.body).not.toHaveProperty("notes");
      const familyList = await request(app).get("/api/families?search=Own").set("Authorization", token);
      expect(familyList.status).toBe(200);
      expect(familyList.body).toMatchObject({ data: expect.any(Array), total: expect.any(Number) });
      const listedFamily = familyList.body.data.find((item: { id: number }) => item.id === ids.ownFamily);
      expect(listedFamily, `family ${ids.ownFamily} missing from family list`).toBeDefined();
      const listedFamilyChild = listedFamily.children.find((item: { id: number }) => item.id === ids.ownChild);
      expect(listedFamilyChild, `child ${ids.ownChild} missing from listed family`).toBeDefined();
      expect(listedFamilyChild).not.toHaveProperty("faceDescriptorJson");
      expect(listedFamilyChild).toHaveProperty("hasFaceDescriptor", true);
      const tree = await request(app).get(`/api/families/${ids.ownFamily}/tree`).set("Authorization", token).expect(200);
      expect(tree.body.children[0]).not.toHaveProperty("faceDescriptorJson");
      expect(tree.body.children[0]).toHaveProperty("hasFaceDescriptor", true);
      expect(tree.body.family).not.toHaveProperty("notes");
    },
  );

  it("persists permitted parent biometric writes without returning the template", async () => {
    const descriptorJson = JSON.stringify(Array(128).fill(0.5));
    const response = await request(app).put(`/api/children/${ids.ownChild}/face-descriptor`)
      .set("Authorization", auth("parent"))
      .send({ descriptorJson, consentGiven: true })
      .expect(200);
    expect(response.body).not.toHaveProperty("faceDescriptorJson");
    expect(response.body).toHaveProperty("hasFaceDescriptor", true);
    const stored = await db.execute(sql`SELECT face_descriptor_json FROM children WHERE id=${ids.ownChild}`);
    expect(stored.rows[0].face_descriptor_json).toBe(descriptorJson);
  });

  it("never returns a biometric template from generic child create or update", async () => {
    const create = await request(app).post("/api/children").set("Authorization", auth("parent")).send({
      familyId: ids.ownFamily,
      firstName: "Response",
      lastName: "Safe",
      dob: "2020-01-01",
      gender: "female",
    }).expect(201);
    ids.createdChild = create.body.id;
    expect(create.body).not.toHaveProperty("faceDescriptorJson");
    expect(create.body).toHaveProperty("hasFaceDescriptor", false);

    const update = await request(app).put(`/api/children/${ids.createdChild}`).set("Authorization", auth("parent")).send({
      familyId: ids.ownFamily,
      firstName: "Response",
      lastName: "Safe",
      dob: "2020-01-01",
      gender: "female",
    }).expect(200);
    expect(update.body).not.toHaveProperty("faceDescriptorJson");
    expect(update.body).toHaveProperty("hasFaceDescriptor", false);
  });

  it("allows allocated teacher reads, rejects unrelated reads and every generic mutation", async () => {
    await request(app).get(`/api/families/${ids.ownFamily}`).set("Authorization", auth("teacher")).expect(200);
    await request(app).get(`/api/families/${ids.otherFamily}`).set("Authorization", auth("teacher")).expect(403);
    await request(app).get(`/api/children/${ids.ownChild}`).set("Authorization", auth("teacher")).expect(200);
    await request(app).get(`/api/children/${ids.otherChild}`).set("Authorization", auth("teacher")).expect(403);
    await request(app).post("/api/families").set("Authorization", auth("teacher")).send({}).expect(403);
    await request(app).put(`/api/families/${ids.ownFamily}`).set("Authorization", auth("teacher")).send({}).expect(403);
    await request(app).post("/api/children").set("Authorization", auth("teacher")).send({}).expect(403);
    await request(app).put(`/api/children/${ids.ownChild}`).set("Authorization", auth("teacher")).send({}).expect(403);
    await request(app).put(`/api/children/${ids.ownChild}/face-descriptor`).set("Authorization", auth("teacher")).send({}).expect(403);
    await request(app).delete(`/api/children/${ids.ownChild}/face-descriptor`).set("Authorization", auth("teacher")).expect(403);
  });

  it.each(["support", "admin", "super_admin"])("preserves %s operational reads", async role => {
    await request(app).get("/api/families").set("Authorization", auth(role)).expect(200);
    await request(app).get("/api/children").set("Authorization", auth(role)).expect(200);
    await request(app).get("/api/pickup-delegates").set("Authorization", auth(role)).expect(200);
  });
});

databaseDescribe("explicit safeguarding and pickup delegate authorization", () => {
  it("limits safeguarding teacher lookup to self and administrators", async () => {
    await request(app).get(`/api/safeguarding/teacher/${ids.teacher}`).set("Authorization", auth("teacher")).expect(200);
    await request(app).get(`/api/safeguarding/teacher/${ids.otherTeacher}`).set("Authorization", auth("teacher")).expect(403);
    await request(app).get(`/api/safeguarding/teacher/${ids.teacher}`).set("Authorization", auth("support")).expect(403);
    await request(app).get(`/api/safeguarding/teacher/${ids.teacher}`).set("Authorization", auth("admin")).expect(200);
    await request(app).get(`/api/safeguarding/teacher/${ids.teacher}`).set("Authorization", auth("super_admin")).expect(200);
  });

  it("scopes parent delegates and rejects teachers from every authenticated delegate action", async () => {
    await request(app).get(`/api/pickup-delegates/${ids.ownDelegate}`).set("Authorization", auth("parent")).expect(200);
    await request(app).get(`/api/pickup-delegates/${ids.otherDelegate}`).set("Authorization", auth("parent")).expect(403);
    const teacher = auth("teacher");
    await request(app).get("/api/pickup-delegates").set("Authorization", teacher).expect(403);
    await request(app).post("/api/pickup-delegates").set("Authorization", teacher).send({}).expect(403);
    await request(app).get(`/api/pickup-delegates/operations/${crypto.randomUUID()}`).set("Authorization", teacher).expect(403);
    await request(app).get(`/api/pickup-delegates/${ids.ownDelegate}`).set("Authorization", teacher).expect(403);
    await request(app).put(`/api/pickup-delegates/${ids.ownDelegate}/approve`).set("Authorization", teacher).expect(403);
    await request(app).post(`/api/pickup-delegates/${ids.ownDelegate}/notify-parent`).set("Authorization", teacher).expect(403);
    await request(app).post(`/api/pickup-delegates/${ids.ownDelegate}/approve`).set("Authorization", teacher).expect(403);
    await request(app).post(`/api/pickup-delegates/${ids.ownDelegate}/deny`).set("Authorization", teacher).expect(403);
    await request(app).delete(`/api/pickup-delegates/${ids.ownDelegate}`).set("Authorization", teacher).expect(403);
  });
});