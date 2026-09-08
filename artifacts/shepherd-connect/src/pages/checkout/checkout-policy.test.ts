import { describe, expect, it } from "vitest";
import { getCheckoutAccess } from "./checkout-policy";

describe("custody-aware checkout access", () => {
  it.each(["admin", "super_admin"])("requires a reasoned override for %s custody checkout", role => {
    expect(getCheckoutAccess(role, 41)).toEqual({ kind: "admin_override" });
  });

  it("keeps normal custody checkout for Support", () => {
    expect(getCheckoutAccess("support", 41)).toEqual({ kind: "normal" });
  });

  it.each(["attendant", "teacher", "parent", undefined])(
    "blocks %s from releasing custody with an explanatory message",
    role => {
      const access = getCheckoutAccess(role, 41);
      expect(access.kind).toBe("blocked");
      if (access.kind === "blocked") {
        expect(access.message).toContain("accepting Support custodian");
      }
    },
  );

  it.each(["support", "attendant", "admin", "super_admin"])(
    "preserves ordinary checkout for %s",
    role => {
      expect(getCheckoutAccess(role, null)).toEqual({ kind: "normal" });
    },
  );
});