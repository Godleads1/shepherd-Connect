import { useState } from "react";
import { useTriggerEmergency, useListEmergencies } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Flame, ShieldAlert, HeartPulse, Shield, BadgeAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
      case 'missing_child': return <BadgeAlert className="h-6 w-6" />;
      default: return <AlertTriangle className="h-6 w-6" />;
    }
  };

  const getEmergencyColor = (t: string) => {
    switch (t) {
      case 'medical': return "from-red-500 to-rose-600";
      case 'fire_evacuation': return "from-orange-500 to-red-600";
      case 'security': return "from-slate-700 to-slate-900";
      case 'missing_child': return "from-amber-500 to-orange-600";
      default: return "from-red-600 to-red-800";
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3" style={{ fontFamily: "'Playfair Display', serif" }}>
          <AlertTriangle className="h-8 w-8 text-red-600" /> Emergency Management
        </h1>
        <p className="text-gray-500 mt-2 text-sm">Trigger immediate alerts to all staff and security personnel.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button 
          className="h-40 rounded-2xl flex flex-col items-center justify-center gap-3 text-white font-bold transition-all hover:scale-[1.02] shadow-lg active:scale-95"
          style={{ background: "linear-gradient(135deg, #ef4444, #e11d48)" }}
          onClick={() => { setType("medical"); setIsOpen(true); }}
          data-testid="btn-trigger-medical"
        >
          <div className="p-3 bg-white/20 rounded-full mb-1"><HeartPulse className="h-8 w-8" /></div>
          <span className="text-lg tracking-wide">Medical</span>
        </button>
        
        <button 
          className="h-40 rounded-2xl flex flex-col items-center justify-center gap-3 text-white font-bold transition-all hover:scale-[1.02] shadow-lg active:scale-95"
          style={{ background: "linear-gradient(135deg, #f59e0b, #ea580c)" }}
          onClick={() => { setType("missing_child"); setIsOpen(true); }}
          data-testid="btn-trigger-missing"
        >
          <div className="p-3 bg-white/20 rounded-full mb-1"><BadgeAlert className="h-8 w-8" /></div>
          <span className="text-lg tracking-wide">Missing Child</span>
        </button>
        
        <button 
          className="h-40 rounded-2xl flex flex-col items-center justify-center gap-3 text-white font-bold transition-all hover:scale-[1.02] shadow-lg active:scale-95"
          style={{ background: "linear-gradient(135deg, #f97316, #dc2626)" }}
          onClick={() => { setType("fire_evacuation"); setIsOpen(true); }}
          data-testid="btn-trigger-fire"
        >
          <div className="p-3 bg-white/20 rounded-full mb-1"><Flame className="h-8 w-8" /></div>
          <span className="text-lg tracking-wide">Fire / Evac</span>
        </button>
        
        <button 
          className="h-40 rounded-2xl flex flex-col items-center justify-center gap-3 text-white font-bold transition-all hover:scale-[1.02] shadow-lg active:scale-95"
          style={{ background: "linear-gradient(135deg, #334155, #0f172a)" }}
          onClick={() => { setType("security"); setIsOpen(true); }}
          data-testid="btn-trigger-security"
        >
          <div className="p-3 bg-white/20 rounded-full mb-1"><ShieldAlert className="h-8 w-8" /></div>
          <span className="text-lg tracking-wide">Security</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-gray-100 mt-8">
        <h2 className="text-2xl font-bold flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
          <span className="relative flex h-4 w-4 mr-1">
            {emergencies?.data?.length ? <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span> : null}
            <span className={`relative inline-flex rounded-full h-4 w-4 ${emergencies?.data?.length ? 'bg-red-500' : 'bg-gray-300'}`}></span>
          </span>
          Active Emergencies
        </h2>
        
        {emergencies?.data?.length === 0 || !emergencies?.data ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">System Clear</h3>
            <p className="text-gray-500">There are no active emergencies across the facility.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {emergencies.data.map((em) => (
              <div key={em.id} className="bg-red-50 rounded-2xl border-2 border-red-200 overflow-hidden flex flex-col sm:flex-row">
                <div className={`w-full sm:w-24 flex items-center justify-center p-4 bg-gradient-to-br ${getEmergencyColor(em.type)} text-white`}>
                  {getEmergencyIcon(em.type)}
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold text-red-900 uppercase tracking-wider">{em.type.replace('_', ' ')}</h3>
                      <span className="px-3 py-1 bg-red-200 text-red-800 text-xs font-bold rounded-full border border-red-300">LEVEL {em.level}</span>
                    </div>
                    <p className="text-red-800 font-medium mb-4">{em.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 text-sm font-bold rounded-xl transition-colors">
                      Escalate Alert
                    </button>
                    <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-colors">
                      Mark Resolved
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="border-red-500 border-[3px] sm:max-w-[450px] rounded-3xl p-0 overflow-hidden shadow-2xl bg-white">
          <div className="bg-red-600 p-6 text-white text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 animate-pulse" />
            <DialogTitle className="text-2xl font-black tracking-wider uppercase mb-1">
              CONFIRM EMERGENCY
            </DialogTitle>
            <DialogDescription className="text-red-100 text-sm font-medium">
              This will trigger a site-wide alert immediately.
            </DialogDescription>
          </div>
          
          <div className="p-6 space-y-5 bg-red-50/30">
            <div className="flex items-center justify-between bg-red-50 p-3 rounded-xl border border-red-100">
              <span className="text-sm font-bold text-red-800">EMERGENCY TYPE</span>
              <span className="uppercase font-black text-red-600">{type.replace('_', ' ')}</span>
            </div>
          
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Severity Level</label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="border-red-200 rounded-xl h-12 bg-white focus:ring-red-500 font-medium">
                  <SelectValue placeholder="Select Level" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-red-100 shadow-xl">
                  <SelectItem value="L1" className="font-medium text-amber-700">L1 - Local Area Only</SelectItem>
                  <SelectItem value="L2" className="font-medium text-orange-700">L2 - Zone Level</SelectItem>
                  <SelectItem value="L3" className="font-medium text-red-700">L3 - Entire Building</SelectItem>
                  <SelectItem value="L4" className="font-medium text-red-900 font-bold">L4 - FULL EVACUATION</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Details <span className="text-gray-400 font-normal text-xs normal-case">(Optional)</span></label>
              <Textarea 
                placeholder="Where? Who? What is happening?" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="border-red-200 rounded-xl min-h-[100px] resize-none focus-visible:ring-red-500 bg-white"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
              <button 
                type="button" 
                className="h-14 rounded-xl text-gray-600 font-bold border border-gray-200 bg-white hover:bg-gray-50 transition-colors" 
                onClick={() => setIsOpen(false)}
              >
                CANCEL
              </button>
              <button 
                type="button" 
                className="h-14 rounded-xl text-white font-black bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 disabled:opacity-50"
                onClick={handleTrigger} 
                disabled={triggerMutation.isPending}
              >
                {triggerMutation.isPending ? "SENDING..." : "SOUND ALARM"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
