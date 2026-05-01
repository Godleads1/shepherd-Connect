import { useListChildren } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { School, CheckCircle, AlertTriangle } from "lucide-react";

export default function MyClass() {
  // In reality this would filter by the teacher's currently allocated class
  const { data: children, isLoading } = useListChildren();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
        <School className="w-8 h-8" /> My Class
        <Badge variant="secondary" className="text-lg ml-auto">9am Service</Badge>
      </h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : children?.data?.map((child) => (
          <Card key={child.id} className={child.allergies ? "border-destructive/50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="flex justify-between items-center text-lg">
                {child.firstName} {child.lastName}
                <Badge variant="outline">{child.age} yrs</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {child.allergies && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {child.allergies}
                </div>
              )}
              {child.medicalNotes && (
                <p className="text-xs text-muted-foreground line-clamp-2">{child.medicalNotes}</p>
              )}
              <div className="pt-2 border-t flex justify-between items-center text-sm font-medium">
                Status: <span className="text-success flex items-center gap-1"><CheckCircle className="w-4 h-4"/> In Class</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
