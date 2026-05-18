import { describe, it, expect, beforeAll } from "vitest";
import { api, CREDS, loginAs } from "./helpers";

let adminToken: string;
let parentToken: string;

beforeAll(async () => {
  [adminToken, parentToken] = await Promise.all([
    loginAs(CREDS.admin.email,  CREDS.admin.password),
    loginAs(CREDS.parent.email, CREDS.parent.password),
  ]);
});

describe("GET /api/dashboard/stats", () => {
  it("returns dashboard stats for admin", async () => {
    const res = await api
      .get("/api/dashboard/stats")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty("totalCheckedIn");
    expect(res.body).toHaveProperty("totalChildren");
    expect(res.body).toHaveProperty("activeEmergencies");
    expect(typeof res.body.totalCheckedIn).toBe("number");
    expect(typeof res.body.totalChildren).toBe("number");
  });

  it("returns 401 without token", async () => {
    await api.get("/api/dashboard/stats").expect(401);
  });

  it("returns 403 for parent (admin-only)", async () => {
    await api
      .get("/api/dashboard/stats")
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(403);
  });
});

describe("GET /api/reports/not-picked-up", () => {
  it("returns report with children array for admin", async () => {
    const res = await api
      .get("/api/reports/not-picked-up")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty("children");
    expect(Array.isArray(res.body.children)).toBe(true);
    expect(res.body).toHaveProperty("total");
  });
});

describe("GET /api/reports/teacher-ratios", () => {
  it("returns ratio data with classes array for admin", async () => {
    const res = await api
      .get("/api/reports/teacher-ratios")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty("classes");
    expect(Array.isArray(res.body.classes)).toBe(true);
  });
});

describe("GET /api/notifications", () => {
  it("returns paginated notifications for parent", async () => {
    const res = await api
      .get("/api/notifications")
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(200);

    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("unreadCount");
  });
});
