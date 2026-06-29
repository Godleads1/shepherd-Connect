import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api-call";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Clock, CheckCircle2, XCircle, AlertTriangle, Plus, Trash2,
  Users, BarChart3, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { resolvePhotoUrl } from "@/components/PhotoUploader";

function todayLocal() { return new Date().toISOString().slice(0, 10); }

function Avatar({ firstName, lastName, photoUrl }: { firstName: string; lastName: string; photoUrl?: string | null }) {
  const photo = resolvePhotoUrl(photoUrl);
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`;
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
      {photo
        ? <img src={photo} alt={initials} className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs"
            style={{ background: "linear-gradient(135deg,#1e3a8a,#3b82f6)" }}>{initials}</div>}
    </div>
  );
}

interface Window_ {
  id: number; serviceDate: string; serviceSlot: string;
  label: string; opensAt: string; closesAt: string;
}
interface StaffRow {
  userId: number; firstName: string; lastName: string;
  role: string; photoUrl?: string | null; totalCheckins: number;
  checkpoints: {
    windowId: number; label: string; opensAt: string; closesAt: string;
    serviceSlot: string; checkedIn: boolean; checkedInAt: string | null; isOnTime: boolean | null;
  }[];
}
interface Summary {
  date: string;
  windows: Window_[];
  staff: StaffRow[];
  stats: { totalStaff: number; totalWindows: number; fullCompliance: number; partialCompliance: number; zeroCompliance: number };
}

function fmtTime(ts: string | null) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    const wat = new Date(d.getTime() + 60 * 60 * 1000);
    return `${String(wat.getUTCHours()).padStart(2,"0")}:${String(wat.getUTCMinutes()).padStart(2,"0")}`;
  } catch { return "—"; }
}

function AddWindowForm({ date, onDone }: { date: string; onDone: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ serviceSlot: "1st", label: "", opensAt: "06:45", closesAt: "07:15" });
  const mut = useMutation({
    mutationFn: () => apiPost("/staff-checkpoints/windows", { serviceDate: date, ...form }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cp-summary", date] }); onDone(); toast({ title: "Checkpoint added" }); },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const presets = [
    { label: "7:00 AM", opensAt: "06:45", closesAt: "07:15", slot: "1st" },
    { label: "8:00 AM", opensAt: "07:45", closesAt: "08:15", slot: "1st" },
    { label: "9:30 AM", opensAt: "09:15", closesAt: "09:45", slot: "1st" },
    { label: "10:30 AM", opensAt: "10:15", closesAt: "10:45", slot: "2nd" },
    { label: "12:00 PM", opensAt: "11:45", closesAt: "12:15", slot: "2nd" },
  ];

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
      <p className="text-sm font-bold text-gray-700">Add Checkpoint Window</p>

      <div className="flex flex-wrap gap-2">
        {presets.map(p => (
          <button key={p.label} type="button"
            onClick={() => setForm({ serviceSlot: p.slot, label: p.label, opensAt: p.opensAt, closesAt: p.closesAt })}
            className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
            style={form.label === p.label ? { background: "#1e3a8a", color: "white", borderColor: "#1e3a8a" } : { background: "white", color: "#374151", borderColor: "#e5e7eb" }}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Label</label>
          <input value={form.label} onChange={e => set("label", e.target.value)} placeholder="e.g. 7:00 AM"
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Service</label>
          <select value={form.serviceSlot} onChange={e => set("serviceSlot", e.target.value)}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
            <option value="1st">1st Service</option>
            <option value="2nd">2nd Service</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Window Opens (WAT)</label>
          <input type="time" value={form.opensAt} onChange={e => set("opensAt", e.target.value)}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Window Closes (WAT)</label>
          <input type="time" value={form.closesAt} onChange={e => set("closesAt", e.target.value)}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => mut.mutate()} disabled={!form.label || mut.isPending}
          className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
          style={{ background: "#1e3a8a", color: "white" }}>
          {mut.isPending ? "Adding…" : "Add Checkpoint"}
        </button>
        <button onClick={onDone} className="px-4 py-2 rounded-xl text-sm font-medium border text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function StaffCheckpointsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayLocal());
  const [showAdd, setShowAdd] = useState(false);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<Summary>({
    queryKey: ["cp-summary", date],
    queryFn: () => apiGet(`/staff-checkpoints/summary?date=${date}`),
    refetchInterval: date === todayLocal() ? 30_000 : false,
  });

  const deleteWindow = useMutation({
    mutationFn: (id: number) => apiDelete(`/staff-checkpoints/windows/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cp-summary", date] }); toast({ title: "Checkpoint removed" }); },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });

  if (!["super_admin", "admin"].includes(user?.role ?? "")) {
    return <div className="p-8 text-center text-gray-500">Access restricted.</div>;
  }

  const isToday = date === todayLocal();
  const stats = data?.stats;
  const windows = data?.windows ?? [];
  const staff = data?.staff ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-6 h-6" style={{ color: "#1e3a8a" }} />
            Service Checkpoints
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Staff must check in at each window to confirm they are at their post</p>
        </div>
        <div className="flex items-center gap-2">
          {isToday && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
            </span>
          )}
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Date + Add */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Date</label>
            <input type="date" value={date} max={todayLocal()} onChange={e => setDate(e.target.value)}
              className="border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
          <button onClick={() => setDate(todayLocal())} className="text-xs font-semibold text-blue-600 hover:underline mt-4">Today</button>
          {data && (
            <p className="ml-auto text-sm text-gray-500 mt-4">
              {format(new Date(date + "T00:00:00"), "EEEE, d MMMM yyyy")}
            </p>
          )}
        </div>

        {/* Existing windows */}
        {windows.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {windows.map(w => (
              <div key={w.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border"
                style={{ background: "#f0f9ff", borderColor: "#bae6fd", color: "#0369a1" }}>
                <span>{w.label}</span>
                <span className="opacity-60">({w.serviceSlot})</span>
                <span className="opacity-50 mx-0.5">·</span>
                <span className="opacity-70">{w.opensAt}–{w.closesAt}</span>
                <button onClick={() => deleteWindow.mutate(w.id)}
                  className="ml-1 text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {showAdd
          ? <AddWindowForm date={date} onDone={() => setShowAdd(false)} />
          : (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              <Plus className="w-4 h-4" /> Add checkpoint window
            </button>
          )
        }
      </div>

      {/* Stat cards */}
      {stats && windows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Users, label: "Total Staff", value: stats.totalStaff, color: "#1e3a8a" },
            { icon: CheckCircle2, label: "Full Compliance", value: stats.fullCompliance, color: "#16a34a" },
            { icon: BarChart3, label: "Partial", value: stats.partialCompliance, color: "#f59e0b" },
            { icon: XCircle, label: "No Check-ins", value: stats.zeroCompliance, color: "#dc2626" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.color + "18" }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {windows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
          <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">No checkpoints set for this date</p>
          <p className="text-sm text-gray-400 mt-1">Add checkpoint windows above before service starts.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : staff.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 font-medium">No active teachers or support staff found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Column headers */}
          <div className="px-4 py-2 border-b border-gray-50 flex items-center gap-3"
            style={{ background: "#f8fafc" }}>
            <div className="w-8" />
            <div className="flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Staff Member</div>
            {windows.map(w => (
              <div key={w.id} className="w-16 text-center text-xs font-semibold text-gray-500 hidden sm:block">
                {w.label}
              </div>
            ))}
            <div className="w-16 text-center text-xs font-semibold text-gray-500">Score</div>
          </div>

          <div className="divide-y divide-gray-50">
            {staff.map(s => {
              const total = windows.length;
              const done = s.totalCheckins;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const color = pct === 100 ? "#16a34a" : pct > 0 ? "#f59e0b" : "#dc2626";
              const expanded = expandedUser === s.userId;

              return (
                <div key={s.userId}>
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedUser(expanded ? null : s.userId)}>
                    <Avatar firstName={s.firstName} lastName={s.lastName} photoUrl={s.photoUrl} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.firstName} {s.lastName}</p>
                      <p className="text-xs text-gray-400 capitalize">{s.role}</p>
                    </div>

                    {/* Mini checkpoint dots (desktop) */}
                    {windows.map(w => {
                      const cp = s.checkpoints.find(c => c.windowId === w.id);
                      return (
                        <div key={w.id} className="w-16 flex justify-center hidden sm:flex">
                          {cp?.checkedIn
                            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                            : <XCircle className="w-4 h-4 text-gray-200" />}
                        </div>
                      );
                    })}

                    <div className="w-16 text-center flex-shrink-0">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: color + "18", color }}>
                        {done}/{total}
                      </span>
                    </div>

                    <div className="flex-shrink-0 text-gray-300">
                      {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expanded && (
                    <div className="px-4 pb-3 pt-0 bg-gray-50 border-t border-gray-100">
                      <div className="flex flex-wrap gap-2 mt-2">
                        {s.checkpoints.map(cp => (
                          <div key={cp.windowId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border"
                            style={cp.checkedIn
                              ? { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }
                              : { background: "#fff7f7", borderColor: "#fecaca", color: "#991b1b" }}>
                            {cp.checkedIn
                              ? <CheckCircle2 className="w-3 h-3" />
                              : <XCircle className="w-3 h-3" />}
                            <span className="font-semibold">{cp.label}</span>
                            {cp.checkedIn && <span className="opacity-70">@ {fmtTime(cp.checkedInAt)}</span>}
                            {!cp.checkedIn && <span className="opacity-70">Missed</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
