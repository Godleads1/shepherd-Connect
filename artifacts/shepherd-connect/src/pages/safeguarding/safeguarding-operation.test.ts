import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingSafeguardingOperation,
  readPendingSafeguardingOperation,
  writePendingSafeguardingOperation,
} from "./safeguarding-operation";

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

describe("pending safeguarding operation identity", () => {
  it("survives reload without retaining the safeguarding payload", () => {
    const pending = { operationId, createdAt: 123 };
    writePendingSafeguardingOperation(8, pending);
    expect(readPendingSafeguardingOperation(8)).toEqual(pending);
    const stored = [...values.values()][0];
    expect(stored).not.toContain("notes");
    expect(stored).not.toContain("reference");
    expect(stored).not.toContain("teacherUserId");
  });

  it("is user-scoped and only clears when the operation is completed or replaced", () => {
    writePendingSafeguardingOperation(8, { operationId, createdAt: 123 });
    expect(readPendingSafeguardingOperation(9)).toBeNull();
    clearPendingSafeguardingOperation(8);
    expect(readPendingSafeguardingOperation(8)).toBeNull();
  });
});