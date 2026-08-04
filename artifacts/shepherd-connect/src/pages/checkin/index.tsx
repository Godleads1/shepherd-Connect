import { useState, useCallback, useEffect } from "react";
import { useScanQrCode, useCheckIn, useEscortToClass, useScanFace, useListAttendance } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle, QrCode, Scan, Truck, ShieldCheck, Users, Camera, WifiOff, Upload, HandHelping, Music, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import FaceCapture from "@/components/FaceCapture";
import QrCameraScanner from "@/components/QrCameraScanner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { enqueueCheckIn, getQueue, removeFromQueue, type QueuedCheckIn } from "@/lib/offline-queue";
import { useAuth } from "@/contexts/auth";
import FamilyAssist from "./FamilyAssist";
import LocationBanner from "@/components/LocationBanner";
import { useGeneralSettings } from "@/components/AnnouncementBanner";
import { apiGet, apiPost, apiDelete } from "@/lib/api-call";

type Tab = "qr" | "face" | "assist";
type SlotChoice = "7am" | "10:30am" | "both";

const DEFAULT_SERVICE_SLOTS: { value: SlotChoice; label: string; time: string }[] = [
  { value: "7am",     label: "1st Service",   time: "7:00 – 10:00 AM" },
  { value: "10:30am", label: "2nd Service",   time: "10:30 AM onwards" },
  { value: "both",    label: "Both Services", time: "All day" },
];

const DEFAULT_SLOT_OPTIONS: { value: SlotChoice; label: string }[] = [
  { value: "7am",     label: "1st" },
  { value: "10:30am", label: "2nd" },
  { value: "both",    label: "Both" },
];

function isSunday() {
  return new Date().getDay() === 0;
}

