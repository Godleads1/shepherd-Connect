import { describe, expect, it } from "vitest";
import {
  buildTeacherAttendanceQuery, defaultPeriodValue, isSundayDate, latestSundayOnOrBefore, validatePeriodValue,
} from "./teacher-attendance-period";

describe("teacher attendance period helpers", () => {
  it("recognises real Sundays only", () => {
    expect(isSundayDate("2026-08-23")).toBe(true);
    expect(isSundayDate("2026-08-24")).toBe(false);
    expect(isSundayDate("2026-02-30")).toBe(false);
    expect(isSundayDate("garbage")).toBe(false);
  });

  it("snaps to the latest Sunday on or before a date", () => {
    expect(latestSundayOnOrBefore("2026-08-23")).toBe("2026-08-23");
    expect(latestSundayOnOrBefore("2026-08-29")).toBe("2026-08-23");
    expect(latestSundayOnOrBefore("2026-03-02")).toBe("2026-03-01");
  });

  it("derives defaults per period", () => {
    expect(defaultPeriodValue("sunday", "2026-08-26")).toBe("2026-08-23");
    expect(defaultPeriodValue("month", "2026-08-26")).toBe("2026-08");
    expect(defaultPeriodValue("year", "2026-08-26")).toBe("2026");
  });

  it("validates values", () => {
    expect(validatePeriodValue("sunday", "2026-08-24")).toMatch(/not a Sunday/);
    expect(validatePeriodValue("sunday", "2026-08-23")).toBeNull();
    expect(validatePeriodValue("month", "2026-13")).not.toBeNull();
    expect(validatePeriodValue("month", "2026-08")).toBeNull();
    expect(validatePeriodValue("year", "26")).not.toBeNull();
    expect(validatePeriodValue("year", "2026")).toBeNull();
  });

  it("builds the endpoint query", () => {
    expect(buildTeacherAttendanceQuery("month", "2026-08", "pdf", "summary"))
      .toBe("/reports/teacher-attendance?period=month&value=2026-08&format=pdf&view=summary");
  });
});
