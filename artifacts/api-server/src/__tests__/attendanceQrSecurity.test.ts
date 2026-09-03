import { describe, expect, it } from "vitest";
import { familyCodeFromQr } from "../routes/attendance";

describe("family QR lookup authorization token", () => {
  it("accepts the opaque family code emitted to parents", () => {
    expect(familyCodeFromQr(" fam-a1b2c3 ")).toBe("FAM-A1B2C3");
  });

  it("rejects predictable legacy database identifiers", () => {
    expect(familyCodeFromQr("QR:1")).toBeNull();
    expect(familyCodeFromQr("QR:1:2")).toBeNull();
    expect(familyCodeFromQr("FAM-1")).toBeNull();
  });
});