import { useState } from "react";
import { useListAttendance } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Attendance() {
  const { data, isLoading } = useListAttendance();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Attendance Records</h1>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Child</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            ) : data?.data?.map((record) => (
              <TableRow key={record.id}>
                <TableCell>{format(new Date(record.serviceDate), 'MMM dd, yyyy')}</TableCell>
                <TableCell className="font-medium">{record.child?.firstName} {record.child?.lastName}</TableCell>
                <TableCell>{record.class?.name}</TableCell>
                <TableCell>{record.checkInTime ? format(new Date(record.checkInTime), 'HH:mm') : '-'}</TableCell>
                <TableCell>{record.checkOutTime ? format(new Date(record.checkOutTime), 'HH:mm') : '-'}</TableCell>
                <TableCell>
                  <Badge variant={record.status === 'picked_up' ? 'outline' : 'default'}>
                    {record.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {data?.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  No attendance records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
