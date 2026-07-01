import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { apiPost, apiGet } from "@/lib/api-call";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { CheckCircle2, AlertCircle, LogOut, QrCode, Clock, RefreshCw } from "lucide-react";
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

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";
  const date = params.get("date") ?? new Date().toISOString().slice(0, 10);

  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  const [clockOutDone, setClockOutDone] = useState(false);
  const [clockOutLoading, setClockOutLoading] = useState(false);
  const [clockOutError, setClockOutError] = useState<string | null>(null);

  const [myScans, setMyScans] = useState<Scan[]>([]);

  const loadMyScans = useCallback(async () => {
    try {
      const data = await apiGet<{ scans: Scan[] }>(`/sunday-attendance/my-scans?date=${date}`);
      setMyScans(data.scans ?? []);
    } catch {
      // non-critical
    }
  }, [date]);

  const ptr = usePullToRefresh(loadMyScans);

  const doScan = async () => {
    if (!token) {
      setScanError("No QR code token found. Please scan the QR code on the church wall.");
      return;
    }
    setScanning(true);
    setScanError(null);
    try {
      const result = await apiPost<ScanResult>("/sunday-attendance/scan", { token, date });
      setScanResult(result);
      setHasScanned(true);
      await loadMyScans();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scan failed. Please try again.";
      setScanError(msg);
    } finally {
      setScanning(false);
    }
  };

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

  useEffect(() => {
    if (!authLoading && !user) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/login?redirect=${returnTo}`);
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      // Only auto-scan if a token was supplied (i.e. opened via QR code)
      if (token && !hasScanned && !scanning) doScan();
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

  const checkpoints = myScans.filter(s => s.scanType === "checkpoint");
  const clockOuts   = myScans.filter(s => s.scanType === "clock_out");
  const alreadyClockedOut = clockOuts.length > 0 || clockOutDone;
  const alreadyCheckedIn  = checkpoints.length > 0;

  const homeHref =
    user.role === "teacher" ? "/my-class"
    : user.role === "support" ? "/checkin"
    : "/dashboard";

  const ScanHistory = () => (
    <div className="space-y-2">
      <p className="text-blue-300 text-xs font-medium uppercase tracking-wider">
        Your record today
      </p>
      {checkpoints.map(s => (
        <div key={s.id}
          className="flex items-center justify-between bg-blue-800/30 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span className="text-white text-sm">
              {s.intervalLabel ? (INTERVAL_LABELS[s.intervalLabel] ?? s.intervalLabel) : "Checked in"}
            </span>
          </div>
          <span className="text-blue-300 text-xs">
            {new Date(s.scannedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}
          </span>
        </div>
      ))}
      {clockOuts.map(s => (
        <div key={s.id}
          className="flex items-center justify-between bg-yellow-900/30 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <LogOut className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <span className="text-white text-sm">Clock Out — {s.service} service</span>
          </div>
          <span className="text-blue-300 text-xs">
            {new Date(s.scannedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}
          </span>
        </div>
      ))}
    </div>
  );

  return (
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

        {/* ── No-token state: instructions + history ── */}
        {!token && (
          <>
            {/* Instruction card */}
            <Card className="border-0 bg-blue-800/50">
              <CardContent className="py-5 space-y-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-yellow-400/20 border-2 border-yellow-400/40 flex items-center justify-center mx-auto">
                  <QrCode className="w-7 h-7 text-yellow-400" />
                </div>
                <p className="text-white font-semibold">How to check in</p>
                <ol className="text-blue-200 text-sm text-left space-y-2 list-none">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-yellow-400 text-blue-950 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                    Open your phone&apos;s camera app
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-yellow-400 text-blue-950 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                    Point it at the QR code displayed at the church entrance
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-yellow-400 text-blue-950 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                    Tap the link that appears — your attendance is recorded automatically
                  </li>
                </ol>
              </CardContent>
            </Card>

            {/* Clock-out from this page (no QR token needed) */}
            {alreadyCheckedIn && !alreadyClockedOut && (
              <Card className="border-0 bg-blue-800/40">
                <CardContent className="py-4 space-y-3 text-center">
                  <p className="text-blue-200 text-sm">Done for this service?</p>
                  <Button
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-blue-950 font-semibold"
                    onClick={doClockOut}
                    disabled={clockOutLoading}
                  >
                    {clockOutLoading
                      ? <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      : <LogOut className="w-4 h-4 mr-2" />}
                    Clock Out
                  </Button>
                  {clockOutError && <p className="text-red-300 text-xs">{clockOutError}</p>}
                </CardContent>
              </Card>
            )}

            {clockOutDone && (
              <Card className="border-0 bg-green-900/50">
                <CardContent className="py-4 text-center space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto" />
                  <p className="text-white font-medium">Clocked out successfully</p>
                  <p className="text-green-300 text-xs">God bless you for serving today!</p>
                </CardContent>
              </Card>
            )}

            {myScans.length > 0 && <ScanHistory />}
          </>
        )}

        {/* ── QR-token flow: scanning / result / clock-out ── */}
        {token && (
          <>
            {scanning && (
              <Card className="border-0 bg-blue-800/50">
                <CardContent className="py-6 flex flex-col items-center gap-3 text-white">
                  <RefreshCw className="w-8 h-8 animate-spin text-yellow-400" />
                  <p className="text-sm">Recording your attendance…</p>
                </CardContent>
              </Card>
            )}

            {scanResult && !scanning && (
              <Card className={`border-0 ${scanResult.duplicate ? "bg-blue-800/50" : "bg-green-800/50"}`}>
                <CardContent className="py-5 space-y-2 text-center">
                  {scanResult.duplicate
                    ? <Clock className="w-10 h-10 text-yellow-400 mx-auto" />
                    : <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />}
                  <p className="text-white font-semibold text-lg">
                    {scanResult.duplicate ? "Already Recorded" : "Scan Successful!"}
                  </p>
                  <p className="text-blue-200 text-sm">{scanResult.message}</p>
                  {scanResult.intervalLabel && (
                    <div className="bg-blue-900/60 rounded-lg px-3 py-2 inline-block">
                      <p className="text-yellow-400 font-medium text-sm">
                        {INTERVAL_LABELS[scanResult.intervalLabel] ?? scanResult.intervalLabel}
                      </p>
                    </div>
                  )}
                  <Button variant="outline" size="sm"
                    className="mt-1 border-blue-400 text-blue-200 hover:bg-blue-800"
                    onClick={doScan} disabled={scanning}>
                    Scan Again
                  </Button>
                </CardContent>
              </Card>
            )}

            {scanError && !scanning && (
              <Card className="border-0 bg-red-900/50">
                <CardContent className="py-5 space-y-2 text-center">
                  <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
                  <p className="text-white font-semibold">Scan Failed</p>
                  <p className="text-red-200 text-sm">{scanError}</p>
                  <Button variant="outline" size="sm"
                    className="border-red-400 text-red-200 hover:bg-red-900"
                    onClick={doScan} disabled={scanning}>
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            )}

            {hasScanned && !alreadyClockedOut && (
              <Card className="border-0 bg-blue-800/40">
                <CardContent className="py-4 space-y-3 text-center">
                  <p className="text-blue-200 text-sm">Done for this service?</p>
                  <Button
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-blue-950 font-semibold"
                    onClick={doClockOut} disabled={clockOutLoading}>
                    {clockOutLoading
                      ? <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      : <LogOut className="w-4 h-4 mr-2" />}
                    Clock Out
                  </Button>
                  {clockOutError && <p className="text-red-300 text-xs">{clockOutError}</p>}
                </CardContent>
              </Card>
            )}

            {clockOutDone && (
              <Card className="border-0 bg-green-900/50">
                <CardContent className="py-4 text-center space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto" />
                  <p className="text-white font-medium">Clocked out successfully</p>
                  <p className="text-green-300 text-xs">God bless you for serving today!</p>
                </CardContent>
              </Card>
            )}

            {myScans.length > 0 && <ScanHistory />}
          </>
        )}

        {/* ── Footer ── */}
        <div className="text-center">
          <button className="text-blue-400 text-xs underline" onClick={() => navigate(homeHref)}>
            Back to app
          </button>
        </div>

      </div>
    </div>
  );
}
