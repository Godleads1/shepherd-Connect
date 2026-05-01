import { useListTeachers } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function Teachers() {
  const { data: teachers, isLoading } = useListTeachers();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Teachers</h1>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            ) : teachers?.map((teacher) => (
              <TableRow key={teacher.id}>
                <TableCell className="font-medium">{teacher.user?.firstName} {teacher.user?.lastName}</TableCell>
                <TableCell>{teacher.user?.email}</TableCell>
                <TableCell>{new Date(teacher.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
            {teachers?.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                  No teachers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
