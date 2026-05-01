import { useState } from "react";
import { useListChildren, useCreateAppraisal } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Award, PenTool } from "lucide-react";
import { format } from "date-fns";

export default function Appraisals() {
  const { data: children } = useListChildren(); // teacher's class children in real app
  const createMutation = useCreateAppraisal();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);

  // Form State
  const [part, setPart] = useState("good");
  const [scripture, setScripture] = useState("good");
  const [social, setSocial] = useState("good");
  const [milestone, setMilestone] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = async () => {
    if (!selectedChild) return;
    try {
      await createMutation.mutateAsync({
        data: {
          childId: selectedChild,
          serviceDate: format(new Date(), 'yyyy-MM-dd'),
          participationLevel: part as any,
          scriptureEngagement: scripture as any,
          socialInteraction: social as any,
          milestoneNote: milestone,
          personalNoteToParent: note
        }
      });
      toast({ title: "Appraisal submitted" });
      setIsOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to submit" });
    }
  };

  const openForChild = (id: number) => {
    setSelectedChild(id);
    setPart("good"); setScripture("good"); setSocial("good"); setMilestone(""); setNote("");
    setIsOpen(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
        <Award className="w-8 h-8" />
        Class Appraisals
      </h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {children?.data?.map((child) => (
          <Card key={child.id}>
            <CardHeader className="pb-2">
              <CardTitle>{child.firstName} {child.lastName}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="w-full gap-2" variant="outline" onClick={() => openForChild(child.id)}>
                <PenTool className="w-4 h-4" /> Write Appraisal
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Student Appraisal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Participation Level</label>
              <Select value={part} onValueChange={setPart}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="needs_encouragement">Needs Encouragement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Scripture Engagement</label>
              <Select value={scripture} onValueChange={setScripture}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="needs_encouragement">Needs Encouragement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Social Interaction</label>
              <Select value={social} onValueChange={setSocial}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="needs_encouragement">Needs Encouragement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Milestone (Optional)</label>
              <Textarea value={milestone} onChange={e=>setMilestone(e.target.value)} placeholder="E.g., Memorized John 3:16" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Note to Parent (Optional)</label>
              <Textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Encouraging word for parents" />
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending}>
              Submit Appraisal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
