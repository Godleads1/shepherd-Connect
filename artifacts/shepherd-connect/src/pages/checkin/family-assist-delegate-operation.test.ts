import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingFamilyAssistDelegateOperation,
  readPendingFamilyAssistDelegateOperation,
  writePendingFamilyAssistDelegateOperation,
} from "./family-assist-delegate-operation";

const values = new Map<string, string>();
const operationId = "7e2ff613-a0eb-4c46-83eb-95d83ce45e13";

beforeEach(() => {
  values.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});

describe("family assist pending delegate identity", () => {
  it("survives reload while persisting only the operation ID", () => {
    writePendingFamilyAssistDelegateOperation(8, operationId);
    expect(readPendingFamilyAssistDelegateOperation(8)).toBe(operationId);
    expect([...values.values()]).toEqual([operationId]);
    expect([...values.values()][0]).not.toMatch(/phone|otp|delegateName|childId/i);
  });

  it("is user-scoped and clears only after completion or an explicit new submission", () => {
    writePendingFamilyAssistDelegateOperation(8, operationId);
    expect(readPendingFamilyAssistDelegateOperation(9)).toBeNull();
    clearPendingFamilyAssistDelegateOperation(8);
    expect(readPendingFamilyAssistDelegateOperation(8)).toBeNull();
  });
});