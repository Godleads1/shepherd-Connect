import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiDelete } from "@/lib/api-call";
import {
  Smartphone, Wifi, WifiOff, RefreshCw, Loader2, LogOut,
  CheckCircle2, Settings2, Copy, Check, QrCode, Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";

type WaStatus = "disconnected" | "connecting" | "pairing_code_ready" | "qr_ready" | "connected";

interface WaState {
  status: WaStatus;
  qr: string | null;
  pairingCode: string | null;
  connected: boolean;
}

type ConnectMode = "phone" | "qr";

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
    const interval = ["connecting", "qr_ready", "pairing_code_ready"].includes(waState.status)
      ? 3000
      : 30000;
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, interval);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [waState.status]);

  if (!user || user.role !== "super_admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Access restricted to Super Admin.</p>
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
          Settings
        </h1>
        <p className="text-gray-500 text-sm mt-1">Manage integrations and system settings</p>
      </div>

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

      <p className="text-xs text-gray-400 text-center">
        WhatsApp is used as a fallback when Termii SMS fails. Powered by Baileys.
      </p>
    </div>
  );
}
