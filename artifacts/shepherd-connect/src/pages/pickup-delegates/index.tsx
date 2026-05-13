import { useState } from "react";
import { useGetMyFamily, useListPickupDelegates, useCreatePickupDelegate, useApprovePickupDelegate } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShieldCheck, Check, Copy, AlertCircle, User, Phone, Baby } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/contexts/auth";
import { PhotoUploader, resolvePhotoUrl } from "@/components/PhotoUploader";

const formSchema = z.object({
  childId: z.coerce.number().min(1, "Please select a child"),
  name: z.string().min(1, "Delegate name is required"),
  phone: z.string().min(1, "Phone number is required"),
});

export default function PickupDelegates() {
  const { user } = useAuth();
  const { data: family } = useGetMyFamily();
  const { data: delegates, refetch } = useListPickupDelegates();
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
    defaultValues: { childId: 0, name: "", phone: "" },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      const res = await createMutation.mutateAsync({ data: { ...data, photoUrl: delegatePhotoUrl || undefined } as any });
      setNewOtp(res.otpCode || null);
      toast({ title: "Delegate added successfully" });
      form.reset({ childId: 0, name: "", phone: "" });
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
                  <FormField control={form.control} name="childId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1"><Baby className="w-4 h-4" /> Which Child?</FormLabel>
                      {children.length > 0 ? (
                        <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a child" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {children.map((c: any) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.firstName} {c.lastName} · Age {c.age}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <FormControl>
                          <Input type="number" placeholder="Child ID" {...field} />
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

      <div className="grid gap-4 sm:grid-cols-2">
        {delegates?.map((delegate: any) => (
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
                <Badge variant={delegate.parentApproved ? "default" : "secondary"}
                  className={delegate.parentApproved ? "bg-green-100 text-green-800 border-green-200" : ""}>
                  {delegate.parentApproved ? "Approved" : "Pending"}
                </Badge>
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
        {(!delegates || delegates.length === 0) && (
          <div className="col-span-2 text-center py-12 border rounded-2xl bg-white border-dashed border-gray-200">
            <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No pickup delegates yet</p>
            <p className="text-gray-400 text-sm mt-1">Add trusted people who can collect your children</p>
          </div>
        )}
      </div>
    </div>
  );
}
