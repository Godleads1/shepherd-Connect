import { useState } from "react";
import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCircle, Info, AlertTriangle, Check, CheckCheck, ShieldCheck, ShieldX, MapPin, ExternalLink, Send, Loader2, Radio } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiPost, apiGet } from "@/lib/api-call";
import { useAuth } from "@/contexts/auth";
import { format, formatDistanceToNow } from "date-fns";

type TabKey = "all" | "unread" | "read";

type WhatsappBroadcast = {
  id: string;
  context: string;
  title: string;
  message: string;
  totalCount: number;
  deliveredCount: number;
  failedCount: number;
  skippedCount: number;
  status: "running" | "completed";
  createdAt: string;
  completedAt: string | null;
};

function BroadcastHistory() {
  const { data, isLoading } = useQuery<WhatsappBroadcast[]>({
    queryKey: ["whatsapp-broadcasts"],
    queryFn: () => apiGet("/notifications/whatsapp-broadcasts"),
    refetchInterval: (query) => {
      const data = query.state.data as WhatsappBroadcast[] | undefined;
      return data?.some(b => b.status === "running") ? 8000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading broadcast history…
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-sm text-gray-400 py-4 text-center">No WhatsApp broadcasts sent yet.</div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map(b => {
        const isRunning = b.status === "running";
        const delivered = b.deliveredCount;
        const failed = b.failedCount;
        const skipped = b.skippedCount;
        const processed = delivered + failed + skipped;
        const pct = b.totalCount > 0 ? Math.round((processed / b.totalCount) * 100) : 0;

        return (
          <div key={b.id} className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {isRunning
                  ? <Radio className="w-4 h-4 text-blue-500 animate-pulse flex-shrink-0" />
                  : <Send className="w-4 h-4 text-green-600 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="font-bold text-sm text-gray-900 truncate">{b.title}</p>
                  <p className="text-xs text-gray-500 capitalize">{b.context}</p>
                </div>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{isRunning ? `Sending… ${processed} / ${b.totalCount}` : `Sent to ${b.totalCount} recipients`}</span>
                <span>{pct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: isRunning ? "#3b82f6" : "#16a34a" }}
                />
              </div>
            </div>

            {/* Delivery counts */}
            <div className="flex gap-3 text-xs font-semibold">
              <span className="text-green-700">✓ {delivered} delivered</span>
              {skipped > 0 && <span className="text-gray-400">– {skipped} skipped</span>}
              {failed > 0 && <span className="text-red-600">✗ {failed} failed</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DelegateApprovalActions({ notif, onAction }: { notif: any; onAction: () => void }) {
  const { toast } = useToast();
  const meta = (() => { try { return JSON.parse(notif.metadataJson || "{}"); } catch { return {}; } })();
  const delegateId = meta.delegateId;
  const [loading, setLoading] = useState<"approved" | "denied" | null>(null);
  const [done, setDone] = useState<"approved" | "denied" | null>(null);

  if (!delegateId) return null;

  const handle = async (action: "approve" | "deny") => {
    const mapped: "approved" | "denied" = action === "approve" ? "approved" : "denied";
    setLoading(mapped);
    try {
      await apiPost(`/pickup-delegates/${delegateId}/${action}`, {});
      setDone(mapped);
      toast({
        title: mapped === "approved" ? "Pickup Approved ✓" : "Pickup Denied ✗",
        description: mapped === "approved"
          ? `${meta.delegateName} is authorised to collect the child.`
          : "The front desk has been notified that pickup is denied.",
        variant: mapped === "denied" ? "destructive" : "default",
      });
      onAction();
    } catch {
      toast({ variant: "destructive", title: `Failed to ${action} pickup` });
    } finally {
      setLoading(null);
    }
  };

  if (done) {
    return (
      <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${done === "approved" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
        {done === "approved" ? <ShieldCheck className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
        {done === "approved" ? "You approved this pickup" : "You denied this pickup"}
      </div>
    );
  }

  return (
    <div className="mt-3 flex gap-2">
      <button onClick={() => handle("approve")} disabled={!!loading}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
        {loading === "approved" ? "Approving..." : <><ShieldCheck className="w-4 h-4" /> Approve</>}
      </button>
      <button onClick={() => handle("deny")} disabled={!!loading}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
        {loading === "denied" ? "Denying..." : <><ShieldX className="w-4 h-4" /> Deny</>}
      </button>
    </div>
  );
}

export default function Notifications() {
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const { data: notifications, refetch, isError: notifError } = useListNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const handleMarkRead = async (id: number) => {
    try { await markReadMutation.mutateAsync({ id }); refetch(); }
    catch { toast({ variant: "destructive", title: "Action failed" }); }
  };

  const handleMarkAllRead = async () => {
    try { await markAllReadMutation.mutateAsync(); refetch(); }
    catch { toast({ variant: "destructive", title: "Action failed" }); }
  };

  const getIconAndColor = (type: string) => {
    if (type === "delegate_approval_request") return { icon: <ShieldCheck className="w-5 h-5 text-amber-600" />, bg: "bg-amber-100" };
    if (type.includes("emergency") || type.includes("alert")) return { icon: <AlertTriangle className="w-5 h-5 text-red-600" />, bg: "bg-red-100" };
    if (type.includes("success")) return { icon: <CheckCircle className="w-5 h-5 text-green-600" />, bg: "bg-green-100" };
    return { icon: <Info className="w-5 h-5 text-blue-600" />, bg: "bg-blue-100" };
  };

  const all = notifications?.data || [];
  const filtered = activeTab === "unread" ? all.filter(n => !n.readStatus) : activeTab === "read" ? all.filter(n => n.readStatus) : all;

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "all", label: "All", count: all.length },
    { key: "unread", label: "Unread", count: all.filter(n => !n.readStatus).length },
    { key: "read", label: "Read", count: all.filter(n => n.readStatus).length },
  ];

  if (notifError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center max-w-3xl mx-auto">
        <Bell className="w-10 h-10 text-gray-300" />
        <p className="font-bold text-gray-800">Could not load notifications</p>
        <p className="text-sm text-gray-500">Check your connection and try again.</p>
        <button onClick={() => refetch()} className="mt-2 px-4 py-2 bg-blue-900 text-white text-sm font-semibold rounded-xl">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto py-4">
      <div className="flex justify-between items-end border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3" style={{ fontFamily: "'Playfair Display', serif" }}>
            <div className="relative">
              <Bell className="w-8 h-8 text-blue-900" />
              {notifications?.unreadCount ? <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white" /> : null}
            </div>
            Notifications
          </h1>
          <p className="text-gray-500 mt-2 text-sm">Stay updated with your family and classes.</p>
        </div>
        {notifications?.unreadCount ? (
          <button onClick={handleMarkAllRead} disabled={markAllReadMutation.isPending}
            className="flex items-center gap-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        ) : null}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={activeTab === tab.key ? { background: "#1e3a8a", color: "white", boxShadow: "0 2px 8px rgba(30,58,138,.3)" } : { color: "#6b7280" }}>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={activeTab === tab.key ? { background: "rgba(255,255,255,0.2)" } : { background: "#e5e7eb", color: "#374151" }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(notif => {
          const { icon, bg } = getIconAndColor(notif.type);
          const isApprovalRequest = notif.type === "delegate_approval_request";
          return (
            <div key={notif.id}
              className={`p-5 rounded-2xl transition-all duration-300 flex gap-4 ${
                isApprovalRequest && !notif.readStatus
                  ? "bg-amber-50 border-l-4 border-l-amber-500 border border-amber-200 shadow-sm"
                  : notif.readStatus
                    ? "bg-white border border-gray-100 opacity-70"
                    : "bg-white border-l-4 border-l-[#1a237e] border border-gray-100 shadow-sm"
              }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>{icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`font-bold text-base leading-tight ${notif.readStatus ? "text-gray-700" : "text-gray-900"}`}>{notif.title}</h4>
                  <span className="text-xs font-medium text-gray-400 whitespace-nowrap ml-4">{format(new Date(notif.createdAt), "MMM d, h:mm a")}</span>
                </div>
                <p className={`text-sm ${notif.readStatus ? "text-gray-500" : "text-gray-700 font-medium"}`}>{notif.message}</p>
                <p className="text-xs text-gray-400 mt-1 capitalize">{notif.channel?.replace("_", " ")} · {notif.type?.replace(/_/g, " ")}</p>

                {notif.type === "pre_dismissal" && (() => {
                  const meta = (() => { try { return JSON.parse(notif.metadataJson || "{}"); } catch { return {}; } })();
                  const address = meta.pickupAddress || "RCCG City of David, Victoria Island, Lagos";
                  const mapsLink = meta.mapsLink || "https://maps.app.goo.gl/uvgtpVETsCeqkzmDA";
                  return (
                    <div className="mt-3 flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                      style={{ background: "#1e3a8a", color: "white" }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: "rgba(245,158,11,0.2)", border: "1.5px solid rgba(245,158,11,0.5)" }}>
                          <MapPin className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#f59e0b" }}>Pickup Location</p>
                          <p className="text-xs font-semibold text-white leading-tight truncate">{address}</p>
                        </div>
                      </div>
                      <a href={mapsLink} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
                        style={{ background: "#f59e0b", color: "#172554" }}>
                        Directions <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  );
                })()}

                {isApprovalRequest && (
                  <DelegateApprovalActions notif={notif} onAction={() => { handleMarkRead(notif.id); refetch(); }} />
                )}
              </div>
              {!notif.readStatus && !isApprovalRequest && (
                <button className="w-8 h-8 rounded-full bg-gray-50 hover:bg-green-50 text-gray-400 hover:text-green-600 flex items-center justify-center transition-colors flex-shrink-0"
                  onClick={() => handleMarkRead(notif.id)} disabled={markReadMutation.isPending} title="Mark as read">
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Bell className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {activeTab === "unread" ? "No Unread Notifications" : activeTab === "read" ? "No Read Notifications" : "All Caught Up"}
            </h3>
            <p className="text-gray-500 text-sm">You have no {activeTab === "all" ? "" : activeTab + " "}notifications right now.</p>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mt-10 border-t border-gray-100 pt-8">
          <div className="flex items-center gap-2 mb-4">
            <Send className="w-5 h-5 text-blue-900" />
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
              WhatsApp Broadcast History
            </h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Delivery results for recent broadcasts and pre-dismissal alerts sent via WhatsApp.</p>
          <BroadcastHistory />
        </div>
      )}
    </div>
  );
}
