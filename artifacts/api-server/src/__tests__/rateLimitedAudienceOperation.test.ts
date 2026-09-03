import { describe, expect, it, vi } from "vitest";
import { runRateLimitedAudienceOperation } from "../lib/rateLimitedAudienceOperation";

describe("zero-recipient notification operations", () => {
  it.each([
    ["broadcast", "lastBroadcastAt"],
    ["pre-dismissal", "lastPreDismissalAt"],
  ])("does not change %s %s", async (_operation, _timestamp) => {
    const setLastOperationAt = vi.fn();
    const createForRecipient = vi.fn();

    const result = await runRateLimitedAudienceOperation({
      lastOperationAt: new Date("2020-01-01T00:00:00.000Z"),
      getRecipientIds: vi.fn().mockResolvedValue([]),
      setLastOperationAt,
      createForRecipient,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(result).toEqual({ kind: "empty" });
    expect(setLastOperationAt).not.toHaveBeenCalled();
    expect(createForRecipient).not.toHaveBeenCalled();
  });
});