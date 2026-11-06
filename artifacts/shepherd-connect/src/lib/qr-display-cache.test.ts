import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllQrDisplays, endOfLagosDay, meetingQrKey, readQrDisplay, saveQrDisplay, sundayQrKey,
} from "./qr-display-cache";

describe("device-local QR display cache", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() { return store.size; },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns the saved code until its end time while the server's code matches", () => {
    saveQrDisplay(meetingQrKey(7), "url-1", "fp1", 2000, 1000);
    expect(readQrDisplay(meetingQrKey(7), "fp1", 1999)).toBe("url-1");
    expect(readQrDisplay(meetingQrKey(7), "fp1", 2000)).toBeNull();
    expect(store.size).toBe(0);
  });

  it("hides a code that was replaced, closed or revoked elsewhere", () => {
    saveQrDisplay(meetingQrKey(7), "url-1", "fp1", 5000, 1000);
    expect(readQrDisplay(meetingQrKey(7), "fp2", 1500)).toBeNull();
    saveQrDisplay(sundayQrKey("2026-11-08"), { token: "t" }, "fp1", 5000, 1000);
    expect(readQrDisplay(sundayQrKey("2026-11-08"), null, 1500)).toBeNull();
    // Kept (not deleted) so older server data can't erase a newer code from another tab.
    expect(readQrDisplay(meetingQrKey(7), "fp1", 1500)).toBe("url-1");
  });

  it("never saves already-expired or unidentified codes, and ignores corrupt entries", () => {
    saveQrDisplay("a", "x", "fp", 1000, 1000);
    saveQrDisplay("b", "x", null, 5000, 1000);
    expect(store.size).toBe(0);
    store.set("shepherd_qr_display:c", "{not json");
    expect(readQrDisplay("c", "fp", 0)).toBeNull();
    expect(store.size).toBe(0);
  });

  it("clears every saved code on sign-out but leaves other storage alone", () => {
    saveQrDisplay("a", "x", "fp", 5000, 1000);
    saveQrDisplay("b", "y", "fp", 5000, 1000);
    store.set("token", "session");
    clearAllQrDisplays();
    expect([...store.keys()]).toEqual(["token"]);
  });

  it("ends a Sunday code at midnight Lagos time after its service date", () => {
    expect(new Date(endOfLagosDay("2026-11-08")!).toISOString()).toBe("2026-11-08T23:00:00.000Z");
    expect(new Date(endOfLagosDay("2026-12-31")!).toISOString()).toBe("2026-12-31T23:00:00.000Z");
    expect(endOfLagosDay("bad")).toBeNull();
  });
});
