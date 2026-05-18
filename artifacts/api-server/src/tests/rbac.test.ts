import { describe, it, expect, beforeAll } from "vitest";
import { api, CREDS, loginAs } from "./helpers";

let adminToken: string;
let teacherToken: string;
let parentToken: string;
let attendantToken: string;

beforeAll(async () => {
  [adminToken, teacherToken, parentToken, attendantToken] = await Promise.all([
    loginAs(CREDS.admin.email,     CREDS.admin.password),
    loginAs(CREDS.teacher.email,   CREDS.teacher.password),
    loginAs(CREDS.parent.email,    CREDS.parent.password),
    loginAs(CREDS.attendant.email, CREDS.attendant.password),
  ]);
});

describe("Role-based access — unauthenticated", () => {
  const protectedRoutes = [
    "/api/families",
    "/api/children",
    "/api/teachers",
    "/api/teacher-allocations",
    "/api/notifications",
    "/api/attendance",
    "/api/users",
  ];

  for (const route of protectedRoutes) {
    it(`GET ${route} returns 401 without token`, async () => {
      await api.get(route).expect(401);
    });
  }
});

describe("Role-based access — admin-only routes", () => {
  it("GET /api/users returns 200 for admin", async () => {
    await api
      .get("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("GET /api/users returns 403 for teacher", async () => {
    await api
      .get("/api/users")
      .set("Authorization", `Bearer ${teacherToken}`)
      .expect(403);
  });

  it("GET /api/users returns 403 for parent", async () => {
    await api
      .get("/api/users")
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(403);
  });

  it("GET /api/users returns 403 for attendant", async () => {
    await api
      .get("/api/users")
      .set("Authorization", `Bearer ${attendantToken}`)
      .expect(403);
  });
});

describe("Role-based access — teacher routes", () => {
  it("GET /api/teacher-allocations returns 200 for admin", async () => {
    await api
      .get("/api/teacher-allocations")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("GET /api/teacher-allocations returns 200 for teacher", async () => {
    await api
      .get("/api/teacher-allocations")
      .set("Authorization", `Bearer ${teacherToken}`)
      .expect(200);
  });

  it("POST /api/teacher-allocations returns 403 for parent", async () => {
    await api
      .post("/api/teacher-allocations")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({})
      .expect(403);
  });
});

describe("Role-based access — reports (admin only)", () => {
  it("GET /api/reports/not-picked-up returns 200 for admin", async () => {
    await api
      .get("/api/reports/not-picked-up")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("GET /api/reports/not-picked-up returns 403 for teacher", async () => {
    await api
      .get("/api/reports/not-picked-up")
      .set("Authorization", `Bearer ${teacherToken}`)
      .expect(403);
  });

  it("GET /api/reports/not-picked-up returns 403 for parent", async () => {
    await api
      .get("/api/reports/not-picked-up")
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(403);
  });
});

describe("Role-based access — dashboard (admin only)", () => {
  it("GET /api/dashboard/stats returns 403 for teacher", async () => {
    await api
      .get("/api/dashboard/stats")
      .set("Authorization", `Bearer ${teacherToken}`)
      .expect(403);
  });

  it("GET /api/dashboard/stats returns 403 for parent", async () => {
    await api
      .get("/api/dashboard/stats")
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(403);
  });

  it("GET /api/dashboard/stats returns 403 for attendant", async () => {
    await api
      .get("/api/dashboard/stats")
      .set("Authorization", `Bearer ${attendantToken}`)
      .expect(403);
  });
});
