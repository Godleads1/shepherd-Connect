import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-call";
import { useAuth } from "@/contexts/auth";
import { format } from "date-fns";
import {
  Clock, CheckCircle2, XCircle, AlertTriangle, Download,
  RefreshCw, Users, Timer, UserX, TrendingUp,
} from "lucide-react";
import { resolvePhotoUrl } from "@/components/PhotoUploader";

function todayLocal() {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(ts: string | null | undefined) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    const wat = new Date(d.getTime() + 60 * 60 * 1000);
    const hh = String(wat.getUTCHours()).padStart(2, "0");
    const mm = String(wat.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch { return "—"; }
}

function roleLabel(role: string) {
  if (role === "teacher") return "Teacher";
  if (role === "support") return "Support";
  return role;
}

function Avatar({ firstName, lastName, photoUrl }: { firstName: string; lastName: string; photoUrl?: string | null }) {
  const photo = resolvePhotoUrl(photoUrl);
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`;
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
      {photo
        ? <img src={photo} alt={initials} className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg,#1e3a8a,#3b82f6)" }}>
            {initials}
          </div>}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
    </div>
  );
}

export default function StaffAttendance() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayLocal());
  const [tick, setTick] = useState(0);

  // Auto-refresh every 30 s when viewing today
  useEffect(() => {
    if (date !== todayLocal()) return;
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, [date]);

  const { data, isLoading, refetch, isFetching } = useQuery<{
    date: string;
    stats: { total: number; present: number; onTime: number; late: number; absent: number };
    staff: {
      userId: number;
      firstName: string;
      lastName: string;
      role: string;
      photoUrl?: string | null;
      clockIn: {
        clockInAt: string | null;
        clockOutAt: string | null;
        isOnTime: boolean | null;
        isWithinGeofence: boolean;
      } | null;
    }[];
  }>({
    queryKey: ["staff-attendance-summary", date, tick],
    queryFn: () => apiGet(`/teacher-clock-ins/summary?date=${date}`),
  });

  const token = localStorage.getItem("token");
  const handleExport = () => {
    const from = date;
    const to = date;
    fetch(`/api/teacher-clock-ins/export?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.blob()).then(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `staff-attendance-${date}.csv`;
      a.click();
    });
  };

  const isToday = date === todayLocal();
  const stats = data?.stats;
  const staff = data?.staff ?? [];

  const present  = staff.filter(s => s.clockIn?.clockInAt);
  const absent   = staff.filter(s => !s.clockIn?.clockInAt);

  if (!["super_admin", "admin"].includes(user?.role ?? "")) {
    return <div className="p-8 text-center text-gray-500">Access restricted.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-6 h-6" style={{ color: "#1e3a8a" }} />
            Staff Attendance
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Real-time arrival monitoring · geofenced clock-in
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isToday && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={!staff.length}
            className="flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3 py-1.5 transition-colors disabled:opacity-40"
            style={{ background: "#f59e0b", color: "#172554" }}>
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Date Picker */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Date</label>
          <input
            type="date"
            value={date}
            max={todayLocal()}
            onChange={e => setDate(e.target.value)}
            className="border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <button onClick={() => setDate(todayLocal())}
          className="text-xs font-semibold text-blue-600 hover:underline mt-4">Today</button>
        <button onClick={() => {
          const d = new Date(); d.setDate(d.getDate() - 7);
          setDate(d.toISOString().slice(0, 10));
        }} className="text-xs font-semibold text-blue-600 hover:underline mt-4">Last Sunday</button>

        {data && (
          <p className="ml-auto text-sm text-gray-500 mt-4">
            {format(new Date(date + "T00:00:00"), "EEEE, d MMMM yyyy")}
          </p>
        )}
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Users}        label="Total Staff"  value={stats.total}   color="#1e3a8a" />
          <StatCard icon={CheckCircle2} label="Present"      value={stats.present} color="#16a34a" />
          <StatCard icon={TrendingUp}   label="On Time"      value={stats.onTime}  color="#f59e0b" />
          <StatCard icon={UserX}        label="Absent"       value={stats.absent}  color="#dc2626" />
        </div>
      ) : null}

      {/* Present Staff */}
      {present.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            Present ({present.length})
          </h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {present.map(s => (
              <div key={s.userId} className="flex items-center gap-3 px-4 py-3">
                <Avatar firstName={s.firstName} lastName={s.lastName} photoUrl={s.photoUrl} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {s.firstName} {s.lastName}
                  </p>
                  <p className="text-xs text-gray-400">{roleLabel(s.role)}</p>
                </div>
                <div className="flex items-center gap-3 text-right flex-shrink-0">
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Clock In</p>
                    <p className="font-mono text-sm font-bold"
                      style={{ color: s.clockIn?.isOnTime ? "#166534" : "#991b1b" }}>
                      {fmtTime(s.clockIn?.clockInAt)}
                    </p>
                  </div>
                  {s.clockIn?.clockOutAt && (
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Clock Out</p>
                      <p className="font-mono text-sm font-bold text-gray-600">
                        {fmtTime(s.clockIn.clockOutAt)}
                      </p>
                    </div>
                  )}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    s.clockIn?.isOnTime
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}>
                    {s.clockIn?.isOnTime ? "On Time" : "Late"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Absent Staff */}
      {absent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            Not Yet Arrived ({absent.length})
          </h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {absent.map(s => (
              <div key={s.userId} className="flex items-center gap-3 px-4 py-3 opacity-70">
                <Avatar firstName={s.firstName} lastName={s.lastName} photoUrl={s.photoUrl} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">
                    {s.firstName} {s.lastName}
                  </p>
                  <p className="text-xs text-gray-400">{roleLabel(s.role)}</p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                  {isToday ? "Not clocked in" : "Absent"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!isLoading && staff.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">No staff records found</p>
          <p className="text-sm text-gray-400 mt-1">No active teachers or support staff in the system.</p>
        </div>
      )}

      {/* Geofence note */}
      <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl p-3 border border-gray-100">
        <Timer className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
        <span>
          Clock-in requires staff to be physically within <strong>150 m</strong> of the church building.
          On-time cutoff is <strong>7:00 AM WAT</strong>. GPS coordinates are recorded with every clock-in.
        </span>
      </div>
    </div>
  );
}
