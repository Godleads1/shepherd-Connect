import { useState, useEffect, useRef } from "react";
import { useTriggerEmergency, useListEmergencies } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, Flame, ShieldAlert, HeartPulse, Shield, BadgeAlert,
  ChevronRight, Search, CheckCircle, MessageSquare, TrendingUp, Clock,
  Users, UserCheck, Radio, ChevronDown, ChevronUp, MapPin, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiPut } from "@/lib/api-call";
import { format } from "date-fns";

type EmergencyUpdate = {
  id: number; emergencyId: number; userId: number; message: string;
  updateType: "update" | "escalation" | "all_clear" | "note";
  createdAt: string;
  user: { id: number; firstName: string; lastName: string; role: string } | null;
};

type ChildInfo = {
  id: number; firstName: string; lastName: string;
  currentClass?: { id: number; name: string } | null;
};

type LastKnownLocation = {
  id: number; childId: number; classId: number; serviceDate: string;
  checkInTime: string | null; checkOutTime: string | null; status: string;
  class?: { id: number; name: string } | null;
};

type MissingChildResult = {
  success: boolean; searchActivated: boolean; teachersAlerted: number; message: string;
  childInfo: ChildInfo | null;
  lastKnownLocation: LastKnownLocation | null;
};

type Emergency = {
  id: number; type: string; level: string; status: string; description: string;
  childId: number | null; triggeredBy: number; createdAt: string;
  resolvedAt: string | null; resolutionNotes: string | null;
  child: any; triggeredByUser: any; updates?: EmergencyUpdate[];
};

// ─── escalation tree config ───────────────────────────────────────────────────

const LEVEL_CONFIG: Record<string, {
  label: string; sublabel: string; color: string; bg: string; border: string;
  notified: Array<{ icon: React.ReactNode; label: string; desc: string }>;
}> = {
  L1: {
    label: "L1 — Local Area", sublabel: "Class / coordinator level",
    color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-300",
    notified: [
      { icon: <UserCheck className="h-3.5 w-3.5" />, label: "Teachers", desc: "All class teachers" },
      { icon: <Users className="h-3.5 w-3.5" />, label: "Admins", desc: "Admin & super admin" },
    ],
  },
  L2: {
    label: "L2 — Department", sublabel: "Zone / department level",
    color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-300",
    notified: [
      { icon: <UserCheck className="h-3.5 w-3.5" />, label: "All Staff", desc: "Teachers, attendants, admins" },
      { icon: <Users className="h-3.5 w-3.5" />, label: "Affected Parents", desc: "Parents of involved child (if set)" },
    ],
  },
  L3: {
    label: "L3 — Building-Wide", sublabel: "Entire facility",
    color: "text-red-700", bg: "bg-red-50", border: "border-red-300",
    notified: [
      { icon: <UserCheck className="h-3.5 w-3.5" />, label: "All Staff", desc: "Teachers, attendants, admins" },
      { icon: <Users className="h-3.5 w-3.5" />, label: "All Checked-In Parents", desc: "Parents of every child present today" },
    ],
  },
  L4: {
    label: "L4 — CRITICAL", sublabel: "Full community evacuation",
    color: "text-red-900", bg: "bg-red-100", border: "border-red-500",
    notified: [
      { icon: <Radio className="h-3.5 w-3.5" />, label: "EVERYONE", desc: "Every active user on the platform" },
    ],
  },
};

const COLORS: Record<string, string> = {
  medical: "from-red-500 to-rose-600",
  fire_evacuation: "from-orange-500 to-red-600",
  security: "from-slate-700 to-slate-900",
  missing_child: "from-indigo-700 to-blue-900",
  general: "from-gray-500 to-gray-700",
};

const UPDATE_COLORS: Record<string, string> = {
  update: "bg-blue-50 border-blue-200 text-blue-900",
  escalation: "bg-orange-50 border-orange-200 text-orange-900",
  all_clear: "bg-green-50 border-green-200 text-green-900",
  note: "bg-gray-50 border-gray-200 text-gray-800",
};

