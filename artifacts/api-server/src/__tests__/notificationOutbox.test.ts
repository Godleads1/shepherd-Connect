import { describe, expect, it } from "vitest";
import {
  OUTBOX_BACKOFF_MS,
  OUTBOX_FAILURE_DETAIL_MAX_LENGTH,
  redactFailureDetail,
  retryDelayMs,
} from "../services/notificationOutbox";

describe("notification outbox policy", () => {
  it("uses the bounded approved retry schedule", () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([...OUTBOX_BACKOFF_MS]);
    expect(retryDelayMs(99)).toBe(OUTBOX_BACKOFF_MS.at(-1));
  });

  it("bounds and redacts provider failure details", () => {
    const detail = redactFailureDetail(
      `Bearer abc.def token=valuable person@example.test +234 801 234 5678 ${"x".repeat(700)}`,
    );
    expect(detail).not.toContain("abc.def");
    expect(detail).not.toContain("valuable");
    expect(detail).not.toContain("person@example.test");
    expect(detail).not.toContain("801 234 5678");
    expect(detail.length).toBeLessThanOrEqual(OUTBOX_FAILURE_DETAIL_MAX_LENGTH);
  });
});