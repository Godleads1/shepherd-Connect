import { z } from "zod/v4";

const querySchema = z.object({
  period: z.enum(["sunday", "month", "year"]),
  value: z.string(),
  format: z.enum(["json", "pdf", "csv"]).default("json"),
  view: z.enum(["detail", "summary"]).default("detail"),
}).strict();

export function teacherReportPeriod(input: unknown) {
  const parsed = querySchema.safeParse(input);
  if (!parsed.success) return null;
  const q = parsed.data;
  const pattern = q.period === "sunday" ? /^\d{4}-\d{2}-\d{2}$/ : q.period === "month" ? /^\d{4}-\d{2}$/ : /^\d{4}$/;
  if (!pattern.test(q.value)) return null;
  const year = Number(q.value.slice(0, 4));
  if (year < 2000 || year > 2100) return null;
  const from = q.period === "sunday" ? q.value : q.period === "month" ? `${q.value}-01` : `${q.value}-01-01`;
  const start = new Date(`${from}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== from) return null;
  if (q.period === "sunday" && start.getUTCDay() !== 0) return null;
  const end = q.period === "year" ? new Date(Date.UTC(year + 1, 0, 0)) :
    q.period === "month" ? new Date(Date.UTC(year, start.getUTCMonth() + 1, 0)) : start;
  return { ...q, from, to: end.toISOString().slice(0, 10), label: `${q.period === "sunday" ? "Sunday" : q.period === "month" ? "Month" : "Year"} ${q.value}` };
}

export type ReportTeacher = { id: number; firstName: string; lastName: string };
export type ReportScan = { userId: number; serviceDate: string; service: string | null; scanType: string; scannedAt: Date };

/** One row per teacher, date and service; never merge first and second service. */
export function buildTeacherAttendanceReport(teachers: ReportTeacher[], scans: ReportScan[]) {
  const roster = new Map(teachers.map(t => [t.id, `${t.firstName} ${t.lastName}`.trim()]));
  type Row = { teacherId: number; teacherName: string; date: string; service: string; clockIn: string | null; clockOut: string | null; emergencyOut: string | null };
  const grouped = new Map<string, Row>();
  for (const s of scans) {
    if (!roster.has(s.userId)) continue;
    const service = s.service || "Unspecified";
    const key = JSON.stringify([s.userId, s.serviceDate, service]);
    const row = grouped.get(key) ?? { teacherId: s.userId, teacherName: roster.get(s.userId)!, date: s.serviceDate, service, clockIn: null, clockOut: null, emergencyOut: null };
    const time = s.scannedAt.toISOString();
    if (s.scanType === "checkpoint" && (!row.clockIn || time < row.clockIn)) row.clockIn = time;
    if (s.scanType === "clock_out" && (!row.clockOut || time > row.clockOut)) row.clockOut = time;
    if (s.scanType === "emergency_out" && (!row.emergencyOut || time > row.emergencyOut)) row.emergencyOut = time;
    grouped.set(key, row);
  }
  const rows = [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date) || a.teacherName.localeCompare(b.teacherName) || a.service.localeCompare(b.service));
  const perTeacher = new Map<number, Row[]>();
  for (const r of rows) perTeacher.set(r.teacherId, [...(perTeacher.get(r.teacherId) ?? []), r]);
  const summaries = teachers.map(t => {
    const records = perTeacher.get(t.id) ?? [];
    return {
      teacherId: t.id, teacherName: roster.get(t.id)!, services: records.length,
      days: new Set(records.map(r => r.date)).size,
      checkIns: records.filter(r => r.clockIn).length,
      clockOuts: records.filter(r => r.clockOut).length,
      // An emergency exit is not a normal clock-out; it remains separately visible.
      missingClockOuts: records.filter(r => r.clockIn && !r.clockOut).length,
      emergencyExits: records.filter(r => r.emergencyOut).length,
    };
  }).sort((a, b) => a.teacherName.localeCompare(b.teacherName));
  const sum = (key: "checkIns" | "clockOuts" | "missingClockOuts" | "emergencyExits") => summaries.reduce((n, t) => n + t[key], 0);
  return { rows, teachers: summaries, summary: {
    teachers: teachers.length, teachersWithScans: summaries.filter(t => t.services > 0).length,
    serviceRecords: rows.length, checkIns: sum("checkIns"), clockOuts: sum("clockOuts"),
    missingClockOuts: sum("missingClockOuts"), emergencyExits: sum("emergencyExits"),
  } };
}
