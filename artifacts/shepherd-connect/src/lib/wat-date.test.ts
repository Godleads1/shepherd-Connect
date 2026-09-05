import { describe, expect, it } from "vitest";
import { formatServiceDate, formatWatTime, isWatSundayAt, watServiceDateAt, watWeekdayAt } from "./wat-date";

describe("West Africa Time service date", () => {
  it("uses the next WAT date after 23:00 UTC", () => {
    const boundary = new Date("2026-08-22T23:30:00.000Z");

    expect(watServiceDateAt(boundary)).toBe("2026-08-23");
    expect(isWatSundayAt(boundary)).toBe(true);
    expect(watWeekdayAt(boundary)).toBe("Sunday");
  });

  it("keeps the prior WAT date before 23:00 UTC", () => {
    const beforeBoundary = new Date("2026-08-22T22:59:59.999Z");

    expect(watServiceDateAt(beforeBoundary)).toBe("2026-08-22");
    expect(isWatSundayAt(beforeBoundary)).toBe(false);
    expect(watWeekdayAt(beforeBoundary)).toBe("Saturday");
  });

  it("keeps 00:15 UTC on the same Lagos service date", () => {
    expect(watServiceDateAt(new Date("2026-08-23T00:15:00.000Z"))).toBe("2026-08-23");
  });

  it("formats attendance dates and timestamps independently of the host timezone", () => {
    const priorTimezone = process.env.TZ;
    const instant = "2026-08-22T23:30:00.000Z";
    process.env.TZ = "Pacific/Honolulu";
    const westHost = [formatWatTime(instant), formatServiceDate("2026-08-23")];
    process.env.TZ = "Asia/Tokyo";
    const eastHost = [formatWatTime(instant), formatServiceDate("2026-08-23")];
    process.env.TZ = priorTimezone;

    expect(westHost).toEqual(eastHost);
    expect(westHost).toEqual(["00:30", "23 Aug 2026"]);
  });
});