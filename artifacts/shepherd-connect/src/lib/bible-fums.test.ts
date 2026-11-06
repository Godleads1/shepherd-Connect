import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { randomId } from "./bible-fums";

describe("Bible usage report IDs", () => {
  it("are 32-character hex strings from the cryptographic generator", () => {
    const spy = vi.spyOn(globalThis.crypto, "getRandomValues");
    const ids = new Set(Array.from({ length: 200 }, () => randomId()));
    expect(spy).toHaveBeenCalledTimes(200);
    spy.mockRestore();
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("never uses Math.random()", () => {
    expect(readFileSync(resolve(import.meta.dirname, "bible-fums.ts"), "utf8")).not.toContain("Math.random");
  });
});
