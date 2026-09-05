import { beforeEach, describe, expect, it } from "vitest";
import { clearPendingPickupDelegateOperation, readPendingPickupDelegateOperation, writePendingPickupDelegateOperation } from "./pickup-delegate-operation";

describe("pickup delegate pending operation lifecycle", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.assign(globalThis, { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    } });
  });

  it("persists only an operation identity per user through reload and clears it explicitly", () => {
    writePendingPickupDelegateOperation(7, "same-operation-id");
    expect(readPendingPickupDelegateOperation(7)).toBe("same-operation-id");
    expect(readPendingPickupDelegateOperation(8)).toBeNull();
    expect(localStorage.getItem("pickup-delegate-pending:7")).toBe("same-operation-id");
    clearPendingPickupDelegateOperation(7);
    expect(readPendingPickupDelegateOperation(7)).toBeNull();
  });
});