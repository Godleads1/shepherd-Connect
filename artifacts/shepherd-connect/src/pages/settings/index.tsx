import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiDelete, apiPut } from "@/lib/api-call";
import {
  Smartphone, Wifi, WifiOff, RefreshCw, Loader2, LogOut,
  CheckCircle2, Settings2, Copy, Check, QrCode, Phone,
  Clock, Megaphone, Save, MapPin, ExternalLink,
  Music, Merge, Trash2, Plus, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

type WaStatus = "disconnected" | "connecting" | "pairing_code_ready" | "qr_ready" | "connected";

interface WaState {
  status: WaStatus;
  qr: string | null;
  pairingCode: string | null;
  connected: boolean;
}

type ConnectMode = "phone" | "qr";

interface GeneralSettings {
  serviceSlot1Label: string;
  serviceSlot1Time: string;
  serviceSlot2Label: string;
  serviceSlot2Time: string;
  supportPhone: string;
  announcementBanner: string;
}

interface LocationSettings {
  churchName: string;
  address: string;
  mapsUrl: string;
}

function LocationSettingsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<LocationSettings>({
    churchName: "RCCG City of David",
    address: "Victoria Island, Lagos",
    mapsUrl: "https://maps.app.goo.gl/uvgtpVETsCeqkzmDA",
  });
  const [loadedAt, setLoadedAt] = useState<string | null>(null); // updatedAt snapshot for optimistic lock
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    apiGet<LocationSettings & { updatedAt?: string }>("/settings/location")
      .then(data => {
        const { updatedAt, ...rest } = data as any;
        setSettings(rest);
        setLoadedAt(updatedAt ?? null);
      })
      .catch(() => {
        toast({ variant: "destructive", title: "Could not load location settings", description: "Check your connection and try refreshing." });
      })
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await apiPut<LocationSettings & { updatedAt?: string }>("/settings/location", {
        ...settings,
        ...(loadedAt ? { currentUpdatedAt: loadedAt } : {}),
      });
      const { updatedAt, ...rest } = updated as any;
      setSettings(rest);
      setLoadedAt(updatedAt ?? null);
      // Refresh LocationBanner and CollectionNotice everywhere
      queryClient.invalidateQueries({ queryKey: ["settings-location"] });
      toast({ title: "Location saved", description: "Pickup location has been updated." });
    } catch (e: any) {
      if (e?.status === 409 || e?.message?.includes("someone else")) {
        toast({
          variant: "destructive",
          title: "Settings changed by another admin",
          description: "Someone else saved new settings while you were editing. Reloading the latest version.",
        });
        reload();
      } else {
        toast({ variant: "destructive", title: "Could not save location", description: e.message });
      }
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof LocationSettings, value: string) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  return (
    <div className="border rounded-2xl bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-gray-50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">Pickup Location</p>
          <p className="text-xs text-gray-500">Shown on the parent dashboard and collection notices</p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-5">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Church Name</label>
              <Input
                value={settings.churchName}
                onChange={e => set("churchName", e.target.value)}
                placeholder="e.g. RCCG City of David"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Address</label>
              <Input
                value={settings.address}
                onChange={e => set("address", e.target.value)}
                placeholder="e.g. Victoria Island, Lagos"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-gray-600">Google Maps URL</label>
                {settings.mapsUrl && (
                  <a
                    href={settings.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <Input
                type="url"
                value={settings.mapsUrl}
                onChange={e => set("mapsUrl", e.target.value)}
                placeholder="https://maps.app.goo.gl/…"
              />
              <p className="text-xs text-gray-400">
                The "Get Directions" link on the parent dashboard and collection notices.
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4 mr-2" /> Save Location</>}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function GeneralSettingsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<GeneralSettings>({
    serviceSlot1Label: "1st Service",
    serviceSlot1Time: "7:00 – 10:00 AM",
    serviceSlot2Label: "2nd Service",
    serviceSlot2Time: "10:30 AM onwards",
    supportPhone: "",
    announcementBanner: "",
  });
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    apiGet<GeneralSettings & { updatedAt?: string }>("/settings/general")
      .then(data => {
        const { updatedAt, ...rest } = data as any;
        setSettings(rest);
        setLoadedAt(updatedAt ?? null);
      })
      .catch(() => {
        toast({ variant: "destructive", title: "Could not load church settings", description: "Check your connection and try refreshing." });
      })
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await apiPut<GeneralSettings & { updatedAt?: string }>("/settings/general", {
        ...settings,
        ...(loadedAt ? { currentUpdatedAt: loadedAt } : {}),
      });
      const { updatedAt, ...rest } = updated as any;
      setSettings(rest);
      setLoadedAt(updatedAt ?? null);
      // Invalidate the cached query so components using useGeneralSettings() pick up changes
      queryClient.invalidateQueries({ queryKey: ["general-settings"] });
      toast({ title: "Settings saved", description: "Church-wide settings have been updated." });
    } catch (e: any) {
      if (e?.status === 409 || e?.message?.includes("someone else")) {
        toast({
          variant: "destructive",
          title: "Settings changed by another admin",
          description: "Someone else saved new settings while you were editing. Reloading the latest version.",
        });
        reload();
      } else {
        toast({ variant: "destructive", title: "Could not save settings", description: e.message });
      }
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof GeneralSettings, value: string) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  return (
    <div className="border rounded-2xl bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-gray-50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-900 flex items-center justify-center">
          <Settings2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">General Settings</p>
          <p className="text-xs text-gray-500">Church-wide text shown throughout the app</p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Service times */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-blue-700" />
                <p className="text-sm font-semibold text-gray-800">Service Slots</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">1st Service — Label</label>
                  <Input
                    value={settings.serviceSlot1Label}
                    onChange={e => set("serviceSlot1Label", e.target.value)}
                    placeholder="e.g. 1st Service"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">1st Service — Time</label>
                  <Input
                    value={settings.serviceSlot1Time}
                    onChange={e => set("serviceSlot1Time", e.target.value)}
                    placeholder="e.g. 7:00 – 10:00 AM"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">2nd Service — Label</label>
                  <Input
                    value={settings.serviceSlot2Label}
                    onChange={e => set("serviceSlot2Label", e.target.value)}
                    placeholder="e.g. 2nd Service"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">2nd Service — Time</label>
                  <Input
                    value={settings.serviceSlot2Time}
                    onChange={e => set("serviceSlot2Time", e.target.value)}
                    placeholder="e.g. 10:30 AM onwards"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                These labels appear on the check-in screen's service selector.
              </p>
            </div>

            <div className="border-t" />

            {/* Support phone */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-4 h-4 text-blue-700" />
                <label className="text-sm font-semibold text-gray-800">Support Contact Number</label>
              </div>
              <Input
                type="tel"
                value={settings.supportPhone}
                onChange={e => set("supportPhone", e.target.value)}
                placeholder="e.g. 08012345678"
              />
              <p className="text-xs text-gray-400">
                Displayed on parent-facing help screens. Leave blank to hide.
              </p>
            </div>

            <div className="border-t" />

            {/* Announcement banner */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 mb-1">
                <Megaphone className="w-4 h-4 text-blue-700" />
                <label className="text-sm font-semibold text-gray-800">Announcement / Welcome Banner</label>
              </div>
              <Textarea
                value={settings.announcementBanner}
                onChange={e => set("announcementBanner", e.target.value)}
                placeholder="e.g. Welcome to our special anniversary service! Children's church is in Hall B today."
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-gray-400">
                Shown as a banner on the parent dashboard. Leave blank to hide.
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4 mr-2" /> Save General Settings</>}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Hall Session Card ──────────────────────────────────────────────────────

interface HallSession {
  id: number;
  serviceDate: string;
  serviceSlot: "7am" | "10:30am" | null;
}

function HallSessionCard() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<HallSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slot, setSlot] = useState<"both" | "7am" | "10:30am">("both");

  const today = new Date().toISOString().slice(0, 10);

  const reload = () => {
    setLoading(true);
    apiGet<HallSession[]>(`/hall-sessions?date=${today}`)
      .then(setSessions)
      .catch(() => toast({ variant: "destructive", title: "Could not load hall sessions" }))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const isActive = sessions.length > 0;

  const handleActivate = async () => {
    setSaving(true);
    try {
      await apiPost("/hall-sessions", {
        serviceDate: today,
        serviceSlot: slot === "both" ? null : slot,
      });
      toast({ title: "Hall session activated", description: "En-route notifications now reflect the hall session." });
      reload();
    } catch (e: any) {
      if (e?.status === 409) {
        toast({ variant: "destructive", title: "Already active", description: "A hall session for this slot is already set." });
      } else {
        toast({ variant: "destructive", title: "Could not activate", description: e.message });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await apiDelete(`/hall-sessions/${id}`);
      toast({ title: "Hall session removed" });
      reload();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not remove", description: e.message });
    }
  };

  const slotLabel = (s: "7am" | "10:30am" | null) =>
    s === "7am" ? "1st Service" : s === "10:30am" ? "2nd Service" : "Both Services";

  return (
    <div className="border rounded-2xl bg-white overflow-hidden">
      <div className="px-6 py-5 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Hall Session</p>
            <p className="text-xs text-gray-500">Children attend general hall before going to class</p>
          </div>
        </div>
        {isActive && <Badge className="bg-purple-100 text-purple-700 border-purple-200">Active Today</Badge>}
      </div>

      <div className="px-6 py-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <>
            {isActive ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Active sessions today — en-route messages will say children are in the general hall first.
                </p>
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-purple-900">{slotLabel(s.serviceSlot)}</p>
                      <p className="text-xs text-purple-600">Parents & teachers notified about the hall</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleRemove(s.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-gray-400">Remove when children have gone to their classes.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Mark this Sunday as having a hall session so parents aren't confused by en-route notifications before children reach their classes.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Which service?</label>
                  <div className="flex rounded-xl border overflow-hidden">
                    {(["both", "7am", "10:30am"] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setSlot(s)}
                        className={cn(
                          "flex-1 py-2 text-xs font-medium transition-colors",
                          slot === s ? "bg-purple-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50",
                        )}
                      >
                        {s === "both" ? "Both" : s === "7am" ? "1st (7am)" : "2nd (10:30am)"}
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={handleActivate} disabled={saving} className="w-full bg-purple-600 hover:bg-purple-700">
                  {saving
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Activating…</>
                    : <><Plus className="w-4 h-4 mr-2" /> Activate Hall Session</>}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Class Merge Card ───────────────────────────────────────────────────────

interface ClassItem { id: number; name: string; }
interface ClassMerge {
  id: number;
  sourceClassId: number;
  targetClassId: number;
  sourceClassName: string;
  targetClassName: string;
  serviceDate: string;
  serviceSlot: "7am" | "10:30am" | null;
}

function ClassMergeCard() {
  const { toast } = useToast();
  const [merges, setMerges] = useState<ClassMerge[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sourceId, setSourceId] = useState<number | "">("");
  const [targetId, setTargetId] = useState<number | "">("");
  const [mergeDate, setMergeDate] = useState(new Date().toISOString().slice(0, 10));

  const reload = () => {
    setLoading(true);
    Promise.all([
      apiGet<ClassMerge[]>(`/class-merges?date=${mergeDate}`),
      apiGet<ClassItem[]>("/classes"),
    ])
      .then(([m, c]) => { setMerges(m); setClasses(c); })
      .catch(() => toast({ variant: "destructive", title: "Could not load class data" }))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [mergeDate]);

  const handleAdd = async () => {
    if (!sourceId || !targetId) {
      toast({ variant: "destructive", title: "Select both classes" });
      return;
    }
    if (sourceId === targetId) {
      toast({ variant: "destructive", title: "A class cannot merge with itself" });
      return;
    }
    setSaving(true);
    try {
      await apiPost("/class-merges", { sourceClassId: sourceId, targetClassId: targetId, serviceDate: mergeDate });
      toast({ title: "Merge saved", description: "Pickup notifications will be rerouted to the host class." });
      setSourceId("");
      setTargetId("");
      reload();
    } catch (e: any) {
      if (e?.status === 409) {
        toast({ variant: "destructive", title: "Already merged", description: "This class is already merged on that date." });
      } else {
        toast({ variant: "destructive", title: "Could not save merge", description: e.message });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await apiDelete(`/class-merges/${id}`);
      toast({ title: "Merge removed" });
      reload();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not remove merge", description: e.message });
    }
  };

  return (
    <div className="border rounded-2xl bg-white overflow-hidden">
      <div className="px-6 py-5 border-b bg-gray-50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
          <Merge className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">Class Merges</p>
          <p className="text-xs text-gray-500">Route pickup notifications when classes share a room</p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-5">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <>
            {/* Date picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Sunday date</label>
              <Input
                type="date"
                value={mergeDate}
                onChange={e => setMergeDate(e.target.value)}
              />
            </div>

            {/* Existing merges for selected date */}
            {merges.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Active merges on {mergeDate}</p>
                {merges.map(m => (
                  <div key={m.id} className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-orange-900">{m.sourceClassName}</span>
                      <ChevronRight className="w-3 h-3 text-orange-400" />
                      <span className="text-sm font-medium text-orange-900">{m.targetClassName}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleRemove(m.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-gray-400">
                  Pickup messages for children in the left class go to the right class's teacher.
                </p>
              </div>
            )}

            {/* Add new merge */}
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-medium text-gray-600">Add a merge</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Absorbed class</label>
                  <select
                    value={sourceId}
                    onChange={e => setSourceId(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                  >
                    <option value="">Select class…</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Host class (room)</label>
                  <select
                    value={targetId}
                    onChange={e => setTargetId(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                  >
                    <option value="">Select class…</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                onClick={handleAdd}
                disabled={saving || !sourceId || !targetId}
                className="w-full bg-orange-500 hover:bg-orange-600"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                  : <><Plus className="w-4 h-4 mr-2" /> Add Merge</>}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [waState, setWaState] = useState<WaState>({
    status: "disconnected", qr: null, pairingCode: null, connected: false,
  });
  const [mode, setMode] = useState<ConnectMode>("phone");
  const [phone, setPhone] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await apiGet<WaState>("/whatsapp/status");
      setWaState(data);
    } catch { /* ignore */ }
  };

  // Poll fast (3 s) while connecting/pairing so the UI reacts quickly.
  // Once connected (or fully disconnected with no pending action), slow to 30 s
  // to avoid hammering the server unnecessarily.
  useEffect(() => {
    if (user?.role === "admin") return;

    const interval = ["connecting", "qr_ready", "pairing_code_ready"].includes(waState.status)
      ? 3000
      : 30000;
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, interval);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user?.role, waState.status]);

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin";
  const isSupport = user?.role === "support";
  const isStaff = isSuperAdmin || isAdmin || isSupport;

  if (!isStaff) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Access restricted to staff.</p>
      </div>
    );
  }

  const isIdle = waState.status === "disconnected";
  const isActive = !isIdle;

  const handleConnect = async () => {
    if (mode === "phone" && !phone.trim()) {
      toast({ variant: "destructive", title: "Enter your WhatsApp phone number first" });
      return;
    }
    setConnecting(true);
    try {
      await apiPost("/whatsapp/connect", mode === "phone" ? { phone: phone.trim() } : {});
      toast({
        title: mode === "phone" ? "Requesting pairing code…" : "Generating QR code…",
        description: mode === "phone"
          ? "A code will appear in a few seconds."
          : "Scan it with your WhatsApp app.",
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "Could not start WhatsApp" });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await apiDelete("/whatsapp/session");
      setWaState({ status: "disconnected", qr: null, pairingCode: null, connected: false });
      toast({ title: "WhatsApp disconnected" });
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "Could not disconnect" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleCopy = async () => {
    if (!waState.pairingCode) return;
    await navigator.clipboard.writeText(waState.pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusBadge = () => {
    switch (waState.status) {
      case "connected":          return <Badge className="bg-green-100 text-green-700 border-green-200">Connected</Badge>;
      case "pairing_code_ready": return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Enter Code</Badge>;
      case "qr_ready":           return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Scan QR Code</Badge>;
      case "connecting":         return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Connecting…</Badge>;
      default:                   return <Badge variant="secondary">Disconnected</Badge>;
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-blue-900" />
          {isSupport ? "Sunday Setup" : "Settings"}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {isSupport ? "Configure this Sunday's service details" : "Manage integrations and system settings"}
        </p>
      </div>

      {/* Sunday-specific operational cards — visible to support and super_admin */}
      {(isSuperAdmin || isSupport) && <HallSessionCard />}
      {isSuperAdmin && <ClassMergeCard />}

      {/* Admin / super-admin settings */}
      {(isSuperAdmin || isAdmin) && <LocationSettingsCard />}
      {isSuperAdmin && <GeneralSettingsCard />}

      {(isSuperAdmin || isSupport) && (
      <div className="border rounded-2xl bg-white overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">WhatsApp Notifications</p>
              <p className="text-xs text-gray-500">Fallback channel when SMS is unavailable</p>
            </div>
          </div>
          {statusBadge()}
        </div>

        <div className="px-6 py-6 space-y-5">

          {/* ── Connected ── */}
          {waState.status === "connected" && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800 text-sm">WhatsApp is connected</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Messages will be delivered via WhatsApp when Termii is unavailable.
                </p>
              </div>
            </div>
          )}

          {/* ── Pairing code ── */}
          {waState.status === "pairing_code_ready" && waState.pairingCode && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-800">Enter this code in WhatsApp</p>
                <ol className="mt-2 text-xs text-amber-700 space-y-1 list-decimal list-inside">
                  <li>Open WhatsApp on your phone</li>
                  <li>Tap Menu (⋮) → Linked Devices → Link a Device</li>
                  <li>Tap "Link with phone number instead"</li>
                  <li>Enter the code below</li>
                </ol>
              </div>
              <div className="flex items-center justify-between bg-gray-900 rounded-xl px-5 py-4">
                <span className="text-white text-3xl font-mono font-bold tracking-[0.25em]">
                  {waState.pairingCode}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-300 hover:text-white hover:bg-gray-700"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Code expires in ~60 seconds — disconnect and reconnect to get a new one
              </p>
            </div>
          )}

          {/* ── QR code ── */}
          {waState.status === "qr_ready" && waState.qr && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-800">Scan with WhatsApp</p>
                <ol className="mt-2 text-xs text-amber-700 space-y-1 list-decimal list-inside">
                  <li>Open WhatsApp on your phone</li>
                  <li>Tap Menu (⋮) → Linked Devices → Link a Device</li>
                  <li>Point your camera at the QR code below</li>
                </ol>
              </div>
              <div className="flex justify-center p-4 bg-white border-2 border-dashed border-gray-200 rounded-xl">
                <img src={waState.qr} alt="WhatsApp QR Code" className="w-56 h-56" />
              </div>
              <p className="text-xs text-gray-400 text-center">QR code refreshes every 20 s</p>
            </div>
          )}

          {/* ── Connecting spinner ── */}
          {waState.status === "connecting" && (
            <div className="flex items-center gap-3 text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
              <p className="text-sm">Connecting to WhatsApp…</p>
            </div>
          )}

          {/* ── Disconnected: mode picker + inputs ── */}
          {isIdle && (
            <div className="space-y-4">
              {/* Mode tabs */}
              <div className="flex rounded-xl border overflow-hidden">
                <button
                  onClick={() => setMode("phone")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors",
                    mode === "phone"
                      ? "bg-blue-900 text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50",
                  )}
                >
                  <Phone className="w-4 h-4" /> Phone number
                </button>
                <button
                  onClick={() => setMode("qr")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors",
                    mode === "qr"
                      ? "bg-blue-900 text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50",
                  )}
                >
                  <QrCode className="w-4 h-4" /> QR code
                </button>
              </div>

              {mode === "phone" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    WhatsApp phone number
                  </label>
                  <Input
                    type="tel"
                    placeholder="e.g. 08012345678 or 2348012345678"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleConnect()}
                  />
                  <p className="text-xs text-gray-400">
                    Nigerian numbers — 0801… or 2348… format both work
                  </p>
                </div>
              )}

              {mode === "qr" && (
                <p className="text-sm text-gray-500">
                  A QR code will appear — scan it with the WhatsApp app on your phone.
                </p>
              )}
            </div>
          )}

          {/* ── Action buttons ── */}
          <div className="flex gap-3 pt-1">
            {isIdle && (
              <Button onClick={handleConnect} disabled={connecting} className="flex-1">
                {connecting
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Wifi className="w-4 h-4 mr-2" />}
                {connecting ? "Connecting…" : "Connect WhatsApp"}
              </Button>
            )}

            {isActive && waState.status !== "connected" && (
              <>
                <Button variant="outline" size="sm" onClick={fetchStatus}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  <LogOut className="w-4 h-4 mr-1" /> Cancel
                </Button>
              </>
            )}

            {waState.status === "connected" && (
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                {disconnecting
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <LogOut className="w-4 h-4 mr-2" />}
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </Button>
            )}
          </div>
        </div>
      </div>
      )}

      {(isSuperAdmin || isSupport) && <p className="text-xs text-gray-400 text-center">
        WhatsApp is used as a fallback when Termii SMS fails. Powered by Baileys.
      </p>}
    </div>
  );
}
