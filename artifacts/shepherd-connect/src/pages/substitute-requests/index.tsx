import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-call";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CalendarClock, Plus, UserCheck, AlertCircle, CheckCircle2, XCircle, Clock, Users } from "lucide-react";
import { format } from "date-fns";

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  pending:   { bg: "bg-amber-100",  text: "text-amber-700",  icon: Clock },
  assigned:  { bg: "bg-blue-100",   text: "text-blue-700",   icon: UserCheck },
  confirmed: { bg: "bg-green-100",  text: "text-green-700",  icon: CheckCircle2 },
  cancelled: { bg: "bg-gray-100",   text: "text-gray-500",   icon: XCircle },
};

export default function SubstituteRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<any | null>(null);
  const [serviceDate, setServiceDate] = useState("");
  const [reason, setReason] = useState("");
  const [subTeacherId, setSubTeacherId] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["substitute-requests"],
    queryFn: () => apiGet<any[]>("/substitute-requests"),
  });

  const { data: teachers } = useQuery({
    queryKey: ["all-teachers-for-sub"],
    queryFn: () => apiGet<{ data: any[] }>("/users?role=teacher").then(r => r.data),
    enabled: isAdmin,
  });

  const createMut = useMutation({
    mutationFn: () => apiPost("/substitute-requests", { serviceDate, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["substitute-requests"] });
      setCreating(false); setServiceDate(""); setReason("");
      toast({ title: "Request submitted", description: "Admin will assign a substitute." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: e.message || "Failed to submit" }),
  });

  const assignMut = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiPost(`/substitute-requests/${id}/assign`, {
        substituteTeacherId: parseInt(subTeacherId, 10),
        adminNotes: adminNotes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["substitute-requests"] });
      setAssigning(null); setSubTeacherId(""); setAdminNotes("");
      toast({ title: "Substitute assigned" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: e.message || "Failed to assign" }),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiPost(`/substitute-requests/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["substitute-requests"] });
      toast({ title: "Status updated" });
    },
  });

  const pending = (requests || []).filter((r: any) => r.status === "pending").length;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
        style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}>
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              <CalendarClock className="w-7 h-7" /> Substitute Requests
            </h1>
            <p className="text-blue-200 text-sm mt-1">
              {isAdmin ? "Manage teacher absence cover requests" : "Request cover when you can't attend"}
            </p>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            {pending > 0 && (
              <div className="px-3 py-1.5 rounded-xl bg-amber-400 text-amber-900 text-sm font-bold">
                {pending} pending
              </div>
            )}
            {!isAdmin && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
                style={{ background: "#f59e0b", color: "#1a1a1a" }}>
                <Plus className="w-4 h-4" /> New Request
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>
      ) : (requests || []).length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed">
          <CalendarClock className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No substitute requests yet</p>
          {!isAdmin && <p className="text-gray-400 text-sm mt-1">Submit a request when you need cover</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {(requests || []).map((req: any) => {
            const style = STATUS_STYLES[req.status] || STATUS_STYLES.pending;
            const StatusIcon = style.icon;
            return (
              <div key={req.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${style.bg} ${style.text}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {format(new Date(req.serviceDate + "T12:00:00"), "EEEE, MMM d yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        <span className="font-semibold text-gray-800">Requested by:</span>{" "}
                        {req.requestingTeacher?.firstName} {req.requestingTeacher?.lastName}
                      </span>
                    </div>
                    {req.class && (
                      <p className="text-xs text-gray-500 ml-6 mb-1">Class: {req.class.name}</p>
                    )}
                    <p className="text-sm text-gray-600 ml-6"><span className="font-medium">Reason:</span> {req.reason}</p>
                    {req.substituteTeacher && (
                      <p className="text-sm text-green-700 ml-6 mt-1 font-medium flex items-center gap-1">
                        <UserCheck className="w-4 h-4" />
                        Cover: {req.substituteTeacher.firstName} {req.substituteTeacher.lastName}
                      </p>
                    )}
                    {req.adminNotes && (
                      <p className="text-xs text-gray-500 ml-6 mt-1 italic">Note: {req.adminNotes}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {req.status === "pending" && (
                        <button
                          onClick={() => { setAssigning(req); setSubTeacherId(""); setAdminNotes(""); }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all"
                          style={{ background: "#1e3a8a" }}>
                          Assign Cover
                        </button>
                      )}
                      {req.status === "assigned" && (
                        <button
                          onClick={() => updateStatusMut.mutate({ id: req.id, status: "confirmed" })}
                          disabled={updateStatusMut.isPending}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-green-600 text-white disabled:opacity-50">
                          Confirm
                        </button>
                      )}
                      {req.status !== "cancelled" && (
                        <button
                          onClick={() => updateStatusMut.mutate({ id: req.id, status: "cancelled" })}
                          disabled={updateStatusMut.isPending}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                          Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1e3a8a]">
              <CalendarClock className="w-5 h-5" /> Request Substitute Cover
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Service Date *</label>
              <Input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Reason *</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Why do you need cover?"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCreating(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => createMut.mutate()}
                disabled={!serviceDate || !reason.trim() || createMut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: "#1e3a8a" }}>
                {createMut.isPending ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={!!assigning} onOpenChange={() => setAssigning(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1e3a8a]">
              <UserCheck className="w-5 h-5" /> Assign Substitute Teacher
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Substitute Teacher *</label>
              <Select value={subTeacherId} onValueChange={setSubTeacherId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Choose teacher..." />
                </SelectTrigger>
                <SelectContent>
                  {(teachers || []).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.firstName} {t.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Admin Notes (optional)</label>
              <textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any notes for the substitute..."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAssigning(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => assignMut.mutate({ id: assigning.id })}
                disabled={!subTeacherId || assignMut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: "#1e3a8a" }}>
                {assignMut.isPending ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
