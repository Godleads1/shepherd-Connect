import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { nanoid } from "../lib/utils";

const src = resolve(import.meta.dirname, "..");
function serverSources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : serverSources(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

describe("server randomness", () => {
  it("never uses Math.random() in API server code", () => {
    const offenders = serverSources(src).filter(path => readFileSync(path, "utf8").includes("Math.random"));
    expect(offenders).toEqual([]);
  });

  it("keeps the nanoid format: exact length, lowercase base-36", () => {
    for (const size of [1, 8, 21]) {
      for (let i = 0; i < 200; i += 1) expect(nanoid(size)).toMatch(new RegExp(`^[0-9a-z]{${size}}$`));
    }
  });

  it("keeps reference and code formats", () => {
    const read = (file: string) => readFileSync(join(src, file), "utf8");
    expect(read("routes/safeguardingPortal.ts")).toContain("randomInt(10000, 100000)");
    expect(read("routes/teacherIncidents.ts")).toContain("randomInt(10000, 100000)");
    expect(read("services/whatsappBot.ts")).toContain("randomInt(10000, 100000)");
    expect(read("routes/familyAssist.ts")).toContain('"G-" + randomInt(1000, 10000)');
    expect(read("routes/families.ts")).toMatch(/FAMILY_CODE_ALPHABET\[randomInt\(FAMILY_CODE_ALPHABET\.length\)\]/);
  });
});
