import { describe, expect, it } from "vitest";
import {
  canCreatePickupRequest,
  canDismissPickupRequest,
  isOperationalRole,
} from "../lib/childAccess";

describe("child pickup authorization policy", () => {
  it.each(["super_admin", "admin", "support", "attendant"])(
    "treats %s as an operational role",
    (role) => expect(isOperationalRole(role)).toBe(true),
  );

  it("allows parents to create pickup requests only for their own children", () => {
    expect(canCreatePickupRequest("parent", true)).toBe(true);
    expect(canCreatePickupRequest("parent", false)).toBe(false);
  });

  it("does not let teachers create parent pickup requests", () => {
    expect(canCreatePickupRequest("teacher", true)).toBe(false);
  });

  it("limits parent dismissals to their own children", () => {
    expect(canDismissPickupRequest("parent", true, false)).toBe(true);
    expect(canDismissPickupRequest("parent", false, false)).toBe(false);
  });

  it("limits teacher dismissals to classes they can access", () => {
    expect(canDismissPickupRequest("teacher", false, true)).toBe(true);
    expect(canDismissPickupRequest("teacher", false, false)).toBe(false);
  });
});