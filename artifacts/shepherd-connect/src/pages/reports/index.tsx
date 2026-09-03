import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-call";
import { QueryError } from "@/components/QueryError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyzeFeedbackSentiment } from "@workspace/api-client-react";
import {
  Download, AlertTriangle, Clock, Users, BarChart3, FileText, Bell,
  Star, Printer, TrendingUp, BookOpen, Wand2, RefreshCw, Table2, Sparkles, SmilePlus, Meh, Frown,
  MessageSquare, GraduationCap, Home, LayoutGrid,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import { format } from "date-fns";

const BASE = "/api";
function token() { return localStorage.getItem("token"); }

async function downloadCsv(path: string, filename: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function downloadPdf(path: string, filename: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function printReport(title: string, contentId: string) {
  const el = document.getElementById(contentId);
  if (!el) return;
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(`
    <html><head><title>${title}</title>
    <style>
      body { font-family: Inter, sans-serif; padding: 24px; color: #111; }
      h1 { color: #1e3a8a; font-size: 22px; margin-bottom: 4px; }
      p.sub { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; }
      td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
      tr:nth-child(even) td { background: #f9fafb; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
      @media print { @page { margin: 1cm; } }
    </style></head>
    <body>
      <h1>${title}</h1>
      <p class="sub">Generated: ${new Date().toLocaleString()} · Shepherd Connect — RCCG City of David</p>
      ${el.innerHTML}
    </body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); }, 300);
}

function exportBuilderPdf(title: string, columns: string[], rows: string[][], meta: string) {
  const isWide = columns.length > 6;
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return;

  const tableHead = `<tr>${columns.map(c => `<th>${c}</th>`).join("")}</tr>`;
  const tableBody = rows.map((row, i) =>
    `<tr class="${i % 2 === 0 ? "" : "alt"}">${row.map(cell => `<td>${cell || "—"}</td>`).join("")}</tr>`
  ).join("");

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} — Shepherd Connect</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #111; background: #fff; }

    .header {
      background: #1e3a8a;
      color: white;
      padding: 18px 28px 16px;
    }
    .header-org { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; opacity: 0.75; margin-bottom: 4px; }
    .header-title { font-size: 20px; font-weight: 700; }
    .header-tagline { font-size: 11px; opacity: 0.65; margin-top: 2px; }

    .meta-bar {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .report-name { font-size: 15px; font-weight: 700; color: #1e3a8a; }
    .report-meta { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .generated { font-size: 11px; color: #9ca3af; }

    .content { padding: 20px 28px; }

    .stats { display: flex; gap: 16px; margin-bottom: 18px; }
    .stat { background: #f1f5f9; border-radius: 8px; padding: 10px 16px; }
    .stat-val { font-size: 22px; font-weight: 700; color: #1e3a8a; }
    .stat-label { font-size: 11px; color: #6b7280; }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${isWide ? "10px" : "12px"};
    }
    thead th {
      background: #1e3a8a;
      color: white;
      padding: 9px 10px;
      text-align: left;
      font-weight: 600;
      font-size: ${isWide ? "9px" : "11px"};
      letter-spacing: 0.03em;
      white-space: nowrap;
    }
    tbody td {
      padding: 7px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #374151;
      vertical-align: top;
    }
    tr.alt td { background: #f8fafc; }
    tbody tr:last-child td { border-bottom: none; }

    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #9ca3af;
    }

    @media print {
      @page { margin: 1.2cm; size: ${isWide ? "A4 landscape" : "A4 portrait"}; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      thead th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tr.alt td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-org">THE REDEEMED CHRISTIAN CHURCH OF GOD</div>
    <div class="header-title">Shepherd Connect — City of David, Victoria Island</div>
    <div class="header-tagline">Safe. Known. Celebrated.</div>
  </div>

  <div class="meta-bar">
    <div>
      <div class="report-name">${title}</div>
      <div class="report-meta">${meta}</div>
    </div>
    <div class="generated">Generated: ${new Date().toLocaleString()}</div>
  </div>

  <div class="content">
    <div class="stats">
      <div class="stat">
        <div class="stat-val">${rows.length}</div>
        <div class="stat-label">Total Records</div>
      </div>
      <div class="stat">
        <div class="stat-val">${columns.length}</div>
        <div class="stat-label">Columns</div>
      </div>
    </div>

    <table>
      <thead><tr>${tableHead}</tr></thead>
      <tbody>${tableBody}</tbody>
    </table>

    <div class="footer">
      <span>Shepherd Connect — Confidential Ministry Document</span>
      <span>${new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
    </div>
  </div>

  <script>window.onload = function() { setTimeout(function() { window.print(); }, 400); }<\/script>
</body>
</html>`);
  win.document.close();
}

function exportBuilderCsv(title: string, columns: string[], rows: string[][]) {
  const csv = [columns, ...rows]
    .map(row => row.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const REPORT_TYPES = [
  { value: "attendance",       label: "Attendance Log",         icon: Table2,         color: "#1e3a8a", desc: "Full check-in/in-class/pick-up log with timestamps" },
  { value: "arrivals",         label: "Class Arrivals",         icon: Clock,          color: "#0891b2", desc: "Teacher-confirmed arrivals with drop-off → in-class lag" },
  { value: "not-picked-up",    label: "Not Picked Up",          icon: AlertTriangle,  color: "#dc2626", desc: "Children still in church by date range" },
  { value: "appraisals",       label: "Child Appraisals",       icon: Star,           color: "#7c3aed", desc: "Behaviour & participation appraisals by teacher" },
  { value: "teacher-schedule", label: "Teacher Schedule",       icon: BookOpen,       color: "#059669", desc: "Allocations with class, room, and slot info" },
  { value: "family-registry",  label: "Family Registry",        icon: Users,          color: "#d97706", desc: "All registered families with contacts" },
  { value: "feedback",         label: "Parent Feedback",        icon: MessageSquare,  color: "#be185d", desc: "Satisfaction ratings and AI sentiment by parent" },
] as const;

type ReportType = typeof REPORT_TYPES[number]["value"];

const SLOTS = ["7am", "10:30am"];

export default function Reports() {
  const today = format(new Date(), "yyyy-MM-dd");
  const firstOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");

  const [serviceDate, setServiceDate] = useState(today);
  const [serviceSlot, setServiceSlot] = useState("");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState(today);
  const [activeTab, setActiveTab] = useState<"live" | "exports" | "analytics" | "builder" | "heatmap" | "annual" | "trends">("live");
  const { toast } = useToast();

  const [reportType, setReportType]       = useState<ReportType>("attendance");
  const [builderFrom, setBuilderFrom]     = useState(firstOfMonth);
  const [builderTo, setBuilderTo]         = useState(today);
  const [builderClass, setBuilderClass]   = useState("");
  const [builderSlot, setBuilderSlot]     = useState("");
  const [builderTeacher, setBuilderTeacher] = useState("");
  const [builderFamily, setBuilderFamily]   = useState("");

  const { data: classes } = useQuery({
    queryKey: ["classes-list"],
    queryFn: () => apiGet<any[]>("/classes"),
    enabled: activeTab === "builder",
  });
  const { data: teacherUsers } = useQuery({
    queryKey: ["users-teachers"],
    queryFn: () => apiGet<{ data: any[] }>("/users?role=teacher").then(r => r.data),
    enabled: activeTab === "builder",
  });
  const { data: familiesList } = useQuery({
    queryKey: ["families-list"],
    queryFn: () => apiGet<any[]>("/families"),
    enabled: activeTab === "builder",
  });

  const classList    = Array.isArray(classes) ? classes : [];
  const teacherList  = Array.isArray(teacherUsers) ? teacherUsers : [];
  const familyList   = Array.isArray(familiesList) ? familiesList : [];

  const noDateRange = reportType === "family-registry";
  const noClass     = reportType === "family-registry" || reportType === "feedback";
  const noSlot      = reportType === "family-registry" || reportType === "appraisals" || reportType === "feedback";
  const showTeacher = reportType === "attendance" || reportType === "appraisals" || reportType === "teacher-schedule";
  const showFamily  = reportType === "attendance" || reportType === "not-picked-up" || reportType === "appraisals" || reportType === "feedback" || reportType === "family-registry";

  const builderParams = new URLSearchParams({ reportType });
  if (builderFrom && !noDateRange)   builderParams.set("from", builderFrom);
  if (builderTo && !noDateRange)     builderParams.set("to", builderTo);
  if (builderClass && !noClass)      builderParams.set("classId", builderClass);
  if (builderSlot && !noSlot)        builderParams.set("serviceSlot", builderSlot);
  if (builderTeacher && showTeacher) builderParams.set("teacherId", builderTeacher);
  if (builderFamily && showFamily)   builderParams.set("familyId", builderFamily);

  const {
    data: builderData,
    isLoading: builderLoading,
    isError: builderError,
    refetch: refetchBuilder,
    isFetching: builderFetching,
  } = useQuery({
    queryKey: ["custom-builder", reportType, builderFrom, builderTo, builderClass, builderSlot, builderTeacher, builderFamily],
    queryFn: () => apiGet<any>(`/reports/custom-builder?${builderParams}`),
    enabled: activeTab === "builder",
  });

  const handlePdfExport = useCallback(() => {
    if (!builderData?.columns || !builderData?.rows) return;
    const typeMeta = REPORT_TYPES.find(r => r.value === reportType);
    const meta = [
      reportType !== "family-registry" && builderFrom ? `From: ${builderFrom}` : "",
      reportType !== "family-registry" && builderTo   ? `To: ${builderTo}`     : "",
      builderClass ? `Class: ${classList.find((c: any) => String(c.id) === builderClass)?.name || builderClass}` : "",
      builderSlot  ? `Slot: ${builderSlot}`  : "",
      `Total records: ${builderData.total}`,
    ].filter(Boolean).join("  ·  ");
    exportBuilderPdf(typeMeta?.label || builderData.title, builderData.columns, builderData.rows, meta);
  }, [builderData, reportType, builderFrom, builderTo, builderClass, builderSlot, classList]);

  const handleCsvExport = useCallback(() => {
    if (!builderData?.columns || !builderData?.rows) return;
    const typeMeta = REPORT_TYPES.find(r => r.value === reportType);
    exportBuilderCsv(typeMeta?.label || builderData.title, builderData.columns, builderData.rows);
    toast({ title: "CSV exported" });
  }, [builderData, reportType, toast]);

  const { data: notPickedUp, isLoading: loadingNPU, refetch: refetchNPU } = useQuery({
    queryKey: ["not-picked-up", serviceDate, serviceSlot],
    queryFn: () => {
      const params = new URLSearchParams({ serviceDate });
      if (serviceSlot) params.set("serviceSlot", serviceSlot);
      return apiGet<any>(`/reports/not-picked-up?${params}`);
    },
  });

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["report-summary", serviceDate],
    queryFn: () => apiGet<any>(`/reports/summary?serviceDate=${serviceDate}`),
  });

  const { data: teacherRatios, isLoading: loadingRatios } = useQuery({
    queryKey: ["teacher-ratios", serviceDate, serviceSlot],
    queryFn: () => {
      const params = new URLSearchParams({ serviceDate });
      if (serviceSlot) params.set("serviceSlot", serviceSlot);
      return apiGet<any>(`/reports/teacher-ratios?${params}`);
    },
  });

  const { data: familyRegistry, isLoading: loadingRegistry } = useQuery({
    queryKey: ["family-registry"],
    queryFn: () => apiGet<any>("/reports/family-registry"),
    enabled: activeTab === "exports",
  });

  const { data: teacherSchedule } = useQuery({
    queryKey: ["teacher-schedule", serviceDate],
    queryFn: () => apiGet<any>(`/reports/teacher-schedule?serviceDate=${serviceDate}`),
    enabled: activeTab === "analytics",
  });

  const { data: feedbackSummary, isLoading: loadingFeedback } = useQuery({
    queryKey: ["feedback-summary", exportFrom, exportTo],
    queryFn: () => {
      const params = new URLSearchParams();
      if (exportFrom) params.set("from", exportFrom);
      if (exportTo) params.set("to", exportTo);
      return apiGet<any>(`/reports/feedback-summary?${params}`);
    },
    enabled: activeTab === "analytics",
  });

  const queryClient = useQueryClient();
  const { data: feedbackAnalytics, isLoading: loadingFeedbackAnalytics } = useQuery({
    queryKey: ["feedback-analytics"],
    queryFn: () => apiGet<any>("/dashboard/feedback-analytics"),
    enabled: activeTab === "analytics",
  });
  const analyzeAllMutation = useAnalyzeFeedbackSentiment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Sentiment analysis complete" });
        void queryClient.invalidateQueries({ queryKey: ["feedback-analytics"] });
      },
      onError: () => toast({ variant: "destructive", title: "Analysis failed" }),
    },
  });

  const { data: classUtilization, isLoading: loadingUtilization } = useQuery({
    queryKey: ["class-utilization"],
    queryFn: () => apiGet<any>("/reports/class-utilization"),
    enabled: activeTab === "analytics",
  });

  const handleAttendanceExport = async () => {
    try {
      const params = new URLSearchParams({ format: "csv" });
      if (exportFrom) params.set("from", exportFrom);
      if (exportTo) params.set("to", exportTo);
      if (serviceSlot) params.set("serviceSlot", serviceSlot);
      await downloadCsv(`/reports/attendance-export?${params}`, `attendance-${exportFrom || "all"}-to-${exportTo}.csv`);
      toast({ title: "Attendance report downloaded" });
    } catch { toast({ variant: "destructive", title: "Export failed" }); }
  };

  const handleAttendancePdf = async () => {
    try {
      const params = new URLSearchParams();
      if (exportFrom) params.set("from", exportFrom);
      if (exportTo) params.set("to", exportTo);
      if (serviceSlot) params.set("serviceSlot", serviceSlot);
      const qs = params.toString();
      await downloadPdf(`/reports/pdf/attendance${qs ? "?" + qs : ""}`, `attendance-${exportFrom || "all"}-to-${exportTo || "all"}.pdf`);
      toast({ title: "Attendance PDF downloaded" });
    } catch { toast({ variant: "destructive", title: "PDF export failed" }); }
  };

  const handleEmergencyExport = async () => {
    try {
      await downloadCsv("/reports/emergency-log?format=csv", "emergency-log.csv");
      toast({ title: "Emergency log downloaded" });
    } catch { toast({ variant: "destructive", title: "Export failed" }); }
  };

  const handleEmergencyPdf = async () => {
    try {
      await downloadPdf("/reports/pdf/emergency-log", `emergency-log-${new Date().toISOString().split("T")[0]}.pdf`);
      toast({ title: "Emergency log PDF downloaded" });
    } catch { toast({ variant: "destructive", title: "PDF export failed" }); }
  };

  const handleFeedbackPdf = async () => {
    try {
      const params = new URLSearchParams();
      if (exportFrom) params.set("from", exportFrom);
      if (exportTo) params.set("to", exportTo);
      const qs = params.toString();
      await downloadPdf(`/reports/pdf/feedback${qs ? "?" + qs : ""}`, `feedback-${exportFrom || "all"}-to-${exportTo || "all"}.pdf`);
      toast({ title: "Feedback PDF downloaded" });
    } catch { toast({ variant: "destructive", title: "PDF export failed" }); }
  };

  const handleNotPickedUpExport = async () => {
    try {
      const params = new URLSearchParams({ serviceDate, format: "csv" });
      if (serviceSlot) params.set("serviceSlot", serviceSlot);
      await downloadCsv(`/reports/not-picked-up?${params}`, `not-picked-up-${serviceDate}.csv`);
      toast({ title: "Report downloaded" });
    } catch { toast({ variant: "destructive", title: "Export failed" }); }
  };

  const notPickedUpChildren = notPickedUp?.children || [];
  const ratioAlerts = (teacherRatios?.classes || []).filter((c: any) => c.alert);

  const selectedType = REPORT_TYPES.find(r => r.value === reportType)!;

  const { data: heatmapData, isLoading: heatmapLoading } = useQuery({
    queryKey: ["room-occupancy", serviceDate],
    queryFn: () => apiGet<any>(`/reports/room-occupancy?serviceDate=${serviceDate}`),
    enabled: activeTab === "heatmap",
  });

  const [annualYear, setAnnualYear] = useState(new Date().getFullYear());

  const { data: annualData, isLoading: annualLoading } = useQuery({
    queryKey: ["annual-summary", annualYear],
    queryFn: () => apiGet<any>(`/reports/annual-summary?year=${annualYear}`),
    enabled: activeTab === "annual",
  });

  const [trendsWeeks, setTrendsWeeks] = useState(12);
  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ["attendance-trends", trendsWeeks],
    queryFn: () => apiGet<any>(`/attendance/trends?weeks=${trendsWeeks}`),
    enabled: activeTab === "trends",
  });

  const tabs = [
    { key: "live",     label: "Live Reports",    icon: Clock },
    { key: "exports",  label: "Export Data",     icon: Download },
    { key: "analytics",label: "Analytics",       icon: BarChart3 },
    { key: "trends",   label: "Trends",          icon: TrendingUp },
    { key: "heatmap",  label: "Room Heatmap",    icon: LayoutGrid },
    { key: "builder",  label: "Custom Builder",  icon: Wand2 },
    { key: "annual",   label: "Annual Summary",  icon: GraduationCap },
  ] as const;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
          Reports & Export
        </h1>
        <p className="text-gray-500 text-sm mt-1">Live reports, data exports, analytics, and custom report builder for RCCG City of David</p>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit flex-wrap">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? key === "builder"
                  ? "text-white shadow-sm"
                  : "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            style={activeTab === key && key === "builder"
              ? { background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }
              : {}}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── Attendance Trends ── */}
      {activeTab === "trends" && (
        <div className="space-y-5">
          {/* Controls */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 flex-wrap shadow-sm">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Time Range</label>
              <div className="flex gap-2">
                {[4, 8, 12, 24].map(w => (
                  <button key={w}
                    onClick={() => setTrendsWeeks(w)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      trendsWeeks === w ? "bg-blue-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {w}w
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 self-end pb-0.5">Weekly attendance counts over the last {trendsWeeks} weeks</p>
          </div>

          {trendsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-64 w-full rounded-2xl" />
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </div>
            </div>
          ) : !trendsData?.weeks?.length ? (
            <div className="py-20 text-center bg-white border rounded-2xl">
              <TrendingUp className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">No attendance data available</p>
              <p className="text-sm text-gray-400 mt-1">Attendance trends will appear once check-in records exist</p>
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-blue-800">{trendsData.summary?.avgCheckins ?? "—"}</p>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">Avg. Check-ins / Week</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-green-700">{trendsData.summary?.peakWeek ?? "—"}</p>
                  <p className="text-xs font-semibold text-green-600 mt-0.5">Peak Week</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-amber-700">{trendsData.summary?.trend ?? "Stable"}</p>
                  <p className="text-xs font-semibold text-amber-600 mt-0.5">12-Week Trend</p>
                </div>
              </div>

              {/* Check-ins line chart */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-700" /> Weekly Check-ins
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trendsData.weeks} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v?.slice(5) || v} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                      formatter={(val: number) => [val, "Check-ins"]}
                    />
                    <Line type="monotone" dataKey="checkins" stroke="#1e3a8a" strokeWidth={2.5} dot={{ r: 4, fill: "#1e3a8a" }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="pickedUp" stroke="#16a34a" strokeWidth={2} dot={{ r: 3, fill: "#16a34a" }} name="Picked Up" />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-6 justify-center mt-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 bg-blue-800" style={{ borderRadius: 99 }} />
                    <span className="text-xs text-gray-500">Total Check-ins</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 bg-green-600" style={{ borderRadius: 99 }} />
                    <span className="text-xs text-gray-500">Picked Up</span>
                  </div>
                </div>
              </div>

              {/* Per-class bar chart */}
              {trendsData.byClass && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-amber-600" /> Attendance by Class (Period Total)
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={trendsData.byClass} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="className" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                      <Bar dataKey="total" name="Total Sessions" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Room Heatmap ── */}
      {activeTab === "heatmap" && (
        <div className="space-y-5">
          <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Service Date</label>
              <Input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} className="w-44" />
            </div>
            <p className="text-xs text-gray-400 self-end pb-2">Showing occupancy across all rooms for this service date.</p>
          </div>

          {heatmapLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : !heatmapData?.rooms?.length ? (
            <div className="py-20 text-center bg-white border rounded-xl">
              <LayoutGrid className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No room data for this date</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" /> 0–50% capacity</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200 inline-block" /> 50–80%</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-200 border border-orange-300 inline-block" /> 80–100%</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-300 border border-red-400 inline-block" /> Over capacity</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {heatmapData.rooms.map((room: any) => {
                  const pct = room.capacity > 0 ? (room.checkedIn / room.capacity) * 100 : 0;
                  const bg = pct > 100 ? "#fca5a5" : pct >= 80 ? "#fed7aa" : pct >= 50 ? "#fef08a" : "#bbf7d0";
                  const border = pct > 100 ? "#f87171" : pct >= 80 ? "#fdba74" : pct >= 50 ? "#fde047" : "#86efac";
                  const text = pct > 100 ? "#991b1b" : pct >= 80 ? "#9a3412" : pct >= 50 ? "#713f12" : "#166534";
                  return (
                    <div key={room.classId} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                      <div className="px-4 py-3 flex items-center justify-between" style={{ background: bg, borderBottom: `1px solid ${border}` }}>
                        <div>
                          <p className="font-bold text-sm" style={{ color: text }}>{room.className}</p>
                          <p className="text-xs" style={{ color: text, opacity: 0.75 }}>{room.roomLocation} · {room.serviceSlot}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black" style={{ color: text }}>{room.checkedIn}</p>
                          <p className="text-xs font-medium" style={{ color: text, opacity: 0.75 }}>of {room.capacity}</p>
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                          <span>Occupancy</span>
                          <span className="font-bold">{Math.round(pct)}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: pct > 100 ? "#ef4444" : pct >= 80 ? "#f97316" : pct >= 50 ? "#eab308" : "#22c55e" }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-2">
                          <span>{room.inClass} in class</span>
                          <span>{room.pickedUp} picked up</span>
                          {room.waitlist > 0 && <span className="text-amber-600 font-medium">{room.waitlist} on waitlist</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {heatmapData.summary && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-wrap gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-800">{heatmapData.summary.totalCheckedIn}</p>
                    <p className="text-xs text-blue-600">Total Checked In</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-800">{heatmapData.summary.totalCapacity}</p>
                    <p className="text-xs text-blue-600">Total Capacity</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-800">{Math.round(heatmapData.summary.overallOccupancy)}%</p>
                    <p className="text-xs text-blue-600">Overall Occupancy</p>
                  </div>
                  {heatmapData.summary.overCapacityRooms > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{heatmapData.summary.overCapacityRooms}</p>
                      <p className="text-xs text-red-500">Over Capacity</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Live Reports ── */}
      {activeTab === "live" && (
        <div className="space-y-5">
          <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Service Date</label>
              <Input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} className="w-44" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Service Slot</label>
              <Select value={serviceSlot || "all"} onValueChange={v => setServiceSlot(v === "all" ? "" : v)}>
                <SelectTrigger className="w-32"><SelectValue placeholder="All slots" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Slots</SelectItem>
                  {SLOTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => refetchNPU()} className="text-[#1a237e] border-[#1a237e]">Refresh</Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {loadingSummary ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : [
              { label: "Checked In Today",   value: summary?.totalCheckedIn ?? 0,       icon: Users,    color: "#1e3a8a" },
              { label: "Still Present",      value: summary?.stillPresent ?? 0,          icon: Clock,    color: "#f59e0b" },
              { label: "Picked Up",          value: summary?.pickedUp ?? 0,              icon: BarChart3,color: "#16a34a" },
              { label: "Pending Approvals",  value: summary?.pendingUserApprovals ?? 0,  icon: Bell,     color: "#dc2626" },
            ].map(card => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="bg-white border rounded-xl p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: card.color + "18" }}>
                    <Icon className="w-5 h-5" style={{ color: card.color }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                    <p className="text-xs text-gray-500 leading-tight">{card.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b bg-amber-50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h2 className="font-semibold text-gray-900">Children Not Yet Picked Up</h2>
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">{notPickedUpChildren.length}</Badge>
              </div>
              {notPickedUpChildren.length > 0 && (
                <Button size="sm" variant="outline" className="flex items-center gap-1 text-xs" onClick={handleNotPickedUpExport}>
                  <Download className="w-3.5 h-3.5" /> Export
                </Button>
              )}
            </div>
            <div className="divide-y">
              {loadingNPU ? <div className="p-4"><Skeleton className="h-16 w-full" /></div>
                : notPickedUpChildren.length === 0 ? (
                  <div className="py-10 text-center text-gray-400">
                    <Users className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    All children have been picked up for this service
                  </div>
                ) : notPickedUpChildren.map((r: any) => (
                  <div key={r.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                        {r.child?.firstName?.[0]}{r.child?.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{r.child?.firstName} {r.child?.lastName}</p>
                        <p className="text-xs text-gray-500">{r.class?.name} · {r.family?.familyCode}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={r.minutesSinceCheckIn > 120 ? "destructive" : "secondary"}>
                        {r.minutesSinceCheckIn ? `${r.minutesSinceCheckIn} min` : r.status}
                      </Badge>
                      {r.family?.parentPhone && <p className="text-xs text-gray-400 mt-1">{r.family.parentPhone}</p>}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b bg-blue-50">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Teacher-to-Child Ratios</h2>
              {ratioAlerts.length > 0 && <Badge variant="destructive">{ratioAlerts.length} alerts</Badge>}
            </div>
            <div className="divide-y">
              {loadingRatios ? <div className="p-4"><Skeleton className="h-16 w-full" /></div>
                : (teacherRatios?.classes || []).length === 0 ? (
                  <div className="py-8 text-center text-gray-400">No class data for this date</div>
                ) : (teacherRatios?.classes || []).map((c: any) => (
                  <div key={c.classId} className={`px-4 py-3 flex items-center justify-between ${c.alert ? "bg-red-50" : ""}`}>
                    <div>
                      <p className="font-medium text-gray-900">{c.className}</p>
                      <p className="text-xs text-gray-500">{c.roomLocation} · {c.serviceSlot}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">{c.childrenPresent} children</p>
                        <p className="text-xs text-gray-500">Rec: {c.recommendedTeachers} teachers</p>
                      </div>
                      <Badge className={c.alert ? "bg-red-100 text-red-800 border-red-200" : "bg-green-100 text-green-800 border-green-200"}>
                        {c.ratio}
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Export Data ── */}
      {activeTab === "exports" && (
        <div className="space-y-5">
          <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Date Range — From</label>
              <Input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} className="w-44" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">To</label>
              <Input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} className="w-44" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Attendance */}
            <div className="p-4 rounded-xl bg-gray-50 border space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#1e3a8a18" }}>
                  <FileText className="w-4 h-4" style={{ color: "#1e3a8a" }} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Attendance Records</h3>
                  <p className="text-xs text-gray-500">All attendance data for selected date range</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 flex items-center justify-center gap-1.5 text-xs"
                  style={{ background: "linear-gradient(135deg, #1e3a8a, #1e3a8acc)" }}
                  onClick={handleAttendanceExport}>
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
                <Button size="sm" variant="outline" className="flex-1 flex items-center justify-center gap-1.5 text-xs border-[#1e3a8a] text-[#1e3a8a] hover:bg-blue-50"
                  onClick={handleAttendancePdf}>
                  <FileText className="w-3.5 h-3.5" /> PDF
                </Button>
              </div>
            </div>

            {/* Emergency Log */}
            <div className="p-4 rounded-xl bg-gray-50 border space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#dc262618" }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: "#dc2626" }} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Emergency Log</h3>
                  <p className="text-xs text-gray-500">Full incident log with resolution notes</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 flex items-center justify-center gap-1.5 text-xs"
                  style={{ background: "linear-gradient(135deg, #dc2626, #dc2626cc)" }}
                  onClick={handleEmergencyExport}>
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
                <Button size="sm" variant="outline" className="flex-1 flex items-center justify-center gap-1.5 text-xs border-red-600 text-red-700 hover:bg-red-50"
                  onClick={handleEmergencyPdf}>
                  <FileText className="w-3.5 h-3.5" /> PDF
                </Button>
              </div>
            </div>

            {/* Family Registry */}
            <div className="p-4 rounded-xl bg-gray-50 border space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#7c3aed18" }}>
                    <Users className="w-4 h-4" style={{ color: "#7c3aed" }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Family Registry</h3>
                    <p className="text-xs text-gray-500">All registered families with contacts ({familyRegistry?.total ?? "—"} families)</p>
                  </div>
                </div>
                {familyRegistry?.total != null && (
                  <button onClick={() => printReport("Family Registry", "family-registry-print")}
                    className="flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900">
                    <Printer className="h-3.5 w-3.5" /> Print
                  </button>
                )}
              </div>
              <Button size="sm" className="w-full flex items-center justify-center gap-2 text-xs"
                style={{ background: "linear-gradient(135deg, #7c3aed, #7c3aedcc)" }}
                onClick={async () => {
                  try { await downloadCsv("/reports/families-export", "family-registry.csv"); toast({ title: "Family registry downloaded" }); }
                  catch { toast({ variant: "destructive", title: "Export failed" }); }
                }}>
                <Download className="w-3.5 h-3.5" /> Download CSV
              </Button>
            </div>

            {/* Teacher Schedule */}
            <div className="p-4 rounded-xl bg-gray-50 border space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#0891b218" }}>
                  <BookOpen className="w-4 h-4" style={{ color: "#0891b2" }} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Teacher Schedule</h3>
                  <p className="text-xs text-gray-500">Teacher-class assignments and service hours</p>
                </div>
              </div>
              <Button size="sm" className="w-full flex items-center justify-center gap-2 text-xs"
                style={{ background: "linear-gradient(135deg, #0891b2, #0891b2cc)" }}
                onClick={async () => {
                  try { await downloadCsv(`/reports/teacher-schedule?serviceDate=${serviceDate}&format=csv`, `teacher-schedule-${serviceDate}.csv`); toast({ title: "Teacher schedule downloaded" }); }
                  catch { toast({ variant: "destructive", title: "Export failed" }); }
                }}>
                <Download className="w-3.5 h-3.5" /> Download CSV
              </Button>
            </div>

            {/* Feedback */}
            <div className="p-4 rounded-xl bg-gray-50 border space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#f59e0b18" }}>
                  <Star className="w-4 h-4" style={{ color: "#f59e0b" }} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Parent Feedback</h3>
                  <p className="text-xs text-gray-500">All feedback with sentiment and ratings</p>
                </div>
              </div>
              <Button size="sm" className="w-full flex items-center justify-center gap-2 text-xs"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f59e0bcc)" }}
                onClick={handleFeedbackPdf}>
                <FileText className="w-3.5 h-3.5" /> Download PDF
              </Button>
            </div>
          </div>

          {familyRegistry?.families && (
            <div id="family-registry-print" className="bg-white border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b bg-purple-50">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-700" /> Family Registry ({familyRegistry.total})
                </h2>
                <button onClick={() => printReport("Family Registry", "family-registry-print")}
                  className="flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900 font-medium">
                  <Printer className="h-3.5 w-3.5" /> Print Report
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2 text-left">Code</th>
                      <th className="px-4 py-2 text-left">Family Name</th>
                      <th className="px-4 py-2 text-left">Parent</th>
                      <th className="px-4 py-2 text-left">Phone</th>
                      <th className="px-4 py-2 text-left">Children</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {familyRegistry.families.slice(0, 50).map((f: any) => (
                      <tr key={f.familyId} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono font-bold text-blue-800">{f.familyCode}</td>
                        <td className="px-4 py-2">{f.familyName}</td>
                        <td className="px-4 py-2">{f.parentName}</td>
                        <td className="px-4 py-2 text-gray-500">{f.parentPhone || "—"}</td>
                        <td className="px-4 py-2"><Badge className="bg-blue-50 text-blue-800 border-blue-200">{f.childCount}</Badge></td>
                        <td className="px-4 py-2">
                          <Badge className={f.isActive ? "bg-green-50 text-green-800 border-green-200" : "bg-gray-100 text-gray-600"}>
                            {f.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Analytics ── */}
      {activeTab === "analytics" && (
        <div className="space-y-5">
          <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Service Date (for schedule)</label>
              <Input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} className="w-44" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Feedback — From</label>
              <Input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} className="w-44" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">To</label>
              <Input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} className="w-44" />
            </div>
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b bg-amber-50">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                <h2 className="font-semibold text-gray-900">Parent Feedback Summary</h2>
              </div>
              <button onClick={() => printReport("Feedback Summary", "feedback-summary-print")}
                className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium">
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
            </div>
            <div id="feedback-summary-print" className="p-4">
              {loadingFeedback ? <Skeleton className="h-20 w-full" /> : feedbackSummary ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Total Responses", value: feedbackSummary.totalFeedback, color: "#1e3a8a" },
                      { label: "Avg Rating", value: feedbackSummary.averageRating ? `${feedbackSummary.averageRating}★` : "—", color: "#f59e0b" },
                      { label: "Appraisals", value: feedbackSummary.totalAppraisals, color: "#7c3aed" },
                      { label: "Period", value: exportFrom ? `${exportFrom} → ${exportTo}` : "All time", color: "#059669" },
                    ].map(card => (
                      <div key={card.label} className="p-3 rounded-xl border bg-gray-50">
                        <p className="text-xl font-bold" style={{ color: card.color }}>{card.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
                      </div>
                    ))}
                  </div>
                  {feedbackSummary.ratingDistribution && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Rating Distribution</p>
                      <div className="space-y-1.5">
                        {[5, 4, 3, 2, 1].map(r => {
                          const count = feedbackSummary.ratingDistribution?.[r] || 0;
                          const pct = feedbackSummary.totalFeedback > 0 ? Math.round((count / feedbackSummary.totalFeedback) * 100) : 0;
                          return (
                            <div key={r} className="flex items-center gap-3">
                              <span className="text-xs font-medium w-6 text-right text-amber-600">{r}★</span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 w-8">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : <div className="py-8 text-center text-gray-400 text-sm">No feedback data yet</div>}
            </div>
          </div>

          {/* ── AI Sentiment Analysis ── */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b bg-purple-50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h2 className="font-semibold text-gray-900">AI Sentiment Analysis</h2>
                {feedbackAnalytics?.sentimentBreakdown?.unanalyzed > 0 && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                    {feedbackAnalytics.sentimentBreakdown.unanalyzed} unanalyzed
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-purple-700 border-purple-200 hover:bg-purple-50 gap-1.5 text-xs h-7"
                onClick={() => analyzeAllMutation.mutate()}
                disabled={analyzeAllMutation.isPending}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {analyzeAllMutation.isPending ? "Analyzing…" : "Run AI Analysis"}
              </Button>
            </div>
            <div className="p-4">
              {loadingFeedbackAnalytics ? (
                <Skeleton className="h-40 w-full" />
              ) : feedbackAnalytics?.sentimentBreakdown ? (() => {
                const sb = feedbackAnalytics.sentimentBreakdown;
                const analyzed = sb.positive + sb.neutral + sb.negative;
                const pieData = [
                  { name: "Positive", value: sb.positive, color: "#16a34a" },
                  { name: "Neutral", value: sb.neutral, color: "#d97706" },
                  { name: "Negative", value: sb.negative, color: "#dc2626" },
                ].filter(d => d.value > 0);
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Positive", count: sb.positive, pct: sb.positivePercent, icon: SmilePlus, color: "text-green-600", bg: "bg-green-50 border-green-100" },
                        { label: "Neutral", count: sb.neutral, pct: sb.neutralPercent, icon: Meh, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
                        { label: "Negative", count: sb.negative, pct: sb.negativePercent, icon: Frown, color: "text-red-600", bg: "bg-red-50 border-red-100" },
                      ].map(({ label, count, pct, icon: Icon, color, bg }) => (
                        <div key={label} className={`p-3 rounded-xl border ${bg} flex flex-col items-center text-center`}>
                          <Icon className={`w-6 h-6 ${color} mb-1`} />
                          <p className={`text-2xl font-bold ${color}`}>{count}</p>
                          <p className="text-xs text-gray-500">{label}</p>
                          {analyzed > 0 && <p className={`text-xs font-semibold ${color} mt-0.5`}>{pct}%</p>}
                        </div>
                      ))}
                    </div>
                    {analyzed > 0 && pieData.length > 0 && (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                              {pieData.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => [`${v} responses`]} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {feedbackAnalytics.recentFeedback?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Recent Feedback Sentiment</p>
                        <div className="space-y-2">
                          {feedbackAnalytics.recentFeedback.slice(0, 5).map((fb: any) => (
                            <div key={fb.id} className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50">
                              <div className="mt-0.5">
                                {fb.sentimentLabel === "positive" && <SmilePlus className="w-4 h-4 text-green-600" />}
                                {fb.sentimentLabel === "neutral" && <Meh className="w-4 h-4 text-amber-600" />}
                                {fb.sentimentLabel === "negative" && <Frown className="w-4 h-4 text-red-600" />}
                                {!fb.sentimentLabel && <Sparkles className="w-4 h-4 text-gray-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-medium text-gray-700">{fb.serviceDate}</span>
                                  <span className="text-amber-500 text-xs">{"★".repeat(Math.round(fb.rating))}</span>
                                  {fb.sentimentLabel && (
                                    <Badge className={`text-[10px] px-1.5 py-0 ${
                                      fb.sentimentLabel === "positive" ? "bg-green-100 text-green-800 border-green-200" :
                                      fb.sentimentLabel === "neutral"  ? "bg-amber-100 text-amber-800 border-amber-200" :
                                      "bg-red-100 text-red-800 border-red-200"
                                    }`}>{fb.sentimentLabel}</Badge>
                                  )}
                                </div>
                                {fb.sentimentNote && <p className="text-xs text-gray-500 mt-0.5 truncate">{fb.sentimentNote}</p>}
                                {fb.improvementNote && <p className="text-xs text-gray-400 mt-0.5 italic truncate">"{fb.improvementNote}"</p>}
                              </div>
                              {fb.sentimentScore != null && (
                                <span className="text-xs font-bold shrink-0" style={{ color: fb.sentimentScore >= 0.2 ? "#16a34a" : fb.sentimentScore <= -0.2 ? "#dc2626" : "#d97706" }}>
                                  {fb.sentimentScore > 0 ? "+" : ""}{Number(fb.sentimentScore).toFixed(2)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {analyzed === 0 && sb.unanalyzed > 0 && (
                      <p className="text-sm text-center text-gray-400 py-4">
                        {sb.unanalyzed} feedback entr{sb.unanalyzed === 1 ? "y" : "ies"} waiting for AI analysis. Click "Run AI Analysis" above.
                      </p>
                    )}
                    {feedbackAnalytics.totalResponses === 0 && (
                      <p className="text-sm text-center text-gray-400 py-4">No feedback submitted yet.</p>
                    )}
                  </div>
                );
              })() : <div className="py-8 text-center text-gray-400 text-sm">No feedback data available</div>}
            </div>
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b bg-blue-50">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold text-gray-900">Class Utilization</h2>
              </div>
              <button onClick={() => printReport("Class Utilization", "class-util-print")}
                className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-medium">
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
            </div>
            <div id="class-util-print" className="divide-y">
              {loadingUtilization ? <div className="p-4"><Skeleton className="h-16 w-full" /></div>
                : (classUtilization?.classes || []).map((c: any) => (
                  <div key={c.classId} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{c.className}</p>
                        <p className="text-xs text-gray-500">{c.serviceSlot}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{c.enrollmentCount}/{c.capacity}</p>
                        <Badge className={
                          c.utilizationPercent >= 90 ? "bg-red-100 text-red-800 border-red-200" :
                            c.utilizationPercent >= 70 ? "bg-amber-100 text-amber-800 border-amber-200" :
                              "bg-green-100 text-green-800 border-green-200"
                        }>{c.utilizationPercent}%</Badge>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(c.utilizationPercent, 100)}%`,
                          background: c.utilizationPercent >= 90 ? "#ef4444" : c.utilizationPercent >= 70 ? "#f59e0b" : "#22c55e",
                        }} />
                    </div>
                  </div>
                ))}
              {!loadingUtilization && (!classUtilization?.classes || classUtilization.classes.length === 0) && (
                <div className="py-8 text-center text-gray-400">No class data available</div>
              )}
            </div>
          </div>

          {/* Class Enrollment vs Capacity chart */}
          {!loadingUtilization && (classUtilization?.classes || []).length > 0 && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="p-4 border-b bg-blue-50">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <h2 className="font-semibold text-gray-900">Class Enrollment vs Capacity</h2>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Grouped comparison across all classes</p>
              </div>
              <div className="p-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(classUtilization?.classes || []).map((c: any) => ({
                      name: c.className.replace(/^(The\s+)?/, "").slice(0, 14),
                      Enrolled: c.enrollmentCount,
                      Capacity: c.capacity,
                    }))}
                    margin={{ top: 8, right: 16, left: 0, bottom: 24 }}
                    barCategoryGap="30%"
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" height={48} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Enrolled" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Capacity" fill="#bfdbfe" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {teacherSchedule?.data && teacherSchedule.data.length > 0 && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b bg-cyan-50">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-cyan-600" />
                  <h2 className="font-semibold text-gray-900">Teacher Schedule — {serviceDate}</h2>
                </div>
                <button onClick={() => printReport("Teacher Schedule", "teacher-schedule-print")}
                  className="flex items-center gap-1 text-xs text-cyan-700 hover:text-cyan-900 font-medium">
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
              </div>
              <div id="teacher-schedule-print" className="divide-y">
                {teacherSchedule.data.map((s: any) => (
                  <div key={s.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                        {s.teacherName?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{s.teacherName}</p>
                        <p className="text-xs text-gray-500">{s.className} · {s.serviceSlot || "—"}</p>
                      </div>
                    </div>
                    <Badge className={s.status === "confirmed" ? "bg-green-100 text-green-800 border-green-200" : "bg-blue-100 text-blue-800 border-blue-200"}>
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Custom Report Builder ── */}
      {activeTab === "builder" && (
        <div className="space-y-5">
          {/* Intro banner */}
          <div className="rounded-xl p-5 text-white relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}>
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
            <div className="relative">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Wand2 className="w-5 h-5" /> Custom Report Builder
              </h2>
              <p className="text-blue-200 text-sm mt-1">
                Choose a report type, apply date range, class, and slot filters, then preview results and export as PDF or CSV.
              </p>
            </div>
          </div>

          {/* Report type picker */}
          <div className="bg-white border rounded-xl p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-700">1. Select Report Type</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {REPORT_TYPES.map(rt => {
                const Icon = rt.icon;
                const active = reportType === rt.value;
                return (
                  <button key={rt.value} onClick={() => setReportType(rt.value)}
                    className="p-3 rounded-xl border text-left transition-all hover:shadow-sm"
                    style={active
                      ? { borderColor: rt.color, background: rt.color + "10", boxShadow: `0 0 0 2px ${rt.color}40` }
                      : { borderColor: "#e5e7eb" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: active ? rt.color : rt.color + "18" }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: active ? "white" : rt.color }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: active ? rt.color : "#374151" }}>{rt.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-snug pl-0.5">{rt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white border rounded-xl p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-700">2. Apply Filters</p>
            <div className="flex flex-wrap gap-3 items-end">
              {!noDateRange && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">From Date</label>
                    <Input type="date" value={builderFrom} onChange={e => setBuilderFrom(e.target.value)} className="w-40" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">To Date</label>
                    <Input type="date" value={builderTo} onChange={e => setBuilderTo(e.target.value)} className="w-40" />
                  </div>
                </>
              )}
              {!noClass && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Class</label>
                  <Select value={builderClass || "all"} onValueChange={v => setBuilderClass(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="All classes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classList.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {!noSlot && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Service Slot</label>
                  <Select value={builderSlot || "all"} onValueChange={v => setBuilderSlot(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-32"><SelectValue placeholder="All slots" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Slots</SelectItem>
                      {SLOTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {showTeacher && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1 flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" /> Teacher
                  </label>
                  <Select value={builderTeacher || "all"} onValueChange={v => setBuilderTeacher(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="All teachers" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Teachers</SelectItem>
                      {teacherList.map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.firstName} {t.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {showFamily && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1 flex items-center gap-1">
                    <Home className="h-3 w-3" /> Family
                  </label>
                  <Select value={builderFamily || "all"} onValueChange={v => setBuilderFamily(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="All families" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Families</SelectItem>
                      {familyList.map((f: any) => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          {f.familyCode} — {f.familyName || `${f.parent1?.firstName || ""} Family`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <button
                onClick={() => refetchBuilder()}
                disabled={builderFetching}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${builderFetching ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
            {/* Active filter chips */}
            {(builderTeacher || builderFamily || builderClass || builderSlot) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {builderTeacher && teacherList.find((t: any) => String(t.id) === builderTeacher) && (
                  <span className="flex items-center gap-1 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-1 rounded-full font-medium">
                    <GraduationCap className="h-3 w-3" />
                    {(() => { const t = teacherList.find((t: any) => String(t.id) === builderTeacher); return t ? `${t.firstName} ${t.lastName}` : ""; })()}
                    <button onClick={() => setBuilderTeacher("")} className="ml-0.5 hover:text-emerald-600">×</button>
                  </span>
                )}
                {builderFamily && familyList.find((f: any) => String(f.id) === builderFamily) && (
                  <span className="flex items-center gap-1 text-xs bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded-full font-medium">
                    <Home className="h-3 w-3" />
                    {(() => { const f = familyList.find((f: any) => String(f.id) === builderFamily); return f?.familyCode || ""; })()}
                    <button onClick={() => setBuilderFamily("")} className="ml-0.5 hover:text-amber-600">×</button>
                  </span>
                )}
                {builderClass && classList.find((c: any) => String(c.id) === builderClass) && (
                  <span className="flex items-center gap-1 text-xs bg-blue-50 border border-blue-200 text-blue-800 px-2 py-1 rounded-full font-medium">
                    {classList.find((c: any) => String(c.id) === builderClass)?.name}
                    <button onClick={() => setBuilderClass("")} className="ml-0.5 hover:text-blue-600">×</button>
                  </span>
                )}
                {builderSlot && (
                  <span className="flex items-center gap-1 text-xs bg-purple-50 border border-purple-200 text-purple-800 px-2 py-1 rounded-full font-medium">
                    {builderSlot}
                    <button onClick={() => setBuilderSlot("")} className="ml-0.5 hover:text-purple-600">×</button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Summary stats */}
          {builderData?.summary && builderData.rows?.length > 0 && (() => {
            const s = builderData.summary;
            const stats: { label: string; value: string | number; color: string }[] = [];
            if (s.totalRecords !== undefined) stats.push({ label: "Total Records", value: s.totalRecords, color: selectedType.color });
            if (s.attendanceRate !== undefined) stats.push({ label: "Pickup Rate", value: `${s.attendanceRate}%`, color: "#16a34a" });
            if (s.pickedUp !== undefined) stats.push({ label: "Picked Up", value: s.pickedUp, color: "#16a34a" });
            if (s.uniqueDates !== undefined) stats.push({ label: "Service Days", value: s.uniqueDates, color: "#0891b2" });
            if (s.avgLagMins !== null && s.avgLagMins !== undefined) stats.push({ label: "Avg Drop→Class Lag", value: `${s.avgLagMins} min`, color: "#d97706" });
            if (s.excellent !== undefined) stats.push({ label: "Excellent", value: s.excellent, color: "#16a34a" });
            if (s.good !== undefined) stats.push({ label: "Good", value: s.good, color: "#0891b2" });
            if (s.confirmed !== undefined) stats.push({ label: "Confirmed", value: s.confirmed, color: "#059669" });
            if (s.pending !== undefined) stats.push({ label: "Pending", value: s.pending, color: "#d97706" });
            if (s.active !== undefined && s.inactive !== undefined) {
              stats.push({ label: "Active Families", value: s.active, color: "#16a34a" });
              stats.push({ label: "Inactive", value: s.inactive, color: "#9ca3af" });
            }
            if (s.avgRating !== undefined) stats.push({ label: "Avg Rating", value: `${s.avgRating}★`, color: "#f59e0b" });
            if (s.positive !== undefined) stats.push({ label: "Positive", value: s.positive, color: "#16a34a" });
            if (s.negative !== undefined) stats.push({ label: "Negative", value: s.negative, color: "#dc2626" });
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {stats.slice(0, 8).map((st, i) => (
                  <div key={i} className="bg-white border rounded-xl p-3 text-center">
                    <p className="text-xl font-black" style={{ color: st.color }}>{st.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{st.label}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Chart visualization */}
          {builderData?.rows?.length > 0 && (() => {
            let chartData: { name: string; value: number }[] = [];
            let chartTitle = "";
            const rows: string[][] = builderData.rows;

            if (reportType === "attendance") {
              // Group by date, count records
              const byDate: Record<string, number> = {};
              rows.forEach(r => { byDate[r[0]] = (byDate[r[0]] || 0) + 1; });
              chartData = Object.entries(byDate).slice(-14).map(([name, value]) => ({ name: name.slice(5), value }));
              chartTitle = "Attendance by Service Date";
            } else if (reportType === "appraisals") {
              const byLevel: Record<string, number> = {};
              rows.forEach(r => { const l = r[4] || "—"; byLevel[l] = (byLevel[l] || 0) + 1; });
              chartData = Object.entries(byLevel).map(([name, value]) => ({ name, value }));
              chartTitle = "Appraisals by Participation Level";
            } else if (reportType === "teacher-schedule") {
              const byTeacher: Record<string, number> = {};
              rows.forEach(r => { byTeacher[r[2]] = (byTeacher[r[2]] || 0) + 1; });
              chartData = Object.entries(byTeacher).map(([name, value]) => ({ name, value }));
              chartTitle = "Sessions by Teacher";
            } else if (reportType === "feedback") {
              const bySentiment: Record<string, number> = {};
              rows.forEach(r => { const s = r[6] || "unanalyzed"; bySentiment[s] = (bySentiment[s] || 0) + 1; });
              chartData = Object.entries(bySentiment).map(([name, value]) => ({ name, value }));
              chartTitle = "Feedback by Sentiment";
            } else if (reportType === "not-picked-up") {
              const byDate: Record<string, number> = {};
              rows.forEach(r => { byDate[r[0]] = (byDate[r[0]] || 0) + 1; });
              chartData = Object.entries(byDate).slice(-14).map(([name, value]) => ({ name: name.slice(5), value }));
              chartTitle = "Not Picked Up by Date";
            }

            if (chartData.length < 2) return null;
            return (
              <div className="bg-white border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 p-4 border-b" style={{ background: selectedType.color + "0d" }}>
                  <BarChart3 className="w-4 h-4" style={{ color: selectedType.color }} />
                  <h3 className="font-semibold text-sm text-gray-900">{chartTitle}</h3>
                </div>
                <div className="p-4 h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill={selectedType.color} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          {/* Preview + export */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b"
              style={{ background: selectedType.color + "0d" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: selectedType.color }}>
                  <selectedType.icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {builderData?.title || selectedType.label}
                  </h3>
                  {builderData && (
                    <p className="text-xs text-gray-500">{builderData.total} record{builderData.total !== 1 ? "s" : ""}</p>
                  )}
                </div>
              </div>
              {builderData?.rows?.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCsvExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                  <button
                    onClick={handlePdfExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                    style={{ background: `linear-gradient(135deg, ${selectedType.color}, ${selectedType.color}cc)` }}>
                    <FileText className="w-3.5 h-3.5" />
                    Export PDF
                  </button>
                </div>
              )}
            </div>

            {/* Table */}
            {builderError ? (
              <div className="p-6"><QueryError message="Could not load report data." onRetry={() => refetchBuilder()} /></div>
            ) : builderLoading || builderFetching ? (
              <div className="p-6 space-y-2">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8 w-full rounded" />)}
              </div>
            ) : !builderData ? (
              <div className="py-16 text-center text-gray-400">
                <Table2 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="font-medium">Select filters and click Refresh to preview your report</p>
              </div>
            ) : builderData.rows.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <Table2 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="font-medium">No records match the selected filters</p>
                <p className="text-sm mt-1">Try adjusting the date range, class, or service slot.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">
                    <tr>
                      {builderData.columns.map((col: string) => (
                        <th key={col} className="px-4 py-3 text-left whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {builderData.rows.slice(0, 200).map((row: string[], i: number) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50/50 hover:bg-gray-50"}>
                        {row.map((cell: string, j: number) => (
                          <td key={j} className="px-4 py-2.5 text-gray-700 whitespace-nowrap max-w-xs truncate">
                            {cell || <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {builderData.rows.length > 200 && (
                  <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 text-center">
                    Showing first 200 of {builderData.rows.length} records — export to PDF or CSV to see all.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ANNUAL SUMMARY ── */}
      {activeTab === "annual" && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-700">Year:</label>
              <select
                value={annualYear}
                onChange={e => setAnnualYear(parseInt(e.target.value, 10))}
                className="border rounded-xl px-3 py-2 text-sm font-medium bg-white"
              >
                {[0,1,2,3].map(offset => {
                  const yr = new Date().getFullYear() - offset;
                  return <option key={yr} value={yr}>{yr}</option>;
                })}
              </select>
            </div>
          </div>

          {annualLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
          ) : annualData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Children", value: annualData.totalChildren, sub: `+${annualData.newChildrenThisYear} joined in ${annualYear}`, color: "from-blue-700 to-blue-500" },
                  { label: "Total Families", value: annualData.totalFamilies, sub: `+${annualData.newFamiliesThisYear} new families`, color: "from-indigo-700 to-indigo-500" },
                  { label: "Total Teachers", value: annualData.totalTeachers, sub: `${annualData.completedTeacherServices} completed services`, color: "from-violet-700 to-violet-500" },
                  { label: "Attendance Records", value: annualData.totalSessions, sub: `${annualData.uniqueChildrenAttended} unique children`, color: "from-amber-600 to-amber-400" },
                  { label: "Pickup Rate", value: `${annualData.pickupRate}%`, sub: "Children collected on time", color: "from-green-700 to-green-500" },
                  { label: "Avg Feedback Rating", value: annualData.avgFeedbackRating ? `${annualData.avgFeedbackRating}/5` : "N/A", sub: `${annualData.totalFeedbackResponses} responses`, color: "from-pink-600 to-pink-400" },
                  { label: "Emergencies", value: annualData.totalEmergencies, sub: `${annualData.resolvedEmergencies} resolved`, color: "from-red-700 to-red-500" },
                  { label: "Peak Month", value: annualData.peakMonth, sub: `${annualData.peakMonthCount} sessions`, color: "from-teal-700 to-teal-500" },
                ].map(card => (
                  <div key={card.label} className={`rounded-2xl p-5 bg-gradient-to-br ${card.color} text-white`}>
                    <p className="text-xs font-bold uppercase tracking-wide opacity-80">{card.label}</p>
                    <p className="text-3xl font-black mt-1">{card.value}</p>
                    <p className="text-xs opacity-75 mt-1">{card.sub}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">Monthly Attendance — {annualYear}</h3>
                <div className="flex items-end gap-2 h-40">
                  {annualData.monthlyAttendance.map((m: any) => {
                    const maxCount = Math.max(...annualData.monthlyAttendance.map((x: any) => x.count), 1);
                    const pct = (m.count / maxCount) * 100;
                    const isPeak = m.label === annualData.peakMonth;
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-gray-600">{m.count > 0 ? m.count : ""}</span>
                        <div className="w-full rounded-t-lg transition-all" style={{
                          height: `${Math.max(pct, 2)}%`,
                          background: isPeak ? "linear-gradient(to top, #1e3a8a, #3b82f6)" : "linear-gradient(to top, #e5e7eb, #d1d5db)",
                        }} />
                        <span className="text-xs text-gray-500">{m.label}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-3 text-center">Peak: {annualData.peakMonth} ({annualData.peakMonthCount} sessions)</p>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-gray-400">
              <GraduationCap className="h-12 w-12 mx-auto mb-3 text-gray-200" />
              <p className="font-semibold">No data available for {annualYear}</p>
              <p className="text-sm mt-1">Try a different year or check that data has been seeded.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
