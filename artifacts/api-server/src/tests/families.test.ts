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

describe("GET /api/families", () => {
  it("returns paginated families for admin", async () => {
    const res = await api
      .get("/api/families")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("total");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe("number");
  });

  it("returns 401 without token", async () => {
    await api.get("/api/families").expect(401);
  });
});

describe("GET /api/children", () => {
  it("returns paginated children for admin", async () => {
    const res = await api
      .get("/api/children")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty("id");
      expect(res.body.data[0]).toHaveProperty("firstName");
      expect(res.body.data[0]).toHaveProperty("familyId");
    }
  });

  it("returns children for parent (their own family)", async () => {
    const res = await api
      .get("/api/children")
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(200);

    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("children response does not include passwordHash", async () => {
    const res = await api
      .get("/api/children")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    for (const child of res.body.data) {
      expect(child).not.toHaveProperty("passwordHash");
    }
  });
});

describe("GET /api/classes", () => {
  it("returns classes array with id and name", async () => {
    const res = await api
      .get("/api/classes")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    for (const cls of res.body) {
      expect(cls).toHaveProperty("id");
      expect(cls).toHaveProperty("name");
    }
  });
});
