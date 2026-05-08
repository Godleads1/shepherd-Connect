import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-call";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, AlertTriangle, Clock, Users, BarChart3, FileText, Bell } from "lucide-react";
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

export default function Reports() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [serviceDate, setServiceDate] = useState(today);
  const [serviceSlot, setServiceSlot] = useState("");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState(today);
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Reports & Export</h1>
        <p className="text-gray-500 text-sm mt-1">View live reports and export data for record keeping</p>
      </div>

      {/* Filters */}
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

      {/* Summary Cards */}
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

      {/* Not Picked Up */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-amber-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-gray-900">Children Not Yet Picked Up</h2>
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">{notPickedUpChildren.length}</Badge>
          </div>
          {notPickedUpChildren.length > 0 && (
            <Button size="sm" variant="outline" className="flex items-center gap-1 text-xs" onClick={handleNotPickedUpExport}>
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          )}
        </div>
        <div className="divide-y">
          {loadingNPU ? (
            <div className="p-4"><Skeleton className="h-16 w-full" /></div>
          ) : notPickedUpChildren.length === 0 ? (
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
                {r.family?.parentPhone && (
                  <p className="text-xs text-gray-400 mt-1">{r.family.parentPhone}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Teacher Ratios */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b bg-blue-50">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Teacher-to-Child Ratios</h2>
          {ratioAlerts.length > 0 && <Badge variant="destructive">{ratioAlerts.length} alerts</Badge>}
        </div>
        <div className="divide-y">
          {loadingRatios ? (
            <div className="p-4"><Skeleton className="h-16 w-full" /></div>
          ) : (teacherRatios?.classes || []).map((c: any) => (
            <div key={c.classId} className={`px-4 py-3 flex items-center justify-between ${c.alert ? "bg-red-50" : ""}`}>
              <div>
                <p className="font-medium text-gray-900">{c.className}</p>
                <p className="text-xs text-gray-500">{c.roomLocation} · {c.serviceSlot}</p>
              </div>
              <div className="flex items-center gap-3 text-right">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{c.childrenPresent} children</p>
                  <p className="text-xs text-gray-500">Rec: {c.recommendedTeachers} teachers</p>
                </div>
                <Badge className={c.alert ? "bg-red-100 text-red-800 border-red-200" : "bg-green-100 text-green-800 border-green-200"}>
                  {c.ratio}
                </Badge>
              </div>
            </div>
          ))}
          {!loadingRatios && (!teacherRatios?.classes || teacherRatios.classes.length === 0) && (
            <div className="py-8 text-center text-gray-400">No class data for this date</div>
          )}
        </div>
      </div>

      {/* Export Section */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-[#1a237e]" /> Data Export
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-3 p-4 rounded-xl bg-gray-50 border">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#1a237e]" />
              <h3 className="font-medium text-gray-900">Attendance Export</h3>
            </div>
            <p className="text-xs text-gray-500">Download attendance records as CSV for any date range</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-600 block mb-1">From</label>
                <Input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} className="text-sm" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-600 block mb-1">To</label>
                <Input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} className="text-sm" />
              </div>
            </div>
            <Button className="w-full flex items-center gap-2" style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}
              onClick={handleAttendanceExport}>
              <Download className="w-4 h-4" /> Download Attendance CSV
            </Button>
          </div>

          <div className="space-y-3 p-4 rounded-xl bg-gray-50 border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="font-medium text-gray-900">Emergency Log Export</h3>
            </div>
            <p className="text-xs text-gray-500">Download full emergency incident log including post-incident reports</p>
            <Button className="w-full flex items-center gap-2 mt-4" variant="outline"
              style={{ color: "#dc2626", borderColor: "#fca5a5" }} onClick={handleEmergencyExport}>
              <Download className="w-4 h-4" /> Download Emergency Log CSV
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
