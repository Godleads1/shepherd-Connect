import { useState } from "react";
import { useListAuditLogs } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Shield, Search, X, Filter } from "lucide-react";

const ACTION_BADGES: Record<string, string> = {
  login: "bg-green-100 text-green-700",
  logout: "bg-gray-100 text-gray-600",
  create: "bg-blue-100 text-blue-700",
  update: "bg-amber-100 text-amber-700",
  delete: "bg-red-100 text-red-700",
  approve: "bg-purple-100 text-purple-700",
  reject: "bg-red-100 text-red-700",
};

function badgeClass(action: string) {
  const key = Object.keys(ACTION_BADGES).find(k => action.toLowerCase().includes(k));
  return key ? ACTION_BADGES[key] : "bg-gray-100 text-gray-600";
}

export default function AuditLogs() {
  const [actionFilter, setActionFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListAuditLogs({
    action: actionFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    limit: 50,
  });

  const clearFilters = () => { setActionFilter(""); setStartDate(""); setEndDate(""); setPage(1); };
  const hasFilters = actionFilter || startDate || endDate;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center gap-3">
          <Shield className="w-8 h-8 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Audit Logs</h1>
            <p className="text-white/70 text-sm mt-0.5">Complete record of all system actions</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-600">Filters</span>
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Filter by action..."
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(1); }}
              className="pl-8 h-9 rounded-xl text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">From</label>
            <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} className="h-9 rounded-xl text-sm w-36" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">To</label>
            <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} className="h-9 rounded-xl text-sm w-36" />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-500 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
          {data && (
            <span className="ml-auto text-xs text-gray-400 font-medium">{data.total} records</span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold text-gray-700">Timestamp</TableHead>
              <TableHead className="font-semibold text-gray-700">User</TableHead>
              <TableHead className="font-semibold text-gray-700">Action</TableHead>
              <TableHead className="font-semibold text-gray-700">Entity</TableHead>
              <TableHead className="font-semibold text-gray-700">IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full rounded-lg" /></TableCell></TableRow>
              ))
            ) : data?.data?.map((log) => (
              <TableRow key={log.id} className="hover:bg-blue-50/30 transition-colors">
                <TableCell className="text-xs text-gray-500 font-mono whitespace-nowrap">
                  {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                </TableCell>
                <TableCell className="font-medium text-sm">
                  {log.user ? `${log.user.firstName} ${log.user.lastName}` : <span className="text-gray-400">System</span>}
                  {log.user && <span className="ml-1.5 text-xs text-gray-400 capitalize">({log.user.role})</span>}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClass(log.action)}`}>
                    {log.action}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-gray-500">
                  {log.entityType ? <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{log.entityType} #{log.entityId}</span> : "—"}
                </TableCell>
                <TableCell className="text-xs text-gray-400 font-mono">{log.ipAddress || "—"}</TableCell>
              </TableRow>
            ))}
            {data?.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-gray-400">
                  <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No audit logs match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {data && data.total > 50 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">Page {page} of {Math.ceil(data.total / 50)}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Previous</button>
              <button disabled={page >= Math.ceil(data.total / 50)} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
