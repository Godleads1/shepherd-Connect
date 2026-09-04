import { useState, useEffect, useCallback } from "react";
import { useListAttendance, useCheckOut } from "@workspace/api-client-react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, LogOut, CheckCircle, Clock, ShieldCheck, KeyRound, Bell, Timer, ChevronDown, ChevronUp, X, HandHeart, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInMinutes, differenceInSeconds, formatDistanceToNow } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiPost, apiGet } from "@/lib/api-call";
import { useAuth } from "@/contexts/auth";
import LocationBanner from "@/components/LocationBanner";
import { refreshAfterCommittedCheckout } from "./checkout-flow";

const SERVICE_CLOCK_KEY = "shepherd_service_end_time";

function ServiceClock() {
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const [endTime, setEndTime] = useState<string>(() => localStorage.getItem(SERVICE_CLOCK_KEY) || "");
  const [inputTime, setInputTime] = useState(endTime);
  const [showSet, setShowSet] = useState(false);
  const [now, setNow] = useState(new Date());
  const [predismissalSent, setPredismissalSent] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const endDate = endTime ? (() => {
    const [h, m] = endTime.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  })() : null;

  const minsLeft = endDate ? differenceInMinutes(endDate, now) : null;
  const secsLeft = endDate ? differenceInSeconds(endDate, now) : null;
  const isPast = secsLeft !== null && secsLeft < 0;
  const isWarning = minsLeft !== null && minsLeft <= 10 && minsLeft >= 0;
  const isCritical = minsLeft !== null && minsLeft <= 2 && minsLeft >= 0;

  useEffect(() => {
    if (minsLeft === 10 && !predismissalSent && endTime) {
      setPredismissalSent(true);
      apiPost("/notifications/pre-dismissal", {}).then(() => {
        toast({ title: "Pre-Dismissal Alert Sent", description: "All parents of checked-in children have been notified (10 min to service end)." });
      }).catch(() => {});
    }
  }, [minsLeft, predismissalSent, endTime, toast]);

  useEffect(() => {
    if (isPast && !feedbackSent && endTime) {
      setFeedbackSent(true);
      apiPost("/notifications/broadcast", {
        title: "How was today's service? 💬",
        message: "Service has ended! We'd love to hear your thoughts. Please take a moment to share your feedback through the app.",
        targetRole: "parent",
        type: "feedback_prompt",
        channel: "in_app",
      }).then(() => {
        toast({ title: "Feedback Prompt Sent", description: "Parents have been invited to rate today's service." });
      }).catch(() => {});
    }
  }, [isPast, feedbackSent, endTime, toast]);

  const handleSet = () => {
    if (!inputTime) return;
    setEndTime(inputTime);
    localStorage.setItem(SERVICE_CLOCK_KEY, inputTime);
    setPredismissalSent(false);
    setFeedbackSent(false);
    setShowSet(false);
    toast({ title: "Service end time set", description: `Pre-dismissal alert at 10 min, feedback prompt at service end.` });
  };

  const handleClear = () => {
    setEndTime("");
    setInputTime("");
    localStorage.removeItem(SERVICE_CLOCK_KEY);
    setPredismissalSent(false);
    setFeedbackSent(false);
  };

  if (!endTime && !isAdmin) return null;

  const bgClass = isCritical ? "bg-red-50 border-red-300" : isWarning ? "bg-amber-50 border-amber-300" : "bg-blue-50 border-blue-200";
  const textClass = isCritical ? "text-red-800" : isWarning ? "text-amber-800" : "text-blue-800";

  return (
    <div className={`rounded-2xl border p-4 ${bgClass}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCritical ? "bg-red-200" : isWarning ? "bg-amber-200" : "bg-blue-200"}`}>
            <Timer className={`h-5 w-5 ${textClass}`} />
          </div>
          <div>
            <p className={`text-xs font-bold uppercase tracking-wide ${textClass}`}>
              Service Clock {predismissalSent && <span className="ml-2 text-green-700">· Pre-dismissal sent ✓</span>}
            </p>
            {endTime ? (
              <div className="flex items-center gap-2 mt-0.5">
                <p className={`text-2xl font-black tabular-nums ${isCritical ? "text-red-700 animate-pulse" : isWarning ? "text-amber-700" : "text-blue-700"}`}>
                  {isPast ? "Service ended" : (
                    minsLeft !== null && secsLeft !== null
                      ? `${Math.floor(Math.abs(secsLeft) / 60)}m ${Math.abs(secsLeft) % 60}s`
                      : "—"
                  )}
                </p>
                {!isPast && <span className={`text-xs ${textClass} opacity-70`}>remaining · ends {endTime}</span>}
              </div>
            ) : (
              <p className={`text-sm ${textClass} opacity-70`}>No service end time set</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isWarning && !isPast && (
            <button onClick={() => {
              apiPost("/notifications/pre-dismissal", {}).then(() =>
                toast({ title: "Pre-dismissal alert sent manually" })
              ).catch(() => {});
            }} className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors">
              <Bell className="h-3.5 w-3.5" /> Notify Parents Now
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowSet(v => !v)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-colors ${textClass} bg-white hover:bg-gray-50`}>
              <Clock className="h-3.5 w-3.5" /> {showSet ? "Cancel" : endTime ? "Change" : "Set Time"}
            </button>
          )}
          {endTime && isAdmin && (
            <button onClick={handleClear} className="p-2 rounded-xl border text-gray-400 hover:text-red-500 hover:border-red-200 bg-white transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {showSet && isAdmin && (
        <div className="mt-3 flex items-center gap-3 pt-3 border-t border-current/10 animate-in fade-in slide-in-from-top-1 duration-150">
          <label className={`text-xs font-semibold ${textClass} whitespace-nowrap`}>Service ends at:</label>
          <Input type="time" value={inputTime} onChange={e => setInputTime(e.target.value)}
            className="h-9 w-32 text-sm font-mono" />
          <button onClick={handleSet} disabled={!inputTime}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl disabled:opacity-40 transition-colors">
            Set
          </button>
          <p className={`text-xs ${textClass} opacity-70`}>Auto-sends parent alert at T−10 min</p>
        </div>
      )}
    </div>
  );
}

function PickupQueue({ activeRecords, onCheckout }: { activeRecords: any[]; onCheckout: () => Promise<void> }) {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [handingOver, setHandingOver] = useState<string | null>(null);
  const { toast } = useToast();
  const checkoutMutation = useCheckOut();

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ queue: any[] }>("/pickup-requests");
      setQueue(res.queue ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchQueue();
    const iv = setInterval(fetchQueue, 15000);
    return () => clearInterval(iv);
  }, [fetchQueue]);

  const handleHandOver = async (item: any) => {
    const rec = activeRecords.find((r: any) => r.childId === item.childId);
    setHandingOver(item.id);
    try {
      if (!rec) {
        toast({
          variant: "destructive",
          title: "Handover could not start",
          description: "No active attendance record was found. Refresh the page before trying again.",
        });
        return;
      }

      const result = await checkoutMutation.mutateAsync({ id: rec.id, data: {} });
      const resolvedIds = new Set(result.resolvedPickupRequestIds);
      setQueue(prev => prev.filter(q => q.id !== item.id && !resolvedIds.has(q.id)));
      toast({
        title: result.alreadyApplied ? "Child was already checked out" : "Child handed over",
        description: `${item.childName} is checked out and removed from the pickup queue`,
      });

      const refresh = await refreshAfterCommittedCheckout(onCheckout);
      if (refresh.status === "refresh_failed") {
        toast({
          title: "Handover saved — refresh needed",
          description: "The child is checked out, but the latest attendance list could not be loaded. Use Refresh to reconcile the screen.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Handover failed",
        description: error?.message || "The checkout was not completed.",
      });
    } finally {
      setHandingOver(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <HandHeart className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900">Parent Pickup Queue</p>
          <p className="text-xs text-amber-700 mt-0.5">Parents who have tapped "I'm here to collect" in their app appear here. Their child's teacher has also been notified. Refreshes every 15 seconds.</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
          {queue.length} waiting{queue.length !== 1 ? "" : ""}
        </p>
        <button onClick={fetchQueue} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {queue.length === 0 ? (
        <div className="text-center py-14 border rounded-2xl bg-white text-gray-400">
          <HandHeart className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p className="font-medium">No parents waiting</p>
          <p className="text-sm mt-1">Queue will update automatically</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((item: any) => (
            <Card key={item.id} className="border rounded-2xl overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                      {item.childName?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{item.childName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge variant="outline" className="text-xs border-blue-200 text-blue-700">{item.className}</Badge>
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(item.requestedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Parent: <span className="font-medium">{item.parentName}</span></p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="flex-shrink-0 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleHandOver(item)}
                    disabled={handingOver === item.id}>
                    <LogOut className="w-3.5 h-3.5" />
                    {handingOver === item.id ? "…" : "Hand Over"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Checkout() {
  const [search, setSearch] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpResult, setOtpResult] = useState<any>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [notifyingParent, setNotifyingParent] = useState(false);
  const [approvalState, setApprovalState] = useState<"idle" | "pending" | "approved" | "denied">("idle");
  const [checkingApproval, setCheckingApproval] = useState(false);
  const { toast } = useToast();

  const today = format(new Date(), "yyyy-MM-dd");
  const { data: attendanceList, refetch } = useListAttendance({ serviceDate: today });

  const checkoutMutation = useCheckOut();

  const refreshAttendance = async () => {
    const result = await refetch();
    if (result.error) throw result.error;
  };

  const handleCheckout = async (attendanceId: number) => {
    try {
      const result = await checkoutMutation.mutateAsync({ id: attendanceId, data: {} });
      toast({ title: result.alreadyApplied ? "Child was already checked out" : "Checked out successfully" });
      const refresh = await refreshAfterCommittedCheckout(refreshAttendance);
      if (refresh.status === "refresh_failed") {
        toast({
          title: "Checkout saved — refresh needed",
          description: "The child is checked out, but the attendance list could not be refreshed. Try Refresh before continuing.",
        });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Checkout failed", description: error?.message });
    }
  };

  const handleOtpVerify = async () => {
    if (!otpInput.trim()) {
      toast({ variant: "destructive", title: "Please enter an OTP code" });
      return;
    }
    setOtpLoading(true);
    setOtpResult(null);
    setApprovalState("idle");
    try {
      const res = await apiPost<any>("/pickup-delegates/verify-otp", { otpCode: otpInput.trim() });
      setOtpResult({ success: true, data: res });
      toast({ title: "OTP verified! Delegate is authorised." });
    } catch (e: any) {
      setOtpResult({ success: false, message: e.message || "Invalid OTP" });
      toast({ variant: "destructive", title: e.message || "OTP verification failed" });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpCheckout = async (attendanceId: number) => {
    try {
      const result = await checkoutMutation.mutateAsync({ id: attendanceId, data: {} });
      toast({ title: result.alreadyApplied ? "Child was already checked out" : "Child checked out via delegate OTP" });
      setOtpInput(""); setOtpResult(null);
      const refresh = await refreshAfterCommittedCheckout(refreshAttendance);
      if (refresh.status === "refresh_failed") {
        toast({
          title: "Checkout saved — refresh needed",
          description: "The child is checked out, but the attendance list could not be refreshed. Try Refresh before continuing.",
        });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Checkout failed", description: error?.message });
    }
  };

  const handleNotifyParent = async (delegateId: number, childName: string) => {
    setNotifyingParent(true);
    try {
      await apiPost(`/pickup-delegates/${delegateId}/notify-parent`, {});
      setApprovalState("pending");
      toast({ title: "Parent Notified — Awaiting Approval", description: `${childName}'s parent has been asked to approve this pickup in their app.` });
    } catch {
      toast({ variant: "destructive", title: "Could not notify parent" });
    } finally {
      setNotifyingParent(false);
    }
  };

  const handleCheckApproval = async (delegateId: number) => {
    setCheckingApproval(true);
    try {
      const res = await apiGet<any>(`/pickup-delegates/${delegateId}`);
      if (res.approvalStatus === "approved") {
        setApprovalState("approved");
        toast({ title: "Pickup Approved ✓", description: "Parent has approved. You may now check out the child." });
      } else if (res.approvalStatus === "denied") {
        setApprovalState("denied");
        toast({ variant: "destructive", title: "Pickup Denied", description: "Parent has denied this pickup request." });
      } else {
        toast({ title: "Still waiting…", description: "Parent hasn't responded yet. Ask them to check their Shepherd Connect app." });
      }
    } catch {
      toast({ variant: "destructive", title: "Could not check status" });
    } finally {
      setCheckingApproval(false);
    }
  };

  const activeRecords = (attendanceList || []).filter((a: any) =>
    a.status === "in_class" || a.status === "dropped_off"
  );

  const filteredRecords = activeRecords.filter((a: any) =>
    search === "" ||
    (a.child?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
     a.child?.lastName?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Check Out</h1>
        <p className="text-gray-500 text-sm mt-1">Release children to authorised parents or delegates</p>
      </div>

      <LocationBanner />

      <ServiceClock />

      <Tabs defaultValue="standard">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="standard" className="flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Standard Checkout
          </TabsTrigger>
          <TabsTrigger value="otp" className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Delegate OTP Checkout
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <HandHeart className="w-4 h-4" /> Pickup Queue
          </TabsTrigger>
        </TabsList>

        {/* ── Standard Checkout ── */}
        <TabsContent value="standard" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              className="pl-10 h-12 text-base rounded-xl"
              placeholder="Search by child name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-checkout-search"
            />
          </div>

          <div className="grid gap-3">
            {filteredRecords.length === 0 && (
              <div className="text-center py-12 border rounded-xl bg-white text-gray-400">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                {activeRecords.length === 0
                  ? "No children currently checked in"
                  : "No children matching your search"}
              </div>
            )}

            {filteredRecords.map((record: any) => (
              <Card key={record.id} className="border rounded-2xl overflow-hidden">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                      style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                      {record.child?.firstName?.[0]}{record.child?.lastName?.[0]}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{record.child?.firstName} {record.child?.lastName}</h3>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">{record.class?.name}</Badge>
                        <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                          <Clock className="w-3 h-3" />
                          Checked in at {record.checkInTime ? format(new Date(record.checkInTime), "HH:mm") : "—"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="default"
                    className="gap-2 flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}
                    onClick={() => handleCheckout(record.id)}
                    disabled={checkoutMutation.isPending}
                    data-testid={`btn-checkout-${record.id}`}
                  >
                    <LogOut className="w-4 h-4" />
                    Check Out
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── OTP Delegate Checkout ── */}
        <TabsContent value="otp" className="mt-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900">OTP Delegate Verification</p>
              <p className="text-xs text-blue-700 mt-0.5">
                When a parent sends a delegate to collect their child, ask the delegate for their 6-digit OTP. Enter it below to verify and authorise pickup.
              </p>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#1e3a8a]" /> Enter Delegate OTP
              </label>
              <div className="flex gap-3">
                <Input
                  className="h-14 text-2xl text-center font-mono tracking-widest rounded-xl max-w-[200px]"
                  placeholder="000000"
                  value={otpInput}
                  maxLength={6}
                  onChange={(e) => { setOtpInput(e.target.value.replace(/\D/g, "")); setOtpResult(null); setApprovalState("idle"); }}
                  data-testid="input-otp-code"
                />
                <Button
                  className="h-14 px-6 rounded-xl"
                  style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}
                  onClick={handleOtpVerify}
                  disabled={otpLoading || otpInput.length < 6}
                  data-testid="btn-verify-otp"
                >
                  {otpLoading ? "Verifying..." : "Verify OTP"}
                </Button>
              </div>
            </div>

            {otpResult && (
              <div className={`rounded-xl p-4 border ${otpResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                {otpResult.success ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <p className="font-semibold text-green-900">Delegate Verified!</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-green-100 text-sm space-y-1">
                      <p><span className="text-gray-500">Delegate:</span> <strong>{otpResult.data?.delegate?.name}</strong></p>
                      <p><span className="text-gray-500">Phone:</span> {otpResult.data?.delegate?.phone}</p>
                      <p><span className="text-gray-500">Authorised for:</span>{" "}
                        <strong>
                          {(otpResult.data?.children?.length
                            ? otpResult.data.children
                            : [otpResult.data?.child].filter(Boolean)
                          ).map((c: any) => `${c.firstName} ${c.lastName}`).join(", ")}
                        </strong>
                      </p>
                    </div>

                    {/* Step 2: Notify Parent for Approval (covers all children on this OTP) */}
                    {otpResult.data?.delegate?.id && approvalState === "idle" && (
                      <button
                        onClick={() => handleNotifyParent(otpResult.data.delegate.id, (otpResult.data?.children?.length > 1 ? `${otpResult.data.children.length} children` : otpResult.data?.child?.firstName) || "child")}
                        disabled={notifyingParent}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                        <Bell className="w-4 h-4" />
                        {notifyingParent ? "Notifying..." : "Request Parent Approval"}
                      </button>
                    )}

                    {/* Step 3: Waiting for parent approval */}
                    {approvalState === "pending" && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin flex-shrink-0" />
                          <p className="text-sm font-semibold text-amber-900">Waiting for parent approval…</p>
                        </div>
                        <p className="text-xs text-amber-700">Ask the parent to open their Shepherd Connect app and tap <strong>Approve</strong> on the notification.</p>
                        <button
                          onClick={() => handleCheckApproval(otpResult.data.delegate.id)}
                          disabled={checkingApproval}
                          className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                          {checkingApproval ? "Checking…" : "↻ Check Approval Status"}
                        </button>
                      </div>
                    )}

                    {/* Denied state */}
                    {approvalState === "denied" && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <p className="font-semibold text-red-800 flex items-center gap-2">
                          <span className="text-red-500">✕</span> Parent Denied This Pickup
                        </p>
                        <p className="text-xs text-red-700 mt-1">Do not release the child. Contact the family directly.</p>
                      </div>
                    )}

                    {/* After approval: one checkout button per covered child that is checked in */}
                    {(() => {
                      if (approvalState !== "approved") return null;
                      const covered: any[] = otpResult.data?.children?.length
                        ? otpResult.data.children
                        : [otpResult.data?.child].filter(Boolean);
                      const withRecords = covered.map((c: any) => ({
                        child: c,
                        rec: activeRecords.find((r: any) => r.childId === c.id),
                      }));
                      const anyCheckedIn = withRecords.some(w => w.rec);
                      return (
                        <div className="space-y-2">
                          {withRecords.map(({ child, rec }) => rec ? (
                            <Button
                              key={child.id}
                              className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleOtpCheckout(rec.id)}
                              disabled={checkoutMutation.isPending}
                            >
                              <LogOut className="w-4 h-4" /> Confirm Checkout for {child.firstName}
                            </Button>
                          ) : (
                            <p key={child.id} className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              {child.firstName} {child.lastName} is not currently checked in today.
                            </p>
                          ))}
                          {!anyCheckedIn && covered.length === 0 && (
                            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              This child is not currently checked in today.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">✕</div>
                    <p className="text-red-800 font-medium">{otpResult.message || "Invalid or expired OTP"}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Pickup Queue ── */}
        <TabsContent value="queue" className="mt-4">
          <PickupQueue activeRecords={activeRecords} onCheckout={refreshAttendance} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
