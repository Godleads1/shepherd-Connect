import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-call";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  QrCode, Download, Printer, RefreshCw, CheckCircle2, XCircle,
  LogOut, Users, UserCheck, UserX, ShieldCheck, CalendarDays,
} from "lucide-react";

const INTERVAL_LABELS: Record<string, string> = {
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
  const colors: Record<string, string> = {
    teacher: "bg-blue-100 text-blue-700",
    support: "bg-purple-100 text-purple-700",
    attendant: "bg-green-100 text-green-700",
  };
  return colors[role] ?? "bg-gray-100 text-gray-600";
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
    if (!qrData) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-NG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shepherd Connect — Service Attendance QR</title>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 40px; }
          h1 { font-size: 28px; color: #1e3a8a; margin-bottom: 4px; }
          p { color: #555; font-size: 16px; margin: 4px 0; }
          img { margin: 24px auto; display: block; width: 300px; }
          .footer { margin-top: 16px; font-size: 13px; color: #888; }
        </style>
      </head>
      <body>
        <h1>Shepherd Connect</h1>
        <p>Service Attendance — ${dateLabel}</p>
        <img src="${qrData.qrPng}" alt="QR Code" />
        <p>Scan this QR code at each checkpoint to record your attendance.</p>
        <div class="footer">Safe. Known. Celebrated. — RCCG City of David</div>
      </body>
      </html>
    `);
    win.document.close();
    win.print();
  }

  const statCards = [
    { label: "Total Staff", value: summary?.stats.total ?? 0, icon: Users, color: "text-blue-600" },
    { label: "Present", value: summary?.stats.present ?? 0, icon: UserCheck, color: "text-green-600" },
    { label: "Absent", value: summary?.stats.absent ?? 0, icon: UserX, color: "text-red-500" },
    { label: "Full Day", value: summary?.stats.fullDay ?? 0, icon: ShieldCheck, color: "text-yellow-600" },
  ];

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Service Attendance</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              QR-based Sunday attendance — track who was present at each checkpoint
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white shadow-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchSummary()}
              className="text-gray-600"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map(c => (
            <Card key={c.label} className="shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <c.icon className={`w-6 h-6 ${c.color}`} />
                <div>
                  <p className="text-xl font-bold text-gray-900">{c.value}</p>
                  <p className="text-xs text-gray-500">{c.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* QR + Checkpoints */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* QR Generate Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-700" />
                QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {qrData ? (
                <>
                  <div className="flex justify-center">
                    <div ref={printRef} className="bg-white p-3 rounded-xl border shadow-sm inline-block">
                      <img src={qrData.qrPng} alt="QR Code" className="w-48 h-48" />
                    </div>
                  </div>
                  <p className="text-xs text-center text-gray-500">
                    {qrData.existing ? "Existing QR for this date" : "New QR generated"} —
                    print and paste on the church wall
                  </p>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-blue-900 hover:bg-blue-800 text-white"
                      size="sm"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      Download
                    </Button>
                    <Button
                      className="flex-1"
                      variant="outline"
                      size="sm"
                      onClick={handlePrint}
                    >
                      <Printer className="w-4 h-4 mr-1.5" />
                      Print
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-gray-400 text-xs"
                    onClick={() => generateMutation.mutate(date)}
                    disabled={generateMutation.isPending}
                  >
                    Regenerate QR
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-3 py-4 text-gray-400">
                    <QrCode className="w-16 h-16 opacity-30" />
                    <p className="text-sm text-center">
                      {summary?.hasQr
                        ? "A QR code exists for this date. Click to load it."
                        : "No QR code yet for this date."}
                    </p>
                  </div>
                  <Button
                    className="w-full bg-blue-900 hover:bg-blue-800 text-white"
                    onClick={() => generateMutation.mutate(date)}
                    disabled={generateMutation.isPending}
                  >
                    {generateMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <QrCode className="w-4 h-4 mr-2" />
                    )}
                    {summary?.hasQr ? "Load QR Code" : "Generate QR Code"}
                  </Button>
                </>
              )}
              {generateMutation.isError && (
                <p className="text-red-500 text-xs text-center">
                  Failed to generate QR. Please try again.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Checkpoint summary */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-700" />
                Checkpoint Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">
                  1st Service
                </p>
                {["07:00", "08:30", "09:30"].map(label => {
                  const total = summary?.staff.length ?? 0;
                  const count = summary?.staff.filter(
                    s => s.checkpoints.find(c => c.intervalLabel === label)?.scanned
                  ).length ?? 0;
                  return (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <span className="text-sm text-gray-700 font-medium">{INTERVAL_LABELS[label]} AM</span>
                      <span className={`text-xs font-medium ${count > 0 ? "text-green-600" : "text-gray-400"}`}>
                        {total > 0 ? `${count} / ${total}` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div>
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2">
                  2nd Service
                </p>
                {["10:00", "11:00", "12:00"].map(label => {
                  const total = summary?.staff.length ?? 0;
                  const count = summary?.staff.filter(
                    s => s.checkpoints.find(c => c.intervalLabel === label)?.scanned
                  ).length ?? 0;
                  const disp = label === "12:00" ? "12:00 PM" : `${INTERVAL_LABELS[label]} AM`;
                  return (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <span className="text-sm text-gray-700 font-medium">{disp}</span>
                      <span className={`text-xs font-medium ${count > 0 ? "text-green-600" : "text-gray-400"}`}>
                        {total > 0 ? `${count} / ${total}` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 pt-1">
                WhatsApp reminders are sent automatically at each checkpoint time.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Compliance Grid */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-700" />
              Staff Compliance Grid
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {summaryLoading ? (
              <div className="flex justify-center py-10">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : !summary || summary.staff.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No active staff found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50 border-b">
                      <th className="text-left px-4 py-3 font-semibold text-blue-900 min-w-[160px]">
                        Staff
                      </th>
                      {["07:00", "08:30", "09:30"].map(label => (
                        <th key={label} className="px-3 py-3 text-center font-semibold text-blue-700 min-w-[68px]">
                          <div className="text-xs">{INTERVAL_LABELS[label]}</div>
                          <div className="text-[10px] text-blue-400 font-normal">1st</div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center font-semibold text-amber-700 min-w-[68px]">
                        <div className="text-xs">Out</div>
                        <div className="text-[10px] text-amber-400 font-normal">1st</div>
                      </th>
                      {["10:00", "11:00", "12:00"].map(label => (
                        <th key={label} className="px-3 py-3 text-center font-semibold text-purple-700 min-w-[68px]">
                          <div className="text-xs">{INTERVAL_LABELS[label]}</div>
                          <div className="text-[10px] text-purple-400 font-normal">2nd</div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center font-semibold text-amber-700 min-w-[68px]">
                        <div className="text-xs">Out</div>
                        <div className="text-[10px] text-amber-400 font-normal">2nd</div>
                      </th>
                      <th className="px-3 py-3 text-center font-semibold text-gray-500 min-w-[60px] text-xs">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.staff.map((row, i) => {
                      const firstOut = row.clockOuts.find(c => c.service === "1st");
                      const secondOut = row.clockOuts.find(c => c.service === "2nd");
                      return (
                        <tr
                          key={row.userId}
                          className={`border-b hover:bg-gray-50 transition-colors ${
                            i % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {row.photoUrl ? (
                                <img
                                  src={row.photoUrl}
                                  alt=""
                                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-xs flex-shrink-0">
                                  {row.firstName[0]}{row.lastName[0]}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 text-xs leading-tight truncate">
                                  {row.firstName} {row.lastName}
                                </p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleBadge(row.role)}`}>
                                  {row.role}
                                </span>
                              </div>
                            </div>
                          </td>
                          {["07:00", "08:30", "09:30"].map(label => {
                            const cp = row.checkpoints.find(c => c.intervalLabel === label);
                            return (
                              <td key={label} className="px-2 py-2.5 text-center">
                                {cp?.scanned ? (
                                  <div className="flex flex-col items-center">
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    {cp.scannedAt && (
                                      <span className="text-[10px] text-gray-400 mt-0.5">
                                        {fmtTime(cp.scannedAt)}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-200 mx-auto" />
                                )}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2.5 text-center">
                            {firstOut ? (
                              <div className="flex flex-col items-center">
                                <LogOut className="w-4 h-4 text-amber-500" />
                                <span className="text-[10px] text-gray-400 mt-0.5">
                                  {fmtTime(firstOut.scannedAt)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-200 text-xs">—</span>
                            )}
                          </td>
                          {["10:00", "11:00", "12:00"].map(label => {
                            const cp = row.checkpoints.find(c => c.intervalLabel === label);
                            return (
                              <td key={label} className="px-2 py-2.5 text-center">
                                {cp?.scanned ? (
                                  <div className="flex flex-col items-center">
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    {cp.scannedAt && (
                                      <span className="text-[10px] text-gray-400 mt-0.5">
                                        {fmtTime(cp.scannedAt)}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-200 mx-auto" />
                                )}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2.5 text-center">
                            {secondOut ? (
                              <div className="flex flex-col items-center">
                                <LogOut className="w-4 h-4 text-amber-500" />
                                <span className="text-[10px] text-gray-400 mt-0.5">
                                  {fmtTime(secondOut.scannedAt)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-200 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                row.totalScans >= 6
                                  ? "bg-green-100 text-green-700"
                                  : row.totalScans >= 3
                                  ? "bg-yellow-100 text-yellow-700"
                                  : row.totalScans > 0
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-red-50 text-red-400"
                              }`}
                            >
                              {row.totalScans}/6
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
