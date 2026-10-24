import { Router } from "express";
import { and, asc, gte, lte, sql } from "drizzle-orm";
import { db, usersTable, staffScansTable, auditLogsTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { buildTeacherAttendanceReport, teacherReportPeriod } from "../services/teacherAttendanceReport";
import { streamPdf, renderReportPdf } from "../lib/pdf";
import { formatServiceTime } from "../lib/serviceTime";

const router = Router();
const MAX_SCANS = 100_000;
export function teacherReportCsv(rows: string[][]) {
  return rows.map(row => row.map(value => {
    const safe = /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
}

router.get("/reports/teacher-attendance", authMiddleware, requireRoles("super_admin", "admin"), async (req, res) => {
  const query = teacherReportPeriod(req.query);
  if (!query) { res.status(400).json({ error: "Choose a valid Sunday, month or year (2000–2100)." }); return; }
  try {
    // Current teacher role OR teacher profile includes secondary teachers, but not unrelated support/admin staff.
    const teacherScope = sql`(${usersTable.role} = 'teacher'
      OR coalesce(${usersTable.secondaryRoles}, '') ~ '(^|[^a-z])teacher([^a-z]|$)'
      OR EXISTS (SELECT 1 FROM teachers t WHERE t.user_id = ${usersTable.id}))`;
    // Repeatable-read makes preview/export totals consistent with the selected detail rows.
    const result = await db.transaction(async tx => {
      const teachers = await tx.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName })
        .from(usersTable).where(teacherScope);
      const scans = await tx.select({
        userId: staffScansTable.userId, serviceDate: staffScansTable.serviceDate,
        service: staffScansTable.service, scanType: staffScansTable.scanType, scannedAt: staffScansTable.scannedAt,
      }).from(staffScansTable).innerJoin(usersTable, sql`${usersTable.id} = ${staffScansTable.userId}`)
        .where(and(teacherScope, gte(staffScansTable.serviceDate, query.from), lte(staffScansTable.serviceDate, query.to)))
        .orderBy(asc(staffScansTable.serviceDate), asc(staffScansTable.userId), asc(staffScansTable.scannedAt)).limit(MAX_SCANS + 1);
      if (scans.length > MAX_SCANS) return null;
      return buildTeacherAttendanceReport(teachers, scans);
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    if (!result) { res.status(422).json({ error: "This report is too large. Select a month or Sunday; no records have been omitted." }); return; }
    const report = { ...result, from: query.from, to: query.to, period: query.period, label: query.label };
    if (query.format === "json") { res.json(report); return; }
    const time = (v: string | null) => v ? formatServiceTime(v) : "Not recorded";
    const detail = query.view === "detail";
    const columns = detail
      ? [{ label: "Date", width: 70 }, { label: "Teacher", width: 165 }, { label: "Service", width: 55 }, { label: "In WAT", width: 75 }, { label: "Out WAT", width: 75 }, { label: "Emergency WAT", width: 75 }]
      : [{ label: "Teacher", width: 170 }, { label: "Days", width: 40 }, { label: "Services", width: 50 }, { label: "In", width: 40 }, { label: "Out", width: 40 }, { label: "Missing out", width: 85 }, { label: "Emergency", width: 90 }];
    const rows = detail
      ? result.rows.map(r => [r.date, r.teacherName, r.service, time(r.clockIn), time(r.clockOut), r.emergencyOut ? time(r.emergencyOut) : "-"])
      : result.teachers.map(t => [t.teacherName, String(t.days), String(t.services), String(t.checkIns), String(t.clockOuts), String(t.missingClockOuts), String(t.emergencyExits)]);
    await db.insert(auditLogsTable).values({
      userId: req.user!.userId, action: "report_export", entityType: "teacher_attendance",
      ipAddress: req.ip?.slice(0, 64) || null,
      userAgent: req.headers["user-agent"]?.slice(0, 512) || null,
      metadataJson: JSON.stringify({ role: req.user!.role, format: query.format, filters: query, rowCount: rows.length, sensitivityClass: "operational" }),
    });
    const filename = `teacher-attendance-${query.view}-${query.from}-to-${query.to}.${query.format}`;
    if (query.format === "csv") {
      res.type("text/csv").attachment(filename).send(teacherReportCsv([columns.map(c => c.label), ...rows])); return;
    }
    streamPdf(res, filename, doc => renderReportPdf(doc, {
      title: `Teacher Attendance - ${detail ? "Detail" : "Summary"}`,
      subtitle: `${query.from} to ${query.to} | WAT (UTC+1) | Current teacher roster\nMissing scans do not prove absence. Emergency exits are not normal clock-outs.`,
      columns, rows,
      summaryStats: [
        { label: "Teachers with scans", value: String(result.summary.teachersWithScans) },
        { label: "Check-ins", value: String(result.summary.checkIns) },
        { label: "Normal clock-outs", value: String(result.summary.clockOuts) },
        { label: "Missing clock-outs", value: String(result.summary.missingClockOuts) },
      ],
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to generate teacher attendance report");
    if (!res.headersSent) res.status(500).json({ error: "Could not generate teacher attendance report." });
  }
});
export default router;
