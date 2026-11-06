import { createHash, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, usersTable, meetingsTable, meetingParticipantsTable, auditLogsTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import app from "../app";
import { generateToken } from "../middlewares/auth";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
databaseDescribe("meeting attendance isolated from Sunday attendance", () => {
  const marker = `meeting-test-${randomUUID()}`;
  const ids: number[] = [], meetings: number[] = [];
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  const input = () => ({
    title: "Synthetic teacher meeting",
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 3600_000).toISOString(),
  });
  const api = (role: string) => ({
    get: (path: string) => request(app).get(path).auth(tokens[role], { type: "bearer" }),
    post: (path: string, body = {}) => request(app).post(path).auth(tokens[role], { type: "bearer" }).send(body),
    put: (path: string, body = {}) => request(app).put(path).auth(tokens[role], { type: "bearer" }).send(body),
    patch: (path: string, body = {}) => request(app).patch(path).auth(tokens[role], { type: "bearer" }).send(body),
    delete: (path: string) => request(app).delete(path).auth(tokens[role], { type: "bearer" }),
  });
  async function create() {
    const result = await api("admin").post("/api/meetings", input()).expect(201);
    meetings.push(result.body.id);
    return result.body.id as number;
  }
  async function activate(id: number, teacherIds = [userIds.teacher]) {
    return api("admin").put(`/api/meetings/${id}/participants`, { teacherIds }).expect(200);
  }
  async function issue(id: number) {
    const response = await api("admin").post(`/api/meetings/${id}/qr`).expect(200);
    return response.body.token as string;
  }
  beforeAll(async () => {
    for (const key of ["admin", "super_admin", "teacher", "teacher2", "parent", "support", "inactive"]) {
      const role = key === "teacher2" || key === "inactive" ? "teacher" : key as "admin" | "super_admin" | "teacher" | "parent" | "support";
      const [user] = await db.insert(usersTable).values({
        email: `${marker}-${key}@example.test`, firstName: key === "teacher" ? "=Formula" : "Synthetic",
        lastName: key, passwordHash: "not-a-login-password", role, status: "active", isActive: key !== "inactive",
      }).returning();
      ids.push(user.id);
      userIds[key] = user.id;
      tokens[key] = generateToken({
        userId: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName,
        sessionVersion: user.sessionVersion,
      });
    }
  });
  afterAll(async () => {
    if (ids.length) await db.delete(auditLogsTable).where(inArray(auditLogsTable.userId, ids));
    if (meetings.length) await db.delete(meetingsTable).where(inArray(meetingsTable.id, meetings));
    if (ids.length) await db.delete(usersTable).where(inArray(usersTable.id, ids));
  });
  it("requires login and restricts creation/management/reporting to administrators", async () => {
    await request(app).get("/api/meetings").expect(401);
    for (const role of ["parent", "teacher", "support"]) {
      await api(role).post("/api/meetings", input()).expect(403);
      await api(role).get("/api/meetings/teachers").expect(403);
      await api(role).get("/api/meetings/1/report?format=csv").expect(403);
    }
    await api("super_admin").get("/api/meetings/teachers").expect(200);
    await api("inactive").get("/api/meetings").expect(401);
  });
  it("validates input and limits activation to active teacher accounts", async () => {
    await api("admin").post("/api/meetings", { ...input(), title: "   " }).expect(400);
    await api("admin").post("/api/meetings", { ...input(), endsAt: "invalid" }).expect(400);
    const id = await create();
    await api("admin").post(`/api/meetings/${id}/qr`).expect(409);
    for (const bad of [userIds.parent, userIds.inactive, 1.5]) {
      await api("admin").put(`/api/meetings/${id}/participants`, { teacherIds: [bad] }).expect(400);
    }
  });
  it("only activated teachers can scan and concurrent scans record one server timestamp", async () => {
    const id = await create();
    await activate(id);
    const token = await issue(id);
    await api("teacher2").post("/api/meetings/scan", { token }).expect(403);
    await api("parent").post("/api/meetings/scan", { token }).expect(403);
    await api("teacher").post("/api/meetings/scan", { token, userId: userIds.teacher2 }).expect(400);
    const responses = await Promise.all(Array.from({ length: 4 }, () => api("teacher").post("/api/meetings/scan", { token })));
    expect(responses.every(r => r.status === 200)).toBe(true);
    expect(responses.filter(r => !r.body.duplicate)).toHaveLength(1);
    expect(new Set(responses.map(r => r.body.signedInAt)).size).toBe(1);
    const rows = await db.select().from(meetingParticipantsTable).where(eq(meetingParticipantsTable.meetingId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].signedInAt?.getTime()).toBeGreaterThan(Date.now() - 60_000);
    const audits = await db.select().from(auditLogsTable).where(and(eq(auditLogsTable.entityId, id), eq(auditLogsTable.action, "meeting_signed_in")));
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits)).not.toContain(token);
    const mine = await api("teacher").get("/api/meetings").expect(200);
    expect(mine.body.find((m: { id: number }) => m.id === id).signedInAt).toBeTruthy();
    expect((await api("teacher2").get("/api/meetings")).body.some((m: { id: number }) => m.id === id)).toBe(false);
    // Dedicated tables: meeting sign-ins must not create Sunday scan/clock records.
    const scans = await db.execute(sql`SELECT count(*)::int AS n FROM staff_scans WHERE user_id=${userIds.teacher}`);
    expect(scans.rows[0].n).toBe(0);
  });
  it("revokes old QR codes on replacement, closure and edits", async () => {
    const id = await create(); await activate(id);
    const fingerprint = async () => (await api("admin").get(`/api/meetings/${id}`).expect(200)).body.meeting.qrFingerprint;
    const sha = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);
    const old = await issue(id);
    expect(await fingerprint()).toBe(sha(old));
    const token = await issue(id);
    // Admin devices use this to hide a saved code once it has been replaced elsewhere.
    expect(await fingerprint()).toBe(sha(token));
    expect(sha(token)).not.toBe(sha(old));
    expect(JSON.stringify((await api("teacher").get("/api/meetings")).body)).not.toContain("qrFingerprint");
    await api("teacher").post("/api/meetings/scan", { token: old }).expect(409);
    await api("admin").post(`/api/meetings/${id}/close`).expect(200);
    expect(await fingerprint()).toBeNull();
    await api("teacher").post("/api/meetings/scan", { token }).expect(409);
    const reopened = await issue(id);
    await api("admin").patch(`/api/meetings/${id}`, { ...input(), title: "Updated meeting" }).expect(200);
    await api("teacher").post("/api/meetings/scan", { token: reopened }).expect(409);
  });
  it("rejects early and expired scans according to server time", async () => {
    const id = await create(); await activate(id);
    const token = await issue(id);
    await db.update(meetingsTable).set({ startsAt: new Date(Date.now() + 60_000) }).where(eq(meetingsTable.id, id));
    await api("teacher").post("/api/meetings/scan", { token }).expect(409);
    await db.update(meetingsTable).set({
      startsAt: new Date(Date.now() - 3600_000), endsAt: new Date(Date.now() - 1000),
    }).where(eq(meetingsTable.id, id));
    await api("teacher").post("/api/meetings/scan", { token }).expect(409);
    await api("admin").post(`/api/meetings/${id}/qr`).expect(409);
  });
  it("deactivation retains attendance and reports include actual sign-in times", async () => {
    const id = await create(); await activate(id, [userIds.teacher, userIds.teacher2]);
    const token = await issue(id);
    await api("teacher").post("/api/meetings/scan", { token }).expect(200);
    await activate(id, [userIds.teacher2]);
    await api("teacher").post("/api/meetings/scan", { token }).expect(403);
    const detail = await api("admin").get(`/api/meetings/${id}`).expect(200);
    expect(detail.body.meeting.activatedCount).toBe(1);
    expect(detail.body.meeting.attendedCount).toBe(1);
    expect(detail.body.participants.find((p: { userId: number }) => p.userId === userIds.teacher).signedInAt).toBeTruthy();
    const csv = await api("admin").get(`/api/meetings/${id}/report?format=csv`).expect(200);
    expect(csv.text).toContain("'=Formula");
    expect(csv.text).toContain("Not signed in");
    expect(csv.text).toContain("Deactivated");
    expect(csv.text).toContain("WAT");
    const pdf = await api("super_admin").get(`/api/meetings/${id}/report?format=pdf`).expect(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(Buffer.from(pdf.body).subarray(0, 4).toString()).toBe("%PDF");
    await api("teacher").get(`/api/meetings/${id}`).expect(403);
    const audits = await db.select().from(auditLogsTable).where(and(eq(auditLogsTable.entityId, id), eq(auditLogsTable.action, "meeting_report_export")));
    expect(audits).toHaveLength(2);
  });
  it("lets only administrators delete a meeting, removing its records and leaving an audit entry", async () => {
    const id = await create();
    await activate(id, [userIds.teacher, userIds.teacher2]);
    const token = await issue(id);
    await api("teacher").post("/api/meetings/scan", { token }).expect(200);
    for (const role of ["parent", "teacher", "support"]) await api(role).delete(`/api/meetings/${id}`).expect(403);
    await api("admin").delete("/api/meetings/abc").expect(400);
    await api("admin").delete(`/api/meetings/${id}`).expect(200, { success: true });
    expect(await db.select().from(meetingsTable).where(eq(meetingsTable.id, id))).toHaveLength(0);
    expect(await db.select().from(meetingParticipantsTable).where(eq(meetingParticipantsTable.meetingId, id))).toHaveLength(0);
    // The deleted meeting's QR can no longer be used and it disappears from every list.
    await api("teacher2").post("/api/meetings/scan", { token }).expect(404);
    expect((await api("teacher").get("/api/meetings")).body.some((m: { id: number }) => m.id === id)).toBe(false);
    await api("admin").get(`/api/meetings/${id}`).expect(404);
    await api("super_admin").delete(`/api/meetings/${id}`).expect(404);
    const [audit] = await db.select().from(auditLogsTable)
      .where(and(eq(auditLogsTable.entityId, id), eq(auditLogsTable.action, "meeting_deleted")));
    expect(audit.userId).toBe(userIds.admin);
    expect(JSON.parse(audit.metadataJson!)).toMatchObject({ title: "Synthetic teacher meeting", activatedCount: 2, attendedCount: 1 });
  });
});
