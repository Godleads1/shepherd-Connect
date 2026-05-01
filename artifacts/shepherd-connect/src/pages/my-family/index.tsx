import { useGetMyFamily } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { QrCode, Users, ArrowRight } from "lucide-react";

export default function MyFamily() {
  const { data: family, isLoading } = useGetMyFamily();

  if (isLoading) return <div className="p-8"><Skeleton className="h-64 w-full max-w-2xl mx-auto" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
        <Users className="w-8 h-8" /> My Family
        <Badge className="text-lg py-1 px-3 bg-primary/10 text-primary border-primary">
          Code: {family?.familyCode}
        </Badge>
      </h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-primary border-2 bg-primary/5">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <QrCode className="w-48 h-48 text-primary mb-4" />
            <p className="text-lg font-medium text-center">Use this QR code at the check-in kiosk on Sunday.</p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>My Children</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {family?.children?.map(child => (
                <div key={child.id} className="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <h4 className="font-bold">{child.firstName} {child.lastName}</h4>
                    <p className="text-sm text-muted-foreground">Age {child.age}</p>
                  </div>
                  <Link href={`/children/${child.id}`}>
                    <Button variant="ghost" size="sm"><ArrowRight className="w-4 h-4" /></Button>
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Link href="/pickup-delegates"><Button className="w-full justify-start" variant="outline">Manage Pickup Delegates</Button></Link>
              <Link href="/feedback"><Button className="w-full justify-start" variant="outline">Submit Feedback</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