const UPDATE_ICONS: Record<string, React.ReactNode> = {
  update: <Info className="h-3.5 w-3.5" />,
  escalation: <TrendingUp className="h-3.5 w-3.5" />,
  all_clear: <CheckCircle className="h-3.5 w-3.5" />,
  note: <MessageSquare className="h-3.5 w-3.5" />,
};

function EmergencyIcon({ type, className = "h-5 w-5" }: { type: string; className?: string }) {
  switch (type) {
    case "medical": return <HeartPulse className={className} />;
    case "fire_evacuation": return <Flame className={className} />;
    case "security": return <ShieldAlert className={className} />;
    case "missing_child": return <BadgeAlert className={className} />;
    default: return <AlertTriangle className={className} />;
  }
}

// ─── escalation tree panel ────────────────────────────────────────────────────

function EscalationTreePanel({ currentLevel }: { currentLevel: string }) {
  const levels = ["L1", "L2", "L3", "L4"];
  return (
    <div className="px-4 py-3 bg-gray-50 border-b space-y-2">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Escalation Tree — Who is notified</p>
      <div className="flex gap-2">
        {levels.map((lv) => {
          const cfg = LEVEL_CONFIG[lv];
          const isActive = lv === currentLevel;
          const isPassed = levels.indexOf(lv) < levels.indexOf(currentLevel);
          return (
            <div key={lv}
              className={`flex-1 rounded-lg p-2 border text-xs transition-all ${
                isActive ? `${cfg.bg} ${cfg.border} shadow-sm` :
                isPassed ? "bg-gray-100 border-gray-200 opacity-60" :
                "bg-white border-gray-200 opacity-40"
              }`}>
              <p className={`font-black text-xs ${isActive ? cfg.color : "text-gray-500"}`}>{lv}</p>
              <p className={`text-xs leading-tight mt-0.5 ${isActive ? cfg.color : "text-gray-400"}`}>{cfg.sublabel}</p>
              <div className={`mt-1.5 space-y-0.5 ${isActive ? "" : "opacity-60"}`}>
                {cfg.notified.map((n, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className={isActive ? cfg.color : "text-gray-400"}>{n.icon}</span>
                    <span className={`text-xs font-semibold ${isActive ? cfg.color : "text-gray-400"}`}>{n.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── incident thread ──────────────────────────────────────────────────────────

function EmergencyThread({ emergency, onClose }: { emergency: Emergency; onClose: () => void }) {
  const [msg, setMsg] = useState("");
  const [updateType, setUpdateType] = useState("update");
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [showAllClear, setShowAllClear] = useState(false);
  const [allClearNotes, setAllClearNotes] = useState("");
  const [showTree, setShowTree] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const threadRef = useRef<HTMLDivElement>(null);

  const { data: thread } = useQuery({
    queryKey: ["emergency-updates", emergency.id],
    queryFn: () => apiGet<EmergencyUpdate[]>(`/emergencies/${emergency.id}/updates`),
    refetchInterval: 6000,
  });

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [thread]);

  const postUpdate = useMutation({
    mutationFn: (d: { message: string; updateType: string }) =>
      apiPost(`/emergencies/${emergency.id}/update`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emergency-updates", emergency.id] });
      setMsg("");
    },
    onError: () => toast({ variant: "destructive", title: "Failed to post update" }),
  });

  const escalate = useMutation({
    mutationFn: () => apiPut(`/emergencies/${emergency.id}/escalate`, { reason: escalateReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emergencies-all"] });
      qc.invalidateQueries({ queryKey: ["emergency-updates", emergency.id] });
      setShowEscalate(false);
      toast({ title: "Emergency escalated. Expanded notification tree activated." });
      onClose();
    },
    onError: () => toast({ variant: "destructive", title: "Escalation failed" }),
  });

  const allClear = useMutation({
    mutationFn: () => apiPost(`/emergencies/${emergency.id}/all-clear`, { notes: allClearNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emergencies-all"] });
      setShowAllClear(false);
      toast({ title: "ALL CLEAR issued. All users notified — situation resolved." });
      onClose();
    },
    onError: () => toast({ variant: "destructive", title: "Failed to issue all clear" }),
  });

  const levelNext: Record<string, string> = { L1: "L2", L2: "L3", L3: "L4", L4: "L4" };
  const cfg = LEVEL_CONFIG[emergency.level] ?? LEVEL_CONFIG.L4;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className={`p-4 text-white bg-gradient-to-br ${COLORS[emergency.type] || "from-red-600 to-red-800"}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <EmergencyIcon type={emergency.type} />
            <span className="font-black text-lg uppercase tracking-wide">{emergency.type.replace(/_/g, " ")}</span>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Badge className={`border font-bold ${cfg.bg} ${cfg.border} ${cfg.color}`}>
              {emergency.level}
            </Badge>
            <Badge className={emergency.status === "active"
              ? "bg-red-200 text-red-900 border-red-300"
              : emergency.status === "monitoring"
              ? "bg-yellow-100 text-yellow-900"
              : "bg-green-200 text-green-900 border-green-300"}>
              {emergency.status.toUpperCase()}
            </Badge>
          </div>
        </div>
        <p className="text-white/90 text-sm leading-snug">{emergency.description}</p>
        {emergency.child && (
          <p className="text-white/75 text-xs mt-1 flex items-center gap-1">
            <BadgeAlert className="h-3 w-3" />
            Linked child: {emergency.child.firstName} {emergency.child.lastName}
          </p>
        )}
        <p className="text-white/60 text-xs mt-1">
          {format(new Date(emergency.createdAt), "MMM d, h:mm a")} · by {emergency.triggeredByUser?.firstName} {emergency.triggeredByUser?.lastName}
        </p>
      </div>

      {/* Escalation tree toggle */}
      <button
        onClick={() => setShowTree(v => !v)}
        className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold border-b ${cfg.bg} ${cfg.color} hover:brightness-95 transition-all`}>
        <span className="flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5" />
          Escalation Tree — {cfg.label} · {cfg.notified.map(n => n.label).join(" + ")}
        </span>
        {showTree ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {showTree && <EscalationTreePanel currentLevel={emergency.level} />}

      {/* Action bar */}
      {emergency.status === "active" && (
        <div className="flex gap-2 p-3 border-b bg-gray-50">
          {emergency.level !== "L4" && (
            <button onClick={() => { setShowEscalate(!showEscalate); setShowAllClear(false); }}
              className="flex-1 flex items-center justify-center gap-1 py-2 px-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors">
              <TrendingUp className="h-3.5 w-3.5" />
              Escalate → {levelNext[emergency.level]}
            </button>
          )}
          <button onClick={() => { setShowAllClear(!showAllClear); setShowEscalate(false); }}
            className="flex-1 flex items-center justify-center gap-1 py-2 px-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors">
            <CheckCircle className="h-3.5 w-3.5" /> Issue ALL CLEAR
          </button>
        </div>
      )}

      {showEscalate && (
        <div className="p-3 bg-orange-50 border-b border-orange-200 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="text-xs font-bold text-orange-800">
            Escalating to {levelNext[emergency.level]} will notify:{" "}
            {LEVEL_CONFIG[levelNext[emergency.level]]?.notified.map(n => n.label).join(" + ")}
          </p>
          <Input placeholder="Reason for escalation (optional)" value={escalateReason}
            onChange={e => setEscalateReason(e.target.value)} className="text-sm h-8" />
          <div className="flex gap-2">
            <button onClick={() => setShowEscalate(false)} className="flex-1 py-1.5 text-xs border rounded-lg hover:bg-white">Cancel</button>
            <button onClick={() => escalate.mutate()} disabled={escalate.isPending}
              className="flex-1 py-1.5 text-xs bg-orange-500 text-white font-bold rounded-lg disabled:opacity-50">
              {escalate.isPending ? "Escalating..." : `Confirm — Escalate to ${levelNext[emergency.level]}`}
            </button>
          </div>
        </div>
      )}

      {showAllClear && (
        <div className="p-3 bg-green-50 border-b border-green-200 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="text-xs font-bold text-green-800">Issue ALL CLEAR — all notified parties will be informed the situation is resolved.</p>
          <Input placeholder="Resolution notes (optional)" value={allClearNotes}
            onChange={e => setAllClearNotes(e.target.value)} className="text-sm h-8" />
          <div className="flex gap-2">
            <button onClick={() => setShowAllClear(false)} className="flex-1 py-1.5 text-xs border rounded-lg hover:bg-white">Cancel</button>
            <button onClick={() => allClear.mutate()} disabled={allClear.isPending}
              className="flex-1 py-1.5 text-xs bg-green-600 text-white font-bold rounded-lg disabled:opacity-50">
              {allClear.isPending ? "Issuing..." : "Confirm ALL CLEAR"}
            </button>
          </div>
        </div>
      )}

      {/* Thread */}
      <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-2 max-h-64">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
          <MessageSquare className="h-3 w-3" /> Incident Thread
        </p>
        {(thread || []).map(u => (
          <div key={u.id} className={`p-2.5 rounded-xl border text-sm ${UPDATE_COLORS[u.updateType] ?? UPDATE_COLORS.note}`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-semibold text-xs flex items-center gap-1">
                {UPDATE_ICONS[u.updateType]}
                {u.user?.firstName} {u.user?.lastName}
                <span className="text-xs opacity-60 font-normal capitalize">({u.user?.role})</span>
              </span>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs px-1 py-0 capitalize">{u.updateType.replace("_", " ")}</Badge>
                <span className="text-xs opacity-60">{format(new Date(u.createdAt), "h:mm a")}</span>
              </div>
            </div>
            <p className="text-sm leading-snug">{u.message}</p>
          </div>
        ))}
        {(!thread || thread.length === 0) && (
          <div className="text-center text-gray-400 text-sm py-6 flex flex-col items-center gap-1">
            <MessageSquare className="h-5 w-5 opacity-30" />
            <span>No updates posted yet</span>
          </div>
        )}
      </div>

      {/* Post update bar */}
      {emergency.status === "active" && (
        <div className="p-3 border-t bg-white flex gap-2">
          <Select value={updateType} onValueChange={setUpdateType}>
            <SelectTrigger className="w-24 text-xs h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="note">Note</SelectItem>
            </SelectContent>
          </Select>
          <Input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Post to incident thread..."
            className="flex-1 text-sm h-9"
            onKeyDown={e => {
              if (e.key === "Enter" && msg.trim()) {
                e.preventDefault();
                postUpdate.mutate({ message: msg.trim(), updateType });
              }
            }}
          />
          <button onClick={() => msg.trim() && postUpdate.mutate({ message: msg.trim(), updateType })}
            disabled={!msg.trim() || postUpdate.isPending}
            className="px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40 transition-colors">
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── missing child modal ──────────────────────────────────────────────────────

function MissingChildModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [selectedChild, setSelectedChild] = useState<ChildInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MissingChildResult | null>(null);
  const { toast } = useToast();

  const { data: children } = useQuery({
    queryKey: ["children-list"],
    queryFn: () => apiGet<ChildInfo[]>("/children"),
    enabled: open,
  });

  const filtered = search.length >= 2
    ? (children || []).filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()))
    : [];

  const handleReset = () => {
    setSearch(""); setSelectedChild(null); setResult(null);
  };

  const handleClose = () => { handleReset(); onClose(); };

  const activate = async () => {
    setLoading(true);
    try {
      const res = await apiPost<MissingChildResult>("/emergencies/missing-child-search", {
        childId: selectedChild?.id,
        serviceDate: new Date().toISOString().split("T")[0],
      });
      setResult(res);
      toast({ title: "Missing Child Search Activated", description: `${res.teachersAlerted} teacher(s) alerted immediately.` });
    } catch {
      toast({ variant: "destructive", title: "Search activation failed. Use radio as backup." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
        <div className="bg-indigo-800 p-5 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2 text-lg font-black">
              <Search className="h-5 w-5" /> Missing Child Search Protocol
            </DialogTitle>
            <DialogDescription className="text-indigo-200 text-sm mt-1">
              Activates an L3 alert — all teachers are notified immediately to check their classes.
            </DialogDescription>
          </DialogHeader>
          {/* Escalation badge */}
          <div className="mt-3 flex flex-wrap gap-2">
            {LEVEL_CONFIG.L3.notified.map((n, i) => (
              <span key={i} className="flex items-center gap-1 bg-indigo-700 text-indigo-100 text-xs px-2 py-1 rounded-full font-semibold">
                {n.icon} {n.label} — {n.desc}
              </span>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Search for child (optional — leave blank to alert all teachers)</label>
                <Input
                  value={selectedChild ? `${selectedChild.firstName} ${selectedChild.lastName}` : search}
                  onChange={e => { setSearch(e.target.value); setSelectedChild(null); }}
                  placeholder="Type child's name..."
                  className="h-10"
                />
                {!selectedChild && filtered.length > 0 && (
                  <div className="border rounded-xl divide-y max-h-36 overflow-y-auto shadow-sm">
                    {filtered.slice(0, 6).map(c => (
                      <button key={c.id} onClick={() => { setSelectedChild(c); setSearch(""); }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-50 flex items-center justify-between">
                        <span className="font-semibold">{c.firstName} {c.lastName}</span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {c.currentClass?.name || "Unassigned"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedChild && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-indigo-900 text-sm">{selectedChild.firstName} {selectedChild.lastName}</p>
                      <p className="text-xs text-indigo-600 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Last class: {selectedChild.currentClass?.name || "Unassigned"}
                      </p>
                    </div>
                    <button onClick={() => setSelectedChild(null)} className="text-xs text-indigo-500 underline">Clear</button>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <p className="font-bold mb-1">⚠️ What happens when you activate:</p>
                <ul className="space-y-0.5 list-none">
                  <li>• All active teachers receive an immediate in-app alert</li>
                  <li>• Admin and super admin are notified simultaneously</li>
                  <li>• Last known location (from check-in records) is displayed</li>
                  <li>• A full incident log is created for safeguarding records</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button onClick={handleClose}
                  className="flex-1 py-3 border rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                <button onClick={activate} disabled={loading}
                  className="flex-1 py-3 bg-indigo-800 hover:bg-indigo-900 text-white text-sm font-black rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? (
                    <><span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Activating...</>
                  ) : (
                    <><Search className="h-4 w-4" /> Activate Search</>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* Confirmation */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <p className="font-black text-green-800 flex items-center gap-2 text-base">
                  <CheckCircle className="h-5 w-5" /> Search Protocol Activated
                </p>
                <p className="text-green-700 text-sm mt-1">{result.message}</p>
                <div className="mt-2 flex gap-3">
                  <div className="text-center">
                    <p className="text-2xl font-black text-green-800">{result.teachersAlerted}</p>
                    <p className="text-xs text-green-600">teachers alerted</p>
                  </div>
                </div>
              </div>

              {/* Child info */}
              {result.childInfo && (
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-2">Searching For</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-800 font-black text-sm">
                      {result.childInfo.firstName[0]}{result.childInfo.lastName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{result.childInfo.firstName} {result.childInfo.lastName}</p>
                      <p className="text-xs text-gray-500">
                        Registered class: {result.childInfo.currentClass?.name || "Unassigned"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Last known location */}
              {result.lastKnownLocation ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> Last Known Location
                  </p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Service date</span>
                      <span className="font-semibold">{result.lastKnownLocation.serviceDate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Check-in time</span>
                      <span className="font-semibold">
                        {result.lastKnownLocation.checkInTime
                          ? format(new Date(result.lastKnownLocation.checkInTime), "h:mm a")
                          : "Recorded"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Status at check-in</span>
                      <Badge className="capitalize bg-amber-100 text-amber-800 border-amber-300">
                        {result.lastKnownLocation.status}
                      </Badge>
                    </div>
                    {result.lastKnownLocation.checkOutTime && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Checked out</span>
                        <span className="font-semibold text-orange-700">
                          {format(new Date(result.lastKnownLocation.checkOutTime), "h:mm a")}
                        </span>
                      </div>
                    )}
                  </div>
                  {!result.lastKnownLocation.checkOutTime && (
                    <p className="mt-2 text-xs text-amber-700 font-semibold">
                      ✓ Child was checked in and has NOT been checked out — still expected to be on premises.
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-gray-50 border rounded-xl text-sm text-gray-500 text-center">
                  No check-in record found for today — child may not have been registered at drop-off.
                </div>
              )}

              <p className="text-xs text-gray-500 text-center">
                Keep this screen open. Teachers will check their classes and report to admin.
              </p>
              <button onClick={handleClose}
                className="w-full py-3 bg-indigo-800 text-white text-sm font-bold rounded-xl">
                Close — Continue monitoring
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── trigger dialog ───────────────────────────────────────────────────────────

function TriggerDialog({
  open, onClose, defaultType, children,
}: {
  open: boolean; onClose: () => void; defaultType: string;
  children: ChildInfo[];
}) {
  const [type, setType] = useState(defaultType);
  const [level, setLevel] = useState("L1");
  const [description, setDescription] = useState("");
  const [childId, setChildId] = useState<string>("none");
  const { toast } = useToast();
  const qc = useQueryClient();
  const triggerMutation = useTriggerEmergency();

  useEffect(() => {
    setType(defaultType);
    // Auto-suggest L3 for missing child
    if (defaultType === "missing_child") setLevel("L3");
    else setLevel("L1");
    setChildId("none");
    setDescription("");
  }, [defaultType, open]);

  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.L1;

  const handleTrigger = async () => {
    if (!type) { toast({ variant: "destructive", title: "Select emergency type" }); return; }
    try {
      await triggerMutation.mutateAsync({
        data: {
          type: type as "medical" | "missing_child" | "fire_evacuation" | "security" | "general",
          level: level as "L1" | "L2" | "L3" | "L4",
          description: description || `${type.replace(/_/g, " ")} emergency triggered`,
          ...(childId !== "none" ? { childId: Number(childId) } : {}),
        }
      });
      qc.invalidateQueries({ queryKey: ["emergencies-all"] });
      onClose();
      toast({ variant: "destructive", title: "⚠️ EMERGENCY TRIGGERED", description: `${cfg.notified.map(n => n.label).join(" + ")} notified.` });
    } catch {
      toast({ variant: "destructive", title: "Failed to trigger. Use radio if this persists." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="border-red-500 border-[3px] sm:max-w-[480px] rounded-3xl p-0 overflow-hidden shadow-2xl bg-white">
        <div className="bg-red-600 p-5 text-white text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2 animate-pulse" />
          <DialogTitle className="text-xl font-black tracking-wider uppercase">CONFIRM EMERGENCY</DialogTitle>
          <DialogDescription className="text-red-100 text-sm">This will trigger an alert immediately based on the selected level.</DialogDescription>
        </div>

        <div className="p-5 space-y-4 bg-red-50/20">
          {/* Type */}
          <div className="flex items-center justify-between bg-red-50 p-3 rounded-xl border border-red-100">
            <span className="text-sm font-bold text-red-800">TYPE</span>
            <span className="uppercase font-black text-red-600 flex items-center gap-1.5">
              <EmergencyIcon type={type} className="h-4 w-4" />
              {type.replace(/_/g, " ")}
            </span>
          </div>

          {/* Level selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Severity Level</label>
            <Select value={level} onValueChange={v => setLevel(v)}>
              <SelectTrigger className="border-red-200 rounded-xl h-11 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="L1">L1 — Local Area (Staff only)</SelectItem>
                <SelectItem value="L2">L2 — Department (Staff + Affected Parents)</SelectItem>
                <SelectItem value="L3">L3 — Building-Wide (Staff + All Checked-In Parents)</SelectItem>
                <SelectItem value="L4">L4 — CRITICAL FULL EVACUATION (Everyone)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Who gets notified */}
          <div className={`rounded-xl border p-3 ${cfg.bg} ${cfg.border}`}>
            <p className={`text-xs font-bold ${cfg.color} mb-2 flex items-center gap-1`}>
              <Radio className="h-3.5 w-3.5" /> Who will be notified at {level}:
            </p>
            <div className="flex flex-wrap gap-2">
              {cfg.notified.map((n, i) => (
                <div key={i} className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white/70 border ${cfg.border} ${cfg.color}`}>
                  {n.icon} {n.label}
                  <span className="font-normal opacity-70">— {n.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Child selector (optional) */}
          {children.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                Linked Child <span className="font-normal text-gray-400">(optional — required for Missing Child)</span>
              </label>
              <Select value={childId} onValueChange={setChildId}>
                <SelectTrigger className="rounded-xl h-10 bg-white border-gray-200"><SelectValue placeholder="Select child (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific child</SelectItem>
                  {children.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.firstName} {c.lastName} {c.currentClass ? `— ${c.currentClass.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Details</label>
            <Textarea placeholder="Where? Who? What is happening?" value={description}
              onChange={e => setDescription(e.target.value)}
              className="border-red-200 rounded-xl min-h-[70px] resize-none bg-white text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose}
              className="h-12 rounded-xl text-gray-600 font-bold border border-gray-200 bg-white hover:bg-gray-50">
              CANCEL
            </button>
            <button type="button" onClick={handleTrigger} disabled={triggerMutation.isPending}
              className="h-12 rounded-xl text-white font-black bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 disabled:opacity-50">
              {triggerMutation.isPending ? "SENDING..." : "SOUND ALARM"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function Emergencies() {
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [triggerType, setTriggerType] = useState<string>("general");
  const [showDetailId, setShowDetailId] = useState<number | null>(null);
  const [showMissingChild, setShowMissingChild] = useState(false);

  const { data: allEmergencies, isLoading } = useQuery({
    queryKey: ["emergencies-all"],
    queryFn: () => apiGet<Emergency[]>("/emergencies"),
    refetchInterval: 12000,
  });

  const { data: children } = useQuery({
    queryKey: ["children-list"],
    queryFn: () => apiGet<ChildInfo[]>("/children"),
  });

  const { data: detailData } = useQuery({
    queryKey: ["emergency-detail", showDetailId],
    queryFn: () => showDetailId ? apiGet<Emergency & { updates: EmergencyUpdate[] }>(`/emergencies/${showDetailId}`) : null,
    enabled: !!showDetailId,
    refetchInterval: 6000,
  });

  const active = (allEmergencies || []).filter(e => e.status === "active");
  const monitoring = (allEmergencies || []).filter(e => e.status === "monitoring");
  const history = (allEmergencies || []).filter(e => e.status === "resolved");

  const openTrigger = (type: string) => { setTriggerType(type); setTriggerOpen(true); };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <AlertTriangle className="h-7 w-7 text-red-600" /> Emergency Management
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Tiered L1–L4 escalation · Live incident thread · Missing child protocol
          </p>
        </div>
        <button onClick={() => setShowMissingChild(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-800 hover:bg-indigo-900 text-white text-sm font-bold rounded-xl transition-colors whitespace-nowrap shadow-sm">
          <Search className="h-4 w-4" /> Missing Child Protocol
        </button>
      </div>

      {/* Quick-trigger buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { t: "medical", label: "Medical", Icon: HeartPulse, from: "#ef4444", to: "#e11d48" },
          { t: "missing_child", label: "Missing Child", Icon: BadgeAlert, from: "#1e40af", to: "#1e3a8a" },
          { t: "fire_evacuation", label: "Fire / Evac", Icon: Flame, from: "#f97316", to: "#dc2626" },
          { t: "security", label: "Security", Icon: ShieldAlert, from: "#334155", to: "#0f172a" },
        ].map(({ t, label, Icon, from, to }) => (
          <button key={t}
            className="h-32 rounded-2xl flex flex-col items-center justify-center gap-2 text-white font-bold transition-all hover:scale-[1.03] shadow-lg active:scale-95 group"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
            onClick={() => openTrigger(t)}
            data-testid={`btn-trigger-${t}`}>
            <div className="p-2.5 bg-white/20 rounded-full group-hover:bg-white/30 transition-colors">
              <Icon className="h-6 w-6" />
            </div>
            <span className="text-sm tracking-wide">{label}</span>
            <span className="text-xs opacity-60 font-normal">Tap to trigger</span>
          </button>
        ))}
      </div>

      {/* Active emergencies */}
      {active.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <h2 className="text-lg font-bold text-red-700">Active Emergencies ({active.length})</h2>
          </div>
          {active.map(em => {
            const cfg = LEVEL_CONFIG[em.level] ?? LEVEL_CONFIG.L4;
            return (
              <div key={em.id} className="bg-red-50 rounded-2xl border-2 border-red-200 overflow-hidden">
                <div className="flex">
                  <div className={`w-16 flex flex-col items-center justify-center p-3 bg-gradient-to-br ${COLORS[em.type] || "from-red-600 to-red-800"} text-white flex-shrink-0`}>
                    <EmergencyIcon type={em.type} className="h-6 w-6 mb-1" />
                    <span className="text-xs font-black">{em.level}</span>
                  </div>
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between mb-1 gap-2 flex-wrap">
                      <h3 className="font-black text-red-900 uppercase text-sm tracking-wide">{em.type.replace(/_/g, " ")}</h3>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-red-400 flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />{format(new Date(em.createdAt), "h:mm a")}
                        </span>
                      </div>
                    </div>
                    <p className="text-red-800 text-sm mb-1">{em.description}</p>
                    {em.child && (
                      <p className="text-xs text-red-600 mb-2 flex items-center gap-1">
                        <BadgeAlert className="h-3 w-3" /> {em.child.firstName} {em.child.lastName}
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <button onClick={() => setShowDetailId(em.id)}
                        className="flex items-center gap-1 text-xs font-bold text-red-700 hover:text-red-900 underline underline-offset-2">
                        <MessageSquare className="h-3.5 w-3.5" /> Open Thread & Manage <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-xs text-red-400">
                        Notifying: {cfg.notified.map(n => n.label).join(" + ")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Monitoring */}
      {monitoring.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-yellow-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            Under Monitoring ({monitoring.length})
          </h2>
          {monitoring.map(em => (
            <div key={em.id}
              className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-yellow-100 transition-colors"
              onClick={() => setShowDetailId(em.id)}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${COLORS[em.type] || "from-gray-500 to-gray-700"} text-white flex-shrink-0`}>
                  <EmergencyIcon type={em.type} className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 capitalize">{em.type.replace(/_/g, " ")} · {em.level}</p>
                  <p className="text-xs text-gray-500">{format(new Date(em.createdAt), "MMM d, h:mm a")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">Monitoring</Badge>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clear state */}
      {active.length === 0 && monitoring.length === 0 && !isLoading && (
        <div className="bg-white rounded-2xl p-10 border flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-3">
            <Shield className="h-7 w-7 text-green-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">System Clear</h3>
          <p className="text-gray-500 text-sm">No active or monitored emergencies across the facility.</p>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 text-sm">Resolved Incidents ({history.length})</h2>
          </div>
          <div className="divide-y">
            {history.slice(0, 20).map(em => (
              <div key={em.id}
                className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setShowDetailId(em.id)}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${COLORS[em.type] || "from-gray-500 to-gray-700"} text-white flex-shrink-0`}>
                    <EmergencyIcon type={em.type} className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 capitalize">{em.type.replace(/_/g, " ")} · {em.level}</p>
                    <p className="text-xs text-gray-500">{format(new Date(em.createdAt), "MMM d, yyyy h:mm a")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Resolved</Badge>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trigger dialog */}
      <TriggerDialog
        open={triggerOpen}
        onClose={() => setTriggerOpen(false)}
        defaultType={triggerType}
        children={children || []}
      />

      {/* Incident thread dialog */}
      <Dialog open={!!showDetailId} onOpenChange={() => setShowDetailId(null)}>
        <DialogContent className="sm:max-w-xl rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          {detailData ? (
            <EmergencyThread emergency={detailData} onClose={() => setShowDetailId(null)} />
          ) : (
            <div className="p-10 text-center text-gray-400 flex flex-col items-center gap-2">
              <span className="h-6 w-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              Loading incident details...
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Missing child modal */}
      <MissingChildModal open={showMissingChild} onClose={() => setShowMissingChild(false)} />
    </div>
  );
}
