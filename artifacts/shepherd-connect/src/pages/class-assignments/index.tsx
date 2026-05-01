import { useState } from "react";
import { useListChildren, useListClasses, useCreateClassAssignment } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus } from "lucide-react";

export default function ClassAssignments() {
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  
  const { data: unassignedChildren, refetch: refetchChildren, isLoading: loadingChildren } = useListChildren({ unassigned: true });
  const { data: classes, isLoading: loadingClasses } = useListClasses();
  
  const assignMutation = useCreateClassAssignment();
  const { toast } = useToast();

  const handleAssign = async (classId: number) => {
    if (!selectedChildId) return;

    try {
      await assignMutation.mutateAsync({
        data: {
          childId: selectedChildId,
          classId
        }
      });
      
      toast({ title: "Child assigned to class successfully" });
      setSelectedChildId(null);
      refetchChildren();
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to assign child" });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Class Assignments</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="flex flex-col h-[600px]">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Unassigned Children
              <Badge variant="secondary">{unassignedChildren?.data?.length || 0}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-2">
            {loadingChildren ? <Skeleton className="h-20 w-full" /> : unassignedChildren?.data?.map(child => (
              <div 
                key={child.id}
                onClick={() => setSelectedChildId(child.id === selectedChildId ? null : child.id)}
                className={`p-3 border rounded-md cursor-pointer transition-colors ${selectedChildId === child.id ? "bg-primary/10 border-primary" : "hover:bg-muted"}`}
                data-testid={`child-card-${child.id}`}
              >
                <div className="font-medium">{child.firstName} {child.lastName}</div>
                <div className="text-sm text-muted-foreground">Age: {child.age}</div>
              </div>
            ))}
            {unassignedChildren?.data?.length === 0 && (
              <div className="text-center p-8 text-muted-foreground">All children are assigned!</div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col h-[600px]">
          <CardHeader>
            <CardTitle>Classes</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-4">
            {loadingClasses ? <Skeleton className="h-24 w-full" /> : classes?.map(cls => (
              <div key={cls.id} className="p-4 border rounded-md">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold">{cls.name}</div>
                    <div className="text-sm text-muted-foreground">Ages: {cls.ageMin}-{cls.ageMax}</div>
                  </div>
                  <div className="text-sm flex items-center gap-1">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    {cls.enrollmentCount} / {cls.capacity}
                  </div>
                </div>
                <Button 
                  size="sm" 
                  className="w-full"
                  disabled={!selectedChildId || assignMutation.isPending || cls.enrollmentCount >= cls.capacity}
                  onClick={() => handleAssign(cls.id)}
                  data-testid={`assign-to-${cls.id}`}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Assign Selected
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
