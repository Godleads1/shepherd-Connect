import { useState } from "react";
import { useTriggerEmergency, useListEmergencies } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Flame, ShieldAlert, HeartPulse, Shield, BadgeAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Emergencies() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<string>("");
  const [level, setLevel] = useState<string>("L1");
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  const { data: emergencies } = useListEmergencies({ status: "active" });
  const triggerMutation = useTriggerEmergency();

  const handleTrigger = async () => {
    try {
      await triggerMutation.mutateAsync({
        data: {
          type: type as any,
          level: level as any,
          description: description || `Emergency triggered: ${type}`
        }
      });
      setIsOpen(false);
      setType("");
      setDescription("");
      toast({
        variant: "destructive",
        title: "EMERGENCY TRIGGERED",
        description: "All staff have been notified."
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to trigger",
        description: "Please try again or use radio."
      });
    }
  };

  const getEmergencyIcon = (t: string) => {
    switch (t) {
      case 'medical': return <HeartPulse className="h-6 w-6" />;
      case 'fire_evacuation': return <Flame className="h-6 w-6" />;
      case 'security': return <ShieldAlert className="h-6 w-6" />;
      default: return <AlertTriangle className="h-6 w-6" />;
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-primary">Emergency Management</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button 
          variant="destructive" 
          className="h-32 flex-col gap-2 text-lg font-bold"
          onClick={() => { setType("medical"); setIsOpen(true); }}
          data-testid="btn-trigger-medical"
        >
          <HeartPulse className="h-8 w-8 mb-2" />
          Medical
        </Button>
        <Button 
          variant="destructive" 
          className="h-32 flex-col gap-2 text-lg font-bold bg-orange-600 hover:bg-orange-700"
          onClick={() => { setType("missing_child"); setIsOpen(true); }}
          data-testid="btn-trigger-missing"
        >
          <BadgeAlert className="h-8 w-8 mb-2" />
          Missing Child
        </Button>
        <Button 
          variant="destructive" 
          className="h-32 flex-col gap-2 text-lg font-bold bg-red-600 hover:bg-red-700"
          onClick={() => { setType("fire_evacuation"); setIsOpen(true); }}
          data-testid="btn-trigger-fire"
        >
          <Flame className="h-8 w-8 mb-2" />
          Fire / Evac
        </Button>
        <Button 
          variant="destructive" 
          className="h-32 flex-col gap-2 text-lg font-bold bg-slate-800 hover:bg-slate-900"
          onClick={() => { setType("security"); setIsOpen(true); }}
          data-testid="btn-trigger-security"
        >
          <ShieldAlert className="h-8 w-8 mb-2" />
          Security
        </Button>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          Active Emergencies
        </h2>
        
        {emergencies?.data?.length === 0 ? (
          <div className="p-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
            <Shield className="h-12 w-12 mb-2 text-success/50" />
            <p>No active emergencies. All clear.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {emergencies?.data?.map((em) => (
              <Card key={em.id} className="border-destructive bg-destructive/10">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="p-2 bg-destructive text-destructive-foreground rounded-full">
                    {getEmergencyIcon(em.type)}
                  </div>
                  <div>
                    <CardTitle className="text-destructive capitalize flex items-center gap-2">
                      {em.type.replace('_', ' ')}
                      <Badge variant="outline" className="border-destructive text-destructive">Level {em.level}</Badge>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{em.description}</p>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-white">Escalate</Button>
                    <Button variant="default" className="bg-success hover:bg-success/90 text-white">Mark Resolved</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="border-destructive border-2 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2 text-xl">
              <AlertTriangle className="h-6 w-6" />
              CONFIRM EMERGENCY
            </DialogTitle>
            <DialogDescription className="text-base font-bold">
              You are about to trigger a <span className="uppercase text-destructive">{type.replace('_', ' ')}</span> emergency. This will alert all staff immediately.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Severity Level</label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="border-destructive">
                  <SelectValue placeholder="Select Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L1">Level 1 (Local Area)</SelectItem>
                  <SelectItem value="L2">Level 2 (Zone)</SelectItem>
                  <SelectItem value="L3">Level 3 (Building)</SelectItem>
                  <SelectItem value="L4">Level 4 (Site-wide Evac)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Brief Description (Optional but helpful)</label>
              <Textarea 
                placeholder="Where? Who? What?" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="border-destructive"
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleTrigger} disabled={triggerMutation.isPending} className="font-bold text-lg h-12">
              TRIGGER ALARM
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