function ChildSlotPicker({
  value,
  onChange,
  slotOptions,
}: {
  value: SlotChoice;
  onChange: (v: SlotChoice) => void;
  slotOptions: { value: SlotChoice; label: string }[];
}) {
  return (
    <div className="flex gap-1 rounded-lg p-0.5 mb-4" style={{ background: "#f3f4f6" }}>
      {slotOptions.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="flex-1 py-1.5 rounded-md text-xs font-bold transition-all"
          style={value === opt.value
            ? { background: "#1e3a8a", color: "white", boxShadow: "0 1px 4px rgba(30,58,138,.35)" }
            : { color: "#6b7280" }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function CheckIn() {
  const { user } = useAuth();
  const canAssist = user?.role === "support" || user?.role === "admin" || user?.role === "super_admin";
  const [qrCode, setQrCode] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("qr");
  const [serviceSlot, setServiceSlot] = useState<SlotChoice>("7am");

  const { data: generalSettings } = useGeneralSettings();
  const serviceSlots: { value: SlotChoice; label: string; time: string }[] = generalSettings
    ? [
        { value: "7am",     label: generalSettings.serviceSlot1Label, time: generalSettings.serviceSlot1Time },
        { value: "10:30am", label: generalSettings.serviceSlot2Label, time: generalSettings.serviceSlot2Time },
        { value: "both",    label: "Both Services", time: "All day" },
      ]
    : DEFAULT_SERVICE_SLOTS;
  const slotOptions: { value: SlotChoice; label: string }[] = generalSettings
    ? [
        { value: "7am",     label: generalSettings.serviceSlot1Label.replace("Service", "").trim() || "1st" },
        { value: "10:30am", label: generalSettings.serviceSlot2Label.replace("Service", "").trim() || "2nd" },
        { value: "both",    label: "Both" },
      ]
    : DEFAULT_SLOT_OPTIONS;
  const [scanResult, setScanResult] = useState<any>(null);
  const [faceMatched, setFaceMatched] = useState(false);
  const [childSlots, setChildSlots] = useState<Record<number, SlotChoice>>({});
  const [cameraOpen, setCameraOpen] = useState(false);
  const [checkingInAll, setCheckingInAll] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [queueCount, setQueueCount] = useState(() => getQueue().length);
  const isOnline = useOnlineStatus();
  const { toast } = useToast();

  const scanMutation = useScanQrCode();
  const checkInMutation = useCheckIn();
  const escortMutation = useEscortToClass();
  const scanFaceMutation = useScanFace();

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: todayAttendance, refetch: refetchAttendance } = useListAttendance({ serviceDate: today, serviceSlot });
  const attendanceList: any[] = Array.isArray(todayAttendance) ? todayAttendance : [];

  // Hall session state — fetched once on mount and after bulk-escort clears it
  const [hallSessionActive, setHallSessionActive] = useState(false);
  const [hallSessionId, setHallSessionId] = useState<number | null>(null);
  const [bulkEscorting, setBulkEscorting] = useState(false);

  const fetchHallSession = useCallback(() => {
    apiGet<{ active: boolean; sessions: { id: number }[] }>("/hall-sessions/today")
      .then(data => {
        setHallSessionActive(data.active);
        setHallSessionId(data.sessions[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchHallSession(); }, [fetchHallSession]);

  const handleBulkEscort = async () => {
    setBulkEscorting(true);
    try {
      const result = await apiPost<{ count: number }>("/attendance/bulk-escort", {
        serviceDate: today,
        ...(serviceSlot !== "both" ? { serviceSlot } : {}),
      });
      toast({
        title: `${result.count} ${result.count === 1 ? "child" : "children"} sent to class`,
        description: "Parents and teachers have been notified. Teachers will confirm each arrival.",
      });
      // Backend cleared the hall session — update local state
      setHallSessionActive(false);
      setHallSessionId(null);
      refetchAttendance();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not send children", description: e.message });
    } finally {
      setBulkEscorting(false);
    }
  };

  const getChildSlot = (child: any): SlotChoice => {
    if (childSlots[child.id] !== undefined) return childSlots[child.id];
    const pref = child.servicePreference as SlotChoice | undefined;
    if (pref === "7am" || pref === "10:30am" || pref === "both") return pref;
    return serviceSlot as SlotChoice;
  };

  const setChildSlot = (childId: number, slot: SlotChoice) => {
    setChildSlots(prev => ({ ...prev, [childId]: slot }));
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrCode) return;
    try {
      const result = await scanMutation.mutateAsync({
        data: { qrCode, serviceDate: today, serviceSlot: serviceSlot === "both" ? "7am" : serviceSlot }
      });
      setScanResult(result);
      setChildSlots({});
      setQrCode("");
      refetchAttendance();
    } catch {
      toast({ variant: "destructive", title: "Scan Failed", description: "QR code not recognised" });
    }
  };

  const handleFaceDescriptor = useCallback(async (descriptor: number[]) => {
    try {
      const result = await scanFaceMutation.mutateAsync({ data: { descriptor } });
      setScanResult(result);
      setChildSlots({});
      setFaceMatched(true);
      refetchAttendance();
      toast({ title: "Face Matched!", description: `Family found · confidence ${(result as any).confidence ?? "—"}%` });
    } catch {
      toast({
        variant: "destructive",
        title: "No Match Found",
        description: "Face not recognised. Please use the QR code instead.",
      });
    }
  }, [scanFaceMutation, toast, refetchAttendance]);

  const isAlreadyCheckedIn = (childId: number) =>
    attendanceList.some((a: any) => a.childId === childId);

  const checkInForSlots = async (childId: number, classId: number, slots: SlotChoice) => {
    const slotsToBook = slots === "both" ? ["7am", "10:30am"] : [slots];
    for (const s of slotsToBook) {
      await checkInMutation.mutateAsync({ data: { childId, classId, serviceDate: today, serviceSlot: s } });
    }
  };

  const processOfflineQueue = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;
    setSyncingQueue(true);
    let synced = 0;
    for (const item of queue) {
      try {
        await checkInMutation.mutateAsync({
          data: { childId: item.childId, classId: item.classId, serviceDate: item.serviceDate, serviceSlot: item.serviceSlot },
        });
        removeFromQueue(item.id);
        synced++;
      } catch { /* leave in queue */ }
    }
    setQueueCount(getQueue().length);
    setSyncingQueue(false);
    if (synced > 0) {
      toast({ title: `Synced ${synced} offline check-in${synced > 1 ? "s" : ""}` });
      refetchAttendance();
    }
  }, [checkInMutation, toast, refetchAttendance]);

  useEffect(() => {
    if (isOnline && getQueue().length > 0) {
      processOfflineQueue();
    }
  }, [isOnline, processOfflineQueue]);

  const handleCheckIn = async (child: any) => {
    if (!child.currentClass) {
      toast({ variant: "destructive", title: "Cannot Check In", description: "Child is not assigned to a class" });
      return;
    }
    const slot = getChildSlot(child);

    if (!isOnline) {
      enqueueCheckIn({
        type: "checkin",
        childId: child.id,
        classId: child.currentClass.id,
        serviceDate: today,
        serviceSlot: slot === "both" ? "7am" : slot,
        childName: `${child.firstName} ${child.lastName}`,
      });
      setQueueCount(getQueue().length);
      const label = slot === "both" ? "both services" : slot === "7am" ? "1st service" : "2nd service";
      toast({ title: "Queued Offline", description: `${child.firstName} will be checked in for ${label} when you reconnect.` });
      return;
    }

    try {
      await checkInForSlots(child.id, child.currentClass.id, slot);
      const label = slot === "both" ? "both services" : slot === "7am" ? "1st service" : "2nd service";
      toast({ title: "Checked In", description: `${child.firstName} checked in for ${label}. Assign an escort to take them to class.` });
      refetchAttendance();
    } catch {
      toast({ variant: "destructive", title: "Check In Failed" });
    }
  };

  const handleCheckInAll = async () => {
    if (!scanResult?.children) return;
    const eligible = scanResult.children.filter(
      (c: any) => c.currentClass && !isAlreadyCheckedIn(c.id)
    );
    if (eligible.length === 0) {
      toast({ title: "All children already checked in" });
      return;
    }
    setCheckingInAll(true);
    let done = 0;
    for (const child of eligible) {
      const slot = getChildSlot(child);
      try {
        await checkInForSlots(child.id, child.currentClass.id, slot);
        done++;
      } catch { /* skip individual failures */ }
    }
    refetchAttendance();
    setCheckingInAll(false);
    toast({ title: `${done} of ${eligible.length} children checked in`, description: "Assign escorts to take them to their classes." });
  };

  const handleEscort = async (id: number, childName: string) => {
    try {
      await escortMutation.mutateAsync({ id });
      toast({ title: "Escort Started", description: `${childName} is now in transit to class.` });
      refetchAttendance();
    } catch {
      toast({ variant: "destructive", title: "Already escorted or not in dropped-off state" });
    }
  };

  const clearScan = () => { setScanResult(null); setFaceMatched(false); setChildSlots({}); };

  const printBadge = (child: any, familyCode?: string) => {
    const win = window.open("", "_blank", "width=400,height=300");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Badge</title>
<style>
  @media print { @page { margin: 0; size: 100mm 70mm; } body { margin: 8mm; } }
  body { font-family: Inter, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: white; text-align: center; }
  .name { font-size: 32px; font-weight: 900; color: #1e3a8a; margin-bottom: 6px; }
  .class { font-size: 18px; color: #374151; margin-bottom: 8px; font-weight: 600; }
  .code { font-size: 14px; color: #6b7280; font-family: monospace; background: #f3f4f6; padding: 4px 12px; border-radius: 8px; }
  .date { font-size: 11px; color: #9ca3af; margin-top: 8px; }
  .logo { font-size: 11px; font-weight: 700; color: #1e3a8a; letter-spacing: 0.05em; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 10px; width: 100%; }
</style></head><body>
<div class="name">${child.firstName} ${child.lastName}</div>
<div class="class">${child.currentClass?.name || "Children's Church"}</div>
<div class="code">Family: ${familyCode || "—"}</div>
<div class="date">${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
<div class="logo">RCCG City of David · Shepherd Connect</div>
</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const droppedOff = attendanceList.filter((a: any) => a.status === "dropped_off");
  const inTransit  = attendanceList.filter((a: any) => a.status === "in_transit");

  return (
    <div className="flex flex-col items-center max-w-4xl mx-auto py-8">
      {/* Hero */}
      <div
        className="w-full rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden text-center mb-8 shadow-xl"
        style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}
      >
        <div className="absolute top-0 left-0 w-full h-full opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative z-10">
          <div style={{ width: 96, height: 96, margin: "0 auto 16px" }}>
            <img src="/rccg-logo-new.png" alt="RCCG" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>Shepherd Connect</h1>
          <p className="text-base text-blue-200 font-medium mb-6">Child Check-In Gateway</p>

          {/* Service selector — inside the hero so it's the first decision */}
          <div className="mt-2">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-3">Select Service</p>
            <div className="flex gap-3 justify-center">
              {serviceSlots.map(slot => (
                <button key={slot.value} onClick={() => setServiceSlot(slot.value)}
                  className="flex-1 max-w-[180px] py-3 px-4 rounded-2xl text-left transition-all duration-200 active:scale-95"
                  style={serviceSlot === slot.value
                    ? { background: "rgba(255,255,255,0.95)", color: "#1e3a8a", boxShadow: "0 4px 16px rgba(0,0,0,0.25)" }
                    : { background: "rgba(255,255,255,0.12)", color: "white", border: "1.5px solid rgba(255,255,255,0.25)" }}>
                  <p className="text-sm font-bold leading-tight">{slot.label}</p>
                  <p className="text-xs leading-tight mt-0.5 opacity-80">{slot.time}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <LocationBanner />

      {/* ── Hall Session Banner ── */}
      {hallSessionActive && canAssist && (
        <div className="w-full mb-6 rounded-2xl overflow-hidden shadow-sm"
          style={{ background: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 100%)" }}>
          <div className="px-5 py-4 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm">Hall session is active</p>
              <p className="text-xs text-purple-200 mt-0.5">
                {droppedOff.length > 0
                  ? `${droppedOff.length} ${droppedOff.length === 1 ? "child is" : "children are"} waiting. When praise ends, tap the button to send everyone to their classes at once.`
                  : "No children waiting yet. Tap the button when praise ends to dispatch any who check in."}
              </p>
              <button
                onClick={handleBulkEscort}
                disabled={bulkEscorting || droppedOff.length === 0}
                className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.95)", color: "#4c1d95" }}
              >
                {bulkEscorting
                  ? <><span className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />&nbsp;Sending…</>
                  : <><Send className="w-4 h-4" /> Praise is done — send all {droppedOff.length > 0 ? `${droppedOff.length} ` : ""}to class</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transit/dropped-off live strip */}
      {(droppedOff.length > 0 || inTransit.length > 0) && (
        <div className="w-full bg-white rounded-2xl border border-amber-200 mb-6 overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
            <p className="text-sm font-bold text-amber-700 flex items-center gap-2">
              <Truck className="w-4 h-4" /> Live Escort Queue
            </p>
            <div className="flex gap-2 text-xs font-semibold">
              {droppedOff.length > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{droppedOff.length} waiting escort</span>}
              {inTransit.length > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{inTransit.length} in transit</span>}
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {[...droppedOff, ...inTransit].map((a: any) => (
              <div key={a.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: a.status === "in_transit" ? "#1d4ed8" : "#d97706" }}>
                  {a.child?.firstName?.[0]}{a.child?.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{a.child?.firstName} {a.child?.lastName}</p>
                  <p className="text-xs text-gray-500 truncate">{a.class?.name}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={a.status === "in_transit"
                      ? { background: "#dbeafe", color: "#1d4ed8" }
                      : { background: "#fef3c7", color: "#d97706" }}>
                    {a.status === "in_transit" ? "In Transit" : "Waiting Escort"}
                  </span>
                  {a.status === "dropped_off" && (
                    <button
                      onClick={() => handleEscort(a.id, a.child?.firstName)}
                      disabled={escortMutation.isPending}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-60"
                      style={{ background: "#1e3a8a", color: "white" }}
                    >
                      <Truck className="w-3 h-3 inline mr-1" /> Escort
                    </button>
                  )}
                  {a.status === "in_transit" && (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sunday indicator */}
      {!isSunday() && (
        <div className="w-full mb-3 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium"
          style={{ background: "#fef9c3", color: "#92400e", border: "1px solid #fde68a" }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Services are held on Sundays only — today is {new Date().toLocaleDateString("en-GB", { weekday: "long" })}.
        </div>
      )}

      {/* Tab switcher */}
      <div className="w-full flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {([
          { key: "qr",   label: "QR / Code",        icon: QrCode },
          { key: "face", label: "Face Scan",         icon: Scan },
          ...(canAssist ? [{ key: "assist", label: "Family Assist", icon: HandHelping }] : []),
        ] as { key: Tab; label: string; icon: typeof QrCode }[]).map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); clearScan(); }}
              className="flex-1 py-3 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              style={activeTab === tab.key
                ? { background: tab.key === "assist" ? "#f59e0b" : "#1e3a8a", color: "white", boxShadow: "0 2px 8px rgba(30,58,138,.3)" }
                : { color: "#6b7280" }}>
              <Icon className="w-4 h-4 flex-shrink-0" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Offline / queue status strip */}
      {!isOnline && (
        <div className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 text-sm font-semibold"
          style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          Offline mode — check-ins will be queued and synced on reconnect.
          {queueCount > 0 && <span className="ml-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "#d97706", color: "white" }}>{queueCount} queued</span>}
        </div>
      )}
      {isOnline && queueCount > 0 && (
        <div className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl mb-4 text-sm font-semibold"
          style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" }}>
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            {queueCount} offline check-in{queueCount > 1 ? "s" : ""} ready to sync
          </div>
          <button
            onClick={processOfflineQueue}
            disabled={syncingQueue}
            className="px-3 py-1 rounded-lg text-xs font-bold"
            style={{ background: "#059669", color: "white" }}>
            {syncingQueue ? "Syncing…" : "Sync Now"}
          </button>
        </div>
      )}

      {/* Family Assist tab */}
      {activeTab === "assist" && (
        <div className="w-full bg-white rounded-3xl p-6 shadow-sm border border-amber-100 mb-8">
          <FamilyAssist />
        </div>
      )}

      {/* QR tab */}
      {activeTab === "qr" && !scanResult && (
        <div className="w-full bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8">
          <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <QrCode className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400" />
              <Input
                autoFocus
                className="pl-14 h-16 text-lg rounded-2xl border-gray-200 focus-visible:ring-[#1a237e] bg-gray-50/50"
                placeholder="Scan QR Code or Enter Family Code..."
                value={qrCode}
                onChange={e => setQrCode(e.target.value)}
                data-testid="input-qr-scan"
              />
            </div>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              title="Use camera to scan QR"
              className="h-16 px-5 rounded-2xl font-bold text-lg transition-all active:scale-95 border-2 flex items-center justify-center"
              style={{ borderColor: "#1e3a8a", color: "#1e3a8a" }}>
              <Camera className="w-6 h-6" />
            </button>
            <button
              type="submit"
              disabled={scanMutation.isPending}
              data-testid="button-scan"
              className="h-16 px-10 rounded-2xl font-bold text-lg transition-all active:scale-95 disabled:opacity-70"
              style={{ background: "linear-gradient(135deg, #1a237e, #283593)", color: "#ffffff", boxShadow: "0 4px 15px rgba(26,35,126,0.3)" }}>
              {scanMutation.isPending ? "Scanning..." : "Scan"}
            </button>
          </form>
        </div>
      )}

      {cameraOpen && (
        <QrCameraScanner
          onScan={(code) => {
            setCameraOpen(false);
            setQrCode(code);
            setTimeout(() => {
              document.querySelector<HTMLButtonElement>("[data-testid='button-scan']")?.click();
            }, 50);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {/* Face tab */}
      {activeTab === "face" && !scanResult && (
        <div className="w-full bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-3"
              style={{ background: "#eff6ff", color: "#1e3a8a" }}>
              <ShieldCheck className="w-4 h-4" /> Consent-based · Optional
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Parent Face Recognition</h3>
            <p className="text-sm text-gray-500">
              Look into the camera to identify your family. Falls back to QR if not enrolled.
            </p>
          </div>
          <FaceCapture mode="scan" label="Scan to Identify Family" onDescriptor={handleFaceDescriptor} />
          {scanFaceMutation.isPending && (
            <p className="text-center text-sm text-blue-600 mt-3 font-medium">Searching for a match...</p>
          )}
        </div>
      )}

      {/* Scan result */}
      {scanResult && (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl flex items-center gap-5">
            <div className="h-16 w-16 rounded-full bg-blue-800 text-white flex items-center justify-center text-2xl font-bold shadow-md">
              {scanResult.family?.familyCode?.substring(0, 2)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-600 mb-1">
                {faceMatched ? "✓ Face Matched" : "✓ QR Matched"} · Family Found
              </p>
              <h2 className="text-2xl font-bold text-gray-900">
                {scanResult.family?.parent1?.firstName} {scanResult.family?.parent1?.lastName}
              </h2>
              <p className="text-gray-500 text-sm">Code: <span className="font-mono font-medium">{scanResult.family?.familyCode}</span></p>
            </div>
            <button onClick={clearScan}
              className="text-gray-400 hover:text-gray-600 text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-100">
              ✕ Clear
            </button>
          </div>

          {scanResult.hasAlerts && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-2xl">
              <p className="font-bold text-red-700 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Medical / Allergy Alerts
              </p>
              {scanResult.alerts.map((a: string, i: number) => (
                <p key={i} className="text-sm text-red-600">• {a}</p>
              ))}
            </div>
          )}

          {/* Check In All button */}
          {scanResult.children.length > 1 && scanResult.children.some((c: any) => c.currentClass && !isAlreadyCheckedIn(c.id)) && (
            <button
              onClick={handleCheckInAll}
              disabled={checkingInAll || checkInMutation.isPending}
              className="w-full h-14 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-3 shadow-md"
              style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)", color: "white" }}>
              <Users className="w-5 h-5" />
              {checkingInAll
                ? "Checking in all children…"
                : `Check In All ${scanResult.children.filter((c: any) => c.currentClass && !isAlreadyCheckedIn(c.id)).length} Children at Once`}
            </button>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            {scanResult.children.map((child: any) => {
              const alreadyIn = isAlreadyCheckedIn(child.id);
              const slot = getChildSlot(child);
              return (
                <div key={child.id} className={`bg-white rounded-2xl overflow-hidden border shadow-sm flex flex-col transition-all ${alreadyIn ? "border-green-200 opacity-80" : "border-gray-100"}`}>
                  {alreadyIn && (
                    <div className="bg-green-600 text-white px-4 py-2 flex items-center justify-center gap-2 font-bold text-sm">
                      <CheckCircle className="h-4 w-4" /> Already Checked In Today
                    </div>
                  )}
                  {!alreadyIn && child.allergies && (
                    <div className="bg-red-600 text-white px-4 py-2.5 flex items-center justify-center gap-2 font-bold text-sm">
                      <AlertTriangle className="h-4 w-4" /> ALLERGY ALERT
                    </div>
                  )}
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{child.firstName} {child.lastName}</h3>
                        <p className="text-gray-500 mt-1 text-sm">Age {child.age}</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-800 flex items-center justify-center font-bold text-lg">
                        {child.firstName[0]}
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-50 border border-gray-200 text-gray-700">
                        {child.currentClass
                          ? <><CheckCircle className="w-4 h-4 text-green-600" /> {child.currentClass.name}</>
                          : <><AlertTriangle className="w-4 h-4 text-amber-500" /> Unassigned</>}
                      </div>
                      {!alreadyIn && child.allergies && (
                        <p className="mt-3 text-sm font-medium text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">{child.allergies}</p>
                      )}
                    </div>

                    {/* Per-child service selector */}
                    {!alreadyIn && child.currentClass && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Service</p>
                        <ChildSlotPicker value={slot} onChange={v => setChildSlot(child.id, v)} slotOptions={slotOptions} />
                      </div>
                    )}

                    <div className="flex gap-2 mt-auto">
                      {alreadyIn ? (
                        <div className="flex-1 h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle className="w-5 h-5" /> Checked In
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCheckIn(child)}
                          disabled={!child.currentClass || checkInMutation.isPending || checkingInAll}
                          data-testid={`button-checkin-${child.id}`}
                          className="flex-1 h-14 rounded-xl font-bold text-base transition-all active:scale-95 disabled:opacity-50 flex flex-col items-center justify-center leading-tight"
                          style={{ background: "#1e3a8a", color: "white" }}>
                          <span>Check In Child</span>
                          <span className="text-[10px] font-medium opacity-75 mt-0.5">
                            {slot === "both" ? "Both services" : slot === "7am" ? "1st service · 7 AM" : "2nd service · 10:30 AM"}
                          </span>
                        </button>
                      )}
                      <button
                        onClick={() => printBadge(child, scanResult?.family?.familyCode)}
                        className="h-14 px-4 rounded-xl font-semibold text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                        title="Print name badge">
                        🖨️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
