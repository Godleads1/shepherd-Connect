import { useState, useCallback } from "react";
import { useScanQrCode, useCheckIn, useEscortToClass, useScanFace, useListAttendance } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle, QrCode, Scan, Truck, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import FaceCapture from "@/components/FaceCapture";

type Tab = "qr" | "face";

const SERVICE_SLOTS = [
  { value: "7am",     label: "1st Service", time: "7:00 – 10:00 AM" },
  { value: "10:30am", label: "2nd Service", time: "10:30 AM onwards" },
];

function isSunday() {
  return new Date().getDay() === 0;
}

export default function CheckIn() {
  const [qrCode, setQrCode] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("qr");
  const [serviceSlot, setServiceSlot] = useState("7am");
  const [scanResult, setScanResult] = useState<any>(null);
  const [faceMatched, setFaceMatched] = useState(false);
  const { toast } = useToast();

  const scanMutation = useScanQrCode();
  const checkInMutation = useCheckIn();
  const escortMutation = useEscortToClass();
  const scanFaceMutation = useScanFace();

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: todayAttendance, refetch: refetchAttendance } = useListAttendance({ serviceDate: today, serviceSlot });
  const attendanceList: any[] = Array.isArray(todayAttendance) ? todayAttendance : [];

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrCode) return;
    try {
      const result = await scanMutation.mutateAsync({
        data: { qrCode, serviceDate: today, serviceSlot }
      });
      setScanResult(result);
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

  const handleCheckIn = async (childId: number, classId: number | undefined) => {
    if (!classId) {
      toast({ variant: "destructive", title: "Cannot Check In", description: "Child is not assigned to a class" });
      return;
    }
    try {
      await checkInMutation.mutateAsync({ data: { childId, classId, serviceDate: today, serviceSlot } });
      toast({ title: "Dropped Off", description: "Child checked in. Assign an escort to take them to class." });
      refetchAttendance();
    } catch {
      toast({ variant: "destructive", title: "Check In Failed" });
    }
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

  const clearScan = () => { setScanResult(null); setFaceMatched(false); };

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

  // Children currently dropped off (waiting escort) or in transit — pulled from live attendance
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
          <div style={{ width: 120, height: 120, margin: "0 auto 24px" }}>
            <img src="/rccg-logo-new.png" alt="RCCG" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>Shepherd Connect</h1>
          <p className="text-lg sm:text-xl text-blue-100 font-medium">Child Check-In Gateway</p>
        </div>
      </div>

      {/* Transit/dropped-off live strip (visible when children are waiting) */}
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

      {/* Service slot selector */}
      <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Select Service</p>
        <div className="flex gap-2">
          {SERVICE_SLOTS.map(slot => (
            <button key={slot.value} onClick={() => setServiceSlot(slot.value)}
              className="flex-1 py-2.5 px-3 rounded-xl text-left transition-all"
              style={serviceSlot === slot.value
                ? { background: "#1e3a8a", color: "white", boxShadow: "0 2px 8px rgba(30,58,138,0.3)" }
                : { background: "#f3f4f6", color: "#374151" }}>
              <p className="text-xs font-bold leading-tight">{slot.label}</p>
              <p className="text-[10px] opacity-75 leading-tight mt-0.5">{slot.time}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="w-full flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {([
          { key: "qr",   label: "QR / Code Scan",    icon: QrCode },
          { key: "face", label: "Face Recognition",  icon: Scan },
        ] as { key: Tab; label: string; icon: typeof QrCode }[]).map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); clearScan(); }}
              className="flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
              style={activeTab === tab.key
                ? { background: "#1e3a8a", color: "white", boxShadow: "0 2px 8px rgba(30,58,138,.3)" }
                : { color: "#6b7280" }}>
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

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

          <div className="grid gap-5 md:grid-cols-2">
            {scanResult.children.map((child: any) => (
              <div key={child.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm flex flex-col">
                {child.allergies && (
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

                  <div className="mb-5 flex-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-50 border border-gray-200 text-gray-700">
                      {child.currentClass
                        ? <><CheckCircle className="w-4 h-4 text-green-600" /> {child.currentClass.name}</>
                        : <><AlertTriangle className="w-4 h-4 text-amber-500" /> Unassigned</>}
                    </div>
                    {child.allergies && (
                      <p className="mt-3 text-sm font-medium text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">{child.allergies}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCheckIn(child.id, child.currentClass?.id)}
                      disabled={!child.currentClass || checkInMutation.isPending}
                      data-testid={`button-checkin-${child.id}`}
                      className="flex-1 h-14 rounded-xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50"
                      style={{ background: "#1e3a8a", color: "white" }}>
                      Check In Child
                    </button>
                    <button
                      onClick={() => printBadge(child, scanResult?.family?.familyCode)}
                      className="h-14 px-4 rounded-xl font-semibold text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                      title="Print name badge">
                      🖨️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
