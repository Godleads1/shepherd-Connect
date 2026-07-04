import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-call";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  QrCode, Download, Printer, RefreshCw, CheckCircle2, XCircle,
  LogOut, Users, UserCheck, UserX, ShieldCheck, CalendarDays,
  ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";

const SERVICES = ["1st", "2nd"] as const;

type CheckIn = { service: "1st" | "2nd"; scanned: boolean; scannedAt: string | null };
type ClockOut = { service: string | null; scannedAt: string };
type EmergencyOut = { service: string | null; exitedAt: Date; reason: string | null } | null;

type StaffRow = {
  userId: number;
  firstName: string;
  lastName: string;
  role: string;
  photoUrl: string | null;
  checkIns: CheckIn[];
  clockOuts: ClockOut[];
  emergencyOut: EmergencyOut;
  scheduledService: "1st" | "2nd" | "both";
  totalScans: number;
  scoreMax: number;
  isSubstitute: boolean;
  isExcused: boolean;
};

type SummaryData = {
  date: string;
  hasQr: boolean;
  services: string[];
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

function fmtTime(iso: string | Date) {
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

function scoreColor(n: number, max: number) {
  if (n >= max) return "bg-green-100 text-green-700";
  if (n > 0)  return "bg-orange-100 text-orange-700";
  return "bg-red-50 text-red-400";
}

/** Mini dot-row showing check-in/out per service */
function DotRow({
  checkIns, clockOuts, emergencyOut, scheduledService,
}: {
  checkIns: CheckIn[];
  clockOuts: ClockOut[];
  emergencyOut: EmergencyOut;
  scheduledService: "1st" | "2nd" | "both";
}) {
  const firstOut  = clockOuts.find(c => c.service === "1st");
  const secondOut = clockOuts.find(c => c.service === "2nd");
  const emg1st = emergencyOut?.service === "1st";
  const emg2nd = emergencyOut?.service === "2nd";
  const in1st = checkIns.find(c => c.service === "1st")?.scanned;
  const in2nd = checkIns.find(c => c.service === "2nd")?.scanned;

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {/* 1st service */}
      <div
        title={scheduledService === "2nd" ? "Not scheduled" : "1st Service check-in"}
        className={`w-3.5 h-3.5 rounded-full ${
          scheduledService === "2nd" ? "bg-gray-100" :
          in1st ? "bg-green-500" :
          emg1st ? "bg-orange-300" :
                   "bg-red-200"
        }`}
      />
      <div
        title={emg1st ? "Emergency exit" : "Clock-out 1st"}
        className={`w-3.5 h-3.5 rounded-sm ${
          scheduledService === "2nd" ? "bg-gray-100" :
          emg1st   ? "bg-orange-400" :
          firstOut ? "bg-amber-400"  : "bg-gray-200"
        }`}
      />
      <div className="w-0.5 h-3.5 bg-gray-200 rounded mx-0.5" />
      {/* 2nd service */}
      <div
        title={scheduledService === "1st" ? "Not scheduled" : "2nd Service check-in"}
        className={`w-3.5 h-3.5 rounded-full ${
          scheduledService === "1st" ? "bg-gray-100" :
          in2nd ? "bg-green-500" :
          emg2nd ? "bg-orange-300" :
                   "bg-red-200"
        }`}
      />
      <div
        title={emg2nd ? "Emergency exit" : "Clock-out 2nd"}
        className={`w-3.5 h-3.5 rounded-sm ${
          scheduledService === "1st" ? "bg-gray-100" :
          emg2nd    ? "bg-orange-400" :
          secondOut ? "bg-amber-400"  : "bg-gray-200"
        }`}
      />
    </div>
  );
}

/** Mobile card for one staff member */
function StaffCard({ row }: { row: StaffRow }) {
  const [open, setOpen] = useState(false);
  const firstOut  = row.clockOuts.find(c => c.service === "1st");
  const secondOut = row.clockOuts.find(c => c.service === "2nd");
  const emg1st    = row.emergencyOut?.service === "1st";
  const emg2nd    = row.emergencyOut?.service === "2nd";
  const in1st = row.checkIns.find(c => c.service === "1st");
  const in2nd = row.checkIns.find(c => c.service === "2nd");

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
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm truncate">
              {row.firstName} {row.lastName}
            </p>
            {row.isSubstitute && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-teal-100 text-teal-700">SUB</span>
            )}
            {row.isExcused && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500">EXCUSED</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleBadge(row.role)}`}>
              {row.role}
            </span>
            <DotRow
              checkIns={row.checkIns}
              clockOuts={row.clockOuts}
              emergencyOut={row.emergencyOut}
              scheduledService={row.scheduledService}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(row.totalScans, row.scoreMax)}`}>
            {row.totalScans}/{row.scoreMax}
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t bg-gray-50 px-4 py-3 space-y-3">
          {/* 1st service */}
          <div>
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">
              1st Service
              {row.scheduledService === "2nd" && (
                <span className="ml-2 font-normal text-gray-400 normal-case">(not scheduled)</span>
              )}
            </p>
            {row.scheduledService === "2nd" ? (
              <div className="rounded-lg p-2 text-center bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-300">N/A</span>
              </div>
            ) : (
              <div className={`rounded-lg p-2 text-center ${
                in1st?.scanned ? "bg-green-50 border border-green-200" :
                emg1st ? "bg-orange-50 border border-orange-100" :
                "bg-red-50 border border-red-100"
              }`}>
                <p className="text-xs font-medium text-gray-700">Check-in</p>
                {in1st?.scanned ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto mt-1" />
                    <p className="text-[10px] text-gray-500 mt-0.5">{in1st.scannedAt ? fmtTime(in1st.scannedAt) : ""}</p>
                  </>
                ) : emg1st ? (
                  <AlertTriangle className="w-4 h-4 text-orange-400 mx-auto mt-1" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-300 mx-auto mt-1" />
                )}
              </div>
            )}
            {firstOut && row.scheduledService !== "2nd" && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                <LogOut className="w-3.5 h-3.5" />
                <span>Clocked out at {fmtTime(firstOut.scannedAt)}</span>
              </div>
            )}
            {emg1st && (
              <div className="mt-2 flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Emergency exit at {fmtTime(row.emergencyOut!.exitedAt)}</span>
              </div>
            )}
          </div>
          {/* 2nd service */}
          <div>
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2">
              2nd Service
              {row.scheduledService === "1st" && (
                <span className="ml-2 font-normal text-gray-400 normal-case">(not scheduled)</span>
              )}
            </p>
            {row.scheduledService === "1st" ? (
              <div className="rounded-lg p-2 text-center bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-300">N/A</span>
              </div>
            ) : (
              <div className={`rounded-lg p-2 text-center ${
                in2nd?.scanned ? "bg-green-50 border border-green-200" :
                emg2nd ? "bg-orange-50 border border-orange-100" :
                "bg-red-50 border border-red-100"
              }`}>
                <p className="text-xs font-medium text-gray-700">Check-in</p>
                {in2nd?.scanned ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto mt-1" />
                    <p className="text-[10px] text-gray-500 mt-0.5">{in2nd.scannedAt ? fmtTime(in2nd.scannedAt) : ""}</p>
                  </>
                ) : emg2nd ? (
                  <AlertTriangle className="w-4 h-4 text-orange-400 mx-auto mt-1" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-300 mx-auto mt-1" />
                )}
              </div>
            )}
            {secondOut && row.scheduledService !== "1st" && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                <LogOut className="w-3.5 h-3.5" />
                <span>Clocked out at {fmtTime(secondOut.scannedAt)}</span>
              </div>
            )}
            {emg2nd && (
              <div className="mt-2 flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Emergency exit at {fmtTime(row.emergencyOut!.exitedAt)}</span>
              </div>
            )}
          </div>
          {/* Substitute / Excused badges */}
          {(row.isSubstitute || row.isExcused) && (
            <div className="flex gap-2 flex-wrap pt-1">
              {row.isSubstitute && (
                <span className="text-[11px] px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-medium">
                  🔄 Serving as substitute today
                </span>
              )}
              {row.isExcused && (
                <span className="text-[11px] px-2 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200 font-medium">
                  ✓ Substitute assigned — excused
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Desktop table row */
function TableRow({ row, i }: { row: StaffRow; i: number }) {
  const firstOut  = row.clockOuts.find(c => c.service === "1st");
  const secondOut = row.clockOuts.find(c => c.service === "2nd");
  const emg1st    = row.emergencyOut?.service === "1st";
  const emg2nd    = row.emergencyOut?.service === "2nd";
  const in1st = row.checkIns.find(c => c.service === "1st");
  const in2nd = row.checkIns.find(c => c.service === "2nd");

  function checkInCell(svc: "1st" | "2nd") {
    const cp  = svc === "1st" ? in1st : in2nd;
    const na  = row.scheduledService !== "both" && row.scheduledService !== svc;
    const exc = !cp?.scanned && (svc === "1st" ? emg1st : emg2nd);

    if (na) {
      return (
        <td className="px-2 py-3 text-center">
          <span className="text-gray-200 text-xs">—</span>
        </td>
      );
    }
    return (
      <td className="px-2 py-3 text-center">
        {cp?.scanned ? (
          <div className="flex flex-col items-center gap-0.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            {cp.scannedAt && (
              <span className="text-[10px] text-gray-400">{fmtTime(cp.scannedAt)}</span>
            )}
          </div>
        ) : exc ? (
          <span title="Excused — emergency exit"><AlertTriangle className="w-4 h-4 text-orange-300 mx-auto" /></span>
        ) : (
          <XCircle className="w-4 h-4 text-red-200 mx-auto" />
        )}
      </td>
    );
  }

  return (
    <tr className={`border-b hover:bg-gray-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
      {/* Name + badges */}
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
            <div className="flex items-center gap-1 flex-wrap">
              <p className="font-medium text-gray-900 text-sm leading-tight whitespace-nowrap">
                {row.firstName} {row.lastName}
              </p>
              {row.isSubstitute && (
                <span className="text-[9px] px-1 py-0.5 rounded font-bold bg-teal-100 text-teal-700">SUB</span>
              )}
              {row.isExcused && (
                <span className="text-[9px] px-1 py-0.5 rounded font-bold bg-gray-100 text-gray-500">EXCUSED</span>
              )}
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleBadge(row.role)}`}>
              {row.role}
            </span>
          </div>
        </div>
      </td>

      {/* 1st service check-in */}
      {checkInCell("1st")}

      {/* Clock-out / Emergency — 1st service */}
      <td className="px-2 py-3 text-center">
        {row.scheduledService === "2nd" ? (
          <span className="text-gray-200 text-xs">—</span>
        ) : emg1st ? (
          <div className="flex flex-col items-center gap-0.5" title="Emergency exit">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <span className="text-[10px] text-gray-400">{fmtTime(row.emergencyOut!.exitedAt)}</span>
          </div>
        ) : firstOut ? (
          <div className="flex flex-col items-center gap-0.5">
            <LogOut className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] text-gray-400">{fmtTime(firstOut.scannedAt)}</span>
          </div>
        ) : <span className="text-gray-200 text-xs">—</span>}
      </td>

      {/* 2nd service check-in */}
      {checkInCell("2nd")}

      {/* Clock-out / Emergency — 2nd service */}
      <td className="px-2 py-3 text-center">
        {row.scheduledService === "1st" ? (
          <span className="text-gray-200 text-xs">—</span>
        ) : emg2nd ? (
          <div className="flex flex-col items-center gap-0.5" title="Emergency exit">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <span className="text-[10px] text-gray-400">{fmtTime(row.emergencyOut!.exitedAt)}</span>
          </div>
        ) : secondOut ? (
          <div className="flex flex-col items-center gap-0.5">
            <LogOut className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] text-gray-400">{fmtTime(secondOut.scannedAt)}</span>
          </div>
        ) : <span className="text-gray-200 text-xs">—</span>}
      </td>

      {/* Score */}
      <td className="px-3 py-3 text-center">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(row.totalScans, row.scoreMax)}`}>
          {row.totalScans}/{row.scoreMax}
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
    if (!printRef.current || !qrData) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Attendance QR — ${date}</title>
      <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#1e3a8a;color:#fff}
      img{width:320px;height:320px}h2{margin:16px 0 4px}p{margin:0;opacity:.7}</style></head>
      <body>
        <h2>Shepherd Connect</h2>
        <p>Service Attendance — ${date}</p>
        <img src="${qrData.qrPng}" />
        <p style="margin-top:12px;font-size:13px">Scan to record attendance</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  return (
    <div className="space-y-5">

      {/* ── QR Code section ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <QrCode className="w-5 h-5 text-blue-600" />
            Sunday QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date picker */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-gray-500" />
              <label className="text-sm text-gray-600 font-medium">Service Date</label>
            </div>
            <input
              type="date"
              value={date}
              onChange={e => {
                setDate(e.target.value);
                setQrData(null);
              }}
              className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* QR display / generate */}
          <div className="flex flex-col items-center gap-4">
            {qrData ? (
              <>
                <div ref={printRef} className="bg-white p-3 rounded-xl shadow-md">
                  <img src={qrData.qrPng} alt="QR code" className="w-48 h-48 block" />
                </div>
                <p className="text-xs text-gray-500 text-center">
                  {qrData.existing ? "Existing QR for this date" : "New QR generated"}
                </p>
                <div className="flex gap-2 flex-wrap justify-center">
                  <Button size="sm" variant="outline" onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-1" /> Download
                  </Button>
                  <Button size="sm" variant="outline" onClick={handlePrint}>
                    <Printer className="w-4 h-4 mr-1" /> Print
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => generateMutation.mutate(date)}
                    disabled={generateMutation.isPending}
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                    Regenerate
                  </Button>
                </div>
              </>
            ) : (
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => generateMutation.mutate(date)}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending
                  ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  : <QrCode className="w-4 h-4 mr-2" />}
                {summary?.hasQr ? "Load Existing QR" : "Generate QR Code"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Stats cards ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-blue-100">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold text-blue-700">{summary.stats.total}</p>
                <p className="text-xs text-gray-500">Total Staff</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-100">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <UserCheck className="w-8 h-8 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold text-green-700">{summary.stats.present}</p>
                <p className="text-xs text-gray-500">Present</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-100">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <UserX className="w-8 h-8 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold text-red-600">{summary.stats.absent}</p>
                <p className="text-xs text-gray-500">Absent</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-yellow-100">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-yellow-500 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold text-yellow-600">{summary.stats.fullDay}</p>
                <p className="text-xs text-gray-500">Full Score</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Compliance table ── */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Staff Compliance
          </CardTitle>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Legend */}
            <div className="hidden md:flex items-center gap-3 text-[10px] text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Present
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-200 inline-block" /> Absent
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-orange-300 inline-block" /> Excused
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-gray-100 inline-block" /> N/A
              </span>
            </div>
            <Button
              size="sm" variant="ghost"
              onClick={() => refetchSummary()}
              disabled={summaryLoading}
            >
              <RefreshCw className={`w-4 h-4 ${summaryLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
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
                    <div className="w-3.5 h-3.5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] text-gray-500">In</div>
                    <div className="w-3.5 h-3.5 rounded-sm bg-gray-200 mx-0.5" title="Out 1st" />
                    <div className="w-px h-3.5 bg-gray-200 mx-0.5" />
                    <div className="w-3.5 h-3.5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] text-gray-500">In</div>
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
                      <th className="px-2 py-3 text-center font-semibold text-blue-700 min-w-[64px]">
                        <div className="text-xs">Check-in</div>
                        <div className="text-[10px] text-blue-400 font-normal">1st</div>
                      </th>
                      <th className="px-2 py-3 text-center min-w-[56px]">
                        <div className="text-xs font-semibold text-amber-700">Out</div>
                        <div className="text-[10px] text-amber-400 font-normal">1st</div>
                      </th>
                      <th className="px-2 py-3 text-center font-semibold text-purple-700 min-w-[64px]">
                        <div className="text-xs">Check-in</div>
                        <div className="text-[10px] text-purple-400 font-normal">2nd</div>
                      </th>
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
