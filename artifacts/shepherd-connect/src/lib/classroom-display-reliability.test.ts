import { describe, expect, it, vi } from "vitest";
import {
  LatestRequest,
  isLegacyDisplayInvalidation,
  handleClassroomDisplayMessage,
  reconnectDelay,
} from "./classroom-display-reliability";

describe("classroom display convergence controls", () => {
  it("keeps retrying with capped exponential backoff instead of terminating", () => {
    expect([0, 1, 2, 3, 4, 20].map(reconnectDelay)).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000, 30_000,
    ]);
  });

  it("aborts the superseded request and rejects its stale response", () => {
    const requests = new LatestRequest();
    const first = requests.begin();
    const second = requests.begin();

    expect(first.signal.aborted).toBe(true);
    expect(requests.isCurrent(first.generation)).toBe(false);
    expect(requests.isCurrent(second.generation)).toBe(true);

    requests.dispose();
    expect(second.signal.aborted).toBe(true);
    expect(requests.isCurrent(second.generation)).toBe(false);
  });

  it("does not let an older response overwrite a newer reconciliation", async () => {
    vi.useFakeTimers();
    const requests = new LatestRequest();
    const applied: string[] = [];
    const reconcile = async (value: string, delay: number) => {
      const request = requests.begin();
      await new Promise(resolve => setTimeout(resolve, delay));
      if (requests.isCurrent(request.generation)) applied.push(value);
    };

    const older = reconcile("older", 50);
    const newer = reconcile("newer", 5);
    await vi.advanceTimersByTimeAsync(50);
    await Promise.all([older, newer]);

    expect(applied).toEqual(["newer"]);
    vi.useRealTimers();
  });

  it.each(["media", "media-page", "pickup", "dismissed", "checkin-requested", "checkin-accepted", "checkin-cancelled"])(
    "treats legacy %s payloads only as invalidations",
    type => expect(isLegacyDisplayInvalidation(type)).toBe(true),
  );

  it("uses the production handler to apply only current init/refresh messages", () => {
    const applyInit = vi.fn();
    const applyRefresh = vi.fn();
    const reconcile = vi.fn();
    const handlers = { isCurrent: (generation: number) => generation === 2, applyInit, applyRefresh, reconcile };
    handleClassroomDisplayMessage({ type: "init" }, 1, handlers);
    handleClassroomDisplayMessage({ type: "init" }, 2, handlers);
    handleClassroomDisplayMessage({ type: "refresh" }, 2, handlers);
    expect(applyInit).toHaveBeenCalledTimes(1);
    expect(applyRefresh).toHaveBeenCalledTimes(1);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it.each(["media", "media-page", "pickup", "dismissed", "checkin-requested", "checkin-accepted", "checkin-cancelled"])(
    "production handler reconciles legacy %s without applying payload state",
    type => {
      const applyInit = vi.fn();
      const applyRefresh = vi.fn();
      const reconcile = vi.fn();
      handleClassroomDisplayMessage({ type, queue: ["untrusted"], media: "untrusted" }, 3, {
        isCurrent: generation => generation === 3, applyInit, applyRefresh, reconcile,
      });
      expect(reconcile).toHaveBeenCalledOnce();
      expect(applyInit).not.toHaveBeenCalled();
      expect(applyRefresh).not.toHaveBeenCalled();
    },
  );
});