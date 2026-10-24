import { describe, it, expect } from "vitest";
import { teacherReportPeriod, buildTeacherAttendanceReport } from "../services/teacherAttendanceReport";
import { formatServiceTime } from "../lib/serviceTime";

describe("teacher report periods", () => {
  it("accepts Sunday only and rejects invalid dates and unsafe filters", () => {
    expect(teacherReportPeriod({ period: "sunday", value: "2026-10-18" })?.to).toBe("2026-10-18");
    for (const value of ["2026-10-17", "2026-02-30", "bad"]) expect(teacherReportPeriod({ period: "sunday", value })).toBeNull();
    expect(teacherReportPeriod({ period: "year", value: "2026", role: "parent" })).toBeNull();
    expect(teacherReportPeriod({ period: "year", value: "9999" })).toBeNull();
  });
  it("supports full leap years, months and December without a 92-day cap", () => {
    expect(teacherReportPeriod({ period: "month", value: "2028-02" })).toMatchObject({ from: "2028-02-01", to: "2028-02-29" });
    expect(teacherReportPeriod({ period: "month", value: "2026-12" })?.to).toBe("2026-12-31");
    expect(teacherReportPeriod({ period: "year", value: "2028" })).toMatchObject({ from: "2028-01-01", to: "2028-12-31" });
    expect(teacherReportPeriod({ period: "month", value: "2026-13" })).toBeNull();
  });
});
describe("teacher scan reports", () => {
  const teachers = [{ id: 1, firstName: "Test", lastName: "Teacher" }, { id: 2, firstName: "No", lastName: "Scans" }];
  const scan = (service: string, scanType: string, hour: number, userId = 1) => ({
    userId, serviceDate: "2026-10-18", service, scanType, scannedAt: new Date(Date.UTC(2026, 9, 18, hour)),
  });
  it("keeps service rows separate, excludes nonteachers and never treats emergency exits as normal exits", () => {
    const report = buildTeacherAttendanceReport(teachers, [
      scan("1st", "checkpoint", 6), scan("1st", "clock_out", 9),
      scan("2nd", "checkpoint", 10), scan("2nd", "emergency_out", 11),
      scan("1st", "checkpoint", 6, 99),
    ]);
    expect(report.rows).toHaveLength(2);
    expect(report.summary).toEqual({ teachers: 2, teachersWithScans: 1, serviceRecords: 2, checkIns: 2, clockOuts: 1, missingClockOuts: 1, emergencyExits: 1 });
    expect(report.teachers.find(t => t.teacherId === 1)?.days).toBe(1);
    expect(report.teachers.find(t => t.teacherId === 2)?.services).toBe(0);
    expect(formatServiceTime(report.rows[0].clockIn!)).toBe("07:00");
  });
  it("retains exits with missing arrivals and aggregates duplicates deterministically", () => {
    const report = buildTeacherAttendanceReport(teachers, [
      scan("1st", "checkpoint", 8), scan("1st", "checkpoint", 6),
      scan("1st", "clock_out", 9), scan("1st", "clock_out", 10),
      scan("2nd", "clock_out", 12),
    ]);
    expect(report.rows[0].clockIn).toContain("06:00");
    expect(report.rows[0].clockOut).toContain("10:00");
    expect(report.rows[1].clockIn).toBeNull();
    expect(report.summary.missingClockOuts).toBe(0);
  });
  it("returns a zero summary for empty data", () => {
    expect(buildTeacherAttendanceReport([], []).summary.serviceRecords).toBe(0);
    expect(buildTeacherAttendanceReport(teachers, []).teachers).toHaveLength(2);
  });
});
