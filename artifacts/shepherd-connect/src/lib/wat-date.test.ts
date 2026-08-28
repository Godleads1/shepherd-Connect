import { describe, expect, it } from "vitest";
import { isWatSundayAt, watServiceDateAt, watWeekdayAt } from "./wat-date";

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
});