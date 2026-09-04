import { describe, expect, it, vi } from "vitest";
import { refreshAfterCommittedCheckout } from "./checkout-flow";

describe("checkout reconciliation", () => {
  it("reports a successful refresh separately", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);

    await expect(refreshAfterCommittedCheckout(refresh)).resolves.toEqual({
      status: "refreshed",
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does not throw a checkout failure when refresh fails", async () => {
    const refreshError = new Error("attendance refresh unavailable");

    await expect(
      refreshAfterCommittedCheckout(() => Promise.reject(refreshError)),
    ).resolves.toEqual({
      status: "refresh_failed",
      error: refreshError,
    });
  });
});