import { beforeEach, describe, expect, it } from "vitest";
import {
  clearQueue,
  enqueueCheckIn,
  getQueue,
  isAuthorizationReplayFailure,
  markForReconciliation,
  removeFromQueue,
} from "./offline-queue";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const payload = {
  childId: 12,
  classId: 34,
  serviceDate: "2026-08-30",
  serviceSlot: "7am",
  childName: "Ada Parent",
};

describe("offline check-in queue", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  it("partitions entries by authenticated user and snapshots their active role", () => {
    enqueueCheckIn(101, "support", payload);
    enqueueCheckIn(202, "admin", { ...payload, childId: 56 });
    enqueueCheckIn(303, "attendant", { ...payload, childId: 78 });

    expect(getQueue(101)).toHaveLength(1);
    expect(getQueue(101)[0]).toMatchObject({
      operation: "checkin",
      originatingUserId: 101,
      originatingRole: "support",
      childId: 12,
      serviceDate: "2026-08-30",
    });
    expect(getQueue(202)).toHaveLength(1);
    expect(getQueue(202)[0]).toMatchObject({
      originatingUserId: 202,
      originatingRole: "admin",
      childId: 56,
    });
    expect(getQueue(303)[0]).toMatchObject({
      originatingUserId: 303,
      originatingRole: "attendant",
      childId: 78,
    });
  });

  it("assigns a stable UUID event id and queue timestamp", () => {
    const eventId = enqueueCheckIn(101, "teacher", payload);
    const entry = getQueue(101)[0];

    expect(eventId).toBe(entry.eventId);
    expect(entry.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(Number.isNaN(Date.parse(entry.queuedAt))).toBe(false);
  });

  it("removes and clears only the specified user's queue", () => {
    const firstEventId = enqueueCheckIn(101, "support", payload);
    enqueueCheckIn(202, "admin", payload);

    removeFromQueue(101, firstEventId);
    expect(getQueue(101)).toEqual([]);
    expect(getQueue(202)).toHaveLength(1);

    enqueueCheckIn(101, "support", payload);
    clearQueue(101);
    expect(getQueue(101)).toEqual([]);
    expect(getQueue(202)).toHaveLength(1);
  });

  it("marks replay 401/403 as non-retryable reconciliation work and leaves transient failures retryable", () => {
    const eventId = enqueueCheckIn(101, "support", payload);
    expect(isAuthorizationReplayFailure({ status: 401 })).toBe(true);
    expect(isAuthorizationReplayFailure({ status: 403 })).toBe(true);
    expect(isAuthorizationReplayFailure({ status: 500 })).toBe(false);
    expect(isAuthorizationReplayFailure(new TypeError("offline"))).toBe(false);

    markForReconciliation(101, eventId);
    expect(getQueue(101)).toMatchObject([{ eventId, reconciliationRequired: "unauthorized" }]);
  });

  it("never persists bearer credentials with queued work", () => {
    enqueueCheckIn(101, "support", payload);
    const persisted = localStorage.getItem("shepherd_offline_checkin_queue:101")!;
    expect(persisted.toLowerCase()).not.toContain("token");
    expect(persisted.toLowerCase()).not.toContain("authorization");
    expect(persisted.toLowerCase()).not.toContain("bearer");
    expect(persisted).not.toContain("eyJ");
  });
});