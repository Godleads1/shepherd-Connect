import { useState } from "react";
import { useListAttendance, useCheckOut } from "@workspace/api-client-react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, LogOut, CheckCircle, Clock, ShieldCheck, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiPost } from "@/lib/api-call";

export default function Checkout() {
  const [search, setSearch] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpResult, setOtpResult] = useState<any>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const { toast } = useToast();
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: attendanceList, refetch } = useListAttendance({ serviceDate: today });
  
  const checkoutMutation = useCheckOut();

  const handleCheckout = async (attendanceId: number) => {
    try {
      await checkoutMutation.mutateAsync({ id: attendanceId, data: {} });
      toast({ title: "Checked out successfully" });
      refetch();
    } catch (error) {
      toast({ variant: "destructive", title: "Checkout failed" });
    }
  };

  const handleOtpVerify = async () => {
    if (!otpInput.trim()) {
      toast({ variant: "destructive", title: "Please enter an OTP code" });
      return;
    }
    setOtpLoading(true);
    setOtpResult(null);
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
      await checkoutMutation.mutateAsync({ id: attendanceId, data: {} });
      toast({ title: "Child checked out via delegate OTP" });
      setOtpInput(""); setOtpResult(null);
      refetch();
    } catch {
      toast({ variant: "destructive", title: "Checkout failed" });
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

      <Tabs defaultValue="standard">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="standard" className="flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Standard Checkout
          </TabsTrigger>
          <TabsTrigger value="otp" className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Delegate OTP Checkout
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
                          Checked in at {record.checkInTime ? format(new Date(record.checkInTime), 'HH:mm') : '—'}
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
                  onChange={(e) => { setOtpInput(e.target.value.replace(/\D/g, "")); setOtpResult(null); }}
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
                      <p><span className="text-gray-500">Authorised for:</span> <strong>{otpResult.data?.child?.firstName} {otpResult.data?.child?.lastName}</strong></p>
                    </div>

                    {/* Find the attendance record for this child */}
                    {(() => {
                      const childId = otpResult.data?.delegate?.childId;
                      const rec = activeRecords.find((r: any) => r.childId === childId);
                      return rec ? (
                        <Button
                          className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleOtpCheckout(rec.id)}
                          disabled={checkoutMutation.isPending}
                        >
                          <LogOut className="w-4 h-4" /> Confirm Checkout for {otpResult.data?.child?.firstName}
                        </Button>
                      ) : (
                        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          This child is not currently checked in today.
                        </p>
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
      </Tabs>
    </div>
  );
}
