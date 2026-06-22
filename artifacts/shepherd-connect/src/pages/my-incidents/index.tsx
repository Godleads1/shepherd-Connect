import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-call";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  ClipboardList, Plus, X, ChevronDown, ChevronUp, AlertTriangle,
  Flame, CheckCircle2, Clock, Info,
} from "lucide-react";

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  behavioural:  { label: "Behavioural",        color: "#d97706", bg: "#fef3c7" },
  injury:       { label: "Injury",             color: "#dc2626", bg: "#fee2e2" },
  bullying:     { label: "Bullying",           color: "#7c3aed", bg: "#ede9fe" },
  medical:      { label: "Medical",            color: "#0891b2", bg: "#cffafe" },
  safeguarding: { label: "Safeguarding",       color: "#be123c", bg: "#ffe4e6" },
  other:        { label: "Other",              color: "#6b7280", bg: "#f3f4f6" },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open:             { label: "Open",             color: "#d97706", bg: "#fef3c7" },
  under_review:     { label: "Under Review",     color: "#1e3a8a", bg: "#dbeafe" },
  risk_assessed:    { label: "Risk Assessed",    color: "#7c3aed", bg: "#ede9fe" },
  parent_notified:  { label: "Parent Notified",  color: "#0891b2", bg: "#cffafe" },
  follow_up:        { label: "Follow-Up",        color: "#d97706", bg: "#fef3c7" },
  escalated:        { label: "Escalated",        color: "#be123c", bg: "#ffe4e6" },
  closed:           { label: "Closed",           color: "#6b7280", bg: "#f3f4f6" },
};

