import { useState } from "react";
import { useScanQrCode, useCheckIn } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function CheckIn() {
  const [qrCode, setQrCode] = useState("");
  const { toast } = useToast();
  
  const scanMutation = useScanQrCode();
  const checkInMutation = useCheckIn();

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrCode) return;
    
    try {
      await scanMutation.mutateAsync({
        data: {
          qrCode,
          serviceDate: format(new Date(), 'yyyy-MM-dd'),
          serviceSlot: "9am" // default or selected
        }
      });
      setQrCode("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Scan Failed",
        description: "Invalid QR code or network error"
      });
    }
  };

  const handleCheckIn = async (childId: number, classId: number | undefined) => {
    if (!classId) {
      toast({
        variant: "destructive",
        title: "Cannot Check In",
        description: "Child is not assigned to a class"
      });
      return;
    }

    try {
      await checkInMutation.mutateAsync({
        data: {
          childId,
          classId,
          serviceDate: format(new Date(), 'yyyy-MM-dd'),
          serviceSlot: "9am"
        }
      });
      toast({
        title: "Checked In Successfully",
        description: "Child has been checked in."
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Check In Failed",
        description: "Could not complete check in."
      });
    }
  };

  return (
    <div className="flex flex-col items-center min-h-[80vh] max-w-4xl mx-auto py-8">
      <div 
        className="w-full rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden text-center mb-8 shadow-xl"
        style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}
      >
        <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative z-10">
          <div className="rccg-logo-wrap" style={{ width: 120, height: 120, margin: "0 auto 24px" }}>
            <img src="/rccg-logo-new.png" alt="RCCG" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>Shepherd Connect</h1>
          <p className="text-lg sm:text-xl text-blue-100 font-medium tracking-wide">Scan Family QR Code to Check In</p>
        </div>
      </div>

      <div className="w-full bg-white rounded-3xl p-6 shadow-card border border-gray-100 mb-8">
        <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <QrCode className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400" />
            <Input 
              autoFocus
              className="pl-14 h-16 text-lg rounded-2xl border-gray-200 focus-visible:ring-[#1a237e] focus-visible:border-[#1a237e] bg-gray-50/50"
              placeholder="Scan QR Code or Enter Family Code..." 
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              data-testid="input-qr-scan"
            />
          </div>
          <button 
            type="submit" 
            disabled={scanMutation.isPending} 
            data-testid="button-scan"
            className="h-16 px-10 rounded-2xl font-bold text-lg transition-all active:scale-95 disabled:opacity-70"
            style={{ background: "linear-gradient(135deg, #1a237e, #283593)", color: "#ffffff", boxShadow: "0 4px 15px rgba(26,35,126,0.3)" }}
          >
            {scanMutation.isPending ? "Scanning..." : "Scan"}
          </button>
        </form>
      </div>

      {scanMutation.data && (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl flex items-center gap-5">
            <div className="h-16 w-16 rounded-full bg-blue-800 text-white flex items-center justify-center text-2xl font-bold shadow-md">
              {scanMutation.data.family.familyCode.substring(0, 2)}
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-600 mb-1">Family Matched</p>
              <h2 className="text-2xl font-bold text-gray-900">
                {scanMutation.data.family.parent1?.firstName} {scanMutation.data.family.parent1?.lastName}
              </h2>
              <p className="text-gray-500 text-sm">Code: <span className="font-mono font-medium">{scanMutation.data.family.familyCode}</span></p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {scanMutation.data.children.map((child: any) => (
              <div key={child.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-card flex flex-col">
                {child.allergies && (
                  <div className="bg-red-600 text-white px-4 py-2.5 flex items-center justify-center gap-2 font-bold text-sm tracking-wide">
                    <AlertTriangle className="h-4 w-4" /> ALLERGY / MEDICAL ALERT
                  </div>
                )}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{child.firstName} {child.lastName}</h3>
                      <p className="text-gray-500 mt-1 text-sm">Age {child.age}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-800 flex items-center justify-center font-bold text-lg">
                      {child.firstName[0]}
                    </div>
                  </div>
                  
                  <div className="mb-6 flex-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-50 border border-gray-200 text-gray-700">
                      {child.currentClass ? (
                        <><CheckCircle className="w-4 h-4 text-green-600" /> {child.currentClass.name}</>
                      ) : (
                        <><AlertTriangle className="w-4 h-4 text-amber-500" /> Unassigned</>
                      )}
                    </div>
                    
                    {child.allergies && (
                      <p className="mt-3 text-sm font-medium text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                        {child.allergies}
                      </p>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => handleCheckIn(child.id, child.currentClass?.id)}
                    disabled={!child.currentClass || checkInMutation.isPending}
                    data-testid={`button-checkin-${child.id}`}
                    className="w-full h-14 rounded-xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                    style={{ background: "#1e3a8a", color: "white" }}
                  >
                    Check In Child
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
