import { describe, expect, it } from "vitest";
import {
  checkoutErrorMessage,
  familyQrProof,
  getCheckoutAccess,
  helperCodeProof,
  isVerificationRejection,
  parseFamilyQr,
} from "./checkout-policy";

describe("custody-aware checkout access", () => {
  it.each(["admin", "super_admin"])("lets %s verify pickup or record an override on custody rows", role => {
    expect(getCheckoutAccess(role, 41)).toEqual({ kind: "verify", canOverride: true });
  });

  it("requires Support to verify pickup and gives no override", () => {
    expect(getCheckoutAccess("support", 41)).toEqual({ kind: "verify", canOverride: false });
  });

  it.each(["attendant", "teacher", "parent", undefined])(
    "blocks %s from releasing custody with an explanatory message",
    role => {
      const access = getCheckoutAccess(role, 41);
      expect(access.kind).toBe("blocked");
      if (access.kind === "blocked") {
        expect(access.message).toContain("released by Support");
      }
    },
  );

  it.each([
    ["support", false],
    ["attendant", false],
    ["admin", true],
    ["super_admin", true],
  ])("requires pickup verification for %s on ordinary rows", (role, canOverride) => {
    expect(getCheckoutAccess(role, null)).toEqual({ kind: "verify", canOverride });
  });

  it.each(["teacher", "parent", undefined])("blocks %s on ordinary rows", role => {
    expect(getCheckoutAccess(role, null).kind).toBe("blocked");
  });
});

describe("pickup proof helpers", () => {
  it("normalises scanned family QR codes and rejects anything else", () => {
    expect(parseFamilyQr("  fam-ab12cd ")).toBe("FAM-AB12CD");
    expect(parseFamilyQr("FAM-AB12C")).toBeNull();
    expect(parseFamilyQr("SC-STAFF-123456")).toBeNull();
    expect(parseFamilyQr("")).toBeNull();
  });

  it("builds proofs in the API shape", () => {
    expect(familyQrProof("FAM-AB12CD")).toEqual({ method: "family_qr", qrCode: "FAM-AB12CD" });
    expect(helperCodeProof(" 123456 ")).toEqual({ method: "delegate_otp", otpCode: "123456" });
  });

  it("shows the server's verification message and recognises verification rejections", () => {
    const error = Object.assign(new Error("HTTP 403 Forbidden: x"), {
      status: 403,
      data: { message: "This QR code does not belong to this child's family." },
    });
    expect(checkoutErrorMessage(error)).toBe("This QR code does not belong to this child's family.");
    expect(checkoutErrorMessage(new Error("Network down"))).toBe("Network down");
    expect(isVerificationRejection(error)).toBe(true);
    expect(isVerificationRejection({ status: 409 })).toBe(false);
  });
});
