import { useState } from "react";
import { useListPickupDelegates, useCreatePickupDelegate, useApprovePickupDelegate } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShieldCheck, Copy, Check } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const formSchema = z.object({
  childId: z.coerce.number().min(1, "Child ID is required"),
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
});

export default function PickupDelegates() {
  const { data: delegates, refetch } = useListPickupDelegates();
  const createMutation = useCreatePickupDelegate();
  const approveMutation = useApprovePickupDelegate();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [newOtp, setNewOtp] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { childId: 1, name: "", phone: "" }, // hardcoding childId for demo
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      const res = await createMutation.mutateAsync({ data });
      setNewOtp(res.otpCode || "OTP-Generated");
      toast({ title: "Delegate added" });
      refetch();
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to add delegate" });
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approveMutation.mutateAsync({ id, data: {} });
      toast({ title: "Delegate approved" });
      refetch();
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to approve delegate" });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary">Pickup Delegates</h1>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) setNewOtp(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="btn-add-delegate">Add Delegate</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Pickup Delegate</DialogTitle>
            </DialogHeader>
            
            {newOtp ? (
              <div className="text-center space-y-4 py-6">
                <ShieldCheck className="w-16 h-16 text-success mx-auto" />
                <h3 className="text-xl font-bold">Delegate Created</h3>
                <p className="text-muted-foreground">Please share this OTP with the delegate. They will need it for pickup.</p>
                <div className="text-4xl font-mono tracking-widest font-bold p-4 bg-muted rounded-lg border">
                  {newOtp}
                </div>
                <Button className="w-full" onClick={() => setIsOpen(false)}>Done</Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* For real app, childId would be a select from user's children */}
                  <FormField control={form.control} name="childId" render={({ field }) => (
                    <FormItem><FormLabel>Child ID</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Delegate Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Delegate Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Delegate"}
                  </Button>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {delegates?.map(delegate => (
          <Card key={delegate.id}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{delegate.name}</CardTitle>
                  <CardDescription>{delegate.phone}</CardDescription>
                </div>
                <Badge variant={delegate.parentApproved ? "default" : "secondary"}>
                  {delegate.parentApproved ? "Approved" : "Pending"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {!delegate.parentApproved && (
                <Button 
                  className="w-full mt-2 gap-2" 
                  onClick={() => handleApprove(delegate.id)}
                  disabled={approveMutation.isPending}
                >
                  <Check className="w-4 h-4" /> Approve Delegate
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {delegates?.length === 0 && (
          <div className="col-span-2 text-center p-8 border rounded-lg text-muted-foreground">
            No pickup delegates assigned.
          </div>
        )}
      </div>
    </div>
  );
}
