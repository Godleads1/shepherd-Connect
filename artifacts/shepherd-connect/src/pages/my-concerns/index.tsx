import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "@/lib/api-call";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquareWarning, Plus, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, ChevronUp, X, ShieldAlert, ThumbsUp, MessageSquare, Info,
} from "lucide-react";
import { format } from "date-fns";

const TYPE_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  safeguarding_concern: { label: "Safeguarding Concern", icon: ShieldAlert,       color: "#dc2626", bg: "#fee2e2" },
  complaint:            { label: "Complaint",            icon: AlertTriangle,     color: "#d97706", bg: "#fef3c7" },
  compliment:           { label: "Compliment",           icon: ThumbsUp,          color: "#059669", bg: "#d1fae5" },
  general_feedback:     { label: "General Feedback",     icon: MessageSquare,     color: "#1e3a8a", bg: "#dbeafe" },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open:         { label: "Open",         color: "#d97706", bg: "#fef3c7" },
  under_review: { label: "Under Review", color: "#1e3a8a", bg: "#dbeafe" },
  resolved:     { label: "Resolved",     color: "#059669", bg: "#d1fae5" },
  closed:       { label: "Closed",       color: "#6b7280", bg: "#f3f4f6" },
};

function ConcernCard({ concern, isAdmin, onStatusChange }: { concern: any; isAdmin: boolean; onStatusChange?: (id: number, status: string, notes: string) => void }) {
  const [open, setOpen] = useState(false);
  const [editNotes, setEditNotes] = useState(concern.adminNotes ?? "");
  const [editStatus, setEditStatus] = useState(concern.status);
  const tm = TYPE_META[concern.type] ?? TYPE_META.general_feedback;
  const sm = STATUS_META[concern.status] ?? STATUS_META.open;
  const Icon = tm.icon;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: tm.bg }}>
          <Icon className="w-4 h-4" style={{ color: tm.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold font-mono text-gray-400">{concern.referenceNumber}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: sm.bg, color: sm.color }}>
              {sm.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-800 mt-1">{tm.label}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{concern.description}</p>
          {isAdmin && (
            <p className="text-xs text-gray-400 mt-1">
              {concern.parentFirstName} {concern.parentLastName} · {concern.parentEmail}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {format(new Date(concern.createdAt), "d MMM yyyy, h:mm a")}
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 space-y-3">
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-gray-700 leading-relaxed">{concern.description}</p>
          </div>
          {concern.adminNotes && !isAdmin && (
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Response from Team</p>
              <p className="text-sm text-blue-800">{concern.adminNotes}</p>
            </div>
          )}
          {concern.resolvedAt && (
            <p className="text-xs text-gray-400">Resolved: {format(new Date(concern.resolvedAt), "d MMM yyyy, h:mm a")}</p>
          )}

          {/* Admin controls */}
          {isAdmin && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin Response</p>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Add notes or response for the parent…"
                rows={3}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
              />
              <div className="flex items-center gap-2">
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => onStatusChange?.(concern.id, editStatus, editNotes)}
                  className="flex-1 py-1.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{ background: "#1e3a8a", color: "white" }}>
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubmitModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [type, setType] = useState("safeguarding_concern");
  const [description, setDescription] = useState("");

  const mut = useMutation({
    mutationFn: () => apiPost<any>("/safeguarding-portal/concerns", { type, description }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["parent-concerns"] });
      toast({ title: "Submitted!", description: `Your reference number is ${res.referenceNumber}. We will be in touch.` });
      onClose();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Submission failed", description: e?.message }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <MessageSquareWarning className="w-5 h-5 text-blue-700" /> Submit a Concern
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Type</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              {Object.entries(TYPE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Please describe your concern, complaint or feedback in as much detail as possible…"
              rows={5}
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{description.length} characters (minimum 10)</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 flex gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">You will receive a unique reference number to track the status of your submission.</p>
          </div>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || description.trim().length < 10}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
            style={{ background: "#1e3a8a", color: "white" }}>
            {mut.isPending ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyConcerns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState("all");

  const { data: concerns = [], isLoading } = useQuery<any[]>({
    queryKey: ["parent-concerns"],
    queryFn: () => apiGet("/safeguarding-portal/concerns"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status, adminNotes }: { id: number; status: string; adminNotes: string }) =>
      apiPut<any>(`/safeguarding-portal/concerns/${id}`, { status, adminNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parent-concerns"] });
      toast({ title: "Updated successfully" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: e?.message }),
  });

  const filtered = (concerns as any[]).filter((c: any) => filter === "all" || c.status === filter);

  const counts = {
    open: (concerns as any[]).filter((c: any) => c.status === "open").length,
    under_review: (concerns as any[]).filter((c: any) => c.status === "under_review").length,
    resolved: (concerns as any[]).filter((c: any) => c.status === "resolved" || c.status === "closed").length,
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
        style={{ background: "linear-gradient(135deg,#172554 0%,#1e3a8a 60%,#1d4ed8 100%)" }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              <MessageSquareWarning className="w-6 h-6" />
              {isAdmin ? "Concerns & Feedback" : "My Concerns"}
            </h1>
            <p className="text-blue-200 text-sm mt-1">
              {isAdmin ? "All parent submissions — review and respond below" : "Submit and track your safeguarding concerns, complaints and feedback"}
            </p>
          </div>
          {!isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 ml-3 transition-all active:scale-95"
              style={{ background: "#f59e0b", color: "#172554" }}>
              <Plus className="w-4 h-4" /> New
            </button>
          )}
        </div>
        {/* Summary pills */}
        <div className="relative z-10 grid grid-cols-3 gap-2 mt-5">
          {[
            { label: "Open",         value: counts.open,         color: "bg-amber-500/20" },
            { label: "Under Review", value: counts.under_review, color: "bg-blue-400/20"  },
            { label: "Resolved",     value: counts.resolved,     color: "bg-green-500/20" },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl px-3 py-2 text-center`}>
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-blue-200 uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {["all", "open", "under_review", "resolved"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all"
            style={filter === f
              ? { background: "#1e3a8a", color: "white", boxShadow: "0 2px 8px rgba(30,58,138,.3)" }
              : { color: "#6b7280" }}>
            {f === "all" ? "All" : STATUS_META[f]?.label ?? f}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <MessageSquareWarning className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No submissions yet</p>
          {!isAdmin && (
            <button onClick={() => setShowModal(true)}
              className="mt-4 px-5 py-2 rounded-xl text-sm font-bold"
              style={{ background: "#1e3a8a", color: "white" }}>
              Submit a Concern
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c: any) => (
            <ConcernCard
              key={c.id}
              concern={c}
              isAdmin={isAdmin}
              onStatusChange={(id, status, notes) => updateMut.mutate({ id, status, adminNotes: notes })}
            />
          ))}
        </div>
      )}

      {showModal && <SubmitModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
