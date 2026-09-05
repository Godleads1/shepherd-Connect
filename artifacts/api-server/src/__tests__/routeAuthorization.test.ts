import { describe, expect, it } from "vitest";
import {
  canCreateOrEditChild,
  canCreateOrEditFamily,
  canManageChildBiometrics,
  canOperatePickupDelegates,
  canReadSafeguardingTeacher,
  isFamilyChildOperationalRole,
} from "../lib/routeAuthorization";

const roles = ["parent", "teacher", "support", "admin", "super_admin"] as const;

describe("family, child, safeguarding and pickup delegate authorization policy", () => {
  it.each(roles)("defines explicit family and child mutation policy for %s", role => {
    const allowed = ["parent", "support", "admin", "super_admin"].includes(role);
    expect(canCreateOrEditFamily(role)).toBe(allowed);
    expect(canCreateOrEditChild(role)).toBe(allowed);
  });

  it.each(roles)("defines explicit operational family/child access for %s", role => {
    expect(isFamilyChildOperationalRole(role))
      .toBe(["support", "admin", "super_admin"].includes(role));
  });

  it.each(roles)("limits child biometric changes for %s", role => {
    expect(canManageChildBiometrics(role))
      .toBe(["parent", "admin", "super_admin"].includes(role));
  });

  it.each(roles)("defines explicit pickup delegate operators for %s", role => {
    expect(canOperatePickupDelegates(role))
      .toBe(["parent", "support", "admin", "super_admin"].includes(role));
  });

  it("allows safeguarding administrators globally and teachers only for themselves", () => {
    expect(canReadSafeguardingTeacher({ userId: 1, role: "admin" }, 2)).toBe(true);
    expect(canReadSafeguardingTeacher({ userId: 1, role: "super_admin" }, 2)).toBe(true);
    expect(canReadSafeguardingTeacher({ userId: 1, role: "teacher" }, 1)).toBe(true);
    expect(canReadSafeguardingTeacher({ userId: 1, role: "teacher" }, 2)).toBe(false);
    expect(canReadSafeguardingTeacher({ userId: 1, role: "support" }, 1)).toBe(false);
    expect(canReadSafeguardingTeacher({ userId: 1, role: "parent" }, 1)).toBe(false);
  });

  it("grants nothing to unknown or removed legacy roles", () => {
    for (const role of ["attendant", "unknown", ""]) {
      expect(isFamilyChildOperationalRole(role)).toBe(false);
      expect(canCreateOrEditFamily(role)).toBe(false);
      expect(canCreateOrEditChild(role)).toBe(false);
      expect(canManageChildBiometrics(role)).toBe(false);
      expect(canOperatePickupDelegates(role)).toBe(false);
    }
  });
});