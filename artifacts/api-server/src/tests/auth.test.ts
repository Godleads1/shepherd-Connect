import { describe, it, expect } from "vitest";
import { api, CREDS, loginAs } from "./helpers";

describe("POST /api/auth/login", () => {
  it("returns 200 and a token for valid super_admin credentials", async () => {
    const res = await api
      .post("/api/auth/login")
      .send(CREDS.superAdmin)
      .expect(200);

    expect(res.body).toHaveProperty("token");
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.role).toBe("super_admin");
  });

  it("returns 200 and a token for valid admin credentials", async () => {
    const res = await api
      .post("/api/auth/login")
      .send(CREDS.admin)
      .expect(200);

    expect(res.body.user.role).toBe("admin");
    expect(res.body).toHaveProperty("token");
  });

  it("returns 200 and a token for valid parent credentials", async () => {
    const res = await api
      .post("/api/auth/login")
      .send(CREDS.parent)
      .expect(200);

    expect(res.body.user.role).toBe("parent");
  });

  it("returns 401 for wrong password", async () => {
    const res = await api
      .post("/api/auth/login")
      .send({ email: CREDS.admin.email, password: "wrongpassword" })
      .expect(401);

    expect(res.body).toHaveProperty("error");
  });

  it("returns 401 for non-existent email", async () => {
    await api
      .post("/api/auth/login")
      .send({ email: "nobody@nowhere.com", password: "password" })
      .expect(401);
  });

  it("does not return passwordHash in the user object", async () => {
    const res = await api
      .post("/api/auth/login")
      .send(CREDS.admin)
      .expect(200);

    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(res.body.user).not.toHaveProperty("password_hash");
  });
});

describe("GET /api/auth/me", () => {
  it("returns current user for valid token", async () => {
    const token = await loginAs(CREDS.admin.email, CREDS.admin.password);
    const res = await api
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.email).toBe(CREDS.admin.email);
    expect(res.body.role).toBe("admin");
  });

  it("returns 401 for missing token", async () => {
    await api.get("/api/auth/me").expect(401);
  });

  it("returns 401 for malformed token", async () => {
    await api
      .get("/api/auth/me")
      .set("Authorization", "Bearer not.a.valid.token")
      .expect(401);
  });
});
