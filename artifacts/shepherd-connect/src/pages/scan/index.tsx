import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { apiPost, apiGet } from "@/lib/api-call";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import QrCameraScanner from "@/components/QrCameraScanner";
import {
  CheckCircle2, AlertCircle, LogOut, QrCode, Clock,
  RefreshCw, Camera, ScanLine, AlertTriangle, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const INTERVAL_LABELS: Record<string, string> = {
  "07:00": "7:00 AM — 1st Service",
  "08:30": "8:30 AM — 1st Service",
  "09:30": "9:30 AM — 1st Service",
  "10:00": "10:00 AM — 2nd Service",
  "11:00": "11:00 AM — 2nd Service",
  "12:00": "12:00 PM — 2nd Service",
};

type ScanResult = {
  ok: boolean;
  duplicate: boolean;
  message: string;
  intervalLabel?: string;
  service?: string;
  scannedAt?: string;
};

type ClockOutResult = {
  ok: boolean;
  duplicate: boolean;
  message: string;
  service?: string;
};

type EmergencyResult = {
  ok: boolean;
  duplicate: boolean;
  message: string;
  service?: string;
  exitedAt?: string;
};

type Scan = {
  id: number;
  scanType: string;
  intervalLabel: string | null;
  service: string | null;
  scannedAt: string;
};

export default function ScanPage() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  // token + date can come from URL (physical QR scan) or in-app camera scan
  const urlParams = new URLSearchParams(window.location.search);
  const [token, setToken] = useState(urlParams.get("token") ?? "");
  const [date,  setDate]  = useState(
    urlParams.get("date") ?? new Date().toISOString().slice(0, 10),
  );

  const [cameraOpen,            setCameraOpen]            = useState(false);
  const [scanResult,            setScanResult]            = useState<ScanResult | null>(null);
  const [scanError,             setScanError]             = useState<string | null>(null);
  const [scanning,              setScanning]              = useState(false);
  const [hasScanned,            setHasScanned]            = useState(false);
  const [clockOutDone,          setClockOutDone]          = useState(false);
  const [clockOutLoading,       setClockOutLoading]       = useState(false);
  const [clockOutError,         setClockOutError]         = useState<string | null>(null);
  const [emergencyDone,         setEmergencyDone]         = useState(false);
  const [emergencyLoading,      setEmergencyLoading]      = useState(false);
  const [showEmergencyConfirm,  setShowEmergencyConfirm]  = useState(false);
  const [myScans,               setMyScans]               = useState<Scan[]>([]);

  const loadMyScans = useCallback(async () => {
    try {
      const data = await apiGet<{ scans: Scan[] }>(
        `/sunday-attendance/my-scans?date=${date}`,
      );
      setMyScans(data.scans ?? []);
    } catch {
      // non-critical
    }
  }, [date]);

  const ptr = usePullToRefresh(loadMyScans);

  const doScan = useCallback(async (tok: string, dt: string) => {
    if (!tok) {
      setScanError("No QR code token found. Please scan the QR code with your camera.");
      return;
    }
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    try {
      const result = await apiPost<ScanResult>("/sunday-attendance/scan", {
        token: tok,
        date:  dt,
      });
      setScanResult(result);
      setHasScanned(true);
      await loadMyScans();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scan failed. Please try again.";
      setScanError(msg);
    } finally {
      setScanning(false);
    }
  }, [loadMyScans]);

  const doClockOut = async () => {
    setClockOutLoading(true);
    setClockOutError(null);
    try {
      await apiPost<ClockOutResult>("/sunday-attendance/clock-out", { date });
      setClockOutDone(true);
      await loadMyScans();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Clock-out failed. Please try again.";
      setClockOutError(msg);
    } finally {
      setClockOutLoading(false);
    }
  };

  const doEmergencyOut = async () => {
    setEmergencyLoading(true);
    setShowEmergencyConfirm(false);
    try {
      await apiPost<EmergencyResult>("/sunday-attendance/emergency-out", { date });
      setEmergencyDone(true);
      await loadMyScans();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Emergency exit failed. Please try again.";
      setClockOutError(msg);
    } finally {
      setEmergencyLoading(false);
    }
  };

  // Handle QR scanned from in-app camera
  const handleCameraScan = useCallback((rawUrl: string) => {
    setCameraOpen(false);
    try {
      const url   = new URL(rawUrl);
      const tok   = url.searchParams.get("token") ?? "";
      const dt    = url.searchParams.get("date")  ?? date;
      setToken(tok);
      setDate(dt);
      doScan(tok, dt);
    } catch {
      // rawUrl might not be a full URL; try treating as bare token
      setToken(rawUrl);
      doScan(rawUrl, date);
    }
  }, [date, doScan]);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/login?redirect=${returnTo}`);
    }
  }, [authLoading, user, navigate]);

  // Auto-fire if a token arrived via URL (physical QR code scan)
  useEffect(() => {
    if (user) {
      if (token && !hasScanned && !scanning) doScan(token, date);
      loadMyScans();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-yellow-400 border-t-transparent" />
      </div>
    );
  }
  if (!user) return null;

  const checkpoints    = myScans.filter(s => s.scanType === "checkpoint");
  const clockOuts      = myScans.filter(s => s.scanType === "clock_out");
  const emergencyOuts  = myScans.filter(s => s.scanType === "emergency_out");
  const alreadyIn      = checkpoints.length > 0;
  const alreadyOut     = clockOuts.length > 0 || emergencyOuts.length > 0 || clockOutDone || emergencyDone;
  const showClockOut   = (hasScanned || alreadyIn) && !alreadyOut;

  const homeHref =
    user.role === "teacher" ? "/my-class"
    : user.role === "support" ? "/checkin"
    : "/dashboard";

  return (
    <>
      {/* Full-screen camera overlay */}
      {cameraOpen && (
        <QrCameraScanner
          onScan={handleCameraScan}
          onClose={() => setCameraOpen(false)}
          hint="Point the camera at the QR code on the church screen"
        />
      )}

      {/* Emergency exit confirmation overlay */}
      {showEmergencyConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-orange-100 p-2 rounded-full">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Emergency Exit?</h2>
              <button className="ml-auto text-gray-400" onClick={() => setShowEmergencyConfirm(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              This will record an emergency exit and notify the admin. Your remaining checkpoints
              for this service will be marked as excused. Use only for genuine emergencies.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowEmergencyConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                onClick={doEmergencyOut}
                disabled={emergencyLoading}
              >
                {emergencyLoading
                  ? <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                  : <AlertTriangle className="w-4 h-4 mr-1" />}
                Confirm Exit
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-b from-blue-950 to-blue-900 flex flex-col items-center px-4 py-10">
        <PullToRefreshIndicator {...ptr} variant="dark" />

        <div className="w-full max-w-sm space-y-6">

          {/* ── Header ── */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="bg-yellow-400 p-3 rounded-full">
                <QrCode className="w-8 h-8 text-blue-950" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Shepherd Connect</h1>
            <p className="text-blue-300 text-sm">Service Attendance</p>
            <p className="text-blue-200 text-sm font-medium">
              Hello, {user.firstName} {user.lastName}
            </p>
            <p className="text-blue-400 text-xs">
              {new Date(date + "T00:00:00").toLocaleDateString("en-NG", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
            </p>
          </div>

          {/* ── Primary action buttons ── */}
          <div className="space-y-3">
            {/* Check In button — always visible unless already checked in */}
            {!alreadyIn && !scanning && (
              <Button
                className="w-full h-14 text-base font-semibold bg-yellow-400 hover:bg-yellow-300 text-blue-950 rounded-2xl shadow-lg"
                onClick={() => setCameraOpen(true)}
              >
                <Camera className="w-5 h-5 mr-2" />
                Check In — Scan QR Code
              </Button>
            )}

            {/* Scanning spinner */}
            {scanning && (
              <Card className="border-0 bg-blue-800/50">
                <CardContent className="py-6 flex flex-col items-center gap-3 text-white">
                  <RefreshCw className="w-8 h-8 animate-spin text-yellow-400" />
                  <p className="text-sm">Recording your attendance…</p>
                </CardContent>
              </Card>
            )}

            {/* Clock Out button */}
            {showClockOut && !scanning && (
              <Button
                variant="outline"
                className="w-full h-14 text-base font-semibold border-2 border-yellow-400/60 text-yellow-300 hover:bg-yellow-400/10 rounded-2xl"
                onClick={doClockOut}
                disabled={clockOutLoading}
              >
                {clockOutLoading
                  ? <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  : <LogOut className="w-5 h-5 mr-2" />}
                Clock Out
              </Button>
            )}

            {/* Emergency Exit button — only shown when checked in */}
            {showClockOut && !scanning && (
              <button
                className="w-full py-3 text-sm font-medium text-orange-300 flex items-center justify-center gap-2 hover:text-orange-200 transition-colors"
                onClick={() => setShowEmergencyConfirm(true)}
                disabled={emergencyLoading}
              >
                <AlertTriangle className="w-4 h-4" />
                Emergency Exit
              </button>
            )}

            {clockOutError && (
              <p className="text-red-300 text-xs text-center">{clockOutError}</p>
            )}
          </div>

          {/* ── Scan result ── */}
          {scanResult && !scanning && (
            <Card className={`border-0 ${scanResult.duplicate ? "bg-blue-800/50" : "bg-green-800/50"}`}>
              <CardContent className="py-5 space-y-2 text-center">
                {scanResult.duplicate
                  ? <Clock className="w-10 h-10 text-yellow-400 mx-auto" />
                  : <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />}
                <p className="text-white font-semibold text-lg">
                  {scanResult.duplicate ? "Already Recorded" : "Checked In!"}
                </p>
                <p className="text-blue-200 text-sm">{scanResult.message}</p>
                {scanResult.intervalLabel && (
                  <div className="bg-blue-900/60 rounded-lg px-3 py-2 inline-block">
                    <p className="text-yellow-400 font-medium text-sm">
                      {INTERVAL_LABELS[scanResult.intervalLabel] ?? scanResult.intervalLabel}
                    </p>
                  </div>
                )}
                <Button
                  variant="outline" size="sm"
                  className="mt-1 border-blue-400 text-blue-200 hover:bg-blue-800"
                  onClick={() => { setScanResult(null); setCameraOpen(true); }}
                  disabled={scanning}
                >
                  <ScanLine className="w-4 h-4 mr-1" />
                  Scan Again
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── Scan error ── */}
          {scanError && !scanning && (
            <Card className="border-0 bg-red-900/50">
              <CardContent className="py-5 space-y-2 text-center">
                <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
                <p className="text-white font-semibold">Check-in Failed</p>
                <p className="text-red-200 text-sm">{scanError}</p>
                <Button
                  variant="outline" size="sm"
                  className="border-red-400 text-red-200 hover:bg-red-900"
                  onClick={() => { setScanError(null); setCameraOpen(true); }}
                  disabled={scanning}
                >
                  Try Again
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── Clock-out success ── */}
          {(clockOutDone || (alreadyOut && !showClockOut && clockOuts.length > 0)) && (
            <Card className="border-0 bg-green-900/50">
              <CardContent className="py-4 text-center space-y-1">
                <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto" />
                <p className="text-white font-medium">Clocked out successfully</p>
                <p className="text-green-300 text-xs">God bless you for serving today!</p>
              </CardContent>
            </Card>
          )}

          {/* ── Emergency exit success ── */}
          {(emergencyDone || emergencyOuts.length > 0) && (
            <Card className="border-0 bg-orange-900/50">
              <CardContent className="py-4 text-center space-y-1">
                <AlertTriangle className="w-8 h-8 text-orange-400 mx-auto" />
                <p className="text-white font-medium">Emergency exit recorded</p>
                <p className="text-orange-300 text-xs">The admin has been notified. Take care!</p>
              </CardContent>
            </Card>
          )}

          {/* ── Today's record ── */}
          {myScans.length > 0 && (
            <div className="space-y-2">
              <p className="text-blue-300 text-xs font-medium uppercase tracking-wider">
                Your record today
              </p>
              {checkpoints.map(s => (
                <div key={s.id}
                  className="flex items-center justify-between bg-blue-800/30 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-white text-sm">
                      {s.intervalLabel
                        ? (INTERVAL_LABELS[s.intervalLabel] ?? s.intervalLabel)
                        : "Checked in"}
                    </span>
                  </div>
                  <span className="text-blue-300 text-xs">
                    {new Date(s.scannedAt).toLocaleTimeString("en-NG", {
                      hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos",
                    })}
                  </span>
                </div>
              ))}
              {clockOuts.map(s => (
                <div key={s.id}
                  className="flex items-center justify-between bg-yellow-900/30 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <LogOut className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <span className="text-white text-sm">
                      Clock Out — {s.service} service
                    </span>
                  </div>
                  <span className="text-blue-300 text-xs">
                    {new Date(s.scannedAt).toLocaleTimeString("en-NG", {
                      hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos",
                    })}
                  </span>
                </div>
              ))}
              {emergencyOuts.map(s => (
                <div key={s.id}
                  className="flex items-center justify-between bg-orange-900/30 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                    <span className="text-white text-sm">
                      Emergency Exit — {s.service} service
                    </span>
                  </div>
                  <span className="text-blue-300 text-xs">
                    {new Date(s.scannedAt).toLocaleTimeString("en-NG", {
                      hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── Footer ── */}
          <div className="text-center">
            <button
              className="text-blue-400 text-xs underline"
              onClick={() => navigate(homeHref)}
            >
              Back to app
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
