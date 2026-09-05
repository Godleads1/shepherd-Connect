import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingEmergencyCreate,
  readPendingEmergencyCreate,
  writePendingEmergencyCreate,
} from "./emergency-create-operation";

const values = new Map<string, string>();
const operationId = "7e2ff613-a0eb-4c46-83eb-95d83ce45e13";

beforeEach(() => {
  values.clear();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});

describe("pending emergency-create identity", () => {
  it("survives reload with the same UUID and persists no emergency payload", () => {
    writePendingEmergencyCreate(8, { operationId });
    expect(readPendingEmergencyCreate(8)).toEqual({ operationId });
    expect([...values.values()][0]).toBe(JSON.stringify({ operationId }));
    expect([...values.values()][0]).not.toContain("description");
  });

  it("is user-scoped and is only cleared explicitly", () => {
    writePendingEmergencyCreate(8, { operationId });
    expect(readPendingEmergencyCreate(9)).toBeNull();
    clearPendingEmergencyCreate(8);
    expect(readPendingEmergencyCreate(8)).toBeNull();
  });
});