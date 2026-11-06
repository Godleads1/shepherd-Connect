import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, usersTable, sundayQrCodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import app from "../app";
import { generateToken } from "../middlewares/auth";
import { hashStaffQrToken } from "../routes/sundayAttendance";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
databaseDescribe("Sunday QR fingerprint for device-local display", () => {
  const marker = `sunday-qr-fp-${randomUUID()}`;
  // A far-future date that real service data never uses.
  const serviceDate = `2099-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`;
  let adminId = 0, adminToken = "", teacherId = 0, teacherToken = "";

  beforeAll(async () => {
    await db.delete(sundayQrCodesTable).where(eq(sundayQrCodesTable.serviceDate, serviceDate));
    for (const role of ["admin", "teacher"] as const) {
      const [u] = await db.insert(usersTable).values({
        email: `${marker}-${role}@example.test`, firstName: "Synthetic", lastName: role,
        passwordHash: "not-a-login-password", role, status: "active", isActive: true,
      }).returning();
      const token = generateToken({ userId: u.id, email: u.email, role: u.role, firstName: u.firstName, lastName: u.lastName, sessionVersion: u.sessionVersion });
      if (role === "admin") { adminId = u.id; adminToken = token; } else { teacherId = u.id; teacherToken = token; }
    }
  });
  afterAll(async () => {
    await db.delete(sundayQrCodesTable).where(eq(sundayQrCodesTable.serviceDate, serviceDate));
    for (const id of [adminId, teacherId]) if (id) await db.delete(usersTable).where(eq(usersTable.id, id));
  });

  const summary = () => request(app).get(`/api/sunday-attendance/summary?date=${serviceDate}`).auth(adminToken, { type: "bearer" }).expect(200);
  const generate = (force: boolean) => request(app).post("/api/sunday-attendance/qr/generate")
    .auth(adminToken, { type: "bearer" }).send({ serviceDate, force }).expect(201);

  it("reports a non-secret identifier that tracks the active code", async () => {
    expect((await summary()).body.qrFingerprint).toBeNull();
    const first = await generate(false);
    expect(first.body.fingerprint).toBe(hashStaffQrToken(first.body.token).slice(0, 16));
    expect(first.body.fingerprint).not.toContain(first.body.token);
    expect((await summary()).body.qrFingerprint).toBe(first.body.fingerprint);

    const rotated = await generate(true);
    expect(rotated.body.fingerprint).not.toBe(first.body.fingerprint);
    expect((await summary()).body.qrFingerprint).toBe(rotated.body.fingerprint);

    await request(app).post("/api/sunday-attendance/qr/revoke").auth(adminToken, { type: "bearer" }).send({ serviceDate }).expect(200);
    const after = (await summary()).body;
    expect(after.hasQr).toBe(false);
    expect(after.qrFingerprint).toBeNull();
  });

  it("keeps the summary, and so the identifier, admin-only", async () => {
    await request(app).get(`/api/sunday-attendance/summary?date=${serviceDate}`).auth(teacherToken, { type: "bearer" }).expect(403);
  });
});
