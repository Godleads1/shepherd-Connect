import { useState } from "react";
import { useListTeacherAllocations } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Zap, BarChart3, RefreshCw, Calendar } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api-call";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";

type ServiceHour = {
  teacherId: number; teacherName: string;
  totalAllocations: number; completedServices: number;
  upcomingServices: number; estimatedHours: number;
};

export default function TeacherAllocations() {
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const [tab, setTab] = useState<"schedule" | "hours" | "auto">("schedule");
  const [autoDate, setAutoDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [autoSlots, setAutoSlots] = useState("9am,11am");
  const [showAutoDialog, setShowAutoDialog] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: allocations, isLoading } = useListTeacherAllocations();

  const { data: serviceHours, isLoading: hoursLoading } = useQuery({
    queryKey: ["teacher-service-hours"],
    queryFn: () => apiGet<ServiceHour[]>("/teacher-allocations/service-hours"),
    enabled: tab === "hours" && isAdmin,
  });

  const autoSchedule = useMutation({
    mutationFn: () => apiPost<any>("/teacher-allocations/auto-schedule", {
      serviceDate: autoDate,
      serviceSlots: autoSlots.split(",").map(s => s.trim()).filter(Boolean),
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["listTeacherAllocations"] });
      setShowAutoDialog(false);
      toast({ title: "Auto-schedule complete", description: `${data.created} allocation(s) created for ${autoDate}.` });
    },
    onError: () => toast({ variant: "destructive", title: "Auto-schedule failed" }),
  });

  const statusColors: Record<string, string> = {
    confirmed: "bg-green-100 text-green-800 border-green-200",
    scheduled: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-gray-100 text-gray-700 border-gray-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary">Teacher Allocations</h1>
          <p className="text-gray-500 text-sm mt-1">Manage teacher schedules, service hours, and rotation.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAutoDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-colors"
            style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
            <Zap className="h-4 w-4" /> Auto-Schedule
          </button>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {[
          { key: "schedule", label: "Schedule", icon: Calendar },
          ...(isAdmin ? [
            { key: "hours", label: "Service Hours", icon: BarChart3 },
          ] : []),
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "schedule" && (
        <div className="border rounded-xl overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Date</TableHead>
                <TableHead>Slot</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                ))
              ) : (allocations || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-gray-400">
                    No allocations yet. Use Auto-Schedule to get started.
                  </TableCell>
                </TableRow>
              ) : (allocations || []).map((alloc) => (
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
              <Input value={autoSlots} onChange={e => setAutoSlots(e.target.value)} placeholder="9am,11am" />
              <p className="text-xs text-gray-500 mt-1">e.g. 7am,9am,11am,1pm</p>
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
    </div>
  );
}
