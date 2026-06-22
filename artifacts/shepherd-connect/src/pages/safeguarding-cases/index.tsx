import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api-call";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  ShieldAlert, AlertTriangle, Flame, ChevronDown, ChevronUp,
  MessageSquareWarning, ClipboardList, CheckCircle2, Clock, ArrowRight,
} from "lucide-react";

// ── Shared meta ───────────────────────────────────────────────────────────────

const CONCERN_STATUS: Record<string, { label: string; color: string; bg: string; next?: string }> = {
  open:            { label: "Open",            color: "#d97706", bg: "#fef3c7", next: "under_review" },
  under_review:    { label: "Under Review",    color: "#1e3a8a", bg: "#dbeafe", next: "assessment" },
  assessment:      { label: "Assessment",      color: "#7c3aed", bg: "#ede9fe", next: "parent_notified" },
  parent_notified: { label: "Parent Notified", color: "#0891b2", bg: "#cffafe", next: "resolved" },
  escalated:       { label: "Escalated",       color: "#be123c", bg: "#ffe4e6", next: "resolved" },
  resolved:        { label: "Resolved",        color: "#059669", bg: "#d1fae5", next: "closed" },
  closed:          { label: "Closed",          color: "#6b7280", bg: "#f3f4f6" },
};

const INCIDENT_STATUS: Record<string, { label: string; color: string; bg: string; next?: string }> = {
  open:             { label: "Open",             color: "#d97706", bg: "#fef3c7", next: "under_review" },
  under_review:     { label: "Under Review",     color: "#1e3a8a", bg: "#dbeafe", next: "risk_assessed" },
  risk_assessed:    { label: "Risk Assessed",    color: "#7c3aed", bg: "#ede9fe", next: "parent_notified" },
  parent_notified:  { label: "Parent Notified",  color: "#0891b2", bg: "#cffafe", next: "follow_up" },
  follow_up:        { label: "Follow-Up",        color: "#d97706", bg: "#fef3c7", next: "closed" },
  escalated:        { label: "Escalated",        color: "#be123c", bg: "#ffe4e6", next: "closed" },
  closed:           { label: "Closed",           color: "#6b7280", bg: "#f3f4f6" },
};

const CONCERN_TYPE: Record<string, string> = {
  safeguarding_concern: "Safeguarding Concern",
  complaint:            "Complaint",
  compliment:           "Compliment",
  general_feedback:     "General Feedback",
};

const INCIDENT_TYPE: Record<string, { label: string; color: string; bg: string }> = {
  behavioural:  { label: "Behavioural",  color: "#d97706", bg: "#fef3c7" },
  injury:       { label: "Injury",       color: "#dc2626", bg: "#fee2e2" },
  bullying:     { label: "Bullying",     color: "#7c3aed", bg: "#ede9fe" },
  medical:      { label: "Medical",      color: "#0891b2", bg: "#cffafe" },
  safeguarding: { label: "Safeguarding", color: "#be123c", bg: "#ffe4e6" },
  other:        { label: "Other",        color: "#6b7280", bg: "#f3f4f6" },
};

// ── Workflow stepper ──────────────────────────────────────────────────────────

