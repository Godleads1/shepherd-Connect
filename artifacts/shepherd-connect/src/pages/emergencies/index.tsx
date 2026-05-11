import { useState, useEffect, useRef } from "react";
import { useTriggerEmergency, useListEmergencies } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Flame, ShieldAlert, HeartPulse, Shield, BadgeAlert, ChevronRight, Search, CheckCircle, MessageSquare, TrendingUp, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiPut } from "@/lib/api-call";
import { format } from "date-fns";

type EmergencyUpdate = {
  id: number; emergencyId: number; userId: number; message: string;
  updateType: "update" | "escalation" | "all_clear" | "note";
  createdAt: string;
  user: { id: number; firstName: string; lastName: string; role: string } | null;
};

type Emergency = {
  id: number; type: string; level: string; status: string; description: string;
  childId: number | null; triggeredBy: number; createdAt: string;
  resolvedAt: string | null; resolutionNotes: string | null;
  child: any; triggeredByUser: any; updates?: EmergencyUpdate[];
};

const COLORS: Record<string, string> = {
  medical: "from-red-500 to-rose-600",
  fire_evacuation: "from-orange-500 to-red-600",
  security: "from-slate-700 to-slate-900",
  missing_child: "from-indigo-700 to-blue-900",
};

const UPDATE_COLORS: Record<string, string> = {
  update: "bg-blue-50 border-blue-200 text-blue-900",
  escalation: "bg-red-50 border-red-200 text-red-900",
  all_clear: "bg-green-50 border-green-200 text-green-900",
  note: "bg-gray-50 border-gray-200 text-gray-800",
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

function EmergencyThread({ emergency, onClose }: { emergency: Emergency; onClose: () => void }) {
  const [msg, setMsg] = useState("");
  const [updateType, setUpdateType] = useState("update");
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [showAllClear, setShowAllClear] = useState(false);
  const [allClearNotes, setAllClearNotes] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();
  const threadRef = useRef<HTMLDivElement>(null);

  const { data: thread } = useQuery({
    queryKey: ["emergency-updates", emergency.id],
    queryFn: () => apiGet<EmergencyUpdate[]>(`/emergencies/${emergency.id}/updates`),
    refetchInterval: 8000,
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
  });

  const escalate = useMutation({
    mutationFn: () => apiPut(`/emergencies/${emergency.id}/escalate`, { reason: escalateReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emergencies-all"] });
      setShowEscalate(false);
      toast({ title: "Emergency escalated. All personnel notified." });
      onClose();
    },
    onError: () => toast({ variant: "destructive", title: "Escalation failed" }),
  });

  const allClear = useMutation({
    mutationFn: () => apiPost(`/emergencies/${emergency.id}/all-clear`, { notes: allClearNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emergencies-all"] });
      setShowAllClear(false);
      toast({ title: "ALL CLEAR issued. Emergency resolved." });
      onClose();
    },
    onError: () => toast({ variant: "destructive", title: "Failed to issue all clear" }),
  });

  const levelNext: Record<string, string> = { L1: "L2", L2: "L3", L3: "L4", L4: "L4 (max)" };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={`p-4 text-white bg-gradient-to-br ${COLORS[emergency.type] || "from-red-600 to-red-800"}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <EmergencyIcon type={emergency.type} />
            <span className="font-black text-lg uppercase">{emergency.type.replace(/_/g, " ")}</span>
          </div>
          <div className="flex gap-2">
            <Badge className="bg-white/20 text-white border-white/30">LVL {emergency.level}</Badge>
            <Badge className={emergency.status === "active" ? "bg-red-200 text-red-900" : "bg-green-200 text-green-900"}>
              {emergency.status.toUpperCase()}
            </Badge>
          </div>
        </div>
        <p className="text-white/90 text-sm">{emergency.description}</p>
        <p className="text-white/60 text-xs mt-1">
          {format(new Date(emergency.createdAt), "MMM d, h:mm a")} · by {emergency.triggeredByUser?.firstName} {emergency.triggeredByUser?.lastName}
        </p>
      </div>

      {emergency.status === "active" && (
        <div className="flex gap-2 p-3 border-b bg-gray-50">
          <button onClick={() => setShowEscalate(!showEscalate)}
            className="flex-1 flex items-center justify-center gap-1 py-2 px-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg">
            <TrendingUp className="h-3.5 w-3.5" /> Escalate → {levelNext[emergency.level]}
          </button>
          <button onClick={() => setShowAllClear(!showAllClear)}
            className="flex-1 flex items-center justify-center gap-1 py-2 px-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg">
            <CheckCircle className="h-3.5 w-3.5" /> Issue ALL CLEAR
          </button>
        </div>
      )}

      {showEscalate && (
        <div className="p-3 bg-orange-50 border-b border-orange-200 space-y-2">
          <Input placeholder="Reason (optional)" value={escalateReason} onChange={e => setEscalateReason(e.target.value)} className="text-sm h-8" />
          <div className="flex gap-2">
            <button onClick={() => setShowEscalate(false)} className="flex-1 py-1.5 text-xs border rounded-lg hover:bg-white">Cancel</button>
            <button onClick={() => escalate.mutate()} disabled={escalate.isPending}
              className="flex-1 py-1.5 text-xs bg-orange-500 text-white font-bold rounded-lg disabled:opacity-50">
              {escalate.isPending ? "..." : "Confirm Escalate"}
            </button>
          </div>
        </div>
      )}
      {showAllClear && (
        <div className="p-3 bg-green-50 border-b border-green-200 space-y-2">
          <Input placeholder="Resolution notes (optional)" value={allClearNotes} onChange={e => setAllClearNotes(e.target.value)} className="text-sm h-8" />
          <div className="flex gap-2">
            <button onClick={() => setShowAllClear(false)} className="flex-1 py-1.5 text-xs border rounded-lg hover:bg-white">Cancel</button>
            <button onClick={() => allClear.mutate()} disabled={allClear.isPending}
              className="flex-1 py-1.5 text-xs bg-green-600 text-white font-bold rounded-lg disabled:opacity-50">
              {allClear.isPending ? "..." : "Issue ALL CLEAR"}
            </button>
          </div>
        </div>
      )}

      <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-2 max-h-56">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Incident Thread</p>
        {(thread || []).map(u => (
          <div key={u.id} className={`p-2.5 rounded-lg border text-sm ${UPDATE_COLORS[u.updateType] || UPDATE_COLORS.note}`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-semibold text-xs">{u.user?.firstName} {u.user?.lastName}</span>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs px-1 py-0">{u.updateType.replace("_", " ")}</Badge>
                <span className="text-xs opacity-60">{format(new Date(u.createdAt), "h:mm a")}</span>
              </div>
            </div>
            <p className="text-sm">{u.message}</p>
          </div>
        ))}
        {(!thread || thread.length === 0) && (
          <div className="text-center text-gray-400 text-sm py-4">No updates yet</div>
        )}
      </div>

      {emergency.status === "active" && (
        <div className="p-3 border-t bg-white flex gap-2">
          <Select value={updateType} onValueChange={setUpdateType}>
            <SelectTrigger className="w-28 text-xs h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="note">Note</SelectItem>
            </SelectContent>
          </Select>
          <Input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Post update..."
            className="flex-1 text-sm h-9"
            onKeyDown={e => { if (e.key === "Enter" && msg.trim()) { e.preventDefault(); postUpdate.mutate({ message: msg.trim(), updateType }); }}}
          />
          <button onClick={() => msg.trim() && postUpdate.mutate({ message: msg.trim(), updateType })}
            disabled={!msg.trim() || postUpdate.isPending}
            className="px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function MissingChildModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const { data: children } = useQuery({
    queryKey: ["children-list"],
    queryFn: () => apiGet<any[]>("/children"),
    enabled: open,
  });

  const filtered = search.length >= 2
    ? (children || []).filter((c: any) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()))
    : [];

  const activate = async (childId?: number) => {
    setLoading(true);
    try {
      const res = await apiPost<any>("/emergencies/missing-child-search", {
        childId,
        serviceDate: new Date().toISOString().split("T")[0],
      });
      setResult(res);
      toast({ title: "Search activated", description: `${res.teachersAlerted} teacher(s) alerted.` });
    } catch {
      toast({ variant: "destructive", title: "Search activation failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
        <div className="bg-indigo-700 p-5 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Search className="h-5 w-5" /> Missing Child Search Protocol
            </DialogTitle>
            <DialogDescription className="text-indigo-200 text-sm">
              All teachers will be alerted immediately to check their classes.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search child name (optional)..." />
              {filtered.length > 0 && (
                <div className="border rounded-lg divide-y max-h-28 overflow-y-auto">
                  {filtered.slice(0, 5).map((c: any) => (
                    <button key={c.id} onClick={() => setSearch(`${c.firstName} ${c.lastName}`)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                      {c.firstName} {c.lastName} · {c.currentClass?.name || "Unassigned"}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={() => {
                  const found = (children || []).find((c: any) =>
                    `${c.firstName} ${c.lastName}`.toLowerCase() === search.toLowerCase());
                  activate(found?.id);
                }} disabled={loading}
                  className="flex-1 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-bold rounded-xl disabled:opacity-50">
                  {loading ? "Activating..." : "Activate Search"}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <p className="font-bold text-green-800 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Search Activated</p>
                <p className="text-green-700 text-sm mt-1">{result.message}</p>
              </div>
              {result.childInfo && (
                <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-700">
                  Searching for: <strong>{result.childInfo.firstName} {result.childInfo.lastName}</strong>
                </div>
              )}
              <button onClick={onClose} className="w-full py-3 bg-indigo-700 text-white text-sm font-bold rounded-xl">Close</button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Emergencies() {
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [type, setType] = useState<string>("");
  const [level, setLevel] = useState<string>("L1");
  const [description, setDescription] = useState("");
  const [showDetailId, setShowDetailId] = useState<number | null>(null);
  const [showMissingChild, setShowMissingChild] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: allEmergencies, isLoading } = useQuery({
    queryKey: ["emergencies-all"],
    queryFn: () => apiGet<Emergency[]>("/emergencies"),
    refetchInterval: 15000,
  });

  const triggerMutation = useTriggerEmergency();

  const { data: detailData } = useQuery({
    queryKey: ["emergency-detail", showDetailId],
    queryFn: () => showDetailId ? apiGet<Emergency & { updates: EmergencyUpdate[] }>(`/emergencies/${showDetailId}`) : null,
    enabled: !!showDetailId,
    refetchInterval: 8000,
  });

  const handleTrigger = async () => {
    if (!type) { toast({ variant: "destructive", title: "Select emergency type" }); return; }
    try {
      await triggerMutation.mutateAsync({
        data: { type: type as any, level: level as any, description: description || `${type} emergency triggered` }
      });
      qc.invalidateQueries({ queryKey: ["emergencies-all"] });
      setTriggerOpen(false); setType(""); setDescription("");
      toast({ variant: "destructive", title: "EMERGENCY TRIGGERED", description: "All staff and parents notified." });
    } catch {
      toast({ variant: "destructive", title: "Failed. Use radio if this persists." });
    }
  };

  const active = (allEmergencies || []).filter(e => e.status === "active");
  const history = (allEmergencies || []).filter(e => e.status !== "active");

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-600" /> Emergency Management
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Trigger, escalate, and resolve incidents with live thread updates.</p>
        </div>
        <button onClick={() => setShowMissingChild(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-bold rounded-xl transition-colors whitespace-nowrap">
          <Search className="h-4 w-4" /> Missing Child Protocol
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { t: "medical", label: "Medical", Icon: HeartPulse, from: "#ef4444", to: "#e11d48" },
          { t: "missing_child", label: "Missing Child", Icon: BadgeAlert, from: "#1a237e", to: "#1565c0" },
          { t: "fire_evacuation", label: "Fire / Evac", Icon: Flame, from: "#f97316", to: "#dc2626" },
          { t: "security", label: "Security", Icon: ShieldAlert, from: "#334155", to: "#0f172a" },
        ].map(({ t, label, Icon, from, to }) => (
          <button key={t}
            className="h-32 rounded-2xl flex flex-col items-center justify-center gap-2 text-white font-bold transition-all hover:scale-[1.02] shadow-lg active:scale-95"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
            onClick={() => { setType(t); setTriggerOpen(true); }}
            data-testid={`btn-trigger-${t}`}>
            <div className="p-2.5 bg-white/20 rounded-full"><Icon className="h-6 w-6" /></div>
            <span className="text-sm tracking-wide">{label}</span>
          </button>
        ))}
      </div>

      {active.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <h2 className="text-lg font-bold text-red-700">Active Emergencies ({active.length})</h2>
          </div>
          {active.map(em => (
            <div key={em.id} className="bg-red-50 rounded-2xl border-2 border-red-200 overflow-hidden flex">
              <div className={`w-16 flex flex-col items-center justify-center p-3 bg-gradient-to-br ${COLORS[em.type] || "from-red-600 to-red-800"} text-white flex-shrink-0`}>
                <EmergencyIcon type={em.type} className="h-6 w-6 mb-1" />
                <span className="text-xs font-bold">{em.level}</span>
              </div>
              <div className="flex-1 p-4">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-black text-red-900 uppercase text-sm tracking-wide">{em.type.replace(/_/g, " ")}</h3>
                  <div className="flex items-center gap-1 text-xs text-red-500">
                    <Clock className="h-3 w-3" />{format(new Date(em.createdAt), "h:mm a")}
                  </div>
                </div>
                <p className="text-red-800 text-sm mb-2">{em.description}</p>
                <button onClick={() => setShowDetailId(em.id)}
                  className="flex items-center gap-1 text-xs font-bold text-red-700 hover:text-red-900 underline underline-offset-2">
                  <MessageSquare className="h-3.5 w-3.5" /> Open Thread & Manage <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {active.length === 0 && !isLoading && (
        <div className="bg-white rounded-2xl p-10 border flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-3">
            <Shield className="h-7 w-7 text-green-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">System Clear</h3>
          <p className="text-gray-500 text-sm">No active emergencies across the facility.</p>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-700 text-sm">Incident History ({history.length})</h2>
          </div>
          <div className="divide-y">
            {history.slice(0, 15).map(em => (
              <div key={em.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                onClick={() => setShowDetailId(em.id)}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${COLORS[em.type] || "from-red-600 to-red-800"} text-white flex-shrink-0`}>
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

      <Dialog open={triggerOpen} onOpenChange={setTriggerOpen}>
        <DialogContent className="border-red-500 border-[3px] sm:max-w-[440px] rounded-3xl p-0 overflow-hidden shadow-2xl bg-white">
          <div className="bg-red-600 p-5 text-white text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-2 animate-pulse" />
            <DialogTitle className="text-xl font-black tracking-wider uppercase">CONFIRM EMERGENCY</DialogTitle>
            <DialogDescription className="text-red-100 text-sm">This will trigger a site-wide alert immediately.</DialogDescription>
          </div>
          <div className="p-5 space-y-4 bg-red-50/30">
            <div className="flex items-center justify-between bg-red-50 p-3 rounded-xl border border-red-100">
              <span className="text-sm font-bold text-red-800">TYPE</span>
              <span className="uppercase font-black text-red-600">{type.replace(/_/g, " ")}</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Severity Level</label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="border-red-200 rounded-xl h-11 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="L1">L1 — Local Area Only</SelectItem>
                  <SelectItem value="L2">L2 — Zone Level</SelectItem>
                  <SelectItem value="L3">L3 — Entire Building</SelectItem>
                  <SelectItem value="L4">L4 — FULL EVACUATION</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Details</label>
              <Textarea placeholder="Where? Who? What is happening?" value={description}
                onChange={e => setDescription(e.target.value)}
                className="border-red-200 rounded-xl min-h-[80px] resize-none bg-white" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" className="h-12 rounded-xl text-gray-600 font-bold border border-gray-200 bg-white hover:bg-gray-50"
                onClick={() => setTriggerOpen(false)}>CANCEL</button>
              <button type="button"
                className="h-12 rounded-xl text-white font-black bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 disabled:opacity-50"
                onClick={handleTrigger} disabled={triggerMutation.isPending}>
                {triggerMutation.isPending ? "SENDING..." : "SOUND ALARM"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDetailId} onOpenChange={() => setShowDetailId(null)}>
        <DialogContent className="sm:max-w-xl rounded-2xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
          {detailData ? (
            <EmergencyThread emergency={detailData} onClose={() => setShowDetailId(null)} />
          ) : (
            <div className="p-10 text-center text-gray-400">Loading...</div>
          )}
        </DialogContent>
      </Dialog>

      <MissingChildModal open={showMissingChild} onClose={() => setShowMissingChild(false)} />
    </div>
  );
}
