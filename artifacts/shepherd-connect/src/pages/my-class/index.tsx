import { useState } from "react";
import { useListAttendance, useMarkArrived } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { School, CheckCircle, AlertTriangle, Truck, Users, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";
import { format } from "date-fns";

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  dropped_off: { label: "Waiting Escort", color: "#d97706", bg: "#fef3c7", icon: Clock },
  in_transit:  { label: "In Transit",     color: "#1d4ed8", bg: "#dbeafe", icon: Truck },
  in_class:    { label: "In Class",       color: "#16a34a", bg: "#dcfce7", icon: CheckCircle },
  picked_up:   { label: "Picked Up",      color: "#6b7280", bg: "#f3f4f6", icon: CheckCircle },
};

export default function MyClass() {
  const { user } = useAuth();
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");
  const [activeTab, setActiveTab] = useState<"arrivals" | "roster">("arrivals");

  const { data: allAttendance, isLoading, refetch } = useListAttendance({
    serviceDate: today,
  });

  const arriveMutation = useMarkArrived();

  const attendance = Array.isArray(allAttendance) ? allAttendance : [];
  const pendingArrivals = attendance.filter((a: any) => a.status === "in_transit" || a.status === "dropped_off");
  const inClass = attendance.filter((a: any) => a.status === "in_class");
  const allPresent = attendance.filter((a: any) => a.status !== "picked_up");

  const handleConfirmArrival = async (id: number, childName: string) => {
    try {
      await arriveMutation.mutateAsync({ id });
      toast({
        title: "Arrival Confirmed",
        description: `${childName} has been marked as in class. Parent will be notified.`,
      });
      refetch();
    } catch {
      toast({ variant: "destructive", title: "Failed to confirm arrival" });
    }
  };

  const tabs = [
    { key: "arrivals", label: "Pending Arrivals", count: pendingArrivals.length },
    { key: "roster",   label: "Class Roster",    count: inClass.length },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
        style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              <School className="w-7 h-7" /> My Class
            </h1>
            <p className="text-blue-200 text-sm mt-1">Today · {format(new Date(), "EEEE, d MMMM yyyy")}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{allPresent.length}</p>
            <p className="text-blue-200 text-xs">children present</p>
          </div>
        </div>
        {/* Stats row */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: "Waiting", value: attendance.filter((a: any) => a.status === "dropped_off").length, color: "#fbbf24" },
            { label: "In Transit", value: attendance.filter((a: any) => a.status === "in_transit").length, color: "#60a5fa" },
            { label: "In Class", value: inClass.length, color: "#4ade80" },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-2 text-center">
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-white/70">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
            style={activeTab === tab.key
              ? { background: "#1e3a8a", color: "white", boxShadow: "0 2px 8px rgba(30,58,138,.3)" }
              : { color: "#6b7280" }}
          >
            {tab.label}
            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
              style={activeTab === tab.key ? { background: "rgba(255,255,255,0.2)" } : { background: "#e5e7eb" }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}
        </div>
      ) : activeTab === "arrivals" ? (
        <div>
          {pendingArrivals.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-700 font-semibold">All children are in class!</p>
              <p className="text-gray-400 text-sm mt-1">No pending arrivals</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingArrivals.map((a: any) => {
                const meta = STATUS_META[a.status] || STATUS_META.dropped_off;
                const Icon = meta.icon;
                const isTransit = a.status === "in_transit";
                return (
                  <div key={a.id} className="bg-white rounded-2xl border overflow-hidden shadow-sm"
                    style={{ borderColor: isTransit ? "#3b82f6" : "#f59e0b" }}>
                    {/* Status banner */}
                    <div className="px-4 py-2 flex items-center gap-2 font-semibold text-sm"
                      style={{ background: meta.bg, color: meta.color }}>
                      <Icon className="w-4 h-4" />
                      {meta.label}
                      {isTransit && <span className="ml-auto text-xs font-medium opacity-70">Escort in progress</span>}
                    </div>
                    <div className="p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                          {a.child?.firstName?.[0]}{a.child?.lastName?.[0]}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{a.child?.firstName} {a.child?.lastName}</h3>
                          <p className="text-gray-500 text-sm">{a.class?.name}</p>
                          {a.child?.allergies && (
                            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> {a.child.allergies}
                            </p>
                          )}
                        </div>
                      </div>
                      {isTransit && (
                        <button
                          onClick={() => handleConfirmArrival(a.id, `${a.child?.firstName}`)}
                          disabled={arriveMutation.isPending}
                          className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-60"
                          style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "white" }}
                        >
                          ✓ Confirm Arrived in Class
                        </button>
                      )}
                      {a.status === "dropped_off" && (
                        <p className="text-xs text-amber-600 text-center py-2 font-medium">
                          Waiting for volunteer escort
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div>
          {inClass.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No children in class yet</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {inClass.map((a: any) => (
                <Card key={a.id} className={a.child?.allergies ? "border-destructive/40" : "border-green-100"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{a.child?.firstName} {a.child?.lastName}</span>
                      <Badge className="text-xs" style={{ background: "#dcfce7", color: "#16a34a" }}>
                        In Class
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {a.child?.allergies && (
                      <div className="flex items-start gap-1.5 text-xs text-destructive bg-destructive/10 p-2 rounded font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        {a.child.allergies}
                      </div>
                    )}
                    <p className="text-xs text-gray-400">
                      Arrived · {a.checkInTime ? format(new Date(a.checkInTime), "h:mm a") : "—"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
