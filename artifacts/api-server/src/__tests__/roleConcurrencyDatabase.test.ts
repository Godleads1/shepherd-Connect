import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

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

import app from "../app";
import { generateToken } from "../middlewares/auth";
import { canonicalPendingRoles, canonicalSecondaryRoles } from "../lib/roleMutations";

const prefix = `phase3-roles-${Date.now()}`;
const superAdminEmail = `${prefix}-admin@example.test`;
const targetEmail = `${prefix}-target@example.test`;
let superAdminId = 0;
let targetId = 0;
let authorization = "";

const databaseDescribe = process.env.RUN_DATABASE_ROLE_TESTS === "true" ? describe : describe.skip;

describe("role set canonicalization", () => {
  it("keeps known secondary roles once and excludes the primary role", () => {
    expect(canonicalSecondaryRoles(
      JSON.stringify(["teacher", "support", "teacher", "parent", "unknown"]),
      "parent",
    )).toEqual(["teacher", "support"]);
  });

  it("keeps known pending roles once", () => {
    expect(canonicalPendingRoles(
      JSON.stringify(["teacher", "support", "teacher", "unknown"]),
    )).toEqual(["teacher", "support"]);
  });
});

async function roleState() {
  const result = await db.execute(sql`
    SELECT role, secondary_roles, pending_roles
    FROM users
    WHERE id = ${targetId}
  `);
  return result.rows[0] as {
    role: string;
    secondary_roles: string | null;
    pending_roles: string | null;
  };
}

async function setRoleState(
  role: "super_admin" | "admin" | "teacher" | "support" | "parent",
  secondary: string[],
  pending: string[],
) {
  await db.execute(sql`
    UPDATE users
    SET role = ${role},
        secondary_roles = ${JSON.stringify(secondary)},
        pending_roles = ${JSON.stringify(pending)}
    WHERE id = ${targetId}
  `);
}

