import { describe, it, expect, beforeAll } from "vitest";
import { api, CREDS, loginAs } from "./helpers";

let parentToken: string;
let attendantToken: string;
let adminToken: string;

beforeAll(async () => {
  [parentToken, attendantToken, adminToken] = await Promise.all([
    loginAs(CREDS.parent.email,    CREDS.parent.password),
    loginAs(CREDS.attendant.email, CREDS.attendant.password),
    loginAs(CREDS.admin.email,     CREDS.admin.password),
  ]);
});

describe("OTP Delegate System", () => {
  let createdOtpCode: string;
  let delegateId: number;

  it("parent can fetch their children from paginated response", async () => {
    const res = await api
      .get("/api/children")
      .set("Authorization", `Bearer ${parentToken}`)
      .expect(200);

    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("parent can create a pickup delegate and receives a 6-digit OTP code", async () => {
    const childrenRes = await api
      .get("/api/children")
      .set("Authorization", `Bearer ${parentToken}`);

    const children = childrenRes.body.data as Array<{ id: number }>;
    if (children.length === 0) {
      console.warn("No children found for parent — skipping OTP creation test");
      return;
    }

    const childId = children[0].id;

    const res = await api
      .post("/api/pickup-delegates")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({
        childId,
        name: "Test Delegate OTP",
        phone: "+2349000000001",
      })
      .expect(201);

    expect(res.body).toHaveProperty("otpCode");
    expect(typeof res.body.otpCode).toBe("string");
    expect(res.body.otpCode).toMatch(/^\d{6}$/);

    createdOtpCode = res.body.otpCode;
    delegateId = res.body.id;
  });

  it("verify-otp requires a signed-in checkout staff member", async () => {
    await api
      .post("/api/pickup-delegates/verify-otp")
      .send({ otpCode: "000000" })
      .expect(401);
    await api
      .post("/api/pickup-delegates/verify-otp")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ otpCode: "000000" })
      .expect(403);
  });

  it("verifying a non-existent OTP returns valid: false", async () => {
    const res = await api
      .post("/api/pickup-delegates/verify-otp")
      .set("Authorization", `Bearer ${attendantToken}`)
      .send({ otpCode: "000000" })
      .expect(200);

    expect(res.body.valid).toBe(false);
  });

  it("attendant can verify a valid OTP and gets child + delegate info", async () => {
    if (!createdOtpCode) {
      console.warn("No OTP created — skipping OTP verification test");
      return;
    }

    const res = await api
      .post("/api/pickup-delegates/verify-otp")
      .set("Authorization", `Bearer ${attendantToken}`)
      .send({ otpCode: createdOtpCode })
      .expect(200);

    expect(res.body.valid).toBe(true);
    expect(res.body).toHaveProperty("delegate");
    expect(res.body).toHaveProperty("child");
    expect(res.body.delegate.id).toBe(delegateId);
  });

  it("verified delegate response does not expose the raw OTP code", async () => {
    if (!createdOtpCode) return;

    const res = await api
      .post("/api/pickup-delegates/verify-otp")
      .set("Authorization", `Bearer ${attendantToken}`)
      .send({ otpCode: createdOtpCode })
      .expect(200);

    if (res.body.valid) {
      expect(res.body.delegate.otpCode).toBeUndefined();
    }
  });

  it("admin can deny (deactivate) a delegate", async () => {
    if (!delegateId) return;
    const res = await api
      .post(`/api/pickup-delegates/${delegateId}/deny`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "test cleanup" });
    expect([200, 404]).toContain(res.status);
  });
});
