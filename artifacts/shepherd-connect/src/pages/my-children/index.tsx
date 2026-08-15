import { useState } from "react";
import { useGetMyFamily, useListAppraisals } from "@workspace/api-client-react";
import { QueryError } from "@/components/QueryError";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Eye, Award, ChevronDown, ChevronUp, Star, MessageSquare, HandHeart, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiPost, apiGet } from "@/lib/api-call";

const LEVEL_STYLE: Record<string, string> = {
  excellent:           "bg-green-100 text-green-800",
  good:                "bg-blue-100 text-blue-800",
  fair:                "bg-amber-100 text-amber-800",
  needs_encouragement: "bg-red-100 text-red-800",
};

const LEVEL_STARS: Record<string, number> = {
  excellent: 4, good: 3, fair: 2, needs_encouragement: 1,
};

function AppraisalHistory({ childId }: { childId: number }) {
  const { data: raw, isLoading } = useListAppraisals({ childId });
  const appraisals: any[] = Array.isArray(raw) ? raw : (raw as any)?.data ?? [];

  if (isLoading) return (
    <div className="space-y-2 pt-3 border-t mt-3">
      {[1,2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
    </div>
  );

  if (appraisals.length === 0) return (
    <div className="pt-3 border-t mt-3 text-center py-4 text-gray-400 text-sm">
      No appraisals yet — check back after Sunday service.
    </div>
  );

  return (
    <div className="pt-3 border-t mt-3 space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Appraisal History</p>
      {appraisals.slice(0, 5).map((a: any) => (
        <div key={a.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">
              {a.serviceDate ? format(new Date(a.serviceDate + "T00:00:00"), "dd MMM yyyy") : "—"}
            </p>
            <p className="text-xs text-gray-400">
              by {a.teacher?.user?.firstName ?? "Teacher"}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {[
              { label: "Participation", value: a.participationLevel },
              { label: "Scripture", value: a.scriptureEngagement },
              { label: "Social", value: a.socialInteraction },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="flex justify-center gap-0.5 mb-0.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Star key={i} className={`w-2.5 h-2.5 ${i < (LEVEL_STARS[value] ?? 0) ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}`} />
                  ))}
                </div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide">{label}</p>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${LEVEL_STYLE[value] ?? "bg-gray-100 text-gray-600"}`}>
                  {value?.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
          {a.milestoneNote && (
            <div className="flex items-start gap-1.5 mt-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
              <Award className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">{a.milestoneNote}</p>
            </div>
          )}
          {a.personalNoteToParent && (
            <div className="flex items-start gap-1.5 mt-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
              <MessageSquare className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 italic">"{a.personalNoteToParent}"</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ChildCard({ child, onSignalPickup, pickupSent, isCheckedIn, selected, onToggleSelect }: {
  child: any;
  onSignalPickup: (childId: number) => Promise<void>;
  pickupSent: boolean;
  isCheckedIn: boolean;
  selected: boolean;
  onToggleSelect: (childId: number) => void;
}) {
  const [showAppraisals, setShowAppraisals] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePickup = async () => {
    setLoading(true);
    await onSignalPickup(child.id);
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ boxShadow: "0 2px 8px rgba(30,58,138,.06)" }}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl flex-shrink-0 overflow-hidden">
            {child.photoUrl
              ? <img src={child.photoUrl} alt={child.firstName} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-white font-bold text-xl"
                  style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                  {child.firstName[0]}{child.lastName[0]}
                </div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-lg leading-tight">
              {child.firstName} {child.lastName}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {child.currentClass
                ? <Badge variant="outline" className="text-xs border-blue-200 text-blue-700">{child.currentClass.name}</Badge>
                : <Badge variant="secondary" className="text-xs">Unassigned</Badge>}
              {child.age != null && (
                <span className="text-xs text-gray-400">Age {child.age}</span>
              )}
            </div>
            {child.allergies && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-red-700 font-medium bg-red-50 rounded-lg px-2.5 py-1.5 border border-red-100">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Allergies: {child.allergies}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Link href={`/children/${child.id}`} className="flex-1">
            <Button variant="outline" className="w-full gap-1.5 text-sm">
              <Eye className="w-3.5 h-3.5" /> Full Profile
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="flex-1 gap-1.5 text-sm text-[#1e3a8a] hover:bg-blue-50"
            onClick={() => setShowAppraisals(s => !s)}>
            <Award className="w-3.5 h-3.5" />
            Appraisals
            {showAppraisals ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {pickupSent ? (
          <div className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            Pickup signal sent — the teacher has been notified
          </div>
        ) : isCheckedIn ? (
          <div className="mt-3 flex items-stretch gap-2">
            <label className="flex items-center gap-2 px-3 rounded-xl border-2 border-amber-200 bg-white cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-amber-600"
                checked={selected}
                onChange={() => onToggleSelect(child.id)}
                aria-label={`Select ${child.firstName} for pickup`}
              />
            </label>
            <button
              type="button"
              onClick={handlePickup}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-bold transition-all disabled:opacity-50">
              <HandHeart className="w-4 h-4" />
              {loading ? "Signalling…" : "I'm here to collect"}
            </button>
          </div>
        ) : (
          <div className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-400 text-sm font-semibold">
            <HandHeart className="w-4 h-4" />
            Not checked in today
          </div>
        )}
      </div>

      {showAppraisals && (
        <div className="px-5 pb-5">
          <AppraisalHistory childId={child.id} />
        </div>
      )}
    </div>
  );
}

export default function MyChildren() {
  const { data: family, isLoading, isError } = useGetMyFamily();
  const { toast } = useToast();
  const [pickupSent, setPickupSent] = useState<Set<number>>(new Set());
  const [selectedForPickup, setSelectedForPickup] = useState<Set<number>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);

  // Today's attendance for my children — enables "I'm here to collect" only for
  // children who are actually checked in (avoids a guaranteed error otherwise).
  const today = new Date().toISOString().split("T")[0];
  const { data: todayAttendance } = useQuery({
    queryKey: ["my-children-attendance", today],
    queryFn: () => apiGet<any[]>(`/attendance?serviceDate=${today}`),
    refetchInterval: 60 * 1000,
  });
  const checkedInChildIds = new Set(
    (todayAttendance ?? [])
      .filter((a: any) => a.status && a.status !== "picked_up")
      .map((a: any) => a.childId),
  );

  const handleSignalPickup = async (childId: number) => {
    try {
      await apiPost("/pickup-requests", { childId });
      setPickupSent(prev => new Set([...prev, childId]));
      setSelectedForPickup(prev => { const next = new Set(prev); next.delete(childId); return next; });
      toast({ title: "Pickup signal sent!", description: "The teacher has been notified. Head to the collection point." });
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "Could not send pickup signal" });
    }
  };

  const toggleSelect = (childId: number) => {
    setSelectedForPickup(prev => {
      const next = new Set(prev);
      next.has(childId) ? next.delete(childId) : next.add(childId);
      return next;
    });
  };

  const handleBulkPickup = async () => {
    const ids = [...selectedForPickup];
    if (ids.length === 0) return;
    setBulkSending(true);
    const sent: number[] = [];
    const failed: number[] = [];
    for (const childId of ids) {
      try {
        await apiPost("/pickup-requests", { childId });
        sent.push(childId);
      } catch {
        failed.push(childId);
      }
    }
    setPickupSent(prev => new Set([...prev, ...sent]));
    setSelectedForPickup(new Set(failed));
    setBulkSending(false);
    if (failed.length === 0) {
      toast({ title: `Pickup signal sent for ${sent.length} ${sent.length === 1 ? "child" : "children"}!`, description: "The teachers have been notified. Head to the collection point." });
    } else {
      toast({ variant: "destructive", title: `Sent for ${sent.length}, but ${failed.length} failed`, description: "The failed ones are still selected — try again." });
    }
  };

  if (isError) return <QueryError message="Could not load your children." />;
  if (isLoading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
    </div>
  );

  const children = family?.children ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
          My Children
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {children.length} child{children.length !== 1 ? "ren" : ""} registered · tap "Appraisals" to see Sunday reports
        </p>
      </div>

      {children.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border text-gray-400">
          <p className="font-medium">No children registered yet.</p>
          <p className="text-sm mt-1">Add your first child from the My Family page.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {selectedForPickup.size > 0 && (
            <div className="sticky top-2 z-10">
              <button
                type="button"
                onClick={handleBulkPickup}
                disabled={bulkSending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold shadow-lg transition-all disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #b45309, #d97706)" }}>
                <HandHeart className="w-4 h-4" />
                {bulkSending ? "Signalling…" : `I'm here to collect ${selectedForPickup.size} ${selectedForPickup.size === 1 ? "child" : "children"}`}
              </button>
            </div>
          )}
          {children.map((child: any) => (
            <ChildCard
              key={child.id}
              child={child}
              onSignalPickup={handleSignalPickup}
              pickupSent={pickupSent.has(child.id)}
              isCheckedIn={checkedInChildIds.has(child.id)}
              selected={selectedForPickup.has(child.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
