import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api-call";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserCog, Pencil, Phone, Mail, Calendar, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { resolvePhotoUrl } from "@/components/PhotoUploader";

function TeacherAvatar({ teacher }: { teacher: any }) {
  const photo = resolvePhotoUrl(teacher?.user?.photoUrl);
  const initials = `${teacher?.user?.firstName?.[0] ?? ""}${teacher?.user?.lastName?.[0] ?? ""}`;
  return (
    <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
      {photo
        ? <img src={photo} alt={initials} className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg,#1e3a8a,#3b82f6)" }}>
            {initials}
          </div>}
    </div>
  );
}

function EditTeacherModal({ teacher, onClose }: { teacher: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: teacher?.user?.firstName ?? "",
    lastName:  teacher?.user?.lastName  ?? "",
    phone:     teacher?.user?.phone     ?? "",
  });

  const mut = useMutation({
    mutationFn: () => apiPut(`/teachers/${teacher.id}`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teachers"] });
      toast({ title: "Teacher updated successfully" });
      onClose();
    },
    onError: (e: any) => toast({ variant: "destructive", title: e.message || "Update failed" }),
  });

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1e3a8a]">
            <Pencil className="w-4 h-4" /> Edit Teacher Profile
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                First Name
              </label>
              <Input value={form.firstName}
                onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                placeholder="First name" className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Last Name
              </label>
              <Input value={form.lastName}
                onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                placeholder="Last name" className="rounded-xl" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Phone Number
            </label>
            <Input value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="+234 800 000 0000" className="rounded-xl" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl"
              style={{ background: "#1e3a8a" }}
              disabled={!form.firstName || !form.lastName || mut.isPending}
              onClick={() => mut.mutate()}>
              {mut.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Teachers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editTarget, setEditTarget] = useState<any>(null);
  const [search, setSearch] = useState("");

  const canEdit = user?.role === "super_admin" || user?.role === "admin";

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => apiGet<any[]>("/teachers"),
  });

  const { data: safeguardingData } = useQuery({
    queryKey: ["safeguarding"],
    queryFn: () => apiGet<any[]>("/safeguarding"),
    enabled: canEdit,
  });

  const safeguardingByUser: Record<number, any[]> = {};
  (safeguardingData ?? []).forEach((r: any) => {
    if (!safeguardingByUser[r.teacherUserId]) safeguardingByUser[r.teacherUserId] = [];
    safeguardingByUser[r.teacherUserId].push(r);
  });

  const filtered = (teachers as any[]).filter((t: any) => {
    if (!search) return true;
    const name = `${t.user?.firstName} ${t.user?.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase()) || t.user?.email?.toLowerCase().includes(search.toLowerCase());
  });

  const active   = filtered.filter((t: any) => t.user?.isActive);
  const inactive = filtered.filter((t: any) => !t.user?.isActive);

  function getDbsStatus(userId: number) {
    const recs = safeguardingByUser[userId] ?? [];
    if (recs.length === 0) return "none";
    if (recs.some((r: any) => r.isExpired)) return "expired";
    if (recs.some((r: any) => r.isExpiringSoon)) return "expiring";
    if (recs.some((r: any) => r.status === "clear")) return "clear";
    return "pending";
  }

  const DBS_BADGE: Record<string, { label: string; cls: string }> = {
    none:     { label: "No DBS",      cls: "bg-gray-100 text-gray-500" },
    pending:  { label: "DBS Pending", cls: "bg-amber-100 text-amber-700" },
    expiring: { label: "DBS Expiring","cls": "bg-orange-100 text-orange-700" },
    expired:  { label: "DBS Expired", cls: "bg-red-100 text-red-700" },
    clear:    { label: "DBS Clear",   cls: "bg-green-100 text-green-700" },
  };

  function TeacherCard({ teacher }: { teacher: any }) {
    const dbs = getDbsStatus(teacher.user?.id);
    const badge = DBS_BADGE[dbs];
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow">
        <TeacherAvatar teacher={teacher} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-bold text-gray-900 text-base leading-tight">
                {teacher.user?.firstName} {teacher.user?.lastName}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badge.cls}`}>
                  {badge.label}
                </span>
                {teacher.user?.isActive
                  ? <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-50 text-green-700">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </span>
                  : <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500">
                      <XCircle className="w-3 h-3" /> Inactive
                    </span>}
              </div>
            </div>
            {canEdit && (
              <button
                onClick={() => setEditTarget(teacher)}
                className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors flex-shrink-0"
                title="Edit teacher">
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="mt-3 space-y-1">
            {teacher.user?.email && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Mail className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                <span className="truncate">{teacher.user.email}</span>
              </div>
            )}
            {teacher.user?.phone && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Phone className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                <span>{teacher.user.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Joined {new Date(teacher.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stats = {
    total:    (teachers as any[]).length,
    active:   (teachers as any[]).filter((t: any) => t.user?.isActive).length,
    dbsClear: (teachers as any[]).filter((t: any) => getDbsStatus(t.user?.id) === "clear").length,
    dbsIssue: (teachers as any[]).filter((t: any) => ["expired","expiring","none"].includes(getDbsStatus(t.user?.id))).length,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
        style={{ background: "linear-gradient(135deg,#172554 0%,#1e3a8a 60%,#1d4ed8 100%)" }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <UserCog className="w-7 h-7" /> Teachers
          </h1>
          <p className="text-blue-200 text-sm mt-1">Manage teacher profiles and view safeguarding status</p>
        </div>
        {/* Stats row */}
        <div className="relative z-10 grid grid-cols-4 gap-3 mt-5">
          {[
            { label: "Total",       value: stats.total,    color: "bg-white/10" },
            { label: "Active",      value: stats.active,   color: "bg-green-500/20" },
            { label: "DBS Clear",   value: stats.dbsClear, color: "bg-emerald-500/20" },
            { label: "DBS Issues",  value: stats.dbsIssue, color: "bg-red-500/20" },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl px-3 py-2.5 text-center`}>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-blue-200 font-medium uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <Input
          placeholder="Search teachers by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 rounded-xl bg-white shadow-sm"
        />
      </div>

      {/* Active teachers */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      ) : active.length === 0 && inactive.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed">
          <UserCog className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No teachers found</p>
          {search && <p className="text-gray-400 text-sm mt-1">Try a different search term</p>}
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Active Teachers ({active.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {active.map((t: any) => <TeacherCard key={t.id} teacher={t} />)}
              </div>
            </div>
          )}
          {inactive.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 mt-2">
                Inactive / Suspended ({inactive.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
                {inactive.map((t: any) => <TeacherCard key={t.id} teacher={t} />)}
              </div>
            </div>
          )}
        </>
      )}

      {canEdit && (
        <div className="flex justify-end pt-1">
          <a href="/safeguarding"
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
            <ShieldCheck className="w-4 h-4" />
            Manage Safeguarding & DBS Records
          </a>
        </div>
      )}

      {editTarget && (
        <EditTeacherModal teacher={editTarget} onClose={() => setEditTarget(null)} />
      )}
    </div>
  );
}
