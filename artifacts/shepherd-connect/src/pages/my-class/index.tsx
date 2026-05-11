import { useState } from "react";
import { useListAttendance, useMarkArrived } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  School, CheckCircle2, AlertTriangle, Truck, Users,
  Clock, ArrowRight, UserCheck, CalendarCheck, ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function fmt(ts: string | null | undefined) {
  if (!ts) return "—";
  try { return format(new Date(ts), "h:mm a"); } catch { return "—"; }
}

function TimestampPill({ label, time, color }: { label: string; time: string | null | undefined; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-semibold" style={{ color }}>{label}</span>
      <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
        {fmt(time)}
      </span>
    </div>
  );
}

export default function MyClass() {
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");
  const [activeTab, setActiveTab] = useState<"pending" | "roster">("pending");
  const [confirming, setConfirming] = useState<number | null>(null);

  const { data: allAttendance, isLoading, refetch } = useListAttendance({ serviceDate: today });
  const arriveMutation = useMarkArrived();

  const attendance = Array.isArray(allAttendance) ? allAttendance : [];
  const pending   = attendance.filter((a: any) => a.status === "dropped_off" || a.status === "in_transit");
  const inClass   = attendance.filter((a: any) => a.status === "in_class");
  const pickedUp  = attendance.filter((a: any) => a.status === "picked_up");
  const allPresent = attendance.filter((a: any) => a.status !== "picked_up");

  const handleConfirm = async (id: number, childName: string) => {
    setConfirming(id);
    try {
      await arriveMutation.mutateAsync({ id });
      toast({
        title: "Arrival confirmed",
        description: `${childName} is now marked in class. Parent has been notified.`,
      });
      refetch();
    } catch {
      toast({ variant: "destructive", title: "Could not confirm arrival" });
    } finally {
      setConfirming(null);
    }
  };

  const tabs = [
    { key: "pending", label: "Awaiting Confirmation", count: pending.length },
    { key: "roster",  label: "Class Roster",          count: inClass.length },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
        style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}>
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"
              style={{ fontFamily: "'Playfair Display', serif" }}>
              <School className="w-7 h-7" /> My Class
            </h1>
            <p className="text-blue-200 text-sm mt-1">
              {format(new Date(), "EEEE, d MMMM yyyy")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">{allPresent.length}</p>
            <p className="text-blue-200 text-xs">children present</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          {[
            { label: "Dropped Off",  value: attendance.filter((a: any) => a.status === "dropped_off").length, color: "#fbbf24" },
            { label: "In Transit",   value: attendance.filter((a: any) => a.status === "in_transit").length,  color: "#60a5fa" },
            { label: "In Class",     value: inClass.length,  color: "#4ade80" },
            { label: "Picked Up",    value: pickedUp.length, color: "#a3a3a3" },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-white/60 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works callout ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-900">Teacher Arrival Confirmation</p>
          <p className="text-xs text-amber-700 mt-0.5">
            When a child arrives at your class, tap <strong>Confirm in Class</strong> to record the second timestamp.
            This notifies the parent and completes the check-in journey:&nbsp;
            <span className="font-mono">Dropped Off → Confirmed In Class.</span>
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
            style={activeTab === tab.key
              ? { background: "#1e3a8a", color: "white", boxShadow: "0 2px 8px rgba(30,58,138,.3)" }
              : { color: "#6b7280" }}>
            {tab.label}
            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
              style={activeTab === tab.key
                ? { background: "rgba(255,255,255,0.2)", color: "#fff" }
                : { background: "#e5e7eb", color: "#374151" }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
        </div>
      ) : activeTab === "pending" ? (
        <>
          {pending.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-green-200">
              <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-3" />
              <p className="text-gray-800 font-semibold text-lg">All children confirmed in class!</p>
              <p className="text-gray-400 text-sm mt-1">
                No pending arrivals — switch to Class Roster to see everyone.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pending.map((a: any) => {
                const isTransit   = a.status === "in_transit";
                const isDropped   = a.status === "dropped_off";
                const isThisOne   = confirming === a.id;
                const borderColor = isTransit ? "#3b82f6" : "#f59e0b";
                const bannerBg    = isTransit ? "#dbeafe" : "#fef3c7";
                const bannerColor = isTransit ? "#1d4ed8" : "#92400e";
                const BannerIcon  = isTransit ? Truck : Clock;
                const bannerText  = isTransit ? "In Transit — Escort en route" : "Waiting at Door";

                return (
                  <div key={a.id}
                    className="bg-white rounded-2xl border overflow-hidden shadow-sm transition-all"
                    style={{ borderColor }}>

                    {/* Status banner */}
                    <div className="px-4 py-2.5 flex items-center gap-2 text-sm font-semibold"
                      style={{ background: bannerBg, color: bannerColor }}>
                      <BannerIcon className="w-4 h-4" />
                      {bannerText}
                    </div>

                    <div className="p-5">
                      {/* Child info */}
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-13 h-13 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                          {a.child?.firstName?.[0]}{a.child?.lastName?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 text-base">
                            {a.child?.firstName} {a.child?.lastName}
                          </h3>
                          <p className="text-gray-500 text-sm truncate">{a.class?.name}</p>
                          {a.child?.allergies && (
                            <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium">
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                              {a.child.allergies}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Timestamp journey */}
                      <div className="flex items-center gap-2 mb-4 bg-gray-50 rounded-xl px-3 py-2.5">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-400 font-medium">Dropped off</span>
                          <span className="text-sm font-bold text-gray-800 font-mono">{fmt(a.checkInTime)}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        {isTransit && (
                          <>
                            <div className="flex flex-col">
                              <span className="text-xs text-blue-500 font-medium">Escort started</span>
                              <span className="text-sm font-bold text-blue-700 font-mono">{fmt(a.escortTime)}</span>
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          </>
                        )}
                        <div className="flex flex-col">
                          <span className="text-xs text-green-500 font-medium">In class</span>
                          <span className="text-sm font-bold text-green-400 font-mono">Pending ✓</span>
                        </div>
                      </div>

                      {/* Confirm button */}
                      <button
                        onClick={() => handleConfirm(a.id, a.child?.firstName)}
                        disabled={isThisOne}
                        className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                        style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "white" }}>
                        {isThisOne ? (
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3" />
                              <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                            Confirming…
                          </span>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4" />
                            Confirm Arrived in Class
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* ── Class Roster ── */
        <>
          {inClass.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
              <Users className="w-14 h-14 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No children confirmed in class yet</p>
              <p className="text-gray-400 text-sm mt-1">Switch to "Awaiting Confirmation" to confirm arrivals.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inClass.map((a: any) => (
                <div key={a.id}
                  className="bg-white rounded-2xl border border-green-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="px-4 py-2.5 flex items-center gap-2 text-sm font-semibold"
                    style={{ background: "#dcfce7", color: "#16a34a" }}>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmed In Class
                  </div>
                  <div className="p-4 flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                      {a.child?.firstName?.[0]}{a.child?.lastName?.[0]}
                    </div>

                    {/* Name + allergy */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">
                        {a.child?.firstName} {a.child?.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{a.class?.name}</p>
                      {a.child?.allergies && (
                        <p className="text-xs text-red-600 flex items-center gap-1 mt-1 font-medium">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {a.child.allergies}
                        </p>
                      )}
                    </div>

                    {/* Timestamps */}
                    <div className="flex flex-col gap-1.5 items-end">
                      <TimestampPill label="Dropped off" time={a.checkInTime}     color="#d97706" />
                      {a.escortTime && (
                        <TimestampPill label="Escort"      time={a.escortTime}     color="#2563eb" />
                      )}
                      <TimestampPill label="In class"    time={a.classArrivalTime} color="#16a34a" />
                    </div>
                  </div>

                  {/* Timeline bar */}
                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-1">
                      <div className="flex-none flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <span className="text-xs text-gray-400">Drop-off</span>
                      </div>
                      <div className="flex-1 h-0.5 bg-gradient-to-r from-amber-400 to-green-500 rounded-full" />
                      <div className="flex-none flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <span className="text-xs text-gray-400">
                          In class · {fmt(a.classArrivalTime)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Picked up section */}
              {pickedUp.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CalendarCheck className="w-3.5 h-3.5" /> Picked Up Today ({pickedUp.length})
                  </p>
                  <div className="space-y-2">
                    {pickedUp.map((a: any) => (
                      <div key={a.id}
                        className="bg-gray-50 rounded-xl border border-gray-100 p-3 flex items-center gap-3 opacity-70">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{ background: "#94a3b8" }}>
                          {a.child?.firstName?.[0]}{a.child?.lastName?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-600">
                            {a.child?.firstName} {a.child?.lastName}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <TimestampPill label="In class"   time={a.classArrivalTime} color="#16a34a" />
                          <TimestampPill label="Picked up"  time={a.checkOutTime}     color="#6b7280" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
