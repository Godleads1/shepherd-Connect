import { describe, expect, it } from "vitest";
import {
  OUTBOX_BACKOFF_MS,
  OUTBOX_FAILURE_DETAIL_MAX_LENGTH,
  enqueueNotification,
  redactFailureDetail,
  retryDelayMs,
  type OutboxExecutor,
} from "../services/notificationOutbox";

function executor() {
  const execute = async () => ({ rows: [{ id: "row-id", inserted: true }] });
  return { execute } as OutboxExecutor;
}

describe("notification outbox policy", () => {
  it("uses the bounded approved retry schedule", () => {
    expect([1, 2, 3, 4, 5].map(retryDelayMs)).toEqual([...OUTBOX_BACKOFF_MS]);
    expect(retryDelayMs(99)).toBe(OUTBOX_BACKOFF_MS.at(-1));
  });

  it("does not permit in-app deliveries or oversized payload metadata", async () => {
    await expect(enqueueNotification(executor(), {
      logicalDedupKey: "delivery-1", notificationType: "attendance", domainType: "attendance",
      domainIdentifier: "1", recipientUserId: 1, channel: "in_app" as never,
      templateKey: "child-arrived", payload: {},
    })).rejects.toThrow();
    await expect(enqueueNotification(executor(), {
      logicalDedupKey: "delivery-2", notificationType: "attendance", domainType: "attendance",
      domainIdentifier: "1", recipientUserId: 1, channel: "email", templateKey: "child-arrived",
      payload: "x".repeat(9000),
    })).rejects.toThrow("payload");
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