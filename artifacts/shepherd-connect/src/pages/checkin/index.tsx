import { useState } from "react";
import { useScanQrCode, useCheckIn } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QrCode, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-8 p-4">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-primary">Welcome to Shepherd Connect</h1>
        <p className="text-xl text-muted-foreground">Please scan your family QR code to check in</p>
      </div>

      <Card className="w-full max-w-xl shadow-lg border-primary/20">
        <CardContent className="pt-6">
          <form onSubmit={handleScan} className="flex gap-4">
            <div className="relative flex-1">
              <QrCode className="absolute left-3 top-3 h-6 w-6 text-muted-foreground" />
              <Input 
                autoFocus
                className="pl-12 h-12 text-lg"
                placeholder="Scan QR Code or Enter Family Code..." 
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                data-testid="input-qr-scan"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 px-8" disabled={scanMutation.isPending} data-testid="button-scan">
              Scan
            </Button>
          </form>
        </CardContent>
      </Card>

      {scanMutation.data && (
        <div className="w-full max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-4 bg-card p-4 rounded-lg border">
            <Avatar className="h-16 w-16 border-2 border-primary">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {scanMutation.data.family.familyCode.substring(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold">Family {scanMutation.data.family.familyCode}</h2>
              <p className="text-muted-foreground">
                {scanMutation.data.family.parent1?.firstName} {scanMutation.data.family.parent1?.lastName}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {scanMutation.data.children.map(child => (
              <Card key={child.id} className="overflow-hidden border-2">
                {child.allergies && (
                  <div className="bg-destructive text-destructive-foreground px-4 py-2 flex items-center gap-2 font-bold text-sm">
                    <AlertTriangle className="h-4 w-4" /> ALLERGY ALERT
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{child.firstName} {child.lastName}</CardTitle>
                  <CardDescription>
                    {child.currentClass ? child.currentClass.name : "Unassigned"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {child.allergies && (
                    <p className="text-sm font-medium text-destructive">{child.allergies}</p>
                  )}
                  <Button 
                    className="w-full h-12 text-lg" 
                    onClick={() => handleCheckIn(child.id, child.currentClass?.id)}
                    disabled={!child.currentClass || checkInMutation.isPending}
                    data-testid={`button-checkin-${child.id}`}
                  >
                    Check In
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
