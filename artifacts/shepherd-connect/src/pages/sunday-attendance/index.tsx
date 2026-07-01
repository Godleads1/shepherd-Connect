import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-call";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  QrCode, Download, Printer, RefreshCw, CheckCircle2, XCircle,
  LogOut, Users, UserCheck, UserX, ShieldCheck, CalendarDays, ChevronDown, ChevronUp,
} from "lucide-react";

const SERVICE_1 = ["07:00", "08:30", "09:30"] as const;
const SERVICE_2 = ["10:00", "11:00", "12:00"] as const;
const ALL_INTERVALS = [...SERVICE_1, ...SERVICE_2] as const;

const INTERVAL_DISPLAY: Record<string, string> = {
  "07:00": "7:00",
  "08:30": "8:30",
  "09:30": "9:30",
  "10:00": "10:00",
  "11:00": "11:00",
  "12:00": "12:00",
};

type Checkpoint = { intervalLabel: string; scanned: boolean; scannedAt: string | null };
type ClockOut = { service: string | null; scannedAt: string };
type StaffRow = {
  userId: number;
  firstName: string;
  lastName: string;
  role: string;
  photoUrl: string | null;
  checkpoints: Checkpoint[];
  clockOuts: ClockOut[];
  totalScans: number;
};
type SummaryData = {
  date: string;
  hasQr: boolean;
  intervals: string[];
  staff: StaffRow[];
  stats: { total: number; present: number; absent: number; fullDay: number };
};
type QrData = { token: string; serviceDate: string; qrPng: string; existing: boolean };

function nextSunday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + diff);
  return sunday.toISOString().slice(0, 10);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    teacher:  "bg-blue-100 text-blue-700",
    support:  "bg-purple-100 text-purple-700",
    attendant:"bg-green-100 text-green-700",
  };
  return map[role] ?? "bg-gray-100 text-gray-600";
}

function scoreColor(n: number) {
  if (n >= 6) return "bg-green-100 text-green-700";
  if (n >= 3) return "bg-yellow-100 text-yellow-700";
  if (n > 0)  return "bg-orange-100 text-orange-700";
  return "bg-red-50 text-red-400";
}

/** Mini dot-row showing scanned/missed per interval */
function DotRow({ checkpoints, clockOuts }: { checkpoints: Checkpoint[]; clockOuts: ClockOut[] }) {
  const firstOut  = clockOuts.find(c => c.service === "1st");
  const secondOut = clockOuts.find(c => c.service === "2nd");
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {/* 1st service */}
      {SERVICE_1.map(lbl => {
        const ok = checkpoints.find(c => c.intervalLabel === lbl)?.scanned;
        return (
          <div
            key={lbl}
            title={`${INTERVAL_DISPLAY[lbl]} AM (1st)`}
            className={`w-3.5 h-3.5 rounded-full ${ok ? "bg-green-500" : "bg-red-200"}`}
          />
        );
      })}
      {/* clock-out 1st */}
      <div
        title="Clock-out 1st"
        className={`w-3.5 h-3.5 rounded-sm ${firstOut ? "bg-amber-400" : "bg-gray-200"}`}
      />
      <div className="w-0.5 h-3.5 bg-gray-200 rounded mx-0.5" />
      {/* 2nd service */}
      {SERVICE_2.map(lbl => {
        const ok = checkpoints.find(c => c.intervalLabel === lbl)?.scanned;
        return (
          <div
            key={lbl}
            title={`${INTERVAL_DISPLAY[lbl]} (2nd)`}
            className={`w-3.5 h-3.5 rounded-full ${ok ? "bg-green-500" : "bg-red-200"}`}
          />
        );
      })}
      {/* clock-out 2nd */}
      <div
        title="Clock-out 2nd"
        className={`w-3.5 h-3.5 rounded-sm ${secondOut ? "bg-amber-400" : "bg-gray-200"}`}
      />
    </div>
  );
}

