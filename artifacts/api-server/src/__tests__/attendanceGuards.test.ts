/**
 * Cross-service check-in guard — regression tests.
 *
 * Rule: a child checked in for one service who has NOT been checked out
 * (picked up) cannot be checked in for a different service the same day.
 */
import { describe, it, expect } from "vitest";
import { findActiveOtherSlot, stillCheckedInMessage } from "../lib/attendanceGuards";

describe("findActiveOtherSlot", () => {
  it("blocks second service while first service is still active", () => {
    expect(findActiveOtherSlot([{ serviceSlot: "7am", status: "dropped_off" }], "10:30am")).toBe("7am");
    expect(findActiveOtherSlot([{ serviceSlot: "7am", status: "in_transit" }], "10:30am")).toBe("7am");
    expect(findActiveOtherSlot([{ serviceSlot: "7am", status: "in_class" }], "10:30am")).toBe("7am");
  });

  it("allows second service once the first service is checked out", () => {
    expect(findActiveOtherSlot([{ serviceSlot: "7am", status: "picked_up" }], "10:30am")).toBeNull();
  });

  it("allows a first check-in of the day", () => {
    expect(findActiveOtherSlot([], "7am")).toBeNull();
    expect(findActiveOtherSlot([], "10:30am")).toBeNull();
  });

  it("ignores records for the same slot (idempotent re-check-in path)", () => {
    expect(findActiveOtherSlot([{ serviceSlot: "10:30am", status: "in_class" }], "10:30am")).toBeNull();
  });

  it("blocks in both directions (active second service blocks first)", () => {
    expect(findActiveOtherSlot([{ serviceSlot: "10:30am", status: "dropped_off" }], "7am")).toBe("10:30am");
  });

  it("blocks when one slot is picked up but the other is still active", () => {
    expect(findActiveOtherSlot(
      [
        { serviceSlot: "7am", status: "picked_up" },
        { serviceSlot: "10:30am", status: "in_class" },
      ],
      "7am",
    )).toBe("10:30am");
  });

  it("message names the blocking service and what to do", () => {
    const msg = stillCheckedInMessage("7am", "10:30am");
    expect(msg).toContain("7am");
    expect(msg).toContain("10:30am");
    expect(msg.toLowerCase()).toContain("check them out");
  });
});
