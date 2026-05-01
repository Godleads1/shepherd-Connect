import { useListAuditLogs } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Shield } from "lucide-react";

export default function AuditLogs() {
  const { data, isLoading } = useListAuditLogs();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
        <Shield className="w-8 h-8" /> Audit Logs
      </h1>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            ) : data?.data?.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                </TableCell>
                <TableCell className="font-medium">
                  {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}
                </TableCell>
                <TableCell>{log.action}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {log.entityType} #{log.entityId}
                </TableCell>
              </TableRow>
            ))}
            {data?.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                  No logs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