function WorkflowStepper({ steps, currentStatus }: { steps: string[]; currentStatus: string }) {
  const idx = steps.indexOf(currentStatus);
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      {steps.map((s, i) => {
        const done   = i < idx;
        const active = i === idx;
        const future = i > idx;
        return (
          <div key={s} className="flex items-center gap-1 flex-shrink-0">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? "bg-green-500" : active ? "bg-blue-700" : "bg-gray-200"}`} />
            <span className={`text-[10px] font-semibold whitespace-nowrap ${done ? "text-green-600" : active ? "text-blue-700" : "text-gray-400"}`}>
              {s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
            </span>
            {i < steps.length - 1 && <ArrowRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

// ── Case cards ────────────────────────────────────────────────────────────────

function ConcernCard({ concern, onUpdate }: { concern: any; onUpdate: (id: number, status: string, notes: string) => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(concern.adminNotes ?? "");
  const [status, setStatus] = useState(concern.status);
  const sm = CONCERN_STATUS[concern.status] ?? CONCERN_STATUS.open;
  const steps = Object.keys(CONCERN_STATUS).filter(k => k !== "escalated");

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${concern.type === "safeguarding_concern" ? "border-red-200" : "border-gray-100"}`}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 bg-blue-50">
          <MessageSquareWarning className="w-4 h-4 text-blue-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold font-mono text-gray-400">{concern.referenceNumber}</span>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Concern</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
          </div>
          <p className="text-sm font-semibold text-gray-800 mt-0.5">{CONCERN_TYPE[concern.type] ?? concern.type}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">{concern.description}</p>
          <p className="text-xs text-gray-400 mt-1">
            {concern.parentFirstName} {concern.parentLastName} · {format(new Date(concern.createdAt), "d MMM yyyy, h:mm a")}
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 space-y-3">
          <div className="mt-3">
            <WorkflowStepper steps={steps} currentStatus={concern.status} />
          </div>
          <Field label="From" value={`${concern.parentFirstName} ${concern.parentLastName} (${concern.parentEmail})`} />
          <Field label="Description" value={concern.description} />
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Team Response / Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Add notes, assessment or communication log…"
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
          </div>
          <div className="flex items-center gap-2">
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              {Object.entries(CONCERN_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={() => onUpdate(concern.id, status, notes)}
              className="flex-1 py-1.5 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={{ background: "#1e3a8a", color: "white" }}>
              Save &amp; Advance
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function IncidentCard({ incident, onUpdate }: { incident: any; onUpdate: (id: number, status: string, notes: string) => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(incident.adminNotes ?? "");
  const [status, setStatus] = useState(incident.status);
  const tm = INCIDENT_TYPE[incident.incidentType] ?? INCIDENT_TYPE.other;
  const sm = INCIDENT_STATUS[incident.status] ?? INCIDENT_STATUS.open;
  const steps = Object.keys(INCIDENT_STATUS).filter(k => k !== "escalated");

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${incident.isHighRisk ? "border-red-300" : "border-gray-100"}`}>
      {incident.isHighRisk && (
        <div className="bg-red-600 text-white text-xs font-bold px-4 py-1 flex items-center gap-1.5">
          <Flame className="w-3 h-3" /> HIGH RISK — Immediate Escalation
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
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Incident</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: tm.bg, color: tm.color }}>{tm.label}</span>
          </div>
          <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{incident.description}</p>
          {incident.childName && <p className="text-xs text-gray-500 mt-0.5">Child: {incident.childName}</p>}
          <p className="text-xs text-gray-400 mt-1">
            {incident.teacherFirstName} {incident.teacherLastName} · {format(new Date(incident.incidentDate), "d MMM yyyy, h:mm a")}
            {incident.location && ` · ${incident.location}`}
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 space-y-3">
          <div className="mt-3">
            <WorkflowStepper steps={steps} currentStatus={incident.status} />
          </div>
          <Field label="Reported By" value={`${incident.teacherFirstName} ${incident.teacherLastName}`} />
          <Field label="Description" value={incident.description} />
          {incident.actionsTaken && <Field label="Actions Taken" value={incident.actionsTaken} />}
          {incident.parentCommunication && <Field label="Parent Communication" value={incident.parentCommunication} />}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Safeguarding Team Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Risk assessment, follow-up actions, communication log…"
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
          </div>
          <div className="flex items-center gap-2">
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              {Object.entries(INCIDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={() => onUpdate(incident.id, status, notes)}
              className="flex-1 py-1.5 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={{ background: "#1e3a8a", color: "white" }}>
              Save &amp; Advance
            </button>
          </div>
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

// ── Main page ────────────────────────────────────────────────────────────────

export default function SafeguardingCases() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "concerns" | "incidents">("all");
  const [statusFilter, setStatusFilter] = useState("active");

  const { data: concerns = [], isLoading: cLoading } = useQuery<any[]>({
    queryKey: ["safeguarding-concerns"],
    queryFn: () => apiGet("/safeguarding-portal/concerns"),
  });

  const { data: incidents = [], isLoading: iLoading } = useQuery<any[]>({
    queryKey: ["safeguarding-incidents"],
    queryFn: () => apiGet("/teacher-incidents"),
  });

  const concernMut = useMutation({
    mutationFn: ({ id, status, adminNotes }: { id: number; status: string; adminNotes: string }) =>
      apiPut<any>(`/safeguarding-portal/concerns/${id}`, { status, adminNotes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["safeguarding-concerns"] }); toast({ title: "Updated" }); },
    onError: (e: any) => toast({ variant: "destructive", title: e?.message }),
  });

  const incidentMut = useMutation({
    mutationFn: ({ id, status, adminNotes }: { id: number; status: string; adminNotes: string }) =>
      apiPut<any>(`/teacher-incidents/${id}`, { status, adminNotes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["safeguarding-incidents"] }); toast({ title: "Updated" }); },
    onError: (e: any) => toast({ variant: "destructive", title: e?.message }),
  });

  const isLoading = cLoading || iLoading;

  // Combine and filter
  type CaseItem = { _kind: "concern" | "incident"; _date: Date; _isHighRisk: boolean; _status: string; data: any };

  const allCases: CaseItem[] = [
    ...(concerns as any[]).map(c => ({
      _kind: "concern" as const,
      _date: new Date(c.createdAt),
      _isHighRisk: false,
      _status: c.status,
      data: c,
    })),
    ...(incidents as any[]).map(i => ({
      _kind: "incident" as const,
      _date: new Date(i.incidentDate),
      _isHighRisk: i.isHighRisk,
      _status: i.status,
      data: i,
    })),
  ].sort((a, b) => {
    if (a._isHighRisk !== b._isHighRisk) return a._isHighRisk ? -1 : 1;
    return b._date.getTime() - a._date.getTime();
  });

  const filtered = allCases.filter(c => {
    const kindOk = tab === "all" || c._kind === tab.slice(0, -1); // "concerns"→"concern"
    const activeStatuses = ["open", "under_review", "assessment", "risk_assessed", "parent_notified", "follow_up", "escalated"];
    const statusOk = statusFilter === "all"
      ? true
      : statusFilter === "active"
        ? activeStatuses.includes(c._status)
        : statusFilter === "high_risk"
          ? c._isHighRisk && c._status !== "closed"
          : c._status === statusFilter;
    return kindOk && statusOk;
  });

  const highRiskOpen = allCases.filter(c => c._isHighRisk && c._status !== "closed").length;
  const totalOpen    = allCases.filter(c => ["open", "under_review", "assessment", "risk_assessed", "follow_up"].includes(c._status)).length;
  const escalated    = allCases.filter(c => c._status === "escalated").length;
  const closedCount  = allCases.filter(c => c._status === "closed" || c._status === "resolved").length;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
        style={{ background: "linear-gradient(135deg,#172554 0%,#1e3a8a 60%,#1d4ed8 100%)" }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-amber-300" />
            <span className="text-amber-300 text-xs font-bold uppercase tracking-widest">Safeguarding Lead</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Case Management</h1>
          <p className="text-blue-200 text-sm mt-1">All parent concerns and teacher incident reports — track through to closure</p>
        </div>
        <div className="relative z-10 grid grid-cols-4 gap-2 mt-5">
          {[
            { label: "Open",       value: totalOpen,    color: "bg-amber-500/20" },
            { label: "Escalated",  value: escalated,    color: "bg-red-500/30"   },
            { label: "High Risk",  value: highRiskOpen, color: "bg-red-700/40"   },
            { label: "Resolved",   value: closedCount,  color: "bg-green-500/20" },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl px-2 py-2 text-center`}>
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-blue-200 uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* High-risk alert */}
      {highRiskOpen > 0 && (
        <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-4 flex items-start gap-3 animate-pulse">
          <Flame className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-800">
              ⚠ {highRiskOpen} HIGH-RISK case{highRiskOpen > 1 ? "s" : ""} require immediate safeguarding lead action
            </p>
            <p className="text-xs text-red-600 mt-0.5">Review and escalate these cases to the Safeguarding Lead and Leadership Team without delay.</p>
          </div>
        </div>
      )}

      {/* Type tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { k: "all",       label: `All (${allCases.length})` },
          { k: "concerns",  label: `Concerns (${(concerns as any[]).length})` },
          { k: "incidents", label: `Incidents (${(incidents as any[]).length})` },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className="flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all"
            style={tab === t.k ? { background: "#1e3a8a", color: "white", boxShadow: "0 2px 8px rgba(30,58,138,.3)" } : { color: "#6b7280" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-1 overflow-x-auto">
        {[
          { k: "active",    label: "Active" },
          { k: "high_risk", label: "🔴 High Risk" },
          { k: "escalated", label: "Escalated" },
          { k: "all",       label: "All" },
          { k: "closed",    label: "Closed" },
        ].map(f => (
          <button key={f.k} onClick={() => setStatusFilter(f.k)}
            className="flex-shrink-0 py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap"
            style={statusFilter === f.k ? { background: "#f59e0b", color: "#172554", borderColor: "#f59e0b" } : { background: "white", color: "#6b7280", borderColor: "#e5e7eb" }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Cases */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <CheckCircle2 className="w-12 h-12 text-green-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No open cases</p>
          <p className="text-gray-400 text-xs mt-1">All clear in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c =>
            c._kind === "concern"
              ? <ConcernCard key={`c-${c.data.id}`} concern={c.data}
                  onUpdate={(id, status, notes) => concernMut.mutate({ id, status, adminNotes: notes })} />
              : <IncidentCard key={`i-${c.data.id}`} incident={c.data}
                  onUpdate={(id, status, notes) => incidentMut.mutate({ id, status, adminNotes: notes })} />
          )}
        </div>
      )}
    </div>
  );
}
