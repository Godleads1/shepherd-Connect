import { describe, expect, it } from "vitest";
import { buildSelfProfileUpdate, phoneChangeRequiresPassword } from "./profile-security";

describe("self-service phone change step-up", () => {
  const ordinaryEdit = {
    firstName: "Ada",
    lastName: "Lovelace",
    phone: "08012345678",
    dob: "2000-01-01",
  };

  it("does not require or send a password for ordinary profile edits", () => {
    expect(phoneChangeRequiresPassword("08012345678", ordinaryEdit.phone)).toBe(false);
    expect(buildSelfProfileUpdate(ordinaryEdit, "08012345678", "never-sent")).toEqual(ordinaryEdit);
    expect(buildSelfProfileUpdate(ordinaryEdit, " 08012345678 ", "")).not.toHaveProperty("currentPassword");
  });

  it("requires a current password and includes it only for a changed phone", () => {
    const changed = { ...ordinaryEdit, phone: "08087654321" };
    expect(phoneChangeRequiresPassword(ordinaryEdit.phone, changed.phone)).toBe(true);
    expect(() => buildSelfProfileUpdate(changed, ordinaryEdit.phone, "")).toThrow("Current password");
    expect(buildSelfProfileUpdate(changed, ordinaryEdit.phone, "current-password")).toEqual({
      ...changed,
      currentPassword: "current-password",
    });
  });
});