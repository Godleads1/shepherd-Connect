import { getListFamilyEmergencyUpdatesQueryKey, useListFamilyEmergencyUpdates } from "@workspace/api-client-react";
import { AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/ui/skeleton";

export default function FamilyEmergencyUpdates() {
  const updates = useListFamilyEmergencyUpdates({
    query: { refetchInterval: 30_000, queryKey: getListFamilyEmergencyUpdatesQueryKey() },
  });

  if (updates.isLoading) {
    return <div className="space-y-3">{[0, 1].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>;
  }
  if (updates.isError) {
    return <QueryError message="Could not load family emergency updates." onRetry={() => updates.refetch()} />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <header className="rounded-2xl bg-blue-950 text-white p-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" /> Family Emergency Updates
        </h1>
        <p className="text-sm text-blue-100 mt-2">
          Reviewed updates and instructions published by the safeguarding team for your children.
        </p>
      </header>

      {(updates.data ?? []).length === 0 ? (
        <div className="bg-white border rounded-2xl p-8 text-center" data-testid="status-no-family-emergency-updates">
          <ShieldCheck className="h-10 w-10 text-green-600 mx-auto mb-3" />
          <p className="font-semibold text-gray-900">No published emergency updates</p>
          <p className="text-sm text-gray-500 mt-1">Any approved family instructions will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(updates.data ?? []).map(update => (
            <article key={update.id} className="bg-white border border-amber-200 rounded-2xl p-5" data-testid={`card-family-emergency-update-${update.id}`}>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-amber-100 p-2"><AlertTriangle className="h-5 w-5 text-amber-700" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500" data-testid={`text-update-child-${update.id}`}>
                    Update for {update.childFirstName}
                  </p>
                  <h2 className="font-bold text-gray-950 mt-1" data-testid={`text-update-status-${update.id}`}>{update.status}</h2>
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap" data-testid={`text-update-instructions-${update.id}`}>{update.instructions}</p>
                  <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {format(new Date(update.publishedAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}