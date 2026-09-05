import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClassroomDisplayListenerCoordinator } from "../services/classroomDisplayListenerCoordinator";

class FakeListener extends EventEmitter {
  query = vi.fn().mockResolvedValue(undefined);
  release = vi.fn();
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

afterEach(() => vi.useRealTimers());

describe("ClassroomDisplayListenerCoordinator", () => {
  it("starts one bounded poll and clears it with the final client", async () => {
    vi.useFakeTimers();
    const listener = new FakeListener();
    const reconcile = vi.fn().mockResolvedValue(undefined);
    const coordinator = new ClassroomDisplayListenerCoordinator({
      connect: async () => listener,
      reconcile,
      pollMs: 60_000,
    });
    coordinator.setConnected(4, true);
    coordinator.setConnected(4, true);
    await coordinator.start();
    await flush();
    expect(reconcile).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reconcile).toHaveBeenCalledTimes(2);
    coordinator.setConnected(4, false);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(reconcile).toHaveBeenCalledTimes(2);
    coordinator.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores the old socket and reconciles connected classes after capped reconnect", async () => {
    vi.useFakeTimers();
    const listeners = [new FakeListener(), new FakeListener()];
    const connect = vi.fn()
      .mockResolvedValueOnce(listeners[0])
      .mockResolvedValueOnce(listeners[1]);
    const reconcile = vi.fn().mockResolvedValue(undefined);
    const coordinator = new ClassroomDisplayListenerCoordinator({ connect, reconcile, pollMs: 60_000 });
    coordinator.setConnected(8, true);
    await coordinator.start();
    await flush();
    reconcile.mockClear();
    listeners[0].emit("end");
    expect(coordinator.isListening()).toBe(false);
    listeners[0].emit("notification", { channel: "classroom_display_refresh", payload: "8" });
    await flush();
    expect(reconcile).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(999);
    expect(connect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(connect).toHaveBeenCalledTimes(2);
    expect(coordinator.isListening()).toBe(true);
    expect(reconcile).toHaveBeenCalledWith(8);
    coordinator.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("serializes refresh generations and reruns once for newer signals", async () => {
    const listener = new FakeListener();
    const releases: Array<() => void> = [];
    const reconcile = vi.fn(() => new Promise<void>(resolve => releases.push(resolve)));
    const coordinator = new ClassroomDisplayListenerCoordinator({ connect: async () => listener, reconcile, pollMs: 60_000 });
    coordinator.setConnected(3, true);
    await coordinator.start();
    expect(reconcile).toHaveBeenCalledTimes(1);
    coordinator.request(3);
    coordinator.request(3);
    expect(reconcile).toHaveBeenCalledTimes(1);
    releases.shift()!();
    await flush();
    expect(reconcile).toHaveBeenCalledTimes(2);
    releases.shift()!();
    await flush();
    expect(reconcile).toHaveBeenCalledTimes(2);
    coordinator.stop();
  });
});