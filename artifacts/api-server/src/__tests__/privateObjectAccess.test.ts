import { describe, expect, it } from "vitest";
import { canBindPendingObject } from "../lib/privateObjectAccess";

describe("private object attachment policy", () => {
  const pending = {
    uploaderId: 7,
    resourceType: null,
    resourceId: null,
    revokedAt: null,
  };

  it("allows only the uploader to attach a pending object", () => {
    expect(canBindPendingObject(pending, 7)).toBe(true);
    expect(canBindPendingObject(pending, 8)).toBe(false);
  });

  it("does not allow an attached object to be rebound by its uploader", () => {
    expect(canBindPendingObject({
      ...pending,
      resourceType: "child",
      resourceId: 42,
    }, 7)).toBe(false);
  });

  it("does not allow a revoked object to be attached", () => {
    expect(canBindPendingObject({
      ...pending,
      revokedAt: new Date(),
    }, 7)).toBe(false);
  });
});