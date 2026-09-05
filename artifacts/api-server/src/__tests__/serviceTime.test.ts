import { afterEach, describe, expect, it } from "vitest";
import {
  formatServiceDateTime,
  formatServiceTime,
  serviceDateAt,
} from "../lib/serviceTime";

const originalTimezone = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTimezone;
});

describe("Africa/Lagos service time", () => {
  it("uses the Lagos calendar date across Saturday, Sunday, and Monday boundaries", () => {
    expect(serviceDateAt(new Date("2026-08-22T22:30:00.000Z"))).toBe("2026-08-22");
    expect(serviceDateAt(new Date("2026-08-22T23:30:00.000Z"))).toBe("2026-08-23");
    expect(serviceDateAt(new Date("2026-08-23T22:30:00.000Z"))).toBe("2026-08-23");
    expect(serviceDateAt(new Date("2026-08-23T23:15:00.000Z"))).toBe("2026-08-24");
  });

  it("formats report timestamps independently of the host timezone", () => {
    const instant = new Date("2026-08-22T23:30:00.000Z");
    process.env.TZ = "Pacific/Honolulu";
    const westHost = [formatServiceTime(instant), formatServiceDateTime(instant)];
    process.env.TZ = "Asia/Tokyo";
    const eastHost = [formatServiceTime(instant), formatServiceDateTime(instant)];

    expect(westHost).toEqual(eastHost);
    expect(westHost).toEqual(["00:30", "23 Aug 2026, 00:30"]);
  });
});