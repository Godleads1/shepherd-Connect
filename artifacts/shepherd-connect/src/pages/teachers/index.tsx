import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api-call";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserCog, Pencil, Phone, Mail, Calendar, CheckCircle2, XCircle, ShieldCheck, Clock, AlertTriangle, School } from "lucide-react";
import { resolvePhotoUrl } from "@/components/PhotoUploader";
import { QueryError } from "@/components/QueryError";
import { format } from "date-fns";

function TeacherAvatar({ teacher }: { teacher: any }) {
  const photo = resolvePhotoUrl(teacher?.user?.photoUrl);
  const initials = `${teacher?.user?.firstName?.[0] ?? ""}${teacher?.user?.lastName?.[0] ?? ""}`;
  return (
    <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
      {photo
        ? <img src={photo} alt={initials} className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg,#1e3a8a,#3b82f6)" }}>
            {initials}
          </div>}
    </div>
  );
}

function EditTeacherModal({ teacher, classes, onClose }: { teacher: any; classes: any[]; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName:      teacher?.user?.firstName ?? "",
    lastName:       teacher?.user?.lastName  ?? "",
    phone:          teacher?.user?.phone     ?? "",
    primaryClassId: teacher?.user?.primaryClassId ?? null as number | null,
  });

  const mut = useMutation({
    mutationFn: () => apiPut(`/teachers/${teacher.id}`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teachers"] });
      toast({ title: "Teacher updated successfully" });
      onClose();
    },
    onError: (e: any) => toast({ variant: "destructive", title: e.message || "Update failed" }),
  });

  // Deduplicate classes by name
  const seen = new Set<string>();
  const uniqueClasses = classes.filter((c: any) => { if (seen.has(c.name)) return false; seen.add(c.name); return true; });

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1e3a8a]">
            <Pencil className="w-4 h-4" /> Edit Teacher Profile
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                First Name
              </label>
              <Input value={form.firstName}
                onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                placeholder="First name" className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Last Name
              </label>
              <Input value={form.lastName}
                onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                placeholder="Last name" className="rounded-xl" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Phone Number
            </label>
            <Input value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="+234 800 000 0000" className="rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5" /> Assigned Class
            </label>
            <select
              value={form.primaryClassId ?? ""}
              onChange={e => setForm(p => ({ ...p, primaryClassId: e.target.value ? Number(e.target.value) : null }))}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            >
              <option value="">— No class assigned —</option>
              {uniqueClasses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}{c.ageMin != null ? ` (Ages ${c.ageMin}–${c.ageMax})` : ""}</option>
              ))}
            </select>
            {teacher?.user?.primaryClassId && form.primaryClassId !== teacher?.user?.primaryClassId && (
              <p className="text-[11px] mt-1 text-amber-600 font-medium">
                ⚠ This will reassign the teacher from their current class permanently.
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl"
              style={{ background: "#1e3a8a" }}
              disabled={!form.firstName || !form.lastName || mut.isPending}
              onClick={() => mut.mutate()}>
              {mut.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TimeLogTab() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo]     = useState(today);

  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["teacher-clock-ins", from, to],
    queryFn: () => apiGet<any[]>(`/teacher-clock-ins?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });

  function fmtTime(ts: string | null) {
    if (!ts) return "—";
    try { return format(new Date(ts), "h:mm a"); } catch { return "—"; }
  }

  const token = localStorage.getItem("token");
  const exportUrl = `/api/teacher-clock-ins/export?from=${from}&to=${to}`;

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = exportUrl;
    // attach auth token via a fetch + blob since we can't set headers on <a>
    fetch(exportUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `teacher-time-log-${from}-to-${to}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const onTime = (logs as any[]).filter((r: any) => r.isOnTime === true).length;
  const late   = (logs as any[]).filter((r: any) => r.isOnTime === false).length;

  return (
    <div className="space-y-4">
      {/* Filters + Download */}
      <div className="flex flex-wrap items-end gap-3 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <button onClick={() => { setFrom(today); setTo(today); }}
          className="text-xs text-blue-600 font-semibold hover:underline pb-1.5">Today</button>
        <button onClick={() => { setFrom(firstOfMonth); setTo(today); }}
          className="text-xs text-blue-600 font-semibold hover:underline pb-1.5">This Month</button>

        <div className="ml-auto">
          <button
            onClick={handleDownload}
            disabled={(logs as any[]).length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "#f59e0b", color: "#172554" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
            </svg>
            Download CSV
          </button>
        </div>
      </div>

      {/* Summary pills */}
      {(logs as any[]).length > 0 && (
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-100 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="font-bold text-green-700">{onTime}</span>
            <span className="text-green-600">On Time</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="font-bold text-red-600">{late}</span>
            <span className="text-red-500">Late</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="font-bold text-gray-600">{(logs as any[]).length}</span>
            <span className="text-gray-500">Total Records</span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : (logs as any[]).length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <Clock className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-gray-500 font-semibold text-sm">No clock-in records for this period</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Teacher</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Clock In</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Clock Out</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(logs as any[]).map((row: any) => (
                <tr key={row.id} className={row.isOnTime === false ? "bg-red-50/40" : ""}>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">{row.serviceDate}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                    {row.firstName} {row.lastName}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700">{fmtTime(row.clockInAt)}</td>
                  <td className="px-4 py-3 font-mono text-gray-500">{fmtTime(row.clockOutAt)}</td>
                  <td className="px-4 py-3">
                    {row.clockInAt === null ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Not Clocked In
                      </span>
                    ) : row.isOnTime ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3" /> On Time
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        <AlertTriangle className="w-3 h-3" /> Late
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Teachers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editTarget, setEditTarget] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [mainTab, setMainTab] = useState<"roster" | "timelog">("roster");

  const canEdit = user?.role === "super_admin" || user?.role === "admin";

  const { data: teachers = [], isLoading, isError } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => apiGet<any[]>("/teachers"),
  });

  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ["classes"],
    queryFn: () => apiGet<any[]>("/classes"),
    enabled: canEdit,
  });

  const { data: safeguardingData } = useQuery({
    queryKey: ["safeguarding"],
    queryFn: () => apiGet<any[]>("/safeguarding"),
    enabled: canEdit,
  });

  const safeguardingByUser: Record<number, any[]> = {};
  (safeguardingData ?? []).forEach((r: any) => {
    if (!safeguardingByUser[r.teacherUserId]) safeguardingByUser[r.teacherUserId] = [];
    safeguardingByUser[r.teacherUserId].push(r);
  });

  const filtered = (teachers as any[]).filter((t: any) => {
    if (!search) return true;
    const name = `${t.user?.firstName} ${t.user?.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase()) || t.user?.email?.toLowerCase().includes(search.toLowerCase());
  });

  const active   = filtered.filter((t: any) => t.user?.isActive);
  const inactive = filtered.filter((t: any) => !t.user?.isActive);

  function getDbsStatus(userId: number) {
    const recs = safeguardingByUser[userId] ?? [];
    if (recs.length === 0) return "none";
    if (recs.some((r: any) => r.isExpired)) return "expired";
    if (recs.some((r: any) => r.isExpiringSoon)) return "expiring";
    if (recs.some((r: any) => r.status === "clear")) return "clear";
    return "pending";
  }

  const DBS_BADGE: Record<string, { label: string; cls: string }> = {
    none:     { label: "No DBS",      cls: "bg-gray-100 text-gray-500" },
    pending:  { label: "DBS Pending", cls: "bg-amber-100 text-amber-700" },
    expiring: { label: "DBS Expiring","cls": "bg-orange-100 text-orange-700" },
    expired:  { label: "DBS Expired", cls: "bg-red-100 text-red-700" },
    clear:    { label: "DBS Clear",   cls: "bg-green-100 text-green-700" },
  };

  function TeacherCard({ teacher }: { teacher: any }) {
    const dbs = getDbsStatus(teacher.user?.id);
    const badge = DBS_BADGE[dbs];
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow">
        <TeacherAvatar teacher={teacher} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-bold text-gray-900 text-base leading-tight">
                {teacher.user?.firstName} {teacher.user?.lastName}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badge.cls}`}>
                  {badge.label}
                </span>
                {teacher.user?.isActive
                  ? <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-50 text-green-700">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </span>
                  : <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500">
                      <XCircle className="w-3 h-3" /> Inactive
                    </span>}
              </div>
            </div>
            {canEdit && (
              <button
                onClick={() => setEditTarget(teacher)}
                className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors flex-shrink-0"
                title="Edit teacher">
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="mt-3 space-y-1">
            {teacher.user?.email && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Mail className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                <span className="truncate">{teacher.user.email}</span>
              </div>
            )}
            {teacher.user?.phone && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Phone className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                <span>{teacher.user.phone}</span>
              </div>
            )}
            {teacher.primaryClass ? (
              <div className="flex items-center gap-2 text-xs text-blue-700 font-semibold">
                <School className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
                <span>{teacher.primaryClass.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <School className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="italic">No class assigned</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Joined {new Date(teacher.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stats = {
    total:    (teachers as any[]).length,
    active:   (teachers as any[]).filter((t: any) => t.user?.isActive).length,
    dbsClear: (teachers as any[]).filter((t: any) => getDbsStatus(t.user?.id) === "clear").length,
    dbsIssue: (teachers as any[]).filter((t: any) => ["expired","expiring","none"].includes(getDbsStatus(t.user?.id))).length,
  };

  if (isError) return <QueryError message="Could not load teachers." />;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
        style={{ background: "linear-gradient(135deg,#172554 0%,#1e3a8a 60%,#1d4ed8 100%)" }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <UserCog className="w-7 h-7" /> Teachers
          </h1>
          <p className="text-blue-200 text-sm mt-1">Manage teacher profiles, safeguarding and time logs</p>
        </div>
        {/* Stats row */}
        <div className="relative z-10 grid grid-cols-4 gap-3 mt-5">
          {[
            { label: "Total",       value: stats.total,    color: "bg-white/10" },
            { label: "Active",      value: stats.active,   color: "bg-green-500/20" },
            { label: "DBS Clear",   value: stats.dbsClear, color: "bg-emerald-500/20" },
            { label: "DBS Issues",  value: stats.dbsIssue, color: "bg-red-500/20" },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl px-3 py-2.5 text-center`}>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-blue-200 font-medium uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([
          { key: "roster",  label: "Teacher Roster", icon: UserCog },
          { key: "timelog", label: "Time Log",        icon: Clock },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setMainTab(t.key)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all"
            style={mainTab === t.key
              ? { background: "#1e3a8a", color: "white", boxShadow: "0 2px 8px rgba(30,58,138,.3)" }
              : { color: "#6b7280" }}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {mainTab === "timelog" && <TimeLogTab />}

      {mainTab === "roster" && <>
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <Input
          placeholder="Search teachers by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 rounded-xl bg-white shadow-sm"
        />
      </div>

      {/* Active teachers */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      ) : active.length === 0 && inactive.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed">
          <UserCog className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No teachers found</p>
          {search && <p className="text-gray-400 text-sm mt-1">Try a different search term</p>}
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Active Teachers ({active.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {active.map((t: any) => <TeacherCard key={t.id} teacher={t} />)}
              </div>
            </div>
          )}
          {inactive.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 mt-2">
                Inactive / Suspended ({inactive.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
                {inactive.map((t: any) => <TeacherCard key={t.id} teacher={t} />)}
              </div>
            </div>
          )}
        </>
      )}

      {canEdit && (
        <div className="flex justify-end pt-1">
          <a href="/safeguarding"
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
            <ShieldCheck className="w-4 h-4" />
            Manage Safeguarding & DBS Records
          </a>
        </div>
      )}

      {editTarget && (
        <EditTeacherModal teacher={editTarget} classes={classes as any[]} onClose={() => setEditTarget(null)} />
      )}
      </>}
    </div>
  );
}
