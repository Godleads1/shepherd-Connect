import { useState } from "react";
import { useListAttendance, useListClasses } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Filter, X, Calendar, Download, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost } from "@/lib/api-call";
import { useQuery } from "@tanstack/react-query";

const STATUS_OPTS = [
  { value: "all", label: "All Statuses" },
  { value: "dropped_off", label: "Dropped Off" },
  { value: "in_transit",  label: "In Transit"  },
  { value: "in_class",    label: "In Class"    },
  { value: "picked_up",   label: "Picked Up"   },
];

const SLOT_OPTS = [
  { value: "all", label: "All Services"     },
  { value: "7am", label: "7:00 AM Service"  },
  { value: "10am",label: "10:30 AM Service" },
];

const STATUS_STYLE: Record<string, string> = {
  dropped_off: "bg-amber-100 text-amber-800",
  in_transit:  "bg-blue-100 text-blue-800",
  in_class:    "bg-purple-100 text-purple-800",
  picked_up:   "bg-green-100 text-green-800",
};

export default function Attendance() {
  const { user } = useAuth();
  const isParent = user?.role === "parent";
  const { toast } = useToast();
  const [confirmingAll, setConfirmingAll] = useState(false);

  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [serviceSlot, setServiceSlot] = useState("all");
  const [status,      setStatus]      = useState("all");
  const [classId,     setClassId]     = useState("all");

  // Business day is West Africa Time (UTC+1) — match the API's definition of "today"
  const today = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: classesData } = useListClasses({});
  const classes: any[] = classesData || [];

  const filterParams: Record<string, any> = {};
  if (serviceSlot !== "all") filterParams.serviceSlot = serviceSlot;
  if (status      !== "all") filterParams.status      = status;
  if (classId     !== "all") filterParams.classId     = Number(classId);
  if (dateFrom)               filterParams.serviceDate = dateFrom;

  const { data: raw, isLoading, refetch } = useListAttendance(filterParams);

  // Today's in-transit records visible to staff: enables "Confirm all arrivals"
  const { data: todayRaw, refetch: refetchToday } = useListAttendance(
    isParent ? ({ serviceDate: "1970-01-01" } as any) : ({ serviceDate: today } as any),
  );
  const todayRecords: any[] = Array.isArray(todayRaw) ? todayRaw : ((todayRaw as any)?.data ?? []);
  const pendingToday = isParent ? [] : todayRecords.filter((r: any) => r.status === "in_transit" || r.status === "dropped_off");

  // Admins: unresolved records from previous days (children never marked picked up)
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const { data: staleRaw, refetch: refetchStale } = useQuery({
    queryKey: ["attendance-stale"],
    queryFn: () => apiGet<any[]>("/attendance/stale"),
    enabled: isAdmin,
  });
  const staleRecords: any[] = Array.isArray(staleRaw) ? staleRaw : [];
  const [clearingStale, setClearingStale] = useState(false);

  const handleClearStale = async () => {
    setClearingStale(true);
    try {
      const res = await apiPost<{ count: number }>("/attendance/resolve-stale", {});
      toast({ title: `${res.count} old record${res.count !== 1 ? "s" : ""} closed out`, description: "They are now marked as picked up. No parent notifications were sent." });
      refetch();
      refetchStale();
    } catch {
      toast({ variant: "destructive", title: "Could not clear old records" });
    } finally {
      setClearingStale(false);
    }
  };

  const handleConfirmAllArrivals = async () => {
    setConfirmingAll(true);
    const classIds = [...new Set(pendingToday.map((r: any) => r.classId).filter(Boolean))] as number[];
    let confirmed = 0;
    let failures = 0;
    for (const cid of classIds) {
      try {
        const res = await apiPost<{ count: number }>("/attendance/bulk-arrive", { classId: cid, serviceDate: today });
        confirmed += res.count ?? 0;
      } catch {
        failures++;
      }
    }
    setConfirmingAll(false);
    refetch();
    refetchToday();
    if (failures === 0) {
      toast({ title: `${confirmed} arrival${confirmed !== 1 ? "s" : ""} confirmed`, description: "All in-transit children are now marked in class. Parents have been notified." });
    } else {
      toast({ variant: "destructive", title: `Confirmed ${confirmed}, but ${failures} class${failures !== 1 ? "es" : ""} failed`, description: "Try again for the remaining classes." });
    }
  };

  let records: any[] = Array.isArray(raw) ? raw : ((raw as any)?.data ?? []);

  if (dateTo) {
    records = records.filter((r: any) => !r.serviceDate || r.serviceDate <= dateTo);
  }
  if (dateFrom && !filterParams.serviceDate) {
    records = records.filter((r: any) => !r.serviceDate || r.serviceDate >= dateFrom);
  }

  const hasFilters = dateFrom || dateTo || serviceSlot !== "all" || status !== "all" || classId !== "all";

  const clearFilters = () => {
    setDateFrom(""); setDateTo(""); setServiceSlot("all"); setStatus("all"); setClassId("all");
  };

  const exportCsv = () => {
    const headers = ["Date","Child","Class","Service","Check In","Check Out","Status"];
    const rows = records.map((r: any) => [
      r.serviceDate ?? "",
      `${r.child?.firstName ?? ""} ${r.child?.lastName ?? ""}`.trim(),
      r.class?.name ?? "",
      r.serviceSlot === "7am" ? "7:00 AM" : "10:30 AM",
      r.checkInTime  ? format(new Date(r.checkInTime),  "HH:mm") : "",
      r.checkOutTime ? format(new Date(r.checkOutTime), "HH:mm") : "",
      (r.status ?? "").replace(/_/g, " "),
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `attendance-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
            Attendance Records
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoading ? "Loading…" : `${records.length} record${records.length !== 1 ? "s" : ""}${hasFilters ? " · filtered" : ""}`}
          </p>
        </div>
        {!isParent && (
          <Button variant="outline" size="sm" onClick={exportCsv} className="flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        )}
      </div>

      {/* Staff: confirm all in-transit arrivals across classes in one tap */}
      {/* Admins: stale records from previous days that were never closed out */}
      {isAdmin && staleRecords.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {staleRecords.length} unresolved record{staleRecords.length !== 1 ? "s" : ""} from previous days
              </p>
              <p className="text-xs text-amber-700 mt-0.5">Children still shown as dropped off or in transit from past services. Clearing marks them picked up — no parents are notified.</p>
            </div>
          </div>
          <Button
            onClick={handleClearStale}
            disabled={clearingStale}
            variant="outline"
            className="gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-100"
            data-testid="btn-clear-stale"
          >
            {clearingStale ? "Clearing…" : "Clear Old Records"}
          </Button>
        </div>
      )}

      {!isParent && pendingToday.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900">
                {pendingToday.length} child{pendingToday.length !== 1 ? "ren" : ""} awaiting class confirmation today
              </p>
              <p className="text-xs text-blue-700 mt-0.5">Confirm their class arrival on behalf of the teachers — parents will be notified.</p>
            </div>
          </div>
          <Button
            onClick={handleConfirmAllArrivals}
            disabled={confirmingAll}
            className="gap-1.5 bg-blue-700 hover:bg-blue-800 text-white"
            data-testid="btn-confirm-all-arrivals"
          >
            <CheckCircle2 className="w-4 h-4" />
            {confirmingAll ? "Confirming…" : "Confirm All Arrivals"}
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border p-4 space-y-3" style={{ boxShadow: "0 2px 8px rgba(30,58,138,.06)" }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#1e3a8a]" /> Filters
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">From</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-sm h-9" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">To</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-sm h-9" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Service</label>
            <Select value={serviceSlot} onValueChange={setServiceSlot}>
              <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{SLOT_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {!isParent && (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Class</label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden" style={{ boxShadow: "0 2px 8px rgba(30,58,138,.06)" }}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold text-gray-700 text-xs">Date</TableHead>
                <TableHead className="font-semibold text-gray-700 text-xs">Child</TableHead>
                <TableHead className="font-semibold text-gray-700 text-xs">Class</TableHead>
                <TableHead className="font-semibold text-gray-700 text-xs">Service</TableHead>
                <TableHead className="font-semibold text-gray-700 text-xs">Check In</TableHead>
                <TableHead className="font-semibold text-gray-700 text-xs">Check Out</TableHead>
                <TableHead className="font-semibold text-gray-700 text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-14 text-gray-400">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{hasFilters ? "No records match your filters." : "No attendance records found."}</p>
                    {hasFilters && (
                      <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline mt-1">Clear filters</button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                records.map((r: any) => (
                  <TableRow key={r.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="text-sm font-medium">
                      {r.serviceDate ? format(new Date(r.serviceDate + "T00:00:00"), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="font-semibold text-gray-900 text-sm whitespace-nowrap">
                      {r.child?.firstName} {r.child?.lastName}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{r.class?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {r.serviceSlot === "7am" ? "7:00 AM" : "10:30 AM"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {r.checkInTime  ? format(new Date(r.checkInTime),  "HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {r.checkOutTime ? format(new Date(r.checkOutTime), "HH:mm") : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLE[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {(r.status ?? "").replace(/_/g, " ")}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
