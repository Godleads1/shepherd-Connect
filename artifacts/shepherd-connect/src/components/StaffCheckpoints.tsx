import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-call";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, AlertTriangle, Loader2, Lock } from "lucide-react";

interface CheckpointWindow {
  id: number;
  serviceDate: string;
  serviceSlot: string;
  label: string;
  opensAt: string;
  closesAt: string;
  isOpen: boolean;
  isPast: boolean;
  checkedIn: boolean;
  checkedInAt: string | null;
  isOnTime: boolean | null;
}

function fmtTime(ts: string | null | undefined) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const wat = new Date(d.getTime() + 60 * 60 * 1000);
    const hh = String(wat.getUTCHours()).padStart(2, "0");
    const mm = String(wat.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch { return ""; }
}

export function StaffCheckpoints() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ date: string; windows: CheckpointWindow[] }>({
    queryKey: ["staff-checkpoints-today"],
    queryFn: () => apiGet("/staff-checkpoints/today"),
    refetchInterval: 30_000,
  });

  const checkInMut = useMutation({
    mutationFn: (windowId: number) => apiPost<any>("/staff-checkpoints/checkin", { windowId }),
    onSuccess: (_res, windowId) => {
      qc.invalidateQueries({ queryKey: ["staff-checkpoints-today"] });
      const win = data?.windows.find(w => w.id === windowId);
      toast({ title: `✅ Checked in — ${win?.label ?? ""}`, description: "Your presence has been recorded." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Check-in failed", description: e?.message }),
  });

  if (isLoading) return <div className="rounded-2xl border border-gray-100 bg-white animate-pulse h-28" />;

  const windows = data?.windows ?? [];
  if (windows.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center">
        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500 font-medium">No checkpoints scheduled for today</p>
        <p className="text-xs text-gray-400 mt-0.5">Admin will set up service checkpoints before Sunday.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-50" style={{ background: "#f8fafc" }}>
        <Clock className="w-4 h-4" style={{ color: "#1e3a8a" }} />
        <span className="text-sm font-bold text-gray-800">Service Check-ins</span>
        <span className="ml-auto text-xs text-gray-400">{windows.filter(w => w.checkedIn).length}/{windows.length} done</span>
      </div>
      <div className="divide-y divide-gray-50">
        {windows.map(w => {
          const isBusy = checkInMut.isPending && checkInMut.variables === w.id;
          return (
            <div key={w.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-shrink-0">
                {w.checkedIn
                  ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                  : w.isPast
                    ? <AlertTriangle className="w-5 h-5 text-red-400" />
                    : w.isOpen
                      ? <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
                      : <Lock className="w-5 h-5 text-gray-300" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{w.label}</p>
                <p className="text-xs text-gray-400">{w.opensAt} – {w.closesAt} WAT · {w.serviceSlot} service</p>
              </div>
              <div className="flex-shrink-0">
                {w.checkedIn ? (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: w.isOnTime ? "#dcfce7" : "#fee2e2", color: w.isOnTime ? "#166534" : "#991b1b" }}>
                    {fmtTime(w.checkedInAt)} {w.isOnTime ? "✓" : "Late"}
                  </span>
                ) : w.isPast ? (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600">Missed</span>
                ) : w.isOpen ? (
                  <button
                    onClick={() => checkInMut.mutate(w.id)}
                    disabled={isBusy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-60"
                    style={{ background: "#1e3a8a", color: "white" }}>
                    {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Check In
                  </button>
                ) : (
                  <span className="text-xs text-gray-300 font-medium">Opens {w.opensAt}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
