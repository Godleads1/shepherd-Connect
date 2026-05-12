import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api-call";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare, Send, Inbox, Trash2, Plus, ChevronRight,
  CheckCheck, User, Baby, X,
} from "lucide-react";
import { format } from "date-fns";

const ROLE_COLORS: Record<string, string> = {
  parent: "bg-green-100 text-green-700",
  teacher: "bg-blue-100 text-blue-700",
  admin: "bg-purple-100 text-purple-700",
  super_admin: "bg-red-100 text-red-700",
  attendant: "bg-amber-100 text-amber-700",
};

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [selected, setSelected] = useState<any | null>(null);
  const [composing, setComposing] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [childId, setChildId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const { data: inbox, isLoading: inboxLoading } = useQuery({
    queryKey: ["messages-inbox"],
    queryFn: () => apiGet<any[]>("/messages/inbox"),
  });
  const { data: sent, isLoading: sentLoading } = useQuery({
    queryKey: ["messages-sent"],
    queryFn: () => apiGet<any[]>("/messages/sent"),
  });
  const { data: contacts } = useQuery({
    queryKey: ["message-contacts"],
    queryFn: () => apiGet<any[]>("/messages/contacts"),
  });
  const { data: myChildren } = useQuery({
    queryKey: ["my-children-for-msg"],
    queryFn: () => apiGet<any[]>("/children"),
    enabled: user?.role === "parent" || user?.role === "teacher",
  });

  const markRead = useMutation({
    mutationFn: (id: number) => apiPost(`/messages/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages-inbox"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/messages/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages-inbox"] });
      qc.invalidateQueries({ queryKey: ["messages-sent"] });
      setSelected(null);
      toast({ title: "Message deleted" });
    },
  });

  const sendMut = useMutation({
    mutationFn: () => apiPost("/messages", {
      recipientId: parseInt(recipientId, 10),
      childId: childId ? parseInt(childId, 10) : undefined,
      subject: subject || undefined,
      body,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages-sent"] });
      setComposing(false);
      setRecipientId(""); setChildId(""); setSubject(""); setBody("");
      toast({ title: "Message sent" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: e.message || "Failed to send" }),
  });

  const list = tab === "inbox" ? (inbox || []) : (sent || []);
  const loading = tab === "inbox" ? inboxLoading : sentLoading;
  const unread = (inbox || []).filter((m: any) => !m.isRead).length;

  const openMessage = (msg: any) => {
    setSelected(msg);
    if (tab === "inbox" && !msg.isRead) markRead.mutate(msg.id);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
        style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}>
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              <MessageSquare className="w-7 h-7" /> Messages
            </h1>
            <p className="text-blue-200 text-sm mt-1">Two-way parent–teacher communication</p>
          </div>
          <button
            onClick={() => setComposing(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
            style={{ background: "#f59e0b", color: "#1a1a1a" }}>
            <Plus className="w-4 h-4" /> New Message
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([
          { key: "inbox", label: "Inbox", icon: Inbox, count: unread },
          { key: "sent",  label: "Sent",  icon: Send,  count: null },
        ] as const).map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelected(null); }}
            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
            style={tab === t.key
              ? { background: "#1e3a8a", color: "white", boxShadow: "0 2px 8px rgba(30,58,138,.3)" }
              : { color: "#6b7280" }}>
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count !== null && t.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-amber-900">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-5 gap-4">
        {/* List */}
        <div className="md:col-span-2 space-y-2">
          {loading ? (
            [1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
          ) : list.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed">
              <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No messages here yet</p>
            </div>
          ) : list.map((msg: any) => {
            const isUnread = tab === "inbox" && !msg.isRead;
            const person = tab === "inbox" ? msg.sender : msg.recipient;
            return (
              <button key={msg.id} onClick={() => openMessage(msg)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  selected?.id === msg.id ? "border-blue-300 bg-blue-50" : "border-gray-100 bg-white hover:border-gray-200"
                } ${isUnread ? "shadow-sm" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                    {person?.firstName?.[0]}{person?.lastName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-sm truncate ${isUnread ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                        {person?.firstName} {person?.lastName}
                      </p>
                      {isUnread && <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />}
                    </div>
                    <p className={`text-xs truncate ${isUnread ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                      {msg.subject || msg.body}
                    </p>
                    <p className="text-xs text-gray-300 mt-0.5">{format(new Date(msg.createdAt), "MMM d, h:mm a")}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        <div className="md:col-span-3">
          {selected ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">{selected.subject || "(no subject)"}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-500">From:</span>
                    <span className="text-sm font-semibold text-gray-800">{selected.sender?.firstName} {selected.sender?.lastName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${ROLE_COLORS[selected.sender?.role] || "bg-gray-100 text-gray-600"}`}>
                      {selected.sender?.role?.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-500">To:</span>
                    <span className="text-sm font-semibold text-gray-800">{selected.recipient?.firstName} {selected.recipient?.lastName}</span>
                  </div>
                  {selected.child && (
                    <div className="flex items-center gap-1 mt-1">
                      <Baby className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-xs text-blue-600 font-medium">Re: {selected.child.firstName} {selected.child.lastName}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{format(new Date(selected.createdAt), "EEEE, MMM d yyyy 'at' h:mm a")}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selected.isRead && <span title="Read"><CheckCheck className="w-4 h-4 text-green-400" /></span>}
                  <button onClick={() => deleteMut.mutate(selected.id)}
                    disabled={deleteMut.isPending}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selected.body}</p>
              </div>
              <button
                onClick={() => {
                  const person = tab === "inbox" ? selected.sender : selected.recipient;
                  setRecipientId(String(person?.id || ""));
                  setChildId(selected.child ? String(selected.child.id) : "");
                  setSubject(selected.subject ? `Re: ${selected.subject}` : "");
                  setBody("");
                  setComposing(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors">
                <Send className="w-4 h-4" /> Reply
              </button>
            </div>
          ) : (
            <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-200">
              <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">Select a message to read it</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Dialog */}
      <Dialog open={composing} onOpenChange={setComposing}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1e3a8a]">
              <Send className="w-5 h-5" /> New Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">To *</label>
              <Select value={recipientId} onValueChange={setRecipientId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Choose recipient..." />
                </SelectTrigger>
                <SelectContent>
                  {(contacts || []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.firstName} {c.lastName}
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded capitalize ${ROLE_COLORS[c.role] || ""}`}>
                        {c.role?.replace("_", " ")}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(myChildren || []).length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">About child (optional)</label>
                <Select value={childId} onValueChange={setChildId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select child..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {(myChildren || []).map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.firstName} {c.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Subject</label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} className="rounded-xl" placeholder="Optional subject..." />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Message *</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Write your message..."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setComposing(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => sendMut.mutate()}
                disabled={!recipientId || !body.trim() || sendMut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#1e3a8a" }}>
                <Send className="w-4 h-4" />
                {sendMut.isPending ? "Sending..." : "Send Message"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
