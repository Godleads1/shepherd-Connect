import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TeacherAttendanceReport as Report, TeacherAttendanceRow as Row, TeacherAttendanceSummaryRow as TeacherSummary } from "@workspace/api-client-react";
import { apiGet, apiGetBlob } from "@/lib/api-call";
import { formatServiceDate, formatWatTime } from "@/lib/wat-date";
import {
  buildTeacherAttendanceQuery, defaultPeriodValue, validatePeriodValue, type TeacherAttendancePeriod,
} from "@/lib/teacher-attendance-period";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Download, FileText, RefreshCw, ShieldAlert, UserCheck } from "lucide-react";

const PERIODS: { key: TeacherAttendancePeriod; label: string }[] = [
  { key: "sunday", label: "Sunday" }, { key: "month", label: "Month" }, { key: "year", label: "Year" },
];

const time = (v: string | null) => (v ? formatWatTime(v) : "—");

async function saveBlob(path: string, filename: string) {
  const blob = await apiGetBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.style.display = "none";
  document.body.appendChild(a);
  try { a.click(); } finally {
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export default function TeacherAttendanceReport() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<TeacherAttendancePeriod>("sunday");
  const [value, setValue] = useState(() => defaultPeriodValue("sunday"));
  const [view, setView] = useState<"detail" | "summary">("summary");
  const [submitted, setSubmitted] = useState<{ period: TeacherAttendancePeriod; value: string } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const validation = validatePeriodValue(period, value);

  // Reset any shown result whenever filters change.
  useEffect(() => { setSubmitted(null); }, [period, value]);

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["teacher-attendance", submitted?.period, submitted?.value],
    queryFn: () => apiGet<Report>(buildTeacherAttendanceQuery(submitted!.period, submitted!.value, "json", "detail")),
    enabled: !!submitted,
  });

  const changePeriod = (p: TeacherAttendancePeriod) => { setPeriod(p); setValue(defaultPeriodValue(p)); };

  const download = async (format: "pdf" | "csv", v: "detail" | "summary") => {
    if (validation) return;
    const key = `${format}-${v}`;
    setDownloading(key);
    try {
      await saveBlob(buildTeacherAttendanceQuery(period, value, format, v), `teacher-attendance-${v}-${period}-${value}.${format}`);
      toast({ title: `Teacher attendance ${v} ${format.toUpperCase()} downloaded` });
    } catch (e) {
      toast({ variant: "destructive", title: "Download failed", description: e instanceof Error ? e.message : undefined });
    } finally { setDownloading(null); }
  };

  const report = submitted ? data : undefined;
  const s = report?.summary;
  const metrics = s ? [
    { label: "Teachers on roster", value: s.teachers },
    { label: "With scans", value: s.teachersWithScans },
    { label: "Service records", value: s.serviceRecords },
    { label: "Check-ins", value: s.checkIns },
    { label: "Clock-outs", value: s.clockOuts },
    { label: "Missing clock-outs", value: s.missingClockOuts, warn: s.missingClockOuts > 0 },
    { label: "Emergency exits", value: s.emergencyExits, alert: s.emergencyExits > 0 },
  ] : [];

  return (
    <div className="space-y-5" data-testid="panel-teacher-attendance">
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Period</label>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              {PERIODS.map(p => (
                <button key={p.key} type="button" data-testid={`button-period-${p.key}`} onClick={() => changePeriod(p.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${period === p.key ? "bg-blue-800 text-white" : "text-gray-600 hover:bg-gray-200"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              {period === "sunday" ? "Sunday date" : period === "month" ? "Month" : "Year"}
            </label>
            {period === "sunday" && <Input type="date" value={value} onChange={e => setValue(e.target.value)} className="w-44" data-testid="input-sunday" />}
            {period === "month" && <Input type="month" value={value} onChange={e => setValue(e.target.value)} className="w-44" data-testid="input-month" />}
            {period === "year" && <Input type="number" min={2000} max={2100} value={value} onChange={e => setValue(e.target.value)} className="w-28" data-testid="input-year" />}
          </div>
          <Button data-testid="button-run-teacher-attendance" disabled={!!validation || isFetching}
            onClick={() => { if (submitted) void refetch(); else setSubmitted({ period, value }); }}
            className="bg-blue-800 hover:bg-blue-900">
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Run report
          </Button>
        </div>
        {validation && <p className="text-xs text-red-600" data-testid="text-period-error">{validation}</p>}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
          {([["pdf", "detail", "Detail PDF"], ["pdf", "summary", "Summary PDF"], ["csv", "detail", "Detail CSV"], ["csv", "summary", "Summary CSV"]] as const).map(([f, v, label]) => (
            <Button key={`${f}-${v}`} variant="outline" size="sm" disabled={!!validation || !!downloading}
              data-testid={`button-download-${f}-${v}`} onClick={() => void download(f, v)}>
              {f === "pdf" ? <FileText className="h-4 w-4 mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
              {downloading === `${f}-${v}` ? "Preparing…" : label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="text-privacy-note">
        <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
        <ul className="space-y-1 list-disc pl-4">
          <li>A missing scan is <strong>not proof of absence</strong> — teachers may have served without scanning.</li>
          <li>The roster reflects <strong>current</strong> teacher roles, not who held the role historically.</li>
          <li>Emergency exits are counted separately and are not treated as normal clock-outs.</li>
          <li>All times shown in Lagos time (WAT). Handle this report as confidential staff data.</li>
        </ul>
      </div>

      {!submitted ? (
        <div className="py-16 text-center bg-white border rounded-2xl">
          <UserCheck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">Choose a period and run the report</p>
          <p className="text-sm text-gray-400 mt-1">Sunday, month or year — downloads work without previewing.</p>
        </div>
      ) : isFetching && !report ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : isError ? (
        <div className="py-12 text-center bg-white border border-red-100 rounded-2xl" data-testid="status-teacher-attendance-error">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-2" />
          <p className="text-gray-700 font-semibold">Couldn't load teacher attendance</p>
          <p className="text-sm text-gray-400 mt-1">{error instanceof Error ? error.message : "Unknown error"}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => void refetch()} data-testid="button-retry-teacher-attendance">Retry</Button>
        </div>
      ) : report ? (
        <>
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h3 className="font-bold text-gray-800" data-testid="text-report-label">{report.label}</h3>
            <p className="text-xs text-gray-400">{formatServiceDate(report.from)} – {formatServiceDate(report.to)}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {metrics.map(m => (
              <div key={m.label} className={`rounded-2xl border p-3 ${m.alert ? "bg-red-50 border-red-100" : m.warn ? "bg-amber-50 border-amber-100" : "bg-blue-50/60 border-blue-100"}`}
                data-testid={`metric-${m.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <p className={`text-2xl font-black tabular-nums ${m.alert ? "text-red-700" : m.warn ? "text-amber-700" : "text-blue-900"}`}>{m.value}</p>
                <p className="text-[11px] font-semibold text-gray-500 mt-0.5 leading-tight">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                {(["summary", "detail"] as const).map(v => (
                  <button key={v} type="button" data-testid={`button-view-${v}`} onClick={() => setView(v)}
                    className={`px-3 py-1 rounded-md text-xs font-bold capitalize ${view === v ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
                    {v === "summary" ? "Per teacher" : "Detail"}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-400">{view === "summary" ? `${report.teachers.length} teachers` : `${report.rows.length} records`}</span>
            </div>
            <div className="overflow-x-auto">
              {view === "summary" ? (
                report.teachers.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-400">No teachers on the current roster.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>{["Teacher", "Services", "Days", "Check-ins", "Clock-outs", "Missing out", "Emergency"].map(h => <th key={h} className="px-4 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {report.teachers.map(t => (
                        <tr key={t.teacherId} className={`border-t border-gray-50 ${t.checkIns === 0 ? "text-gray-400" : ""}`} data-testid={`row-teacher-${t.teacherId}`}>
                          <td className="px-4 py-2 font-medium">{t.teacherName}{t.checkIns === 0 && <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">no scans</span>}</td>
                          <td className="px-4 py-2 tabular-nums">{t.services}</td>
                          <td className="px-4 py-2 tabular-nums">{t.days}</td>
                          <td className="px-4 py-2 tabular-nums">{t.checkIns}</td>
                          <td className="px-4 py-2 tabular-nums">{t.clockOuts}</td>
                          <td className={`px-4 py-2 tabular-nums ${t.missingClockOuts ? "text-amber-700 font-semibold" : ""}`}>{t.missingClockOuts}</td>
                          <td className={`px-4 py-2 tabular-nums ${t.emergencyExits ? "text-red-700 font-semibold" : ""}`}>{t.emergencyExits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : report.rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400" data-testid="text-no-scans">No teacher scans recorded for this period.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>{["Teacher", "Date", "Service", "Clock in", "Clock out", "Emergency out"].map(h => <th key={h} className="px-4 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r, i) => (
                      <tr key={`${r.teacherId}-${r.date}-${r.service}-${i}`} className="border-t border-gray-50" data-testid={`row-detail-${i}`}>
                        <td className="px-4 py-2 font-medium">{r.teacherName}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{formatServiceDate(r.date)}</td>
                        <td className="px-4 py-2">{r.service}</td>
                        <td className="px-4 py-2 tabular-nums">{time(r.clockIn)}</td>
                        <td className={`px-4 py-2 tabular-nums ${r.clockIn && !r.clockOut && !r.emergencyOut ? "text-amber-700" : ""}`}>{r.clockIn && !r.clockOut && !r.emergencyOut ? "Missing" : time(r.clockOut)}</td>
                        <td className={`px-4 py-2 tabular-nums ${r.emergencyOut ? "text-red-700 font-semibold" : ""}`}>{time(r.emergencyOut)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
