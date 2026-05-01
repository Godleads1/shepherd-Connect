import { useGetMyFamily } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyChildren() {
  const { data: family, isLoading } = useGetMyFamily();

  if (isLoading) return <div className="p-8"><Skeleton className="h-64 w-full max-w-2xl mx-auto" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-primary">My Children</h1>
      
      <div className="grid gap-4 md:grid-cols-2">
        {family?.children?.map(child => (
          <Card key={child.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-start">
                <span>{child.firstName} {child.lastName}</span>
                {child.currentClass ? (
                  <Badge variant="outline">{child.currentClass.name}</Badge>
                ) : (
                  <Badge variant="secondary">Unassigned</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {child.allergies && (
                <div className="flex items-center gap-2 text-sm text-destructive font-medium bg-destructive/10 p-2 rounded">
                  <AlertCircle className="w-4 h-4" /> Allergies: {child.allergies}
                </div>
              )}
              <Link href={`/children/${child.id}`}>
                <Button className="w-full" variant="secondary">
                  <Eye className="w-4 h-4 mr-2" /> View Profile & Activity
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
