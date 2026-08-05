import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "@/lib/api-call";
import { QueryError } from "@/components/QueryError";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, Inbox, PenSquare, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { resolvePhotoUrl } from "@/components/PhotoUploader";

type Tab = "inbox" | "sent";

function Avatar({ user }: { user: any }) {
  const photo = resolvePhotoUrl(user?.photoUrl);
  return (
    <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden">
      {photo
        ? <img src={photo} alt={user?.firstName} className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>}
    </div>
  );
}

function MessageThread({ message, onBack }: { message: any; onBack: () => void }) {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reply, setReply] = useState("");
  const other = message.senderId === me?.id ? message.recipient : message.sender;

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      apiPost("/messages", { recipientId: other?.id, ...(message.childId ? { childId: message.childId } : {}), subject: message.subject, body }),
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["messages"] });
      toast({ title: "Reply sent" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: e.message || "Failed to send" }),
  });

  return (
    <div className="flex flex-col" style={{ minHeight: 420 }}>
      <div className="flex items-center gap-3 pb-4 border-b mb-4">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <Avatar user={other} />
        <div>
          <p className="font-semibold text-gray-900">{other?.firstName} {other?.lastName}</p>
          <p className="text-xs text-gray-400 capitalize">{other?.role?.replace("_", " ")}</p>
        </div>
      </div>

      {message.subject && (
        <p className="text-sm font-semibold text-gray-700 mb-3 px-1">{message.subject}</p>
      )}
      {message.child && (
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700 font-medium">
          Re: {message.child.firstName} {message.child.lastName}
        </div>
      )}

      <div className="flex-1 space-y-3 pb-4">
        <div className={`flex gap-3 ${message.senderId === me?.id ? "flex-row-reverse" : ""}`}>
          <Avatar user={message.sender} />
          <div
            className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${message.senderId === me?.id ? "rounded-tr-sm text-white" : "bg-gray-100 text-gray-900 rounded-tl-sm"}`}
            style={message.senderId === me?.id ? { background: "#1e3a8a" } : {}}>
            <p>{message.body}</p>
            <p className={`text-[10px] mt-1.5 ${message.senderId === me?.id ? "text-blue-200" : "text-gray-400"}`}>
              {format(new Date(message.createdAt), "dd MMM · HH:mm")}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t pt-3 flex gap-2">
        <Textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          placeholder="Write a reply…"
          rows={2}
          className="resize-none text-sm"
        />
        <Button
          onClick={() => reply.trim() && sendMutation.mutate(reply.trim())}
          disabled={!reply.trim() || sendMutation.isPending}
          className="self-end px-3"
          style={{ background: "#1e3a8a" }}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default function Messages() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("inbox");
  const [selectedMsg, setSelectedMsg] = useState<any>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [form, setForm] = useState({ recipientId: "", childId: "", subject: "", body: "" });

  const { data: inbox = [], isLoading: inboxLoading, isError: inboxError } = useQuery({
    queryKey: ["messages", "inbox"],
    queryFn: () => apiGet<any[]>("/messages/inbox"),
  });
  const { data: sent = [], isLoading: sentLoading, isError: sentError } = useQuery({
    queryKey: ["messages", "sent"],
    queryFn: () => apiGet<any[]>("/messages/sent"),
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["messages", "contacts"],
    queryFn: () => apiGet<any[]>("/messages/contacts"),
  });
  const { data: myFamily } = useQuery({
    queryKey: ["my-family-for-msg"],
    queryFn: () => apiGet<any>("/families/my"),
    enabled: me?.role === "parent",
  });

  const children: any[] = myFamily?.children ?? [];

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiPut(`/messages/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });

  const sendMutation = useMutation({
    mutationFn: (data: any) => apiPost("/messages", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      toast({ title: "Message sent!" });
      setComposeOpen(false);
      setForm({ recipientId: "", childId: "", subject: "", body: "" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: e.message || "Failed to send" }),
  });

  const handleOpenMsg = (msg: any) => {
    setSelectedMsg(msg);
    if (!msg.isRead && msg.recipientId === me?.id) markReadMutation.mutate(msg.id);
  };

  const unreadCount = (inbox as any[]).filter((m: any) => !m.isRead).length;
  const list: any[] = tab === "inbox" ? (inbox as any[]) : (sent as any[]);
  const loading = tab === "inbox" ? inboxLoading : sentLoading;
  const fetchError = tab === "inbox" ? inboxError : sentError;

  if (selectedMsg) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border p-5"
        style={{ boxShadow: "0 2px 8px rgba(30,58,138,.08)" }}>
        <MessageThread message={selectedMsg} onBack={() => setSelectedMsg(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
            Messages
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm font-medium" style={{ color: "#1e3a8a" }}>
              {unreadCount} unread message{unreadCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Button onClick={() => setComposeOpen(true)} className="flex items-center gap-2"
          style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
          <PenSquare className="w-4 h-4" /> New Message
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(["inbox", "sent"] as Tab[]).map(key => {
          const Icon = key === "inbox" ? Inbox : Send;
          const label = key === "inbox" ? "Inbox" : "Sent";
          return (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${tab === key ? "bg-white shadow-sm" : "text-gray-500"}`}
              style={tab === key ? { color: "#1e3a8a" } : {}}>
              <Icon className="w-4 h-4" />
              {label}
              {key === "inbox" && unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ background: "#dc2626" }}>{unreadCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Message list */}
      <div className="bg-white rounded-2xl border overflow-hidden"
        style={{ boxShadow: "0 2px 8px rgba(30,58,138,.06)" }}>
        {fetchError ? (
          <div className="p-4"><QueryError message="Could not load messages." /></div>
        ) : loading ? (
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{tab === "inbox" ? "No messages yet" : "No sent messages yet"}</p>
            <button onClick={() => setComposeOpen(true)}
              className="text-xs font-medium hover:underline mt-1"
              style={{ color: "#1e3a8a" }}>
              Send your first message
            </button>
          </div>
        ) : (
          <ul className="divide-y">
            {list.map((msg: any) => {
              const other = tab === "inbox" ? msg.sender : msg.recipient;
              const isUnread = tab === "inbox" && !msg.isRead;
              return (
                <li key={msg.id}
                  onClick={() => handleOpenMsg(msg)}
                  className={`flex items-start gap-3 px-5 py-4 cursor-pointer transition-colors hover:bg-gray-50 ${isUnread ? "bg-blue-50/50" : ""}`}>
                  <Avatar user={other} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`text-sm truncate ${isUnread ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                        {other?.firstName} {other?.lastName}
                        <span className="ml-1.5 text-xs font-normal text-gray-400 capitalize">
                          · {other?.role?.replace("_", " ")}
                        </span>
                      </p>
                      <p className="text-[10px] text-gray-400 flex-shrink-0">
                        {format(new Date(msg.createdAt), "dd MMM")}
                      </p>
                    </div>
                    {msg.subject && <p className="text-xs font-semibold text-gray-600 truncate">{msg.subject}</p>}
                    <p className="text-xs text-gray-500 truncate mt-0.5">{msg.body}</p>
                    {msg.child && (
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                        Re: {msg.child.firstName}
                      </span>
                    )}
                  </div>
                  {isUnread && (
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: "#1e3a8a" }} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Compose modal */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenSquare className="w-4 h-4" /> New Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5 uppercase tracking-wide">To *</label>
              <Select value={form.recipientId} onValueChange={v => setForm(p => ({ ...p, recipientId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select recipient…" /></SelectTrigger>
                <SelectContent className="max-h-[45vh] overflow-y-auto">
                  {(contacts as any[]).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.firstName} {c.lastName} · <span className="capitalize">{c.role.replace("_", " ")}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {children.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5 uppercase tracking-wide">
                  About a child (optional)
                </label>
                <Select value={form.childId || "none"} onValueChange={v => setForm(p => ({ ...p, childId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select child (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not about a specific child</SelectItem>
                    {children.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5 uppercase tracking-wide">Subject (optional)</label>
              <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="e.g. Question about Sunday's class" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5 uppercase tracking-wide">Message *</label>
              <Textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                placeholder="Write your message here…" rows={5} />
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t flex-shrink-0">
            <Button variant="outline" className="flex-1" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button className="flex-1 flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}
              disabled={!form.recipientId || !form.body.trim() || sendMutation.isPending}
              onClick={() => sendMutation.mutate({
                recipientId: Number(form.recipientId),
                ...(form.childId ? { childId: Number(form.childId) } : {}),
                ...(form.subject ? { subject: form.subject } : {}),
                body: form.body.trim(),
              })}>
              <Send className="w-4 h-4" />
              {sendMutation.isPending ? "Sending…" : "Send Message"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
