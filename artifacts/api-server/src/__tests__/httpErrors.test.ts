import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => ({ db: { insert: () => ({ values: async () => undefined }) }, errorLogsTable: {} }));

import { classifyError, defaultEmptyBody, rejectInvalidNumericPathSegments, sendRouteError } from "../lib/httpErrors";
import { errorMonitorMiddleware } from "../middleware/errorMonitor";

function drizzleError(code: string) {
  const cause = Object.assign(new Error("db said no"), { code });
  return Object.assign(new Error("Failed query: select 1"), { cause });
}

describe("classifyError", () => {
  it.each([
    ["22003", 400], ["22P02", 400], ["22007", 400], ["22008", 400], ["23502", 400], ["23503", 409], ["23505", 409],
  ])("maps PostgreSQL %s to %i", (code, status) => {
    expect(classifyError(drizzleError(code))?.status).toBe(status);
  });

  it("maps drizzle's empty update to 400", () => {
    expect(classifyError(new Error("No values to set"))?.status).toBe(400);
  });

  it("keeps real faults as server errors", () => {
    expect(classifyError(new Error("connect ECONNREFUSED"))).toBeNull();
    expect(classifyError(drizzleError("08006"))).toBeNull();
    expect(classifyError(Object.assign(new Error("x"), { code: "ECONNREFUSED" }))).toBeNull();
  });
});

function testApp() {
  const app = express();
  app.use(express.json());
  app.use(defaultEmptyBody);
  app.use("/api", rejectInvalidNumericPathSegments);
  app.post("/api/things", (req, res) => { const { name } = req.body; res.json({ name: name ?? null }); });
  app.get("/api/things/:id", (req, res) => res.json({ id: Number(req.params.id) }));
  app.get("/api/objects/*path", (_req, res) => res.json({ ok: true }));
  app.get("/api/boom/:code", (req, _res, next) => next(drizzleError(req.params.code)));
  app.get("/api/route-catch", (req, res) => sendRouteError(req, res, drizzleError("22003"), "Failed"));
  app.get("/api/fault", () => { throw new Error("real bug"); });
  app.use(errorMonitorMiddleware as any);
  return app;
}

describe("request guards", () => {
  const app = testApp();

  it("treats a missing body as empty instead of crashing", async () => {
    await request(app).post("/api/things").expect(200, { name: null });
  });

  it("rejects malformed JSON with 400", async () => {
    await request(app).post("/api/things").set("content-type", "application/json").send('{"a": [}').expect(400);
  });

  it.each(["99999999999999999999", "2147483648", "-1", "1.5"])("rejects id %s with 400", async (id) => {
    await request(app).get(`/api/things/${id}`).expect(400);
  });

  it("accepts normal ids and non-numeric segments", async () => {
    await request(app).get("/api/things/2147483647").expect(200);
    await request(app).get("/api/objects/uploads/abc-123").expect(200);
  });

  it("maps database input errors to 4xx and real faults to 500", async () => {
    await request(app).get("/api/boom/22007").expect(400);
    await request(app).get("/api/boom/23505").expect(409);
    await request(app).get("/api/route-catch").expect(400);
    await request(app).get("/api/fault").expect(500, { error: "Internal server error" });
  });
});
