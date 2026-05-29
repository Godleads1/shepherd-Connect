import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiDelete } from "@/lib/api-call";
import { Smartphone, Wifi, WifiOff, RefreshCw, Loader2, LogOut, CheckCircle2, Settings2 } from "lucide-react";

type WaStatus = "disconnected" | "connecting" | "qr_ready" | "connected";

interface WaState {
  status: WaStatus;
  qr: string | null;
  connected: boolean;
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [waState, setWaState] = useState<WaState>({ status: "disconnected", qr: null, connected: false });
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await apiGet<WaState>("/whatsapp/status");
      setWaState(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  if (!user || user.role !== "super_admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Access restricted to Super Admin.</p>
      </div>
    );
  }

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await apiPost("/whatsapp/connect", {});
      toast({ title: "WhatsApp initialising", description: "Scan the QR code with your phone." });
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
      setWaState({ status: "disconnected", qr: null, connected: false });
      toast({ title: "WhatsApp disconnected", description: "Session has been cleared." });
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "Could not disconnect" });
    } finally {
      setDisconnecting(false);
    }
  };

  const statusBadge = () => {
    switch (waState.status) {
      case "connected":   return <Badge className="bg-green-100 text-green-700 border-green-200">Connected</Badge>;
      case "qr_ready":    return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Scan QR Code</Badge>;
      case "connecting":  return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Connecting…</Badge>;
      default:            return <Badge variant="secondary">Disconnected</Badge>;
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
        <div className="px-6 py-5 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">WhatsApp Notifications</p>
              <p className="text-xs text-gray-500">Send check-in alerts and OTPs via WhatsApp</p>
            </div>
          </div>
          {statusBadge()}
        </div>

        <div className="px-6 py-6 space-y-5">
          {waState.status === "connected" && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800 text-sm">WhatsApp is connected</p>
                <p className="text-xs text-green-700 mt-0.5">Messages will be delivered via WhatsApp when SMS is unavailable.</p>
              </div>
            </div>
          )}

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
              <p className="text-xs text-gray-400 text-center">QR code refreshes automatically every 20 seconds</p>
            </div>
          )}

          {waState.status === "connecting" && (
            <div className="flex items-center gap-3 text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
              <p className="text-sm">Connecting to WhatsApp…</p>
            </div>
          )}

          {waState.status === "disconnected" && (
            <div className="flex items-center gap-3 text-gray-600 bg-gray-50 border rounded-xl p-4">
              <WifiOff className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">WhatsApp is not connected. Click "Connect" to link a phone number.</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            {waState.status === "disconnected" && (
              <Button onClick={handleConnect} disabled={connecting} className="flex-1">
                {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wifi className="w-4 h-4 mr-2" />}
                {connecting ? "Starting…" : "Connect WhatsApp"}
              </Button>
            )}
            {(waState.status === "qr_ready" || waState.status === "connecting") && (
              <>
                <Button variant="outline" size="sm" onClick={fetchStatus}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                  <LogOut className="w-4 h-4 mr-1" /> Cancel
                </Button>
              </>
            )}
            {waState.status === "connected" && (
              <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting} className="text-red-600 border-red-200 hover:bg-red-50">
                {disconnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        WhatsApp is used as a fallback when SMS delivery fails. Powered by Baileys (unofficial WhatsApp Web API).
      </p>
    </div>
  );
}
