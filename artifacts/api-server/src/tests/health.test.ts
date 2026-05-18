import { describe, it, expect } from "vitest";
import { api } from "./helpers";

describe("GET /api/healthz", () => {
  it("returns 200 with status ok", async () => {
    const res = await api.get("/api/healthz").expect(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body.status).toBe("ok");
  });

  it("does not require authentication", async () => {
    await api.get("/api/healthz").expect(200);
  });
});
