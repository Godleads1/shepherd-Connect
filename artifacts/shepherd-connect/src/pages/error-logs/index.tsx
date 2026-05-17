import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiDelete } from "@/lib/api-call";

interface ErrorLog {
  id: number;
  message: string;
  stack: string | null;
  path: string | null;
  method: string | null;
  statusCode: number | null;
  userId: number | null;
  createdAt: string;
}

interface ErrorLogsResponse {
  data: ErrorLog[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 50;

export default function ErrorLogs() {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<ErrorLogsResponse>({
    queryKey: ["error-logs", page],
    queryFn: () =>
      apiGet<ErrorLogsResponse>(`/error-logs?page=${page}&limit=${PAGE_SIZE}`),
  });

  const clearMutation = useMutation({
    mutationFn: () => apiDelete<{ message: string }>("/error-logs"),
    onSuccess: () => {
      toast({ title: "Error logs cleared" });
      queryClient.invalidateQueries({ queryKey: ["error-logs"] });
      setPage(1);
    },
    onError: () => toast({ variant: "destructive", title: "Failed to clear logs" }),
  });

  const logs: ErrorLog[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const statusColor = (code: number | null) => {
    if (!code) return "text-gray-500";
    if (code >= 500) return "text-red-600 font-bold";
    if (code >= 400) return "text-yellow-600 font-semibold";
    return "text-green-600";
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            Error Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} error{total !== 1 ? "s" : ""} recorded
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => {
              if (confirm("Clear all error logs? This cannot be undone."))
                clearMutation.mutate();
            }}
            disabled={clearMutation.isPending || logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-500">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No errors recorded</p>
          <p className="text-gray-400 text-sm mt-1">
            Errors from unhandled API exceptions will appear here
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 w-32">Time</th>
                  <th className="text-left px-4 py-3 w-20">Status</th>
                  <th className="text-left px-4 py-3 w-24">Method</th>
                  <th className="text-left px-4 py-3 w-48">Path</th>
                  <th className="text-left px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {logs.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                      onClick={() =>
                        setExpanded(expanded === log.id ? null : log.id)
                      }
                    >
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("en-GB", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className={`px-4 py-3 ${statusColor(log.statusCode)}`}>
                        {log.statusCode ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                        {log.method ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-mono text-xs truncate max-w-0 w-48">
                        {log.path ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-800 dark:text-gray-200 truncate max-w-0">
                        {log.message}
                      </td>
                    </tr>
                    {expanded === log.id && log.stack && (
                      <tr key={`${log.id}-stack`}>
                        <td
                          colSpan={5}
                          className="px-4 py-3 bg-red-50 dark:bg-red-950/20"
                        >
                          <pre className="text-xs text-red-700 dark:text-red-400 whitespace-pre-wrap font-mono overflow-x-auto">
                            {log.stack}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600 dark:text-gray-400">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
