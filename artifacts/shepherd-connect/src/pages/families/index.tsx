import { useState } from "react";
import { useListFamilies } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye } from "lucide-react";

export default function Families() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListFamilies({ search });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary">Families</h1>
        <Button data-testid="button-create-family">Add Family</Button>
      </div>
      
      <div className="flex items-center gap-2 max-w-sm">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search families..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-families"
        />
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Parents</TableHead>
              <TableHead>Children</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            ) : data?.data?.map((family) => (
              <TableRow key={family.id}>
                <TableCell className="font-medium">{family.familyCode}</TableCell>
                <TableCell>
                  {family.parent1?.firstName} {family.parent1?.lastName}
                  {family.parent2 ? ` & ${family.parent2.firstName} ${family.parent2.lastName}` : ""}
                </TableCell>
                <TableCell>{family.children?.length || 0}</TableCell>
                <TableCell>
                  <Link href={`/families/${family.id}`}>
                    <Button variant="ghost" size="sm" data-testid={`link-family-${family.id}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {data?.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                  No families found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
