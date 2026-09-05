import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api-call";
import { useAuth } from "@/contexts/auth";
import { QueryError } from "@/components/QueryError";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Plus, AlertTriangle, CheckCircle2, Clock, X, Trash2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import {
  clearPendingSafeguardingOperation,
  readPendingSafeguardingOperation,
  writePendingSafeguardingOperation,
} from "./safeguarding-operation";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string; icon: React.ElementType }> = {
  clear:         { bg: "bg-green-100",  text: "text-green-700",  label: "Clear",         icon: CheckCircle2 },
  pending:       { bg: "bg-amber-100",  text: "text-amber-700",  label: "Pending",        icon: Clock },
  expired:       { bg: "bg-red-100",    text: "text-red-700",    label: "Expired",        icon: AlertTriangle },
  not_submitted: { bg: "bg-gray-100",   text: "text-gray-500",   label: "Not Submitted",  icon: X },
};

export default function Safeguarding() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [teacherUserId, setTeacherUserId] = useState("");
  const [checkType, setCheckType] = useState("DBS Enhanced");
  const [refNumber, setRefNumber] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  const [pendingOperationId, setPendingOperationId] = useState<string | null>(null);
  const [submissionState, setSubmissionState] = useState<"idle" | "unknown" | "checking">("idle");

  const { data: records, isLoading, isError } = useQuery({
    queryKey: ["safeguarding"],
    queryFn: () => apiGet<any[]>("/safeguarding"),
  });

  const { data: teachers } = useQuery({
    queryKey: ["all-teachers-list"],
    queryFn: () => apiGet<{ data: any[] }>("/users?role=teacher").then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (operationId: string) => apiPost("/safeguarding", {
      operationId,
      teacherUserId: parseInt(teacherUserId, 10),
      checkType, referenceNumber: refNumber || undefined,
      issuedDate: issuedDate || undefined,
      expiryDate: expiryDate || undefined,
      status, notes: notes || undefined,
    }),
    onSuccess: () => {
      if (user?.id) clearPendingSafeguardingOperation(user.id);
      setPendingOperationId(null);
      setSubmissionState("idle");
      qc.invalidateQueries({ queryKey: ["safeguarding"] });
      setCreating(false);
      resetForm();
      toast({ title: "Record added" });
    },
    onError: () => {
      setSubmissionState("unknown");
      toast({ variant: "destructive", title: "Submission outcome is unknown", description: "Check status, retry this same submission, or start a new one." });
    },
  });

  async function checkPendingOperation(operationId = pendingOperationId): Promise<void> {
    if (!operationId || !user?.id) return;
    setSubmissionState("checking");
    try {
      await apiGet(`/safeguarding/operations/${operationId}`);
      clearPendingSafeguardingOperation(user.id);
      setPendingOperationId(null);
      setSubmissionState("idle");
      qc.invalidateQueries({ queryKey: ["safeguarding"] });
      setCreating(false);
      resetForm();
      toast({ title: "Record confirmed" });
    } catch {
      setSubmissionState("unknown");
      toast({ variant: "destructive", title: "Status not confirmed", description: "You can retry the same submission or start a new one." });
    }
  }

  function submitNewOperation() {
    if (!user?.id) return;
    const operationId = crypto.randomUUID();
    writePendingSafeguardingOperation(user.id, { operationId, createdAt: Date.now() });
    setPendingOperationId(operationId);
    setSubmissionState("idle");
    createMut.mutate(operationId);
  }

  function retryPendingOperation() {
    if (pendingOperationId) createMut.mutate(pendingOperationId);
  }

  function startNewSubmission() {
    if (user?.id) clearPendingSafeguardingOperation(user.id);
    setPendingOperationId(null);
    setSubmissionState("idle");
    resetForm();
  }

  useEffect(() => {
    if (!user?.id) return;
    const pending = readPendingSafeguardingOperation(user.id);
    if (!pending) return;
    setPendingOperationId(pending.operationId);
    setSubmissionState("unknown");
    void checkPendingOperation(pending.operationId);
  // Pending identity is deliberately scoped to the authenticated user and is
  // the only data retained across reloads; the safeguarding payload stays in memory.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/safeguarding/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["safeguarding"] });
      toast({ title: "Record deleted" });
    },
  });

  function resetForm() {
    setTeacherUserId(""); setCheckType("DBS Enhanced"); setRefNumber("");
    setIssuedDate(""); setExpiryDate(""); setStatus("pending"); setNotes("");
  }

  const expiring = (records || []).filter((r: any) => r.isExpiringSoon && !r.isExpired);
  const expired = (records || []).filter((r: any) => r.isExpired);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
        style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}>
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              <ShieldCheck className="w-7 h-7" /> Safeguarding & DBS
            </h1>
            <p className="text-blue-200 text-sm mt-1">DBS checks and safeguarding records for all teachers</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
            style={{ background: "#f59e0b", color: "#1a1a1a" }}>
            <Plus className="w-4 h-4" /> Add Record
          </button>
        </div>
      </div>

      {/* Alerts */}
      {(expiring.length > 0 || expired.length > 0) && (
        <div className="space-y-2">
          {expired.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-800">DBS Expired — Action Required</p>
                <p className="text-sm text-red-600 mt-0.5">
                  {expired.length} teacher{expired.length > 1 ? "s have" : " has"} an expired DBS check.
                  Review immediately.
                </p>
              </div>
            </div>
          )}
          {expiring.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-800">DBS Expiring Soon</p>
                <p className="text-sm text-amber-600 mt-0.5">
                  {expiring.length} teacher{expiring.length > 1 ? "s have" : " has"} a DBS check expiring within 30 days.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Records */}
      {isError ? (
        <QueryError message="Could not load safeguarding records." />
      ) : isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>
      ) : (records || []).length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed">
          <ShieldCheck className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No safeguarding records yet</p>
          <p className="text-gray-400 text-sm mt-1">Add DBS checks and safeguarding records for each teacher</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(records || []).map((rec: any) => {
            const style = STATUS_STYLES[rec.status] || STATUS_STYLES.pending;
            const StatusIcon = style.icon;
            const daysToExpiry = rec.expiryDate
              ? differenceInDays(new Date(rec.expiryDate), new Date())
              : null;
            return (
              <div key={rec.id}
                className={`bg-white rounded-2xl border shadow-sm p-5 ${rec.isExpired ? "border-red-200" : rec.isExpiringSoon ? "border-amber-200" : "border-gray-100"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${style.bg} ${style.text}`}>
                        <StatusIcon className="w-3.5 h-3.5" /> {style.label}
                      </span>
                      <span className="font-bold text-gray-900">
                        {rec.teacher?.firstName} {rec.teacher?.lastName}
                      </span>
                      <span className="text-sm text-gray-500">{rec.checkType}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm ml-1">
                      {rec.referenceNumber && (
                        <p><span className="text-gray-500">Ref:</span> <span className="font-mono font-medium text-gray-800">{rec.referenceNumber}</span></p>
                      )}
                      {rec.issuedDate && (
                        <p><span className="text-gray-500">Issued:</span> <span className="font-medium">{format(new Date(rec.issuedDate + "T12:00:00"), "MMM d, yyyy")}</span></p>
                      )}
                      {rec.expiryDate && (
                        <p>
                          <span className="text-gray-500">Expires:</span>{" "}
                          <span className={`font-medium ${rec.isExpired ? "text-red-600" : rec.isExpiringSoon ? "text-amber-600" : "text-gray-800"}`}>
                            {format(new Date(rec.expiryDate + "T12:00:00"), "MMM d, yyyy")}
                            {daysToExpiry !== null && daysToExpiry >= 0 && ` (${daysToExpiry}d)`}
                            {daysToExpiry !== null && daysToExpiry < 0 && " (EXPIRED)"}
                          </span>
                        </p>
                      )}
                    </div>
                    {rec.notes && <p className="text-xs text-gray-400 mt-2 italic">{rec.notes}</p>}
                  </div>
                  <button
                    onClick={() => deleteMut.mutate(rec.id)}
                    disabled={deleteMut.isPending}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors disabled:opacity-50 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={v => { setCreating(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1e3a8a]">
              <ShieldCheck className="w-5 h-5" /> Add Safeguarding Record
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Teacher *</label>
              <Select value={teacherUserId} onValueChange={setTeacherUserId}>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Check Type *</label>
                <Select value={checkType} onValueChange={setCheckType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["DBS Enhanced", "DBS Standard", "DBS Basic", "Safeguarding Training", "First Aid"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Status *</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["clear", "pending", "expired", "not_submitted"].map(s => (
                      <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Reference Number</label>
              <Input value={refNumber} onChange={e => setRefNumber(e.target.value)} className="rounded-xl" placeholder="DBS ref number..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Issued Date</label>
                <Input type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Expiry Date</label>
                <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes..."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setCreating(false); resetForm(); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              {(submissionState === "unknown" || submissionState === "checking") && pendingOperationId ? (
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-amber-700">The previous submission may have completed. Use the same operation to avoid a duplicate.</p>
                  <div className="flex gap-2">
                    <button onClick={() => void checkPendingOperation()} disabled={submissionState === "checking" || createMut.isPending}
                      className="flex-1 py-2.5 rounded-xl border border-amber-300 text-sm font-semibold text-amber-800 disabled:opacity-50">
                      {submissionState === "checking" ? "Checking..." : "Check status"}
                    </button>
                    <button onClick={retryPendingOperation} disabled={!teacherUserId || !checkType || createMut.isPending}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: "#1e3a8a" }}>
                      Retry same
                    </button>
                  </div>
                  <button onClick={startNewSubmission} className="w-full text-xs font-semibold text-gray-600 underline">Start new submission</button>
                </div>
              ) : (
                <button
                  onClick={submitNewOperation}
                  disabled={!teacherUserId || !checkType || createMut.isPending || !user?.id}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: "#1e3a8a" }}>
                  {createMut.isPending ? "Saving..." : "Add Record"}
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
