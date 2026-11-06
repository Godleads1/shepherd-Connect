import { describe, expect, it } from "vitest";
import { CheckoutReleaseError, decideCheckoutAuthority } from "../services/checkoutReleaseProof";

const qr = { method: "family_qr" as const, qrCode: "FAM-ABC123" };
const decide = (input: Partial<Parameters<typeof decideCheckoutAuthority>[0]>) => decideCheckoutAuthority({
  role: "support", custodyBacked: true, alreadyReleased: false, ...input,
});
const rejection = (fn: () => unknown) => {
  try { fn(); } catch (error) {
    if (error instanceof CheckoutReleaseError) return { status: error.statusCode, title: error.errorTitle };
    throw error;
  }
  throw new Error("expected a rejection");
};

describe("checkout release authority", () => {
  it.each(["support", "attendant", "admin", "super_admin"])("requires pickup proof from %s on a non-custody row", role => {
    expect(rejection(() => decide({ role, custodyBacked: false }))).toEqual({ status: 400, title: "Pickup verification required" });
    expect(decide({ role, custodyBacked: false, proof: qr })).toEqual({ kind: "verify_proof", proof: qr });
  });

  it("requires pickup proof from Support on custody rows and refuses Support overrides", () => {
    expect(rejection(() => decide({}))).toEqual({ status: 400, title: "Pickup verification required" });
    expect(rejection(() => decide({ overrideReason: "Parent forgot phone" })).status).toBe(403);
    expect(rejection(() => decide({ custodyBacked: false, overrideReason: "Parent forgot phone" })).status).toBe(403);
  });

  it.each(["admin", "super_admin"])("lets %s override with a reason, but not with a blank one", role => {
    expect(decide({ role, overrideReason: "  ID checked at desk " })).toEqual({ kind: "admin_override", reason: "ID checked at desk" });
    expect(decide({ role, custodyBacked: false, overrideReason: "ID checked" }).kind).toBe("admin_override");
    expect(rejection(() => decide({ role, overrideReason: "   " })).status).toBe(400);
  });

  it("rejects proof and an override reason together", () => {
    expect(rejection(() => decide({ role: "admin", proof: qr, overrideReason: "x" }))).toEqual({ status: 400, title: "Choose one release method" });
  });

  it("blocks attendants and other roles from custody release even with proof", () => {
    for (const role of ["attendant", "teacher", "parent"]) {
      expect(rejection(() => decide({ role, proof: qr })).status).toBe(403);
    }
  });

  it("lets an already released child replay without proof", () => {
    expect(decide({ alreadyReleased: true })).toEqual({ kind: "already_released" });
  });
});
