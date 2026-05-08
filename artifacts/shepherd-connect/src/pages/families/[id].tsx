import { useGetFamily, useGetFamilyTree } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, AlertCircle, Eye, Shield } from "lucide-react";

export default function FamilyProfile() {
  const { id } = useParams();
  const familyId = parseInt(id || "0", 10);
  
  const { data: tree, isLoading } = useGetFamilyTree(familyId, { query: { enabled: !!familyId, queryKey: ['getFamilyTree', familyId] } });

  if (isLoading) return <div className="space-y-4 p-8"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!tree) return <div>Family not found</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
          Family Profile
          <Badge variant="outline" className="text-lg py-1 px-3 bg-primary/10">Code: {tree.family.familyCode}</Badge>
        </h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Parents Section */}
        <Card>
          <CardHeader>
            <CardTitle>Parents & Guardians</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {tree.parents.map(parent => (
              <div key={parent.id} className="p-4 border rounded-lg bg-card">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg">{parent.firstName} {parent.lastName}</h3>
                  <Badge>{parent.role}</Badge>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2"><Mail className="w-4 h-4" /> {parent.email}</div>
                  {parent.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4" /> {parent.phone}</div>}
                </div>
              </div>
            ))}
            
            <div className="pt-4 border-t space-y-2 text-sm">
              <div className="flex items-center gap-2 font-medium"><MapPin className="w-4 h-4" /> Address</div>
              <p className="text-muted-foreground pl-6">{tree.family.address || "No address provided"}</p>
              
              <div className="flex items-center gap-2 font-medium mt-4"><Shield className="w-4 h-4 text-accent" /> Emergency Contact</div>
              <p className="text-muted-foreground pl-6">
                {tree.family.emergencyContactName ? `${tree.family.emergencyContactName} (${tree.family.emergencyContactPhone})` : "Not provided"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Children Section */}
        <Card>
          <CardHeader>
            <CardTitle>Children</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tree.children.map(child => (
              <div key={child.id} className="p-4 border rounded-lg bg-card flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{child.firstName} {child.lastName}</h3>
                    <p className="text-sm text-muted-foreground">Age {child.age} • {child.gender}</p>
                  </div>
                  {child.currentClass ? (
                    <Badge variant="outline">{child.currentClass.name}</Badge>
                  ) : (
                    <Badge variant="secondary">Unassigned</Badge>
                  )}
                </div>
                
                <div className="flex justify-end">
                  <Link href={`/children/${child.id}`}>
                    <Button variant="ghost" size="sm" data-testid={`link-child-${child.id}`}>
                      <Eye className="w-4 h-4 mr-2" /> View Profile
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
            {tree.children.length === 0 && <p className="text-muted-foreground">No children registered.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
