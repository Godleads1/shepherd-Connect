import { useState } from "react";
import { useGetMyFamily, useListPickupDelegates, useCreatePickupDelegate, useApprovePickupDelegate } from "@workspace/api-client-react";
import { QueryError } from "@/components/QueryError";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShieldCheck, Check, Copy, AlertCircle, User, Phone, Baby, Trash2, History, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/contexts/auth";
import { PhotoUploader, resolvePhotoUrl } from "@/components/PhotoUploader";

const PHONE_RE = /^\d{11}$/;

const formSchema = z.object({
  childIds: z.array(z.number()).min(1, "Please select at least one child"),
  name: z.string().min(1, "Delegate name is required"),
  phone: z.string().regex(PHONE_RE, "Must be exactly 11 digits"),
});

export default function PickupDelegates() {
  const { user } = useAuth();
  const { data: family } = useGetMyFamily();
  const { data: delegates, refetch, isError: delegatesError } = useListPickupDelegates();
  const createMutation = useCreatePickupDelegate();
  const approveMutation = useApprovePickupDelegate();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [newOtp, setNewOtp] = useState<string | null>(null);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [delegatePhotoUrl, setDelegatePhotoUrl] = useState("");

  const children = family?.children || [];

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { childIds: [], name: "", phone: "" },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      // One delegate covering all selected children — a single OTP is issued.
      const res = await createMutation.mutateAsync({ data: {
        childId: data.childIds[0],
        childIds: data.childIds,
        name: data.name,
        phone: data.phone,
        photoUrl: delegatePhotoUrl || undefined,
      } as any });
      setNewOtp(res.otpCode || null);
      toast({ title: data.childIds.length > 1 ? `Delegate added for ${data.childIds.length} children` : "Delegate added successfully" });
      form.reset({ childIds: [], name: "", phone: "" });
      setDelegatePhotoUrl("");
      refetch();
    } catch (error: any) {
      toast({ variant: "destructive", title: error.message || "Failed to add delegate" });
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approveMutation.mutateAsync({ id });
      toast({ title: "Delegate approved" });
      refetch();
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to approve delegate" });
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Remove ${name} as a pickup delegate?`)) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/pickup-delegates/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to remove delegate");
      toast({ title: `${name} removed as delegate` });
      refetch();
    } catch (error: any) {
      toast({ variant: "destructive", title: error.message || "Failed to remove delegate" });
    }
  };

  const handleCopyOtp = () => {
    if (newOtp) {
      navigator.clipboard.writeText(newOtp).then(() => {
        setCopiedOtp(true);
        setTimeout(() => setCopiedOtp(false), 2000);
      });
    }
  };

  const getChildName = (childId: number) => {
    const child = children.find((c: any) => c.id === childId);
    return child ? `${child.firstName} ${child.lastName}` : `Child #${childId}`;
  };

  // Delegates happen per service day (Sunday): a delegate whose OTP has expired is history.
  const now = new Date();
  const isExpired = (d: any) => d.otpExpiresAt && new Date(d.otpExpiresAt) < now;
  const activeDelegates = (delegates || []).filter((d: any) => !isExpired(d));
  const pastDelegates = (delegates || []).filter(isExpired);

  // Group past delegates: same person + same day (+ multi-child OTPs) become one history entry
  const historyEntries = Object.values(
    pastDelegates.reduce((acc: Record<string, any>, d: any) => {
      const day = d.createdAt ? format(new Date(d.createdAt), "yyyy-MM-dd") : "unknown";
      const key = `${day}|${d.name}|${d.phone}`;
      if (!acc[key]) acc[key] = { key, name: d.name, phone: d.phone, photoUrl: d.photoUrl, date: d.createdAt, childIds: [] as number[], approved: false };
      acc[key].childIds.push(d.childId);
      if (d.parentApproved || d.approvalStatus === "approved") acc[key].approved = true;
      return acc;
    }, {}),
  ).sort((a: any, b: any) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Pickup Delegates</h1>
          <p className="text-gray-500 text-sm mt-1">Authorise trusted people to collect your children with a secure OTP</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setNewOtp(null); setCopiedOtp(false); } }}>
          <DialogTrigger asChild>
            <Button data-testid="btn-add-delegate" style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
              + Add Delegate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{newOtp ? "Delegate OTP Code" : "Add Pickup Delegate"}</DialogTitle>
            </DialogHeader>

            {newOtp ? (
              <div className="text-center space-y-5 py-4">
                <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "#dcfce7" }}>
                  <ShieldCheck className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Delegate Authorised!</h3>
                  <p className="text-gray-500 text-sm mt-1">Share this one-time code with your delegate. They must present it at checkout.</p>
                </div>
                <div className="relative bg-gray-50 rounded-2xl p-5 border-2 border-dashed border-gray-200">
                  <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">OTP Code</p>
                  <p className="text-5xl font-mono font-bold tracking-widest text-[#1e3a8a]">{newOtp}</p>
                  <p className="text-xs text-gray-400 mt-2">Valid for 24 hours</p>
                  <button onClick={handleCopyOtp} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-gray-200 transition-colors">
                    {copiedOtp ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex gap-2 text-left">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>This code is shown only once. Save it now and share it with your delegate securely.</span>
                </div>
                <Button className="w-full" style={{ background: "#1e3a8a" }} onClick={() => setIsOpen(false)}>Done</Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="flex justify-center">
                    <PhotoUploader
                      currentPhotoUrl={delegatePhotoUrl}
                      fallbackLabel="D"
                      onChange={setDelegatePhotoUrl}
                      size="lg"
                      shape="circle"
                    />
                  </div>
                  <FormField control={form.control} name="childIds" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1"><Baby className="w-4 h-4" /> Which Children?</FormLabel>
                      {children.length > 0 ? (
                        <div className="space-y-2 border rounded-xl p-3 max-h-44 overflow-y-auto">
                          {children.map((c: any) => {
                            const checked = (field.value || []).includes(c.id);
                            return (
                              <label key={c.id} className="flex items-center gap-2.5 cursor-pointer text-sm py-0.5">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-gray-300 accent-[#1e3a8a]"
                                  checked={checked}
                                  onChange={(e) => {
                                    const cur = field.value || [];
                                    field.onChange(e.target.checked ? [...cur, c.id] : cur.filter((id: number) => id !== c.id));
                                  }}
                                />
                                <span>{c.firstName} {c.lastName} · Age {c.age}</span>
                              </label>
                            );
                          })}
                          <p className="text-[11px] text-gray-400 pt-1 border-t">Select one or more — one OTP covers them all.</p>
                        </div>
                      ) : (
                        <FormControl>
                          <Input type="number" placeholder="Child ID"
                            onChange={(e) => field.onChange(e.target.value ? [Number(e.target.value)] : [])} />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1"><User className="w-4 h-4" /> Delegate's Full Name</FormLabel>
                      <FormControl><Input placeholder="e.g. Aunty Grace Adeyemi" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1"><Phone className="w-4 h-4" /> Phone Number</FormLabel>
                      <FormControl><Input placeholder="+234..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex gap-2">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>A secure 6-digit OTP will be generated. Share it with your delegate for secure pickup verification.</span>
                  </div>
                  <Button type="submit" className="w-full" style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }} disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Delegate & Generate OTP"}
                  </Button>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {delegatesError ? (
        <QueryError message="Could not load your pickup delegates." onRetry={() => refetch()} />
      ) : (
      <div className="grid gap-4 sm:grid-cols-2">
        {activeDelegates.map((delegate: any) => (
          <Card key={delegate.id} className="border rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {resolvePhotoUrl(delegate.photoUrl) ? (
                    <img src={resolvePhotoUrl(delegate.photoUrl)!} alt={delegate.name}
                      className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ background: delegate.parentApproved ? "#16a34a" : "#f59e0b" }}>
                      {delegate.name[0]}
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-base">{delegate.name}</CardTitle>
                    <CardDescription className="text-xs">{delegate.phone}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={delegate.parentApproved ? "default" : "secondary"}
                    className={delegate.parentApproved ? "bg-green-100 text-green-800 border-green-200" : ""}>
                    {delegate.parentApproved ? "Approved" : "Pending"}
                  </Badge>
                  <button
                    onClick={() => handleDelete(delegate.id, delegate.name)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Remove delegate"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-3 pb-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                <Baby className="w-3.5 h-3.5" />
                <span>Authorised for: <strong>{getChildName(delegate.childId)}</strong></span>
              </div>
              {!delegate.parentApproved && (
                <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleApprove(delegate.id)} disabled={approveMutation.isPending}>
                  <Check className="w-4 h-4" /> Confirm Approval
                </Button>
              )}
              {delegate.parentApproved && (
                <p className="text-xs text-center text-gray-400 flex items-center gap-1 justify-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500" /> Authorised to collect
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {activeDelegates.length === 0 && (
          <div className="col-span-2 text-center py-12 border rounded-2xl bg-white border-dashed border-gray-200">
            <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No active pickup delegates</p>
            <p className="text-gray-400 text-sm mt-1">Add trusted people who can collect your children</p>
          </div>
        )}
      </div>
      )}

      {/* ── Delegate History — past service days (delegates run on Sundays) ── */}
      {historyEntries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pt-2">
            <History className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Delegate History</h2>
          </div>
          <div className="space-y-2">
            {historyEntries.map((h: any) => (
              <div key={h.key} className="bg-white border rounded-2xl px-4 py-3 flex items-center gap-3">
                {resolvePhotoUrl(h.photoUrl) ? (
                  <img src={resolvePhotoUrl(h.photoUrl)!} alt={h.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold bg-gray-300 flex-shrink-0">
                    {h.name?.[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{h.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    Collected: {h.childIds.map((id: number) => getChildName(id)).join(", ")}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                    <CalendarDays className="w-3 h-3" />
                    {h.date ? format(new Date(h.date), "EEE, dd MMM yyyy") : "—"}
                  </p>
                  <Badge variant={h.approved ? "default" : "secondary"}
                    className={`mt-1 text-[10px] ${h.approved ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-500"}`}>
                    {h.approved ? "Approved" : "Expired"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