databaseDescribe("multi-role PostgreSQL concurrency integrity", () => {
  beforeAll(async () => {
    const inserted = await db.execute(sql`
      INSERT INTO users (
        email, password_hash, first_name, last_name, role, status, is_active,
        secondary_roles, pending_roles
      )
      VALUES
        (${superAdminEmail}, 'not-used', 'Phase', 'Admin', 'super_admin', 'active', true, '[]', '[]'),
        (${targetEmail}, 'not-used', 'Phase', 'Target', 'parent', 'active', true, '[]', '[]')
      RETURNING id, email
    `);
    for (const row of inserted.rows as Array<{ id: number; email: string }>) {
      if (row.email === superAdminEmail) superAdminId = row.id;
      if (row.email === targetEmail) targetId = row.id;
    }
    authorization = `Bearer ${generateToken({
      userId: superAdminId,
      email: superAdminEmail,
      role: "super_admin",
      firstName: "Phase",
      lastName: "Admin",
    })}`;
  });

  beforeEach(async () => {
    await setRoleState("parent", [], []);
  });

  afterAll(async () => {
    await db.execute(sql`
      DELETE FROM teachers
      WHERE user_id IN (SELECT id FROM users WHERE email LIKE ${`${prefix}%`})
    `);
    await db.execute(sql`DELETE FROM users WHERE email LIKE ${`${prefix}%`}`);
  });

  it("preserves concurrent Teacher and Support approved additions", async () => {
    const replies = await Promise.all([
      request(app).post(`/api/users/${targetId}/grant-role`).set("Authorization", authorization).send({ role: "teacher" }),
      request(app).post(`/api/users/${targetId}/grant-role`).set("Authorization", authorization).send({ role: "support" }),
    ]);

    expect(replies.every(reply => reply.status === 200)).toBe(true);
    expect(JSON.parse((await roleState()).secondary_roles ?? "[]").sort()).toEqual(["support", "teacher"]);
  });

  it("preserves a concurrent Support addition while removing Teacher", async () => {
    await setRoleState("parent", ["teacher"], []);
    const replies = await Promise.all([
      request(app).post(`/api/users/${targetId}/grant-role`).set("Authorization", authorization).send({ role: "support" }),
      request(app).delete(`/api/users/${targetId}/grant-role/teacher`).set("Authorization", authorization),
    ]);

    expect(replies.every(reply => reply.status === 200)).toBe(true);
    expect(JSON.parse((await roleState()).secondary_roles ?? "[]")).toEqual(["support"]);
  });

  it("matches sequential conflict behavior for four concurrent same-role grants", async () => {
    const replies = await Promise.all(Array.from({ length: 4 }, () =>
      request(app).post(`/api/users/${targetId}/grant-role`).set("Authorization", authorization).send({ role: "teacher" }),
    ));

    expect(replies.filter(reply => reply.status === 200)).toHaveLength(1);
    expect(replies.filter(reply => reply.status === 400)).toHaveLength(3);
    expect(JSON.parse((await roleState()).secondary_roles ?? "[]")).toEqual(["teacher"]);
  });

  it("approves Teacher without losing pending Support", async () => {
    await setRoleState("parent", [], ["teacher", "support"]);
    expect((await request(app).post(`/api/users/${targetId}/approve-role`).set("Authorization", authorization).send({ role: "teacher" })).status).toBe(200);
    const state = await roleState();
    expect(JSON.parse(state.secondary_roles ?? "[]")).toEqual(["teacher"]);
    expect(JSON.parse(state.pending_roles ?? "[]")).toEqual(["support"]);
  });

  it("rejects Teacher without losing pending Support", async () => {
    await setRoleState("parent", [], ["teacher", "support"]);
    expect((await request(app).post(`/api/users/${targetId}/reject-role`).set("Authorization", authorization).send({ role: "teacher" })).status).toBe(200);
    expect(JSON.parse((await roleState()).pending_roles ?? "[]")).toEqual(["support"]);
  });

  it("approves Teacher while preserving existing Parent and Support access", async () => {
    await setRoleState("parent", ["support"], ["teacher"]);
    expect((await request(app).post(`/api/users/${targetId}/approve-role`).set("Authorization", authorization).send({ role: "teacher" })).status).toBe(200);
    const state = await roleState();
    expect(state.role).toBe("parent");
    expect(JSON.parse(state.secondary_roles ?? "[]").sort()).toEqual(["support", "teacher"]);
  });

  it("revokes Teacher without losing Support", async () => {
    await setRoleState("parent", ["teacher", "support"], []);
    expect((await request(app).delete(`/api/users/${targetId}/grant-role/teacher`).set("Authorization", authorization)).status).toBe(200);
    expect(JSON.parse((await roleState()).secondary_roles ?? "[]")).toEqual(["support"]);
  });

  it("removes a newly primary role from secondary roles without altering others", async () => {
    await setRoleState("parent", ["teacher", "support"], []);
    expect((await request(app).put(`/api/users/${targetId}`).set("Authorization", authorization).send({ role: "teacher" })).status).toBe(200);
    const state = await roleState();
    expect(state.role).toBe("teacher");
    expect(JSON.parse(state.secondary_roles ?? "[]")).toEqual(["support"]);
  });

  it("serializes account approval with teacher reassignment and keeps the profile consistent", async () => {
    await db.execute(sql`UPDATE users SET status = 'pending_approval', is_active = false WHERE id = ${targetId}`);
    const replies = await Promise.all([
      request(app).put(`/api/users/${targetId}/approve`).set("Authorization", authorization),
      request(app).post(`/api/users/${targetId}/reassign-role`).set("Authorization", authorization).send({ role: "teacher" }),
    ]);

    expect(replies.every(reply => reply.status === 200)).toBe(true);
    const state = await roleState();
    expect(state.role).toBe("teacher");
    const profile = await db.execute(sql`SELECT count(*)::int AS count FROM teachers WHERE user_id = ${targetId}`);
    expect(profile.rows[0]).toMatchObject({ count: 1 });
  });

  it("rejects a removed-role token while preserving remaining roles and role switching", async () => {
    await setRoleState("parent", ["teacher", "support"], []);
    const tokenFor = (role: string) => generateToken({
      userId: targetId,
      email: targetEmail,
      role,
      firstName: "Phase",
      lastName: "Target",
    });
    const teacherToken = tokenFor("teacher");
    const parentToken = tokenFor("parent");
    const supportToken = tokenFor("support");

    expect((await request(app).delete(`/api/users/${targetId}/grant-role/teacher`).set("Authorization", authorization)).status).toBe(200);
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${teacherToken}`)).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${parentToken}`)).status).toBe(200);
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${supportToken}`)).status).toBe(200);
    const switched = await request(app)
      .post("/api/auth/switch-role")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ role: "support" });
    expect(switched.status).toBe(200);
    expect(switched.body.user.role).toBe("support");
  });
});