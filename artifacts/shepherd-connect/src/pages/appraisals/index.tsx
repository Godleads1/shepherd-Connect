import { useState } from "react";
import { useListChildren, useCreateAppraisal, useListTeachers, useListTeacherAllocations } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, PenTool, Users } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/auth";

const LEVELS = [
  { value: "excellent",           label: "Excellent"           },
  { value: "good",                label: "Good"                },
  { value: "fair",                label: "Fair"                },
  { value: "needs_encouragement", label: "Needs Encouragement" },
];

export default function Appraisals() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const isAdmin = authUser?.role === "admin" || authUser?.role === "super_admin";

  const { data: teachers, isLoading: teachersLoading } = useListTeachers({});
  const teacherRecord = (teachers as any[])?.find((t: any) => t.userId === authUser?.id);

  const { data: allocations } = useListTeacherAllocations(
    teacherRecord ? { teacherId: teacherRecord.id } : {},
  );
  const allocationList: any[] = Array.isArray(allocations) ? allocations : (allocations as any)?.data ?? [];
  const latestClassId = allocationList.length > 0
    ? allocationList.sort((a: any, b: any) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())[0]?.classId
    : undefined;

  const childParams = isAdmin ? {} : (latestClassId ? { classId: latestClassId } : { classId: -1 });
  const { data: childrenData, isLoading: childrenLoading } = useListChildren(childParams);
  const children: any[] = (childrenData as any)?.data ?? [];

  const createMutation = useCreateAppraisal();

  const [isOpen, setIsOpen]           = useState(false);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const [part, setPart]               = useState("good");
  const [scripture, setScripture]     = useState("good");
  const [social, setSocial]           = useState("good");
  const [milestone, setMilestone]     = useState("");
  const [note, setNote]               = useState("");

  const handleSubmit = async () => {
    if (!selectedChild) return;
    try {
      await createMutation.mutateAsync({
        data: {
          childId: selectedChild,
          serviceDate: format(new Date(), "yyyy-MM-dd"),
          participationLevel: part as any,
          scriptureEngagement: scripture as any,
          socialInteraction: social as any,
          milestoneNote: milestone,
          personalNoteToParent: note,
        },
      });
      toast({ title: "Appraisal submitted successfully" });
      setIsOpen(false);
      setMilestone(""); setNote("");
    } catch {
      toast({ variant: "destructive", title: "Failed to submit appraisal" });
    }
  };

  const openForChild = (id: number) => {
    setSelectedChild(id);
    setPart("good"); setScripture("good"); setSocial("good"); setMilestone(""); setNote("");
    setIsOpen(true);
  };

  const isLoading = teachersLoading || childrenLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3" style={{ fontFamily: "'Playfair Display', serif" }}>
          <Award className="w-6 h-6 text-[#f59e0b]" /> Class Appraisals
        </h1>
        {!isAdmin && (teacherRecord
          ? <p className="text-sm text-gray-500 mt-1">Showing children in your assigned class only</p>
          : !teachersLoading && <p className="text-sm text-amber-600 mt-1">No teacher record found for your account — contact an admin.</p>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : children.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No children found</p>
          <p className="text-gray-400 text-sm mt-1">
            {!isAdmin && !latestClassId
              ? "You don't have a class allocation yet. Contact your admin."
              : "There are no children assigned to this class."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {children.map((child: any) => (
            <Card key={child.id} className="rounded-2xl border hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                    {child.firstName[0]}{child.lastName[0]}
                  </div>
                  <div>
                    <CardTitle className="text-base">{child.firstName} {child.lastName}</CardTitle>
                    <p className="text-xs text-gray-400">Age {child.age ?? "—"}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {child.currentClass && (
                  <p className="text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-1.5 border">
                    📚 {child.currentClass.name}
                  </p>
                )}
                <Button className="w-full gap-2" variant="outline" onClick={() => openForChild(child.id)}>
                  <PenTool className="w-4 h-4" /> Write Appraisal
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Student Appraisal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            {[
              { label: "Participation Level", value: part, setter: setPart },
              { label: "Scripture Engagement", value: scripture, setter: setScripture },
              { label: "Social Interaction", value: social, setter: setSocial },
            ].map(({ label, value, setter }) => (
              <div key={label} className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">{label}</label>
                <Select value={value} onValueChange={setter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">Milestone (Optional)</label>
              <Textarea value={milestone} onChange={e => setMilestone(e.target.value)}
                placeholder="E.g., Memorised John 3:16, prayed aloud for the first time…" rows={2} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">Note to Parent (Optional)</label>
              <Textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder="An encouraging word for the parent…" rows={2} />
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t flex-shrink-0">
            <Button variant="outline" className="flex-1" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={createMutation.isPending}
              style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
              {createMutation.isPending ? "Submitting…" : "Submit Appraisal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
