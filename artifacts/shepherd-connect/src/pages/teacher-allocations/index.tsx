import { useListTeacherAllocations } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function TeacherAllocations() {
  const { data: allocations, isLoading } = useListTeacherAllocations();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Teacher Allocations</h1>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Slot</TableHead>
              <TableHead>Teacher</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            ) : allocations?.map((alloc) => (
              <TableRow key={alloc.id}>
                <TableCell className="font-medium">{format(new Date(alloc.serviceDate), 'MMM dd, yyyy')}</TableCell>
                <TableCell>{alloc.serviceSlot}</TableCell>
                <TableCell>{alloc.teacher?.user?.firstName} {alloc.teacher?.user?.lastName}</TableCell>
                <TableCell>{alloc.class?.name}</TableCell>
                <TableCell>
                  <Badge variant={alloc.status === "confirmed" ? "default" : "secondary"}>
                    {alloc.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {allocations?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  No allocations found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