function IncidentCard({ incident }: { incident: any }) {
  const [open, setOpen] = useState(false);
  const tm = TYPE_META[incident.incidentType] ?? TYPE_META.other;
  const sm = STATUS_META[incident.status] ?? STATUS_META.open;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${incident.isHighRisk ? "border-red-300" : "border-gray-100"}`}>
      {incident.isHighRisk && (
        <div className="bg-red-600 text-white text-xs font-bold px-4 py-1 flex items-center gap-1.5">
          <Flame className="w-3 h-3" /> HIGH RISK — Escalation Required
        </div>
      )}
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: tm.bg }}>
          <AlertTriangle className="w-4 h-4" style={{ color: tm.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold font-mono text-gray-400">{incident.referenceNumber}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: tm.bg, color: tm.color }}>{tm.label}</span>
          </div>
          <p className="text-sm font-semibold text-gray-800 mt-1 truncate">{incident.description}</p>
          {incident.childName && <p className="text-xs text-gray-500 mt-0.5">Child: {incident.childName}</p>}
          <p className="text-xs text-gray-400 mt-1">
            {format(new Date(incident.incidentDate), "d MMM yyyy, h:mm a")}
            {incident.location && ` · ${incident.location}`}
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
               : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 space-y-3">
          <div className="mt-3 space-y-2">
            <Field label="Description" value={incident.description} />
            {incident.location && <Field label="Location" value={incident.location} />}
            {incident.actionsTaken && <Field label="Actions Taken" value={incident.actionsTaken} />}
            {incident.parentCommunication && <Field label="Parent Communication" value={incident.parentCommunication} />}
          </div>
          {incident.adminNotes && (
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Safeguarding Team Response</p>
              <p className="text-sm text-blue-800">{incident.adminNotes}</p>
            </div>
          )}
          {incident.resolvedAt && (
            <p className="text-xs text-gray-400">Closed: {format(new Date(incident.resolvedAt), "d MMM yyyy, h:mm a")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-700 leading-relaxed">{value}</p>
    </div>
  );
}

const today = new Date().toISOString().slice(0, 16);

function ReportModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    incidentType: "behavioural",
    description: "",
    childName: "",
    location: "",
    actionsTaken: "",
    parentCommunication: "",
    isHighRisk: false,
    incidentDate: today,
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: () => apiPost<any>("/teacher-incidents", { ...form }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["teacher-incidents"] });
      toast({ title: "Incident Reported", description: `Reference: ${res.referenceNumber}` });
      onClose();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Failed to submit", description: e?.message }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-700" /> Report an Incident
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* High risk banner */}
          <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.isHighRisk ? "border-red-400 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
            <input type="checkbox" checked={form.isHighRisk} onChange={e => set("isHighRisk", e.target.checked)} className="w-4 h-4 accent-red-600" />
            <div>
              <p className={`text-sm font-bold ${form.isHighRisk ? "text-red-700" : "text-gray-700"}`}>🔴 High Risk / Immediate Escalation Required</p>
              <p className="text-xs text-gray-500 mt-0.5">Tick this for any matter requiring urgent safeguarding lead involvement</p>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Incident Type *</label>
              <select value={form.incidentType} onChange={e => set("incidentType", e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Date & Time *</label>
              <input type="datetime-local" value={form.incidentDate} onChange={e => set("incidentDate", e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Child's Name (if applicable)</label>
            <input type="text" value={form.childName} onChange={e => set("childName", e.target.value)}
              placeholder="First and last name"
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Location</label>
            <input type="text" value={form.location} onChange={e => set("location", e.target.value)}
              placeholder="e.g. Classroom 2, Corridor, Foyer"
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Description of Incident *</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="Describe exactly what happened, including what was seen, heard or disclosed…"
              rows={4}
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Actions Taken</label>
            <textarea value={form.actionsTaken} onChange={e => set("actionsTaken", e.target.value)}
              placeholder="What immediate steps were taken? Who was informed?"
              rows={3}
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Parent / Guardian Communication</label>
            <textarea value={form.parentCommunication} onChange={e => set("parentCommunication", e.target.value)}
              placeholder="Was the parent contacted? What was communicated and when?"
              rows={2}
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
          </div>

          <div className="bg-amber-50 rounded-xl p-3 flex gap-2">
            <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">This report will be reviewed by the safeguarding team. You will receive updates via this portal.</p>
          </div>

          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || form.description.trim().length < 10}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
            style={{ background: "#1e3a8a", color: "white" }}>
            {mut.isPending ? "Submitting…" : "Submit Incident Report"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyIncidents() {
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState("all");

  const { data: incidents = [], isLoading } = useQuery<any[]>({
    queryKey: ["teacher-incidents"],
    queryFn: () => apiGet("/teacher-incidents"),
  });

  const filtered = filter === "all"
    ? (incidents as any[])
    : filter === "high_risk"
      ? (incidents as any[]).filter((i: any) => i.isHighRisk)
      : (incidents as any[]).filter((i: any) => i.status === filter);

  const highRiskCount = (incidents as any[]).filter((i: any) => i.isHighRisk && i.status !== "closed").length;
  const openCount = (incidents as any[]).filter((i: any) => i.status === "open" || i.status === "under_review").length;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
        style={{ background: "linear-gradient(135deg,#172554 0%,#1e3a8a 60%,#1d4ed8 100%)" }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              <ClipboardList className="w-6 h-6" /> My Incident Reports
            </h1>
            <p className="text-blue-200 text-sm mt-1">Log and track safeguarding incidents, injuries and behavioural concerns</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 ml-3 transition-all active:scale-95"
            style={{ background: "#f59e0b", color: "#172554" }}>
            <Plus className="w-4 h-4" /> Report
          </button>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-2 mt-5">
          {[
            { label: "Open / In Review", value: openCount,     color: "bg-amber-500/20" },
            { label: "High Risk",        value: highRiskCount, color: "bg-red-500/30"   },
            { label: "Total",            value: (incidents as any[]).length, color: "bg-white/10" },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl px-3 py-2 text-center`}>
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-blue-200 uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* High-risk alert */}
      {highRiskCount > 0 && (
        <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-4 flex items-start gap-3">
          <Flame className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-800">{highRiskCount} high-risk incident{highRiskCount > 1 ? "s" : ""} require safeguarding lead review</p>
            <p className="text-xs text-red-600 mt-0.5">These have been escalated to the safeguarding team for immediate action.</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {[
          { k: "all", label: "All" },
          { k: "open", label: "Open" },
          { k: "under_review", label: "In Review" },
          { k: "high_risk", label: "🔴 High Risk" },
          { k: "closed", label: "Closed" },
        ].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className="flex-shrink-0 py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
            style={filter === f.k
              ? { background: "#1e3a8a", color: "white", boxShadow: "0 2px 8px rgba(30,58,138,.3)" }
              : { color: "#6b7280" }}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <ClipboardList className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No incident reports found</p>
          <button onClick={() => setShowModal(true)}
            className="mt-4 px-5 py-2 rounded-xl text-sm font-bold"
            style={{ background: "#1e3a8a", color: "white" }}>
            Report an Incident
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((i: any) => <IncidentCard key={i.id} incident={i} />)}
        </div>
      )}

      {showModal && <ReportModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
