import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingEmergencyUpdate,
  readPendingEmergencyUpdate,
  writePendingEmergencyUpdate,
} from "./emergency-update-operation";

const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});

describe("pending emergency update identity", () => {
  it("survives reload with the same ID and contains no emergency narrative", () => {
    const pending = {
      operationId: "7e2ff613-a0eb-4c46-83eb-95d83ce45e13",
      emergencyId: 42,
      createdAt: 123,
    };
    writePendingEmergencyUpdate(8, pending);
    expect(readPendingEmergencyUpdate(8)).toEqual(pending);
    expect([...values.values()][0]).not.toContain("message");
  });

  it("is user-scoped and is cleared only when explicitly completed or replaced", () => {
    writePendingEmergencyUpdate(8, {
      operationId: "7e2ff613-a0eb-4c46-83eb-95d83ce45e13",
      emergencyId: 42,
      createdAt: 123,
    });
    expect(readPendingEmergencyUpdate(9)).toBeNull();
    clearPendingEmergencyUpdate(8);
    expect(readPendingEmergencyUpdate(8)).toBeNull();
  });
});