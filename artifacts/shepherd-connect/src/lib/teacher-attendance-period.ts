import { watServiceDateAt } from "./wat-date";

export type TeacherAttendancePeriod = "sunday" | "month" | "year";

/** True when a YYYY-MM-DD string is a real calendar date falling on a Sunday. */
export function isSundayDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return false;
  return dt.getUTCDay() === 0;
}

/** Most recent Sunday on or before the given YYYY-MM-DD (WAT today by default). */
export function latestSundayOnOrBefore(value: string = watServiceDateAt()): string {
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
  return dt.toISOString().slice(0, 10);
}

export function defaultPeriodValue(period: TeacherAttendancePeriod, today: string = watServiceDateAt()): string {
  if (period === "sunday") return latestSundayOnOrBefore(today);
  if (period === "month") return today.slice(0, 7);
  return today.slice(0, 4);
}

/** Returns an error message, or null when the value is valid for the period. */
export function validatePeriodValue(period: TeacherAttendancePeriod, value: string): string | null {
  if (period === "sunday") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Pick a date.";
    return isSundayDate(value) ? null : "That date is not a Sunday. Choose a Sunday service date.";
  }
  if (period === "month") {
    const m = /^(\d{4})-(\d{2})$/.exec(value);
    return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? null : "Pick a month (YYYY-MM).";
  }
  return /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2100 ? null : "Enter a 4-digit year.";
}

export function buildTeacherAttendanceQuery(
  period: TeacherAttendancePeriod,
  value: string,
  format: "json" | "pdf" | "csv",
  view: "detail" | "summary",
): string {
  return `/reports/teacher-attendance?${new URLSearchParams({ period, value, format, view })}`;
}
