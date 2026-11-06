import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routes = resolve(import.meta.dirname, "../routes");
const sources = {
  pickupDelegates: readFileSync(resolve(routes, "pickupDelegates.ts"), "utf8"),
  familyAssist: readFileSync(resolve(routes, "familyAssist.ts"), "utf8"),
};

describe("pickup-helper OTP generation", () => {
  it.each(Object.entries(sources))("%s generates six-digit codes with cryptographic randomness", (_name, source) => {
    const generator = source.slice(source.indexOf("function generateOTP"), source.indexOf("function generateOTP") + 120);
    expect(source).toMatch(/import \{ randomInt \} from "node:crypto";/);
    expect(generator).toContain("randomInt(100000, 1000000)");
    expect(generator).not.toContain("Math.random");
  });
});
