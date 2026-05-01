import { useState } from "react";
import { useListAttendance, useCheckOut, useVerifyDelegateOtp } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, LogOut, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Checkout() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: attendanceList, refetch } = useListAttendance({ serviceDate: today });
  
  const checkoutMutation = useCheckOut();

  const handleCheckout = async (attendanceId: number) => {
    try {
      await checkoutMutation.mutateAsync({
        id: attendanceId,
        data: {}
      });
      toast({ title: "Checked out successfully" });
      refetch();
    } catch (error) {
      toast({ variant: "destructive", title: "Checkout failed" });
    }
  };

  const activeRecords = attendanceList?.data?.filter(a => 
    a.status === "in_class" || a.status === "dropped_off"
  ) || [];

  const filteredRecords = activeRecords.filter(a => 
    search === "" || 
    (a.child?.firstName.toLowerCase().includes(search.toLowerCase()) || 
     a.child?.lastName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-primary">Check Out</h1>
      
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input 
            className="pl-10 h-12 text-lg"
            placeholder="Search by child name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-checkout-search"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredRecords.length === 0 && (
          <div className="text-center p-8 border rounded-lg text-muted-foreground">
            No children ready for pickup matching search.
          </div>
        )}
        
        {filteredRecords.map((record) => (
          <Card key={record.id}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h3 className="text-xl font-bold">{record.child?.firstName} {record.child?.lastName}</h3>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{record.class?.name}</Badge>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Checked in at {format(new Date(record.checkInTime!), 'HH:mm')}
                  </Badge>
                </div>
              </div>
              <Button 
                size="lg" 
                className="gap-2"
                onClick={() => handleCheckout(record.id)}
                disabled={checkoutMutation.isPending}
                data-testid={`btn-checkout-${record.id}`}
              >
                <LogOut className="w-5 h-5" />
                Check Out
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
