/**
 * API Smoke Tests
 *
 * Verify the essentials that must never regress:
 *  1. The health endpoint is always reachable.
 *  2. Every protected route rejects unauthenticated requests with 401.
 *  3. Every role-restricted route rejects the wrong role with 403.
 *  4. Input validation rejects malformed bodies with 400.
 *
 * These tests never hit the real database — the DB is mocked so
 * the express app can be imported without a real DATABASE_URL.
 */

import { vi, describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

// ── Mock all external dependencies before importing app ──────────────────────
// vi.mock calls are hoisted to the top by vitest even though they appear here.

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          id: 1,
          email: "test@test.com",
          role: "parent",
          firstName: "Test",
          lastName: "User",
          isActive: true,
          status: "active",
          secondaryRoles: JSON.stringify(["teacher", "support", "admin", "super_admin", "attendant"]),
        }]),
      }),
    }),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  usersTable: {
    id: "id",
    email: "email",
    role: "role",
    firstName: "firstName",
    lastName: "lastName",
    isActive: "isActive",
    status: "status",
    secondaryRoles: "secondaryRoles",
  },
  pool: { on: vi.fn(), connect: vi.fn(), end: vi.fn() },
}));

vi.mock("@workspace/db/schema", () => ({}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: vi.fn() } } },
}));

// Whatsapp service has side-effectful top-level code (Baileys auth-state setup).
// Mock it so importing routes/whatsapp.ts doesn't touch the filesystem.
vi.mock("../services/whatsapp", () => ({
  getWhatsAppState: vi.fn().mockReturnValue({ status: "disconnected" }),
  connectWhatsApp: vi.fn().mockResolvedValue(undefined),
  connectWithPhone: vi.fn().mockResolvedValue(undefined),
  disconnectWhatsApp: vi.fn().mockResolvedValue(undefined),
  sendWhatsAppToJid: vi.fn().mockResolvedValue(undefined),
  sendWhatsAppImageToJid: vi.fn().mockResolvedValue(undefined),
  initWhatsApp: vi.fn().mockResolvedValue(undefined),
  closeWhatsAppClean: vi.fn().mockResolvedValue(undefined),
}));

// ── Import app and auth helpers after mocks are registered ───────────────────

import app from "../app";
import { generateToken } from "../middlewares/auth";

// ── Token factory ─────────────────────────────────────────────────────────────

function token(role: string, userId = 1) {
  return `Bearer ${generateToken({
    userId,
    email: `${role}@test.com`,
    role,
    firstName: "Test",
    lastName: "User",
  })}`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/healthz", () => {
  it("returns 200 with status ok — always reachable", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("Authentication guard — 401 without a token", () => {
  const protectedRoutes: [string, string][] = [
    ["GET",    "/api/families"],
    ["GET",    "/api/children"],
    ["GET",    "/api/teachers"],
    ["GET",    "/api/users"],
    // GET /api/classes is intentionally public (parent app reads it without auth)
    ["GET",    "/api/attendance"],
    ["GET",    "/api/notifications"],
    ["GET",    "/api/messages"],
    // GET /api/settings/general and /api/settings/location are intentionally public
    ["GET",    "/api/dashboard/stats"],
    ["GET",    "/api/reports/attendance-export"],   // correct route path
    ["GET",    "/api/safeguarding"],
    ["GET",    "/api/pickup-delegates"],
    ["GET",    "/api/emergencies"],
    ["GET",    "/api/audit-logs"],
    ["GET",    "/api/error-logs"],
    ["GET",    "/api/teacher-clock-ins/today"],
    ["GET",    "/api/pickup-requests/1"],
    ["GET",    "/api/pickup-requests/stream/1"],
    ["GET",    "/api/storage/objects/private-photo"],
    ["POST",   "/api/families"],
    ["POST",   "/api/children"],
    ["POST",   "/api/teachers"],
    ["POST",   "/api/attendance/scan-qr"],
    ["POST",   "/api/attendance/scan-face"],
    ["POST",   "/api/teacher-clock-ins/clock-in"],
    ["PUT",    "/api/settings/general"],
    ["PUT",    "/api/settings/location"],
  ];

  it.each(protectedRoutes)("%s %s → 401", async (method, path) => {
    const res = await (request(app) as any)[method.toLowerCase()](path);
    expect(res.status).toBe(401);
  });
});

describe("Role guard — 403 when role is insufficient", () => {
  it("GET /api/audit-logs as parent → 403", async () => {
    const res = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", token("parent"));
    expect(res.status).toBe(403);
  });

  it("GET /api/error-logs as teacher → 403", async () => {
    const res = await request(app)
      .get("/api/error-logs")
      .set("Authorization", token("teacher"));
    expect(res.status).toBe(403);
  });

  it("POST /api/whatsapp/connect as admin (not super_admin) → 403", async () => {
    const res = await request(app)
      .post("/api/whatsapp/connect")
      .set("Authorization", token("admin"))
      .send({});
    expect(res.status).toBe(403);
  });

  it("POST /api/attendance/scan-qr as parent → 403 before family lookup", async () => {
    const res = await request(app)
      .post("/api/attendance/scan-qr")
      .set("Authorization", token("parent"))
      .send({ qrCode: "QR:999", serviceDate: "2026-08-23", serviceSlot: "7am" });
    expect(res.status).toBe(403);
  });

  it("POST /api/attendance/scan-face as teacher → 403 before biometric search", async () => {
    const res = await request(app)
      .post("/api/attendance/scan-face")
      .set("Authorization", token("teacher"))
      .send({ descriptor: Array(128).fill(0) });
    expect(res.status).toBe(403);
  });
});

describe("Input validation — 400 on bad request body", () => {
  it("POST /api/auth/login with empty body → 400", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({});
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/send-otp with missing phone/email → 400", async () => {
    const res = await request(app)
      .post("/api/auth/send-otp")
      .send({});
    expect(res.status).toBe(400);
  });
});

describe("Public registration privilege boundary", () => {
  it("POST /api/auth/register rejects super_admin even with a valid registration body", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        firstName: "Unapproved",
        lastName: "Admin",
        email: "unapproved-admin@example.com",
        phone: "08012345678",
        password: "safe-password",
        role: "super_admin",
      })
      .expect(403);

    expect(res.body.message).toMatch(/cannot be created through public registration/i);
  });
});

describe("404 for unknown routes", () => {
  it("GET /api/does-not-exist → 404", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
  });
});
