import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-call";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, AlertTriangle, Clock, Users, BarChart3, FileText, Bell, Star, Printer, TrendingUp, BookOpen } from "lucide-react";
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
      .badge-red { background: #fee2e2; color: #991b1b; }
      .badge-green { background: #d1fae5; color: #065f46; }
      .badge-blue { background: #dbeafe; color: #1e40af; }
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

export default function Reports() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [serviceDate, setServiceDate] = useState(today);
  const [serviceSlot, setServiceSlot] = useState("");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState(today);
  const [activeTab, setActiveTab] = useState<"live" | "exports" | "analytics">("live");
  const { toast } = useToast();

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

  const { data: teacherSchedule, isLoading: loadingTeacherSchedule } = useQuery({
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
    } catch {
      toast({ variant: "destructive", title: "Export failed" });
    }
  };

  const handleEmergencyExport = async () => {
    try {
      await downloadCsv("/reports/emergency-log?format=csv", "emergency-log.csv");
      toast({ title: "Emergency log downloaded" });
    } catch {
      toast({ variant: "destructive", title: "Export failed" });
    }
  };

  const handleNotPickedUpExport = () => {
    if (!notPickedUp?.children) return;
    const rows = notPickedUp.children.map((r: any) => [
      r.child?.firstName + " " + r.child?.lastName,
      r.class?.name || "",
      r.status,
      r.minutesSinceCheckIn ? r.minutesSinceCheckIn + " min ago" : "",
      r.family?.familyCode || "",
      r.family?.parentPhone || "",
    ]);
    const csv = [
      ["Child Name", "Class", "Status", "Check-in", "Family Code", "Parent Phone"],
      ...rows,
    ].map(row => row.map((c: string | number) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `not-picked-up-${serviceDate}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Report downloaded" });
  };

  const notPickedUpChildren = notPickedUp?.children || [];
  const ratioAlerts = (teacherRatios?.classes || []).filter((c: any) => c.alert);

  const tabs = [
    { key: "live", label: "Live Reports", icon: Clock },
    { key: "exports", label: "Export Data", icon: Download },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
  ] as const;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Reports & Export</h1>
        <p className="text-gray-500 text-sm mt-1">Live reports, data exports, and analytics for RCCG City of David</p>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === "live" && (
        <div className="space-y-5">
          <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Service Date</label>
              <Input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} className="w-44" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Service Slot</label>
              <Select value={serviceSlot} onValueChange={setServiceSlot}>
                <SelectTrigger className="w-32"><SelectValue placeholder="All slots" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Slots</SelectItem>
                  <SelectItem value="7am">7am</SelectItem>
                  <SelectItem value="9am">9am</SelectItem>
                  <SelectItem value="11am">11am</SelectItem>
                  <SelectItem value="1pm">1pm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => refetchNPU()} className="text-[#1a237e] border-[#1a237e]">Refresh</Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {loadingSummary ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : [
              { label: "Checked In Today", value: summary?.totalCheckedIn ?? 0, icon: Users, color: "#1e3a8a" },
              { label: "Still Present", value: summary?.stillPresent ?? 0, icon: Clock, color: "#f59e0b" },
              { label: "Picked Up", value: summary?.pickedUp ?? 0, icon: BarChart3, color: "#16a34a" },
              { label: "Pending Approvals", value: summary?.pendingUserApprovals ?? 0, icon: Bell, color: "#dc2626" },
            ].map((card) => {
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
            {[
              {
                title: "Attendance Records",
                desc: "All attendance data for selected date range",
                icon: FileText, color: "#1e3a8a",
                action: handleAttendanceExport,
                label: "Download CSV",
              },
              {
                title: "Emergency Log",
                desc: "Full incident log with resolution notes",
                icon: AlertTriangle, color: "#dc2626",
                action: handleEmergencyExport,
                label: "Download CSV",
              },
              {
                title: "Family Registry",
                desc: `All registered families with contacts (${familyRegistry?.total ?? "—"} families)`,
                icon: Users, color: "#7c3aed",
                action: async () => {
                  try {
                    await downloadCsv("/reports/families-export", "family-registry.csv");
                    toast({ title: "Family registry downloaded" });
                  } catch { toast({ variant: "destructive", title: "Export failed" }); }
                },
                label: "Download CSV",
                extra: familyRegistry?.total != null ? (
                  <button onClick={() => printReport("Family Registry", "family-registry-print")}
                    className="flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900">
                    <Printer className="h-3.5 w-3.5" /> Print
                  </button>
                ) : null,
              },
              {
                title: "Teacher Schedule",
                desc: "Teacher-class assignments and service hours",
                icon: BookOpen, color: "#0891b2",
                action: async () => {
                  try {
                    await downloadCsv(`/reports/teacher-schedule?serviceDate=${serviceDate}&format=csv`, `teacher-schedule-${serviceDate}.csv`);
                    toast({ title: "Teacher schedule downloaded" });
                  } catch { toast({ variant: "destructive", title: "Export failed" }); }
                },
                label: "Download CSV",
              },
            ].map(({ title, desc, icon: Icon, color, action, label, extra }) => (
              <div key={title} className="p-4 rounded-xl bg-gray-50 border space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </div>
                  {extra}
                </div>
                <Button size="sm" className="w-full flex items-center gap-2 text-xs"
                  style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
                  onClick={action}>
                  <Download className="w-3.5 h-3.5" /> {label}
                </Button>
              </div>
            ))}
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
                      <th className="px-4 py-2 text-left">Family Code</th>
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
                        <td className="px-4 py-2">
                          <Badge className="bg-blue-50 text-blue-800 border-blue-200">{f.childCount}</Badge>
                        </td>
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

          {/* Feedback Summary */}
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
                  {feedbackSummary.appraisalLevels && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Appraisal Levels</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(feedbackSummary.appraisalLevels).map(([level, count]: [string, any]) => (
                          <div key={level} className="px-3 py-1.5 rounded-lg bg-gray-50 border text-sm">
                            <span className="font-medium capitalize">{level.replace("_", " ")}</span>
                            <span className="ml-2 text-gray-500">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : <div className="py-8 text-center text-gray-400 text-sm">No feedback data yet</div>}
            </div>
          </div>

          {/* Class Utilization */}
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
                        <p className="text-xs text-gray-500">{c.serviceSlot} · {c.roomLocation}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{c.enrolled}/{c.capacity}</p>
                        <Badge className={
                          c.utilizationPct >= 90 ? "bg-red-100 text-red-800 border-red-200" :
                            c.utilizationPct >= 70 ? "bg-amber-100 text-amber-800 border-amber-200" :
                              "bg-green-100 text-green-800 border-green-200"
                        }>{c.utilizationPct}%</Badge>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(c.utilizationPct, 100)}%`,
                          background: c.utilizationPct >= 90 ? "#ef4444" : c.utilizationPct >= 70 ? "#f59e0b" : "#22c55e"
                        }} />
                    </div>
                    {c.waitlistCount > 0 && (
                      <p className="text-xs text-amber-600 mt-1">{c.waitlistCount} on waitlist</p>
                    )}
                  </div>
                ))}
              {!loadingUtilization && (!classUtilization?.classes || classUtilization.classes.length === 0) && (
                <div className="py-8 text-center text-gray-400">No class data available</div>
              )}
            </div>
          </div>

          {/* Teacher Schedule */}
          {teacherSchedule?.schedule && teacherSchedule.schedule.length > 0 && (
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
                {teacherSchedule.schedule.map((s: any) => (
                  <div key={s.teacherId} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                        {s.teacherName?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{s.teacherName}</p>
                        <p className="text-xs text-gray-500">{s.className || "—"} · {s.serviceSlot || "—"}</p>
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
    </div>
  );
}