/** Mobile card for one staff member */
function StaffCard({ row }: { row: StaffRow }) {
  const [open, setOpen] = useState(false);
  const firstOut  = row.clockOuts.find(c => c.service === "1st");
  const secondOut = row.clockOuts.find(c => c.service === "2nd");

  return (
    <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        {row.photoUrl ? (
          <img src={row.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
            {row.firstName[0]}{row.lastName[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">
            {row.firstName} {row.lastName}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleBadge(row.role)}`}>
              {row.role}
            </span>
            <DotRow checkpoints={row.checkpoints} clockOuts={row.clockOuts} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(row.totalScans)}`}>
            {row.totalScans}/6
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t bg-gray-50 px-4 py-3 space-y-3">
          {/* 1st service */}
          <div>
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">1st Service</p>
            <div className="grid grid-cols-3 gap-2">
              {SERVICE_1.map(lbl => {
                const cp = row.checkpoints.find(c => c.intervalLabel === lbl);
                return (
                  <div key={lbl} className={`rounded-lg p-2 text-center ${cp?.scanned ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-100"}`}>
                    <p className="text-xs font-medium text-gray-700">{INTERVAL_DISPLAY[lbl]} AM</p>
                    {cp?.scanned ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto mt-1" />
                        <p className="text-[10px] text-gray-500 mt-0.5">{cp.scannedAt ? fmtTime(cp.scannedAt) : ""}</p>
                      </>
                    ) : (
                      <XCircle className="w-4 h-4 text-red-300 mx-auto mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
            {firstOut && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                <LogOut className="w-3.5 h-3.5" />
                <span>Clocked out at {fmtTime(firstOut.scannedAt)}</span>
              </div>
            )}
          </div>
          {/* 2nd service */}
          <div>
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2">2nd Service</p>
            <div className="grid grid-cols-3 gap-2">
              {SERVICE_2.map(lbl => {
                const cp = row.checkpoints.find(c => c.intervalLabel === lbl);
                const disp = lbl === "12:00" ? "12:00 PM" : `${INTERVAL_DISPLAY[lbl]} AM`;
                return (
                  <div key={lbl} className={`rounded-lg p-2 text-center ${cp?.scanned ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-100"}`}>
                    <p className="text-xs font-medium text-gray-700">{disp}</p>
                    {cp?.scanned ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto mt-1" />
                        <p className="text-[10px] text-gray-500 mt-0.5">{cp.scannedAt ? fmtTime(cp.scannedAt) : ""}</p>
                      </>
                    ) : (
                      <XCircle className="w-4 h-4 text-red-300 mx-auto mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
            {secondOut && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                <LogOut className="w-3.5 h-3.5" />
                <span>Clocked out at {fmtTime(secondOut.scannedAt)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Desktop table row */
function TableRow({ row, i }: { row: StaffRow; i: number }) {
  const firstOut  = row.clockOuts.find(c => c.service === "1st");
  const secondOut = row.clockOuts.find(c => c.service === "2nd");
  return (
    <tr className={`border-b hover:bg-gray-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {row.photoUrl ? (
            <img src={row.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-xs flex-shrink-0">
              {row.firstName[0]}{row.lastName[0]}
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900 text-sm leading-tight whitespace-nowrap">
              {row.firstName} {row.lastName}
            </p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleBadge(row.role)}`}>
              {row.role}
            </span>
          </div>
        </div>
      </td>
      {ALL_INTERVALS.map(lbl => {
        const cp = row.checkpoints.find(c => c.intervalLabel === lbl);
        return (
          <td key={lbl} className="px-2 py-3 text-center">
            {cp?.scanned ? (
              <div className="flex flex-col items-center gap-0.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                {cp.scannedAt && (
                  <span className="text-[10px] text-gray-400">{fmtTime(cp.scannedAt)}</span>
                )}
              </div>
            ) : (
              <XCircle className="w-4 h-4 text-red-200 mx-auto" />
            )}
          </td>
        );
      })}
      <td className="px-2 py-3 text-center">
        {firstOut ? (
          <div className="flex flex-col items-center gap-0.5">
            <LogOut className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] text-gray-400">{fmtTime(firstOut.scannedAt)}</span>
          </div>
        ) : <span className="text-gray-200 text-xs">—</span>}
      </td>
      <td className="px-2 py-3 text-center">
        {secondOut ? (
          <div className="flex flex-col items-center gap-0.5">
            <LogOut className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] text-gray-400">{fmtTime(secondOut.scannedAt)}</span>
          </div>
        ) : <span className="text-gray-200 text-xs">—</span>}
      </td>
      <td className="px-3 py-3 text-center">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(row.totalScans)}`}>
          {row.totalScans}/6
        </span>
      </td>
    </tr>
  );
}

export default function SundayAttendancePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(nextSunday);
  const [qrData, setQrData] = useState<QrData | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<SummaryData>({
    queryKey: ["sunday-attendance-summary", date],
    queryFn: () => apiGet<SummaryData>(`/sunday-attendance/summary?date=${date}`),
    enabled: !!date,
  });

  const handleRefresh = useCallback(async () => {
    await refetchSummary();
  }, [refetchSummary]);

  const ptr = usePullToRefresh(handleRefresh);

  const generateMutation = useMutation({
    mutationFn: (serviceDate: string) =>
      apiPost<QrData>("/sunday-attendance/qr/generate", { serviceDate }),
    onSuccess: (data: QrData) => {
      setQrData(data);
      qc.invalidateQueries({ queryKey: ["sunday-attendance-summary", date] });
    },
  });

  function handleDownload() {
    if (!qrData) return;
    const a = document.createElement("a");
    a.href = qrData.qrPng;
    a.download = `shepherd-connect-attendance-${date}.png`;
    a.click();
  }

  function handlePrint() {
    if (!qrData) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-NG", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    win.document.write(`
      <!DOCTYPE html><html>
      <head><title>Shepherd Connect — Attendance QR</title>
      <style>
        body{font-family:sans-serif;text-align:center;padding:40px}
        h1{font-size:28px;color:#1e3a8a;margin-bottom:4px}
        p{color:#555;font-size:16px;margin:4px 0}
        img{margin:24px auto;display:block;width:300px}
        .foot{margin-top:16px;font-size:13px;color:#888}
      </style></head>
      <body>
        <h1>Shepherd Connect</h1>
        <p>Service Attendance — ${dateLabel}</p>
        <img src="${qrData.qrPng}" alt="QR"/>
        <p>Scan at each checkpoint to record your attendance.</p>
        <div class="foot">Safe. Known. Celebrated. — RCCG City of David</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  const statCards = [
    { label: "Total Staff",  value: summary?.stats.total    ?? 0, icon: Users,      color: "text-blue-600",   bg: "bg-blue-50"  },
    { label: "Present",      value: summary?.stats.present  ?? 0, icon: UserCheck,  color: "text-green-600",  bg: "bg-green-50" },
    { label: "Absent",       value: summary?.stats.absent   ?? 0, icon: UserX,      color: "text-red-500",    bg: "bg-red-50"   },
    { label: "Full Day",     value: summary?.stats.fullDay  ?? 0, icon: ShieldCheck,color: "text-amber-600",  bg: "bg-amber-50" },
  ];

  return (
    <div className="space-y-5">
      <PullToRefreshIndicator {...ptr} />

        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-blue-900">Service Attendance</h1>
            <p className="text-sm text-gray-500">QR-based Sunday tracking</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white shadow-sm w-full sm:w-auto"
            />
            <Button variant="outline" size="icon" onClick={() => refetchSummary()} className="shrink-0">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map(c => (
            <Card key={c.label} className="shadow-sm border-0">
              <CardContent className={`p-3 flex items-center gap-3 rounded-xl ${c.bg}`}>
                <div className="bg-white p-2 rounded-lg shadow-sm shrink-0">
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 leading-none">{c.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── QR + Intervals ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* QR card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-700" /> QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {qrData ? (
                <>
                  <div className="flex justify-center">
                    <div ref={printRef} className="bg-white p-3 rounded-xl border shadow-sm">
                      <img src={qrData.qrPng} alt="QR" className="w-40 h-40 sm:w-48 sm:h-48" />
                    </div>
                  </div>
                  <p className="text-xs text-center text-gray-400">
                    {qrData.existing ? "Existing" : "New"} QR for {date} — paste on the church wall
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button className="bg-blue-900 hover:bg-blue-800 text-white text-xs" size="sm" onClick={handleDownload}>
                      <Download className="w-3.5 h-3.5 mr-1" /> Download
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={handlePrint}>
                      <Printer className="w-3.5 h-3.5 mr-1" /> Print
                    </Button>
                  </div>
                  <button
                    className="w-full text-gray-400 text-xs hover:text-gray-600"
                    onClick={() => generateMutation.mutate(date)}
                    disabled={generateMutation.isPending}
                  >
                    Regenerate
                  </button>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-2 py-5 text-gray-400">
                    <QrCode className="w-14 h-14 opacity-20" />
                    <p className="text-sm text-center">
                      {summary?.hasQr ? "QR exists — click to load" : "No QR yet for this date"}
                    </p>
                  </div>
                  <Button
                    className="w-full bg-blue-900 hover:bg-blue-800 text-white"
                    onClick={() => generateMutation.mutate(date)}
                    disabled={generateMutation.isPending}
                  >
                    {generateMutation.isPending
                      ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      : <QrCode className="w-4 h-4 mr-2" />}
                    {summary?.hasQr ? "Load QR Code" : "Generate QR Code"}
                  </Button>
                </>
              )}
              {generateMutation.isError && (
                <p className="text-red-500 text-xs text-center">Failed. Please try again.</p>
              )}
            </CardContent>
          </Card>

          {/* Checkpoint summary */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-700" /> Checkpoint Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* 1st service */}
              <div>
                <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1.5">1st Service</p>
                {SERVICE_1.map(lbl => {
                  const total = summary?.staff.length ?? 0;
                  const count = summary?.staff.filter(s => s.checkpoints.find(c => c.intervalLabel === lbl)?.scanned).length ?? 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={lbl} className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 font-medium">{INTERVAL_DISPLAY[lbl]} AM</span>
                        <span className={count > 0 ? "text-green-600 font-semibold" : "text-gray-400"}>
                          {total > 0 ? `${count}/${total}` : "—"}
                        </span>
                      </div>
                      {total > 0 && (
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* 2nd service */}
              <div>
                <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">2nd Service</p>
                {SERVICE_2.map(lbl => {
                  const total = summary?.staff.length ?? 0;
                  const count = summary?.staff.filter(s => s.checkpoints.find(c => c.intervalLabel === lbl)?.scanned).length ?? 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const disp = lbl === "12:00" ? "12:00 PM" : `${INTERVAL_DISPLAY[lbl]} AM`;
                  return (
                    <div key={lbl} className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 font-medium">{disp}</span>
                        <span className={count > 0 ? "text-green-600 font-semibold" : "text-gray-400"}>
                          {total > 0 ? `${count}/${total}` : "—"}
                        </span>
                      </div>
                      {total > 0 && (
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400">
                WhatsApp reminders sent automatically at each checkpoint time.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Compliance grid / cards ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-700" /> Staff Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {summaryLoading ? (
              <div className="flex justify-center py-10">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : !summary || summary.staff.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No active staff found.</p>
              </div>
            ) : (
              <>
                {/* Mobile: expandable cards */}
                <div className="md:hidden px-3 pb-3 space-y-2">
                  <div className="flex items-center gap-3 px-1 py-2 text-[10px] text-gray-400 font-medium">
                    <div className="flex items-center gap-0.5">
                      {SERVICE_1.map(l => <div key={l} className="w-3.5 h-3.5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] text-gray-500">{INTERVAL_DISPLAY[l].replace(":","")}</div>)}
                      <div className="w-3.5 h-3.5 rounded-sm bg-gray-200 mx-0.5" title="Out 1st" />
                      <div className="w-px h-3.5 bg-gray-200 mx-0.5" />
                      {SERVICE_2.map(l => <div key={l} className="w-3.5 h-3.5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] text-gray-500">{INTERVAL_DISPLAY[l].replace(":","")}</div>)}
                      <div className="w-3.5 h-3.5 rounded-sm bg-gray-200 mx-0.5" title="Out 2nd" />
                    </div>
                    <span>tap to expand</span>
                  </div>
                  {summary.staff.map(row => <StaffCard key={row.userId} row={row} />)}
                </div>

                {/* Desktop: full table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-blue-50 border-b">
                        <th className="text-left px-4 py-3 font-semibold text-blue-900 min-w-[180px]">Staff</th>
                        {SERVICE_1.map(lbl => (
                          <th key={lbl} className="px-2 py-3 text-center font-semibold text-blue-700 min-w-[64px]">
                            <div className="text-xs">{INTERVAL_DISPLAY[lbl]}</div>
                            <div className="text-[10px] text-blue-400 font-normal">1st</div>
                          </th>
                        ))}
                        <th className="px-2 py-3 text-center min-w-[56px]">
                          <div className="text-xs font-semibold text-amber-700">Out</div>
                          <div className="text-[10px] text-amber-400 font-normal">1st</div>
                        </th>
                        {SERVICE_2.map(lbl => (
                          <th key={lbl} className="px-2 py-3 text-center font-semibold text-purple-700 min-w-[64px]">
                            <div className="text-xs">{INTERVAL_DISPLAY[lbl]}</div>
                            <div className="text-[10px] text-purple-400 font-normal">2nd</div>
                          </th>
                        ))}
                        <th className="px-2 py-3 text-center min-w-[56px]">
                          <div className="text-xs font-semibold text-amber-700">Out</div>
                          <div className="text-[10px] text-amber-400 font-normal">2nd</div>
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 min-w-[56px]">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.staff.map((row, i) => <TableRow key={row.userId} row={row} i={i} />)}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
