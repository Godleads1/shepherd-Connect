import { useState } from "react";
import { useGetFamilyTree, useListAttendance } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPatch, apiGet } from "@/lib/api-call";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, MapPin, Eye, Shield, Calendar, Star, BookOpen, MessageSquare, ChevronRight, AlertTriangle, FileText, Edit2, Check, X, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, subMonths, eachDayOfInterval, getDay, isSameDay } from "date-fns";

function FamilyTreeVisual({ parents, children }: { parents: any[]; children: any[] }) {
  const colors = ["linear-gradient(135deg,#1e3a8a,#3b82f6)", "linear-gradient(135deg,#7c3aed,#a78bfa)"];
  const childColors = [
    "linear-gradient(135deg,#0891b2,#22d3ee)",
    "linear-gradient(135deg,#16a34a,#4ade80)",
    "linear-gradient(135deg,#d97706,#fbbf24)",
    "linear-gradient(135deg,#dc2626,#f87171)",
    "linear-gradient(135deg,#7c3aed,#c4b5fd)",
  ];

  return (
    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-800 mb-4 flex items-center gap-2">
        <Users className="w-4 h-4" /> Family Tree
      </p>

      {/* Parents row */}
      <div className="flex justify-center items-start gap-0 mb-0 relative">
        {parents.map((parent, i) => (
          <div key={parent.id} className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md border-2 border-white"
              style={{ background: colors[i % colors.length] }}>
              {parent.firstName[0]}{parent.lastName[0]}
            </div>
            <p className="text-xs font-bold text-gray-800 mt-1.5 text-center max-w-[80px] leading-tight">{parent.firstName}</p>
            <p className="text-[10px] text-gray-500 capitalize">{parent.role}</p>
            {/* Vertical stem from parent down */}
            <div className="w-0.5 bg-blue-300 mt-1" style={{ height: 20 }} />
          </div>
        ))}
        {/* Horizontal bridge between parents */}
        {parents.length === 2 && (
          <div className="absolute top-7 left-1/2 -translate-x-1/2 h-0.5 bg-blue-300" style={{ width: 64 }} />
        )}
      </div>

      {/* Central vertical trunk */}
      {children.length > 0 && (
        <div className="flex justify-center">
          <div className="w-0.5 bg-blue-300" style={{ height: 24 }} />
        </div>
      )}

      {/* Children row */}
      {children.length > 0 && (
        <>
          {/* Horizontal branch */}
          <div className="flex justify-center">
            <div className="h-0.5 bg-blue-300" style={{ width: Math.min(children.length * 88, 440) }} />
          </div>

          <div className="flex justify-center gap-4 mt-0">
            {children.map((child, i) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Vertical line from branch to child */}
                <div className="w-0.5 bg-blue-300" style={{ height: 16 }} />
                <Link href={`/children/${child.id}`} className="group">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-md border-2 border-white group-hover:scale-110 transition-transform"
                    style={{ background: childColors[i % childColors.length] }}>
                    {child.firstName[0]}{child.lastName[0]}
                  </div>
                </Link>
                <p className="text-xs font-semibold text-gray-800 mt-1.5 text-center max-w-[72px] leading-tight">{child.firstName}</p>
                {child.currentClass && (
                  <span className="text-[9px] bg-white border border-blue-200 text-blue-700 rounded-full px-1.5 py-0.5 mt-0.5 font-semibold text-center leading-tight">
                    {child.currentClass.name}
                  </span>
                )}
                {child.allergies && (
                  <span className="text-[9px] bg-red-100 text-red-700 rounded-full px-1.5 py-0.5 mt-0.5 font-semibold flex items-center gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" /> Allergy
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {children.length === 0 && (
        <div className="text-center text-xs text-blue-500 italic mt-2">No children registered yet</div>
      )}
    </div>
  );
}

function AttendanceCalendar({ childId }: { childId: number }) {
  const { data: attendance } = useListAttendance({ childId }, {
    query: { queryKey: ["attendance", childId] }
  });

  const today = new Date();
  const start = subMonths(today, 2);
  const days = eachDayOfInterval({ start, end: today });

  const attendedDates = (attendance || []).map((a: any) => a.serviceDate);

  const weeks: Date[][] = [];
  let week: Date[] = [];

  const firstDay = getDay(start);
  for (let i = 0; i < firstDay; i++) week.push(null as any);

  for (const day of days) {
    if (week.length === 7) { weeks.push(week); week = []; }
    week.push(day);
  }
  while (week.length < 7) week.push(null as any);
  weeks.push(week);

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {dayLabels.map((d, i) => (
          <div key={i} className="text-center text-xs text-gray-400 font-medium py-0.5">{d}</div>
        ))}
      </div>
      <div className="space-y-0.5">
        {weeks.map((w, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5">
            {w.map((day, di) => {
              if (!day) return <div key={di} className="h-5 w-5 mx-auto" />;
              const dateStr = format(day, "yyyy-MM-dd");
              const attended = attendedDates.includes(dateStr);
              const isToday = isSameDay(day, today);
              return (
                <div key={di}
                  title={dateStr}
                  className={`h-5 w-5 mx-auto rounded-sm transition-colors ${
                    attended ? "bg-blue-600" : isToday ? "bg-amber-300" : "bg-gray-100"
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" /> Attended</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-100 inline-block border" /> Absent</div>
        <span className="ml-auto">{(attendance || []).length} total sessions</span>
      </div>
    </div>
  );
}

function AdminNotesCard({ familyId, notes }: { familyId: number; notes: string | null }) {
  const { user } = useAuth();
  const isAdmin = user && ["super_admin", "admin"].includes(user.role);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes || "");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (value: string) => apiPatch<any>(`/families/${familyId}/notes`, { notes: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getFamilyTree", familyId] });
      setEditing(false);
      toast({ title: "Notes saved" });
    },
    onError: () => toast({ variant: "destructive", title: "Save failed" }),
  });

  if (!isAdmin && !notes) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-blue-600" /> Pastoral Notes</span>
          {isAdmin && !editing && (
            <button onClick={() => { setDraft(notes || ""); setEditing(true); }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {editing ? (
          <div className="space-y-2">
            <textarea
              className="w-full text-sm border rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 min-h-[80px]"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Add pastoral notes about this family..."
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">
                <X className="h-3 w-3" /> Cancel
              </button>
              <button onClick={() => mutation.mutate(draft)} disabled={mutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60">
                <Check className="h-3 w-3" /> Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {notes || <span className="italic text-gray-400">No notes yet. Click edit to add notes.</span>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ChildCard({ child, familyId }: { child: any; familyId: number }) {
  const [expanded, setExpanded] = useState(false);

  const { data: attendance } = useListAttendance({ childId: child.id }, {
    query: { queryKey: ["attendance", child.id], enabled: expanded }
  });

  const { data: appraisals } = useQuery({
    queryKey: ["appraisals", child.id],
    queryFn: () => apiGet<any[]>(`/appraisals?childId=${child.id}`),
    enabled: expanded,
  });

  const recentAppraisal = appraisals?.[appraisals.length - 1];
  const attendanceRate = attendance
    ? Math.round((attendance.filter((a: any) => a.status === "in_class" || a.status === "picked_up").length / Math.max(attendance.length, 1)) * 100)
    : null;

  const levelColors: Record<string, string> = {
    excellent: "bg-emerald-100 text-emerald-800",
    good: "bg-blue-100 text-blue-800",
    needs_improvement: "bg-amber-100 text-amber-800",
    concerning: "bg-red-100 text-red-800",
  };

  return (
    <div className="border rounded-xl overflow-hidden bg-white">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
              {child.firstName[0]}{child.lastName[0]}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{child.firstName} {child.lastName}</h3>
              <p className="text-sm text-gray-500">Age {child.age} · {child.gender}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {child.currentClass ? (
              <Badge variant="outline" className="text-xs">{child.currentClass.name}</Badge>
            ) : <Badge variant="secondary" className="text-xs">Unassigned</Badge>}
            {child.allergies && (
              <Badge className="bg-red-100 text-red-700 border-red-200 text-xs flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Allergy
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Link href={`/children/${child.id}`}
            className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 px-2 py-1 rounded-lg hover:bg-blue-50">
            <Eye className="h-3.5 w-3.5" /> Full Profile
          </Link>
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-50">
            <Calendar className="h-3.5 w-3.5" /> {expanded ? "Hide" : "Show"} History
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-gray-50 p-4 space-y-4">
          <div>
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Attendance — Last 3 Months
            </p>
            <AttendanceCalendar childId={child.id} />
          </div>

          {child.currentClass && (
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" /> Class Journey
              </p>
              <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="text-sm font-medium text-blue-900">{child.currentClass.name}</span>
                <span className="text-xs text-blue-600 ml-auto">Current</span>
              </div>
            </div>
          )}

          {recentAppraisal && (
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Star className="h-3.5 w-3.5" /> Latest Appraisal
              </p>
              <div className={`p-3 rounded-lg text-sm ${levelColors[recentAppraisal.level] || "bg-gray-100 text-gray-800"}`}>
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold capitalize">{recentAppraisal.level?.replace("_", " ")}</span>
                  <span className="text-xs opacity-70">{recentAppraisal.date}</span>
                </div>
                {recentAppraisal.notes && <p className="text-xs mt-1 opacity-80">{recentAppraisal.notes}</p>}
              </div>
            </div>
          )}

          {attendanceRate !== null && (
            <div className="flex items-center justify-between p-2 bg-white rounded-lg border">
              <span className="text-xs font-medium text-gray-600">Attendance Rate</span>
              <span className={`text-sm font-bold ${attendanceRate >= 80 ? "text-green-700" : attendanceRate >= 60 ? "text-amber-700" : "text-red-700"}`}>
                {attendanceRate}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FamilyProfile() {
  const { id } = useParams();
  const familyId = parseInt(id || "0", 10);

  const { data: tree, isLoading } = useGetFamilyTree(familyId, {
    query: { enabled: !!familyId, queryKey: ["getFamilyTree", familyId] }
  });

  const { data: feedback } = useQuery({
    queryKey: ["family-feedback", familyId],
    queryFn: () => apiGet<any[]>(`/feedback?familyId=${familyId}`),
    enabled: !!familyId,
  });

  if (isLoading) return (
    <div className="space-y-4 p-6 max-w-5xl mx-auto">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
    </div>
  );
  if (!tree) return <div className="p-6 text-gray-500">Family not found</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Family Profile</h1>
          <p className="text-gray-500 text-sm mt-1">Family Code: <strong>{tree.family.familyCode}</strong></p>
        </div>
        <Badge className="text-base py-1.5 px-4 bg-blue-50 text-blue-800 border-blue-200">
          {tree.children.length} {tree.children.length === 1 ? "Child" : "Children"}
        </Badge>
      </div>

      <FamilyTreeVisual parents={tree.parents} children={tree.children} />

      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Parents & Guardians</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {tree.parents.map((parent: any) => (
                <div key={parent.id} className="p-3 border rounded-xl bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
                        {parent.firstName[0]}{parent.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{parent.firstName} {parent.lastName}</p>
                        <Badge variant="outline" className="text-xs">{parent.role}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600 pl-11">
                    <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {parent.email}</div>
                    {parent.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {parent.phone}</div>}
                  </div>
                </div>
              ))}

              <div className="pt-2 border-t space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{tree.family.address || "No address provided"}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                  <Shield className="h-3.5 w-3.5 text-amber-500" />
                  <span>{tree.family.emergencyContactName
                    ? `${tree.family.emergencyContactName} — ${tree.family.emergencyContactPhone}`
                    : "No emergency contact"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <AdminNotesCard familyId={familyId} notes={(tree.family as any).notes} />

          {feedback && feedback.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Recent Feedback
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {feedback.slice(-3).map((fb: any) => (
                  <div key={fb.id} className="p-2.5 bg-gray-50 rounded-lg border text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i < Number(fb.rating) ? "text-amber-400 fill-amber-400" : "text-gray-200"}`} />
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">{format(new Date(fb.createdAt), "MMM d")}</span>
                    </div>
                    {fb.comments && <p className="text-xs text-gray-600 line-clamp-2">{fb.comments}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="md:col-span-2 space-y-4">
          <h2 className="font-bold text-gray-900 text-lg">Children</h2>
          {tree.children.length === 0 ? (
            <div className="p-8 text-center text-gray-400 border rounded-2xl">No children registered</div>
          ) : (
            tree.children.map((child: any) => (
              <ChildCard key={child.id} child={child} familyId={familyId} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
