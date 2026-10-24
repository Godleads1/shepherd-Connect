import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  role: "super_admin", authenticated: true,
  transaction: vi.fn(), audit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@workspace/db", async importOriginal => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, db: { transaction: mocks.transaction, insert: () => ({ values: mocks.audit }) } };
});
vi.mock("../middlewares/auth", () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    if (!mocks.authenticated) return res.sendStatus(401);
    req.user = { userId: 1, role: mocks.role }; req.log = { error: vi.fn() }; next();
  },
  requireRoles: (...roles: string[]) => (_req: any, res: any, next: any) => roles.includes(mocks.role) ? next() : res.sendStatus(403),
}));
import router, { teacherReportCsv } from "../routes/teacherAttendanceReports";
const app = express().use("/api", router);
const url = "/api/reports/teacher-attendance?period=year&value=2026";
const result = {
  rows: [{ teacherId: 1, teacherName: "Synthetic Teacher", date: "2026-10-18", service: "1st", clockIn: "2026-10-18T06:00:00.000Z", clockOut: null, emergencyOut: null }],
  teachers: [{ teacherId: 1, teacherName: "Synthetic Teacher", services: 1, days: 1, checkIns: 1, clockOuts: 0, missingClockOuts: 1, emergencyExits: 0 }],
  summary: { teachers: 1, teachersWithScans: 1, serviceRecords: 1, checkIns: 1, clockOuts: 0, missingClockOuts: 1, emergencyExits: 0 },
};
beforeEach(() => {
  vi.clearAllMocks(); mocks.role = "super_admin"; mocks.authenticated = true;
  mocks.transaction.mockResolvedValue(result); mocks.audit.mockResolvedValue(undefined);
});
describe("teacher attendance report boundary", () => {
  it("requires authentication and operational report roles", async () => {
    mocks.authenticated = false;
    expect((await request(app).get(url)).status).toBe(401);
    mocks.authenticated = true;
    for (const role of ["parent", "teacher", "support"]) {
      mocks.role = role;
      expect((await request(app).get(url)).status).toBe(403);
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("allows super admin and existing admin report access with full-year boundaries", async () => {
    for (const role of ["super_admin", "admin"]) {
      mocks.role = role;
      const res = await request(app).get(url);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ from: "2026-01-01", to: "2026-12-31", ...result });
    }
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("rejects Saturday or invalid filters before querying", async () => {
    expect((await request(app).get("/api/reports/teacher-attendance?period=sunday&value=2026-10-17")).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("exports WAT detail CSV and records an audit", async () => {
    const res = await request(app).get(`${url}&format=csv`);
    expect(res.status).toBe(200);
    expect(res.text).toContain("07:00");
    expect(res.text).toContain("Not recorded");
    expect(res.headers["content-disposition"]).toContain("2026-01-01-to-2026-12-31");
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it("exports summary CSV and neutralizes spreadsheet formulas", async () => {
    const res = await request(app).get(`${url}&format=csv&view=summary`);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Missing out");
    expect(teacherReportCsv([['=CMD()', 'a"b']])).toBe('"\'=CMD()","a""b"');
  });
  it("exports a real PDF for both views", async () => {
    for (const view of ["detail", "summary"]) {
      const res = await request(app).get(`${url}&format=pdf&view=${view}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.body.subarray(0, 4).toString()).toBe("%PDF");
    }
  });
  it("refuses truncated results or an unauditable export", async () => {
    mocks.transaction.mockResolvedValueOnce(null);
    expect((await request(app).get(url)).status).toBe(422);
    mocks.audit.mockRejectedValueOnce(new Error("audit unavailable"));
    expect((await request(app).get(`${url}&format=pdf`)).status).toBe(500);
  });
});
