import { describe, expect, it } from "vitest";
import { resolveStaffScanRole } from "./staff-scan-role";

describe("Sunday attendance staff role selection", () => {
  it.each(["teacher", "support", "admin", "super_admin"] as const)(
    "keeps an active %s role",
    (role) => {
      expect(resolveStaffScanRole({ role })).toBe(role);
    },
  );

  it("selects an approved teacher role for a parent-mode account", () => {
    expect(resolveStaffScanRole({
      role: "parent",
      allRoles: ["parent", "teacher"],
      secondaryRoles: ["teacher"],
    })).toBe("teacher");
  });

  it("does not grant staff scanning to a parent-only account", () => {
    expect(resolveStaffScanRole({
      role: "parent",
      allRoles: ["parent"],
      secondaryRoles: [],
    })).toBeNull();
  });

  it("ignores malformed or unapproved role values", () => {
    expect(resolveStaffScanRole({
      role: "parent",
      allRoles: "teacher",
      secondaryRoles: ["attendant", 42],
    })).toBeNull();
  });
});