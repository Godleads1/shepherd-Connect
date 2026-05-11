import { useState } from "react";
import { useListClasses } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api-call";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ListOrdered, Trash2, Bell, CheckCircle, Users, Clock } from "lucide-react";
import { format } from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-700",
  notified: "bg-blue-100 text-blue-700",
  enrolled: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function Waitlist() {
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const { data: classes } = useListClasses();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const classId = selectedClassId ? parseInt(selectedClassId, 10) : null;

  const { data: waitlist, isLoading } = useQuery({
    queryKey: ["class-waitlist-admin", classId],
    queryFn: () => apiGet<any[]>(`/classes/${classId}/waitlist`),
    enabled: !!classId,
  });

  const notifyMutation = useMutation({
    mutationFn: () => apiPost<any>(`/classes/${classId}/notify-waitlist`, {}),
    onSuccess: (data: any) => {
      toast({ title: "Notification sent", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["class-waitlist-admin", classId] });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to send notification" }),
  });

  const removeMutation = useMutation({
    mutationFn: (entryId: number) => apiDelete(`/classes/${classId}/waitlist/${entryId}`),
    onSuccess: () => {
      toast({ title: "Entry removed" });
      queryClient.invalidateQueries({ queryKey: ["class-waitlist-admin", classId] });
    },
    onError: () => toast({ variant: "destructive", title: "Remove failed" }),
  });

  const waiting = (waitlist || []).filter((e: any) => e.status === "waiting");
  const notified = (waitlist || []).filter((e: any) => e.status === "notified");
  const resolved = (waitlist || []).filter((e: any) => ["enrolled", "cancelled"].includes(e.status));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}>
        <div className="relative z-10 flex items-center gap-3">
          <ListOrdered className="w-8 h-8 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Class Waitlist</h1>
            <p className="text-white/70 text-sm mt-0.5">Manage children waiting for class spots</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Select Class</label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue placeholder="Choose a class..." />
              </SelectTrigger>
              <SelectContent>
                {classes?.map(cls => (
                  <SelectItem key={cls.id} value={String(cls.id)}>
                    {cls.name} · {(cls as any).serviceSlot} ({(cls as any).waitlistCount ?? 0} waiting)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {classId && waiting.length > 0 && (
            <button
              onClick={() => notifyMutation.mutate()}
              disabled={notifyMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)", marginTop: "18px" }}
            >
              <Bell className="w-4 h-4" /> Notify Next
            </button>
          )}
        </div>
      </div>

      {!classId && (
        <div className="text-center py-16 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
          <ListOrdered className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Select a class to view its waitlist</p>
        </div>
      )}

      {classId && isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      )}

      {classId && !isLoading && waitlist && (
        <div className="space-y-4">
          {waitlist.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No entries on this waitlist</p>
            </div>
          )}

          {waiting.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-amber-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Waiting ({waiting.length})
              </h3>
              <div className="space-y-2">
                {waiting.map((entry: any, idx: number) => (
                  <div key={entry.id} className="bg-white rounded-2xl p-4 border border-amber-100 shadow-sm flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{entry.childName || `Child #${entry.childId}`}</p>
                      <p className="text-xs text-gray-500">{entry.familyCode} · {entry.parentName || "—"} {entry.parentPhone ? `· ${entry.parentPhone}` : ""}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Requested {entry.requestedAt ? format(new Date(entry.requestedAt), "MMM dd, yyyy") : "—"}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[entry.status]}`}>{entry.status}</span>
                    <button onClick={() => removeMutation.mutate(entry.id)} disabled={removeMutation.isPending}
                      className="p-2 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {notified.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-blue-700 mb-2 flex items-center gap-2">
                <Bell className="w-4 h-4" /> Notified ({notified.length})
              </h3>
              <div className="space-y-2">
                {notified.map((entry: any) => (
                  <div key={entry.id} className="bg-white rounded-2xl p-4 border border-blue-100 shadow-sm flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{entry.childName || `Child #${entry.childId}`}</p>
                      <p className="text-xs text-gray-500">{entry.familyCode} · Notified {entry.notifiedAt ? format(new Date(entry.notifiedAt), "MMM dd, yyyy") : "—"}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[entry.status]}`}>{entry.status}</span>
                    <button onClick={() => removeMutation.mutate(entry.id)} disabled={removeMutation.isPending}
                      className="p-2 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resolved.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" /> Resolved ({resolved.length})
              </h3>
              <div className="space-y-2">
                {resolved.map((entry: any) => (
                  <div key={entry.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center gap-4 opacity-60">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-700 text-sm">{entry.childName || `Child #${entry.childId}`}</p>
                      <p className="text-xs text-gray-400">{entry.familyCode}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[entry.status]}`}>{entry.status}</span>
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
