import { describe, expect, it } from "vitest";
import { CHECK_IN_ALERT_WINDOW_MS, isCheckInAlertActive } from "../services/classroomDisplayAlerts";

describe("class TV 'child is coming' alert window", () => {
  const now = new Date("2026-11-08T08:00:00Z");

  it("never alerts while the parent's drop-off is still waiting for support", () => {
    expect(isCheckInAlertActive({ status: "requested", acceptedAt: null }, now)).toBe(false);
  });

  it("alerts once support has accepted the child, for the alert window only", () => {
    const acceptedAt = new Date(now.getTime() - 60_000);
    expect(isCheckInAlertActive({ status: "accepted", acceptedAt }, now)).toBe(true);
    const stale = new Date(now.getTime() - CHECK_IN_ALERT_WINDOW_MS - 1);
    expect(isCheckInAlertActive({ status: "accepted", acceptedAt: stale }, now)).toBe(false);
  });

  it("drops the alert once the child is checked out or the drop-off is cancelled", () => {
    const acceptedAt = new Date(now.getTime() - 60_000);
    expect(isCheckInAlertActive({ status: "picked_up", acceptedAt }, now)).toBe(false);
    expect(isCheckInAlertActive({ status: "cancelled", acceptedAt: null }, now)).toBe(false);
  });
});
