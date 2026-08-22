import { describe, expect, it } from "vitest";
import { getPublicRegistrationPolicy } from "../lib/registrationPolicy";

describe("public registration policy", () => {
  it("never allows a super-admin account to be created through public registration", () => {
    expect(getPublicRegistrationPolicy("super_admin")).toEqual({
      allowed: false,
      requiresApproval: false,
    });
  });

  it.each(["admin", "teacher", "support"] as const)(
    "requires approval for a public %s application",
    (role) => {
      expect(getPublicRegistrationPolicy(role)).toEqual({
        allowed: true,
        requiresApproval: true,
      });
    },
  );

  it("allows a parent account to be activated after registration", () => {
    expect(getPublicRegistrationPolicy("parent")).toEqual({
      allowed: true,
      requiresApproval: false,
    });
  });
});