import { describe, expect, it, vi } from "vitest";
import { beginCustodyCheckout, submitCustodyOverride } from "./custody-checkout-operation";

describe("attendance custody checkout routing", () => {
  it.each(["admin", "super_admin"])("%s opens the audited override without calling the support endpoint", async (role) => {
    const completeSupportPickup = vi.fn();
    const openOverride = vi.fn();

    await expect(beginCustodyCheckout({
      role,
      episodeId: 8,
      completeSupportPickup,
      openOverride,
    })).resolves.toBe("override_requested");

    expect(openOverride).toHaveBeenCalledWith(8);
    expect(completeSupportPickup).not.toHaveBeenCalled();
  });

  it.each([
    { episodeId: null, reason: "Duty manager verified" },
    { episodeId: 8, reason: "" },
    { episodeId: 8, reason: "   " },
  ])("does not mutate after cancellation or with a blank reason", async ({ episodeId, reason }) => {
    const overridePickup = vi.fn();

    await expect(submitCustodyOverride({
      episodeId,
      reason,
      overridePickup,
    })).resolves.toBe(false);

    expect(overridePickup).not.toHaveBeenCalled();
  });

  it("submits a valid reason through the audited override path", async () => {
    const overridePickup = vi.fn().mockResolvedValue(undefined);

    await expect(submitCustodyOverride({
      episodeId: 8,
      reason: "  Duty manager verified the pickup  ",
      overridePickup,
    })).resolves.toBe(true);

    expect(overridePickup).toHaveBeenCalledWith(8, "Duty manager verified the pickup");
  });

  it("preserves support custody completion", async () => {
    const completeSupportPickup = vi.fn().mockResolvedValue(undefined);
    const openOverride = vi.fn();

    await expect(beginCustodyCheckout({
      role: "support",
      episodeId: 8,
      completeSupportPickup,
      openOverride,
    })).resolves.toBe("completed");

    expect(completeSupportPickup).toHaveBeenCalledWith(8);
    expect(openOverride).not.toHaveBeenCalled();
  });
});