import { useState } from "react";
import { useListChildren } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Search, Eye, AlertCircle } from "lucide-react";

export default function Children() {
  const [search, setSearch] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const { data, isLoading } = useListChildren({ search, unassigned: unassignedOnly });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary">Children</h1>
        <Button data-testid="button-create-child">Add Child</Button>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 w-full max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search children..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-children"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Switch 
            id="unassigned" 
            checked={unassignedOnly} 
            onCheckedChange={setUnassignedOnly}
            data-testid="switch-unassigned"
          />
          <label htmlFor="unassigned" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Unassigned Only
          </label>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Alerts</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            ) : data?.data?.map((child) => (
              <TableRow key={child.id}>
                <TableCell className="font-medium">{child.firstName} {child.lastName}</TableCell>
                <TableCell>{child.age}</TableCell>
                <TableCell>
                  {child.currentClass ? (
                    <Badge variant="outline">{child.currentClass.name}</Badge>
                  ) : (
                    <Badge variant="secondary">Unassigned</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {child.allergies ? (
                    <Badge variant="destructive" className="flex w-fit items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Allergies
                    </Badge>
                  ) : "-"}
                </TableCell>
                <TableCell>
                  <Link href={`/children/${child.id}`}>
                    <Button variant="ghost" size="sm" data-testid={`link-child-${child.id}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {data?.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  No children found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
