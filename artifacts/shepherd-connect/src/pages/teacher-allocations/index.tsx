import { useState } from "react";
import { useListTeacherAllocations } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Zap, BarChart3, RefreshCw, Calendar, AlertTriangle, UserMinus, UserCheck, ArrowLeftRight, Pencil, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-call";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";
import { QueryError } from "@/components/QueryError";

type ServiceHour = {
  teacherId: number; teacherName: string;
  totalAllocations: number; completedServices: number;
  upcomingServices: number; estimatedHours: number;
};

type Allocation = {
  id: number; teacherId: number; classId: number; serviceDate: string;
  serviceSlot: string; status: string;
  teacher?: { id: number; user?: { id: number; firstName: string; lastName: string } | null } | null;
  class?: { id: number; name: string } | null;
};

type Teacher = { id: number; user?: { id: number; firstName: string; lastName: string } | null };

export default function TeacherAllocations() {
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const [tab, setTab] = useState<"schedule" | "hours" | "substitute" | "auto">("schedule");
  const [autoDate, setAutoDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [autoSlots, setAutoSlots] = useState("7am,10:30am");
  const [showAutoDialog, setShowAutoDialog] = useState(false);

  // Delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteAllocId, setDeleteAllocId] = useState<number | null>(null);

  // Mark unavailable
  const [showUnavailDialog, setShowUnavailDialog] = useState(false);
  const [unavailAlloc, setUnavailAlloc] = useState<Allocation | null>(null);
  const [unavailReason, setUnavailReason] = useState("");

  // Assign substitute
  const [showSubstituteDialog, setShowSubstituteDialog] = useState(false);
  const [substituteAlloc, setSubstituteAlloc] = useState<Allocation | null>(null);
  const [newTeacherId, setNewTeacherId] = useState("");
  const [swapReason, setSwapReason] = useState("");

  // Edit allocation (change class)
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editAlloc, setEditAlloc] = useState<Allocation | null>(null);
  const [editClassId, setEditClassId] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");

  // Add allocation manually
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addTeacherId, setAddTeacherId] = useState("");
  const [addClassId, setAddClassId] = useState("");
  const [addDate, setAddDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [addSlot, setAddSlot] = useState<"7am" | "10:30am" | "both">("7am");

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: allocations, isLoading, isError } = useListTeacherAllocations();

  const { data: serviceHours, isLoading: hoursLoading } = useQuery({
    queryKey: ["teacher-service-hours"],
    queryFn: () => apiGet<ServiceHour[]>("/teacher-allocations/service-hours"),
    enabled: (tab === "hours" || tab === "substitute") && isAdmin,
  });

  const { data: teachers } = useQuery({
    queryKey: ["teachers-list-alloc"],
    queryFn: () => apiGet<Teacher[]>("/teachers"),
    enabled: showSubstituteDialog || showEditDialog || showAddDialog,
  });

  type ClassItem = { id: number; name: string };
  const { data: classes } = useQuery({
    queryKey: ["classes-list-alloc"],
    queryFn: () => apiGet<ClassItem[]>("/classes"),
    enabled: showEditDialog || showAddDialog,
  });

  const editAllocation = useMutation({
    mutationFn: ({ id, classId, teacherId }: { id: number; classId?: number; teacherId?: number }) =>
      apiPut(`/teacher-allocations/${id}`, { ...(classId ? { classId } : {}), ...(teacherId ? { teacherId } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: allocQueryKey });
      setShowEditDialog(false);
      setEditClassId(""); setEditTeacherId("");
      toast({ title: "Allocation updated", description: "The class assignment has been changed." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to update allocation" }),
  });

  const deleteAllocation = useMutation({
    mutationFn: (id: number) => apiDelete(`/teacher-allocations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: allocQueryKey });
      toast({ title: "Removed", description: "Allocation removed from schedule." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to remove allocation" }),
  });

  const addAllocation = useMutation({
    mutationFn: async () => {
      const slots = addSlot === "both" ? ["7am", "10:30am"] : [addSlot];
      for (const slot of slots) {
        await apiPost("/teacher-allocations", {
          teacherId: parseInt(addTeacherId, 10),
          classId: parseInt(addClassId, 10),
          serviceDate: addDate,
          serviceSlot: slot,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: allocQueryKey });
      setShowAddDialog(false);
      setAddTeacherId(""); setAddClassId(""); setAddSlot("7am");
      const desc = addSlot === "both" ? "Teacher scheduled for both services." : "Teacher has been scheduled.";
      toast({ title: "Allocation added", description: desc });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to add allocation" }),
  });

  const cancelledAllocations = (allocations || []).filter(a => a.status === "cancelled") as unknown as Allocation[];

  const myTeacherId = (() => {
    if (!user || isAdmin) return null;
    const myAlloc = (allocations || []).find((a: any) => a.teacher?.user?.id === user.id);
    return (myAlloc as any)?.teacher?.id ?? null;
  })();

  const allocQueryKey = ["/api/teacher-allocations"];

  const autoSchedule = useMutation({
    mutationFn: () => apiPost<any>("/teacher-allocations/auto-schedule", {
      serviceDate: autoDate,
      serviceSlots: autoSlots.split(",").map(s => s.trim()).filter(Boolean),
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: allocQueryKey });
      setShowAutoDialog(false);
      toast({ title: "Auto-schedule complete", description: `${data.created} allocation(s) created for ${autoDate}.` });
    },
    onError: () => toast({ variant: "destructive", title: "Auto-schedule failed" }),
  });

  const markUnavailable = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiPost(`/teacher-allocations/${id}/mark-unavailable`, { reason }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: allocQueryKey });
      setShowUnavailDialog(false);
      setUnavailReason("");
      toast({ title: "Marked Unavailable", description: `${data.adminNotified} admin(s) notified to assign a substitute.` });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to mark unavailable" }),
  });

  const assignSubstitute = useMutation({
    mutationFn: ({ id, teacherId, reason }: { id: number; teacherId: number; reason: string }) =>
      apiPost(`/teacher-allocations/${id}/swap`, { newTeacherId: teacherId, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: allocQueryKey });
      setShowSubstituteDialog(false);
      setNewTeacherId(""); setSwapReason("");
      toast({ title: "Substitute assigned", description: "Teacher swapped and both parties notified." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to assign substitute" }),
  });

  const statusColors: Record<string, string> = {
    confirmed: "bg-green-100 text-green-800 border-green-200",
    scheduled: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-gray-100 text-gray-700 border-gray-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };

  const myAllocations = (allocations || []).filter((a: any) => a.teacher?.user?.id === user?.id);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary">Teacher Allocations</h1>
          <p className="text-gray-500 text-sm mt-1">Manage teacher schedules, service hours, rotation, and substitutes.</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button onClick={() => { setAddDate(format(new Date(), "yyyy-MM-dd")); setAddTeacherId(""); setAddClassId(""); setAddSlot("7am"); setShowAddDialog(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
              <Pencil className="h-4 w-4" /> Add Allocation
            </button>
            <button onClick={() => setShowAutoDialog(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-colors"
              style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
              <Zap className="h-4 w-4" /> Auto-Schedule
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit flex-wrap">
        {[
          { key: "schedule", label: "Schedule", icon: Calendar },
          ...(isAdmin ? [
            { key: "hours", label: "Service Hours", icon: BarChart3 },
            { key: "substitute", label: "Substitutes", icon: UserMinus, badge: cancelledAllocations.length },
          ] : []),
        ].map(({ key, label, icon: Icon, badge }: any) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
              tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            <Icon className="h-4 w-4" /> {label}
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "schedule" && (
        <div className="space-y-4">
          {/* My upcoming allocations (teacher view) */}
          {!isAdmin && myAllocations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> My Upcoming Services
              </p>
              <div className="space-y-2">
                {(myAllocations as any[]).filter(a => a.status === "scheduled" || a.status === "confirmed").map((alloc: any) => (
                  <div key={alloc.id} className="bg-white rounded-xl border border-blue-100 px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{alloc.class?.name}</p>
                      <p className="text-xs text-gray-500">{format(new Date(alloc.serviceDate), "MMM d, yyyy")} · {alloc.serviceSlot}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${statusColors[alloc.status] || ""}`}>{alloc.status}</Badge>
                      <button
                        onClick={() => { setUnavailAlloc(alloc); setShowUnavailDialog(true); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                        <UserMinus className="h-3.5 w-3.5" /> Mark Unavailable
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border rounded-xl overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Date</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isError ? (
                  <TableRow><TableCell colSpan={isAdmin ? 6 : 5}>
                    <QueryError message="Could not load allocations." />
                  </TableCell></TableRow>
                ) : isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={isAdmin ? 6 : 5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                  ))
                ) : (allocations || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-10 text-gray-400">
                      No allocations yet. Use Auto-Schedule to get started.
                    </TableCell>
                  </TableRow>
                ) : (allocations || []).map((alloc: any) => (
                  <TableRow key={alloc.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{format(new Date(alloc.serviceDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{alloc.serviceSlot}</TableCell>
                    <TableCell>{alloc.teacher?.user?.firstName} {alloc.teacher?.user?.lastName}</TableCell>
                    <TableCell>{alloc.class?.name}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${statusColors[alloc.status] || "bg-gray-100 text-gray-700"}`}>
                        {alloc.status}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => { setEditAlloc(alloc); setEditClassId(String(alloc.classId)); setEditTeacherId(String(alloc.teacherId)); setShowEditDialog(true); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => { setDeleteAllocId(alloc.id); setShowDeleteDialog(true); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap">
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                          {alloc.status === "cancelled" && (
                            <button
                              onClick={() => { setSubstituteAlloc(alloc); setShowSubstituteDialog(true); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors whitespace-nowrap">
                              <UserCheck className="h-3.5 w-3.5" /> Assign Sub
                            </button>
                          )}
                          {(alloc.status === "scheduled" || alloc.status === "confirmed") && (
                            <button
                              onClick={() => { setSubstituteAlloc(alloc); setShowSubstituteDialog(true); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors whitespace-nowrap">
                              <ArrowLeftRight className="h-3.5 w-3.5" /> Swap
                            </button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {tab === "hours" && isAdmin && (
        <div className="space-y-3">
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-700 text-sm">Teacher Service Hours Summary</h2>
            </div>
            {hoursLoading ? (
              <div className="p-4 space-y-2">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Teacher</TableHead>
                    <TableHead className="text-right">Total Sessions</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Upcoming</TableHead>
                    <TableHead className="text-right">Est. Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(serviceHours || []).map((sh) => (
                    <TableRow key={sh.teacherId} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                            {sh.teacherName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <span className="font-medium text-sm">{sh.teacherName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{sh.totalAllocations}</TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-green-100 text-green-800 border-green-200">{sh.completedServices}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">{sh.upcomingServices}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-gray-900">{sh.estimatedHours}h</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!serviceHours || serviceHours.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-400">No data yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}

      {tab === "substitute" && isAdmin && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Substitute Management</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Teachers who have marked themselves unavailable appear here. Assign a substitute to cover their class.
              </p>
            </div>
          </div>

          {cancelledAllocations.length === 0 ? (
            <div className="text-center py-16 border rounded-2xl bg-white text-gray-400">
              <UserCheck className="h-12 w-12 mx-auto mb-3 text-green-300" />
              <p className="font-semibold text-gray-500">All teachers are available</p>
              <p className="text-sm mt-1">No substitute assignments needed right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cancelledAllocations.map(alloc => (
                <div key={alloc.id} className="bg-white border border-red-100 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                      <UserMinus className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {alloc.teacher?.user?.firstName} {alloc.teacher?.user?.lastName}
                        <span className="text-red-600 ml-2 font-normal text-xs">unavailable</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {alloc.class?.name} · {format(new Date(alloc.serviceDate), "MMM d, yyyy")} · {alloc.serviceSlot}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setSubstituteAlloc(alloc); setShowSubstituteDialog(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl transition-colors"
                    style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                    <UserCheck className="h-4 w-4" /> Assign Substitute
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Auto-schedule dialog */}
      <Dialog open={showAutoDialog} onOpenChange={setShowAutoDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-blue-600" /> Auto-Schedule Teachers</DialogTitle>
            <DialogDescription>
              The system will assign teachers to classes for the selected date using a fair rotation algorithm based on service hours.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Service Date</label>
              <Input type="date" value={autoDate} onChange={e => setAutoDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Service Slots (comma-separated)</label>
              <Input value={autoSlots} onChange={e => setAutoSlots(e.target.value)} placeholder="7am,10:30am" />
              <p className="text-xs text-gray-500 mt-1">Sunday services only: 7am (1st) and/or 10:30am (2nd)</p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAutoDialog(false)}>Cancel</Button>
            <Button className="flex-1 flex items-center gap-2" style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}
              onClick={() => autoSchedule.mutate()} disabled={autoSchedule.isPending}>
              {autoSchedule.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {autoSchedule.isPending ? "Scheduling..." : "Auto-Schedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark Unavailable dialog */}
      <Dialog open={showUnavailDialog} onOpenChange={v => { setShowUnavailDialog(v); if (!v) setUnavailReason(""); }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700"><UserMinus className="h-5 w-5" /> Mark Yourself Unavailable</DialogTitle>
            <DialogDescription>
              {unavailAlloc && (
                <span>This will cancel your allocation for <strong>{unavailAlloc.class?.name}</strong> on{" "}
                {format(new Date(unavailAlloc.serviceDate), "MMM d, yyyy")} ({unavailAlloc.serviceSlot}).{" "}
                Admin will be notified to assign a substitute.</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Reason (optional)</label>
              <Textarea
                value={unavailReason}
                onChange={e => setUnavailReason(e.target.value)}
                placeholder="e.g. illness, travel, family emergency..."
                className="resize-none h-20 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowUnavailDialog(false)}>Cancel</Button>
            <Button variant="destructive" className="flex-1"
              disabled={markUnavailable.isPending}
              onClick={() => unavailAlloc && markUnavailable.mutate({ id: unavailAlloc.id, reason: unavailReason })}>
              {markUnavailable.isPending ? "Submitting..." : "Confirm — I'm Unavailable"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Substitute / Swap dialog */}
      <Dialog open={showSubstituteDialog} onOpenChange={v => { setShowSubstituteDialog(v); if (!v) { setNewTeacherId(""); setSwapReason(""); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <UserCheck className="h-5 w-5" />
              {substituteAlloc?.status === "cancelled" ? "Assign Substitute" : "Swap Teacher"}
            </DialogTitle>
            <DialogDescription>
              {substituteAlloc && (
                <span>
                  {substituteAlloc.class?.name} · {format(new Date(substituteAlloc.serviceDate), "MMM d, yyyy")} · {substituteAlloc.serviceSlot}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                {substituteAlloc?.status === "cancelled" ? "Assign Substitute Teacher" : "New Teacher"}
              </label>
              <Select value={newTeacherId} onValueChange={setNewTeacherId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select teacher..." /></SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  {(teachers || []).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.user?.firstName} {t.user?.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Reason (optional)</label>
              <Input
                value={swapReason}
                onChange={e => setSwapReason(e.target.value)}
                placeholder="Reason for swap/assignment..."
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowSubstituteDialog(false)}>Cancel</Button>
            <Button
              className="flex-1"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
              disabled={!newTeacherId || assignSubstitute.isPending}
              onClick={() => substituteAlloc && assignSubstitute.mutate({
                id: substituteAlloc.id,
                teacherId: parseInt(newTeacherId, 10),
                reason: swapReason,
              })}>
              {assignSubstitute.isPending ? "Assigning..." : "Confirm Assignment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Allocation dialog */}
      <Dialog open={showAddDialog} onOpenChange={v => { setShowAddDialog(v); if (!v) { setAddTeacherId(""); setAddClassId(""); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-700">
              <Pencil className="h-5 w-5" /> Add Allocation
            </DialogTitle>
            <DialogDescription>Manually schedule a teacher for a class and service.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Teacher</label>
              <Select value={addTeacherId} onValueChange={setAddTeacherId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select teacher..." /></SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  {(teachers || []).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.user?.firstName} {t.user?.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Class</label>
              <Select value={addClassId} onValueChange={setAddClassId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select class..." /></SelectTrigger>
                <SelectContent>
                  {(classes || []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Service Date</label>
              <Input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Service Slot</label>
              <Select value={addSlot} onValueChange={v => setAddSlot(v as "7am" | "10:30am" | "both")}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7am">7:00 AM — 1st Service</SelectItem>
                  <SelectItem value="10:30am">10:30 AM — 2nd Service</SelectItem>
                  <SelectItem value="both">Both Services</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              className="flex-1"
              style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}
              disabled={!addTeacherId || !addClassId || !addDate || addAllocation.isPending}
              onClick={() => addAllocation.mutate()}>
              {addAllocation.isPending ? "Scheduling..." : "Schedule Teacher"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Allocation dialog */}
      <Dialog open={showEditDialog} onOpenChange={v => { setShowEditDialog(v); if (!v) { setEditClassId(""); setEditTeacherId(""); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-700">
              <Pencil className="h-5 w-5" /> Edit Allocation
            </DialogTitle>
            <DialogDescription>
              {editAlloc && (
                <span>
                  {format(new Date(editAlloc.serviceDate), "MMM d, yyyy")} · {editAlloc.serviceSlot}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Teacher</label>
              <Select value={editTeacherId} onValueChange={setEditTeacherId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select teacher..." /></SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  {(teachers || []).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.user?.firstName} {t.user?.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Class</label>
              <Select value={editClassId} onValueChange={setEditClassId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select class..." /></SelectTrigger>
                <SelectContent>
                  {(classes || []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button
              className="flex-1"
              style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}
              disabled={(!editClassId && !editTeacherId) || editAllocation.isPending}
              onClick={() => editAlloc && editAllocation.mutate({
                id: editAlloc.id,
                classId: editClassId ? parseInt(editClassId, 10) : undefined,
                teacherId: editTeacherId ? parseInt(editTeacherId, 10) : undefined,
              })}>
              {editAllocation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Allocation</DialogTitle>
            <DialogDescription>Are you sure you want to remove this allocation from the schedule? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteAllocation.isPending}
              onClick={() => {
                if (deleteAllocId !== null) {
                  deleteAllocation.mutate(deleteAllocId, {
                    onSuccess: () => setShowDeleteDialog(false),
                  });
                }
              }}>
              {deleteAllocation.isPending ? "Removing..." : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
