import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "@/lib/api-call";
import { useListChildren, useListClasses } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";
import { CheckCircle, XCircle, Plus, ArrowRight, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function statusBadge(status: string) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending</Badge>;
}

export default function ClassChangeRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [isOpen, setIsOpen] = useState(false);
  const [childId, setChildId] = useState("");
  const [requestedClassId, setRequestedClassId] = useState("");
  const [reason, setReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const { data: requestsData, isLoading, refetch } = useQuery({
    queryKey: ["class-change-requests"],
    queryFn: () => apiGet<{ data: any[]; total: number }>("/class-change-requests"),
  });

  const { data: childrenData } = useListChildren({});
  const { data: classesData } = useListClasses({});

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost("/class-change-requests", body),
    onSuccess: () => {
      toast({ title: "Class change request submitted" });
      setIsOpen(false);
      setChildId(""); setRequestedClassId(""); setReason("");
      refetch();
    },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      apiPut(`/class-change-requests/${id}/approve`, { adminNotes: notes }),
    onSuccess: () => {
      toast({ title: "Request approved. Child moved to new class." });
      setReviewingId(null);
      refetch();
    },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      apiPut(`/class-change-requests/${id}/reject`, { adminNotes: notes }),
    onSuccess: () => {
      toast({ title: "Request rejected." });
      setReviewingId(null);
      refetch();
    },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });

  const requests = requestsData?.data || [];
  const pending = requests.filter(r => r.status === "pending");
  const resolved = requests.filter(r => r.status !== "pending");

  const handleSubmit = () => {
    if (!childId || !requestedClassId) {
      toast({ variant: "destructive", title: "Please select a child and a class" });
      return;
    }
    createMutation.mutate({ childId: Number(childId), requestedClassId: Number(requestedClassId), reason });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Class Change Requests</h1>
          <p className="text-gray-500 text-sm mt-1">Request a class change for your child or review pending requests</p>
        </div>
        {!isAdmin && (
          <Button onClick={() => setIsOpen(true)} style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Request
          </Button>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Class Change</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Child</label>
              <Select value={childId} onValueChange={setChildId}>
                <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
                <SelectContent>
                  {(childrenData?.data || []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Requested Class</label>
              <Select value={requestedClassId} onValueChange={setRequestedClassId}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {(classesData || []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.serviceSlot})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Reason (optional)</label>
              <Textarea placeholder="Explain why you want this class change..." value={reason} onChange={e => setReason(e.target.value)} rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending} style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
                {createMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review modal for admin */}
      {reviewingId && (
        <Dialog open={!!reviewingId} onOpenChange={() => setReviewingId(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Review Request</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Admin Notes (optional)</label>
                <Textarea placeholder="Add a note for the parent..." value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={3} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setReviewingId(null)}>Cancel</Button>
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => rejectMutation.mutate({ id: reviewingId, notes: adminNotes })} disabled={rejectMutation.isPending}>
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => approveMutation.mutate({ id: reviewingId, notes: adminNotes })} disabled={approveMutation.isPending}>
                  <CheckCircle className="w-4 h-4 mr-1" /> Approve & Move Child
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="w-4 h-4" /> Pending
            {pending.length > 0 && <Badge className="bg-amber-500 text-white border-0 text-xs ml-1">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolved.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {isLoading ? <Skeleton className="h-24 w-full rounded-xl" /> :
            pending.length === 0 ? (
              <div className="text-center py-12 bg-white border rounded-xl text-gray-400">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                No pending requests
              </div>
            ) : pending.map((r: any) => (
              <div key={r.id} className="bg-white border rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{r.child?.firstName} {r.child?.lastName}</p>
                      {statusBadge(r.status)}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 flex-wrap">
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{r.currentClass?.name || "Unassigned"}</span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">{r.requestedClass?.name}</span>
                    </div>
                    {r.reason && <p className="text-sm text-gray-500 mt-2 italic">"{r.reason}"</p>}
                    <p className="text-xs text-gray-400 mt-2">
                      By {r.requestedByUser?.firstName} {r.requestedByUser?.lastName} · {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => { setAdminNotes(""); setReviewingId(r.id); }}>
                        Review
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </TabsContent>

        <TabsContent value="resolved" className="mt-4 space-y-3">
          {resolved.length === 0 ? (
            <div className="text-center py-12 bg-white border rounded-xl text-gray-400">No resolved requests yet</div>
          ) : resolved.map((r: any) => (
            <div key={r.id} className={`bg-white border rounded-xl p-4 ${r.status === "rejected" ? "border-red-100" : "border-green-100"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{r.child?.firstName} {r.child?.lastName}</p>
                    {statusBadge(r.status)}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 flex-wrap">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{r.currentClass?.name || "Unassigned"}</span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">{r.requestedClass?.name}</span>
                  </div>
                  {r.adminNotes && <p className="text-sm text-gray-500 mt-1 italic">Admin note: "{r.adminNotes}"</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
