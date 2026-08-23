import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, LogIn, LogOut, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { apiGet, apiPost } from "@/lib/api-call";
import { useToast } from "@/hooks/use-toast";

function fmt(ts: string | null | undefined) {
  if (!ts) return "—";
  try { return format(new Date(ts), "h:mm a"); } catch { return "—"; }
}

export function TeacherClockIn() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [gpsLoading, setGpsLoading] = useState(false);

  const { data, isLoading } = useQuery<{ record: any }>({
    queryKey: ["teacher-clock-in-today"],
    queryFn: () => apiGet("/teacher-clock-ins/today"),
    refetchInterval: 60_000,
  });

  const record = data?.record ?? null;
  const clockedIn  = !!record?.clockInAt;
  const clockedOut = !!record?.clockOutAt;

  const clockInMut = useMutation({
    mutationFn: (coords: { latitude?: number; longitude?: number }) =>
      apiPost<any>("/teacher-clock-ins/clock-in", coords),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["teacher-clock-in-today"] });
      if (res.onTime) {
        toast({ title: "✅ Clocked in — On Time!", description: `Recorded at ${fmt(res.record?.clockInAt)}. Well done!` });
      } else {
        toast({ variant: "destructive", title: "⚠️ Clocked in — Late", description: `Recorded at ${fmt(res.record?.clockInAt)}. This has been noted.` });
      }
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Clock-in failed", description: e?.message || "Please try again." });
    },
  });

  const clockOutMut = useMutation({
    mutationFn: () => apiPost<any>("/teacher-clock-ins/clock-out", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-clock-in-today"] });
      toast({ title: "Clocked out", description: `See you next time!` });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Clock-out failed", description: e?.message }),
  });

  const handleClockIn = () => {
    // Location is optional: attach coordinates when available, but never
    // block the clock-in if GPS is unsupported, denied, or slow.
    if (!navigator.geolocation) {
      clockInMut.mutate({});
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        clockInMut.mutate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        setGpsLoading(false);
        clockInMut.mutate({});
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl p-4 border border-gray-100 bg-white animate-pulse h-24" />
    );
  }

  const isBusy = gpsLoading || clockInMut.isPending || clockOutMut.isPending;

  return (
    <div className="rounded-2xl border overflow-hidden shadow-sm"
      style={{ borderColor: clockedIn && !clockedOut ? "#bbf7d0" : "#e5e7eb" }}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2"
        style={{ background: clockedIn && !clockedOut ? "#f0fdf4" : "#f8fafc" }}>
        <Clock className="w-4 h-4" style={{ color: "#1e3a8a" }} />
        <span className="text-sm font-bold text-gray-800">Today's Time Log</span>

        {clockedIn && (
          <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
            style={record?.isOnTime
              ? { background: "#dcfce7", color: "#166534" }
              : { background: "#fee2e2", color: "#991b1b" }}>
            {record?.isOnTime ? "On Time" : "Late"}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 bg-white">
        {!clockedIn ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-700">You haven't clocked in yet</p>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Tap Clock In to record your arrival
              </p>
            </div>
            <button
              onClick={handleClockIn}
              disabled={isBusy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
              style={{ background: "#1e3a8a", color: "white" }}>
              {isBusy
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <LogIn className="w-4 h-4" />}
              {gpsLoading ? "Getting location…" : clockInMut.isPending ? "Clocking in…" : "Clock In"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            {/* Timestamps */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-400 font-medium">Clock In</p>
                <p className="text-sm font-bold font-mono mt-0.5"
                  style={{ color: record?.isOnTime ? "#166534" : "#991b1b" }}>
                  {fmt(record?.clockInAt)}
                </p>
              </div>
              {clockedOut && (
                <>
                  <div className="text-gray-300">→</div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-medium">Clock Out</p>
                    <p className="text-sm font-bold font-mono mt-0.5 text-gray-700">{fmt(record?.clockOutAt)}</p>
                  </div>
                </>
              )}
            </div>

            {/* Clock out button or done state */}
            {!clockedOut ? (
              <button
                onClick={() => clockOutMut.mutate()}
                disabled={clockOutMut.isPending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60 border"
                style={{ borderColor: "#d1d5db", color: "#374151", background: "white" }}>
                {clockOutMut.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <LogOut className="w-4 h-4" />}
                Clock Out
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
                <CheckCircle2 className="w-4 h-4" /> Done for today
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
