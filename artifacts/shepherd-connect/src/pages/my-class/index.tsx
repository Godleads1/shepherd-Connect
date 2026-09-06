import { useState } from "react";
import { useListAttendance, useListTeachers, useListTeacherAllocations } from "@workspace/api-client-react";
import { QueryError } from "@/components/QueryError";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  School, CheckCircle2, AlertTriangle, Users,
  CalendarCheck, ShieldCheck, Calendar,
  Cake, CalendarClock, PartyPopper, Tv, LockKeyhole,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api-call";
import { TeacherClockIn } from "@/components/TeacherClockIn";
import { ClassTvMediaControl } from "@/components/ClassTvMediaControl";
import { SecurePhoto } from "@/components/PhotoUploader";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";
import { openClassroomDisplay } from "@/lib/classroom-display";

function fmt(ts: string | null | undefined) {
  if (!ts) return "—";
  try { return format(new Date(ts), "h:mm a"); } catch { return "—"; }
}

function TimestampPill({ label, time, color }: { label: string; time: string | null | undefined; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-semibold" style={{ color }}>{label}</span>
      <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
        {fmt(time)}
      </span>
    </div>
  );
}

export default function MyClass() {
  const { toast } = useToast();
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const [activeTab, setActiveTab] = useState<"roster" | "birthdays" | "schedule">("roster");

  const { data: scheduleData } = useQuery({
    queryKey: ["teacher-schedule", user?.id],
    queryFn: () => apiGet<any>(`/reports/custom-builder?reportType=teacher-schedule&teacherId=${user?.id}&from=${today}`),
    enabled: activeTab === "schedule" && !!user?.id,
  });

  const qc = useQueryClient();

  // Resolve: current user → teacher record → today's allocated class
  const { data: allTeachers } = useListTeachers();
  const myTeacher = Array.isArray(allTeachers)
    ? (allTeachers as any[]).find((t) => t.userId === user?.id)
    : null;

  // For class self-selection banner
  const hasPrimaryClass = !!(myTeacher?.primaryClass || myTeacher?.user?.primaryClassId);
  const [selfSelectClassId, setSelfSelectClassId] = useState<number | null>(null);
  const { data: allClasses = [] } = useQuery<any[]>({
    queryKey: ["classes"],
    queryFn: () => apiGet<any[]>("/classes"),
    enabled: !hasPrimaryClass && !!myTeacher,
  });
  const uniqueClasses = (() => {
    const seen = new Set<string>();
    return (allClasses as any[]).filter((c: any) => { if (seen.has(c.name)) return false; seen.add(c.name); return true; });
  })();
  const selectClassMut = useMutation({
    mutationFn: (primaryClassId: number) => apiPost("/teachers/me/select-class", { primaryClassId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });

  const { data: myAllocations } = useListTeacherAllocations(
    { teacherId: myTeacher?.id },
    { query: { enabled: !!myTeacher?.id, queryKey: ["myTeacherAllocations", myTeacher?.id] } },
  );
  const allocList: any[] = Array.isArray(myAllocations) ? (myAllocations as any[]) : [];
  const todayAlloc = allocList.find((a) => a.serviceDate === today);
  const hasAllocationToday = !!todayAlloc;
  const primaryClassId: number | undefined = myTeacher?.primaryClass?.id ?? myTeacher?.user?.primaryClassId ?? undefined;

  const {
    data: assignedClassRosterData,
    isLoading: isAssignedClassRosterLoading,
    isError: isAssignedClassRosterError,
    refetch: refetchAssignedClassRoster,
  } = useQuery<{ data: any[]; total: number; class: { id: number; name: string } | null }>({
    queryKey: ["assignedClassRoster", user?.id, primaryClassId],
    queryFn: () => apiGet<{ data: any[]; total: number; class: { id: number; name: string } | null }>("/children/my-class-roster"),
    enabled: !hasAllocationToday && primaryClassId !== undefined,
  });
  const assignedClassRoster = assignedClassRosterData?.data ?? [];

  // Only use today's allocation — teachers must not see data for classes they aren't assigned to today
  const myClassId: number | undefined = todayAlloc?.classId;
  const myClassName: string | undefined = todayAlloc?.class?.name ?? undefined;

  const { data: allAttendance, isLoading, isError, refetch } = useListAttendance(
    { serviceDate: today, classId: myClassId },
    { query: { enabled: myClassId !== undefined, queryKey: ["myClassAttendance", myClassId, today] } },
  );
  const attendance = Array.isArray(allAttendance) ? allAttendance : [];
  const inClass   = attendance.filter((a: any) => a.status === "in_class");
  const pickedUp  = attendance.filter((a: any) => a.status === "picked_up");
  const { data: custodySummary } = useQuery<{ checkInRequests: number }>({
    queryKey: ["myClassCustodySummary", myClassId, today],
    queryFn: () => apiGet<{ checkInRequests: number }>(`/custody-episodes/my-class-summary?classId=${myClassId}`),
    enabled: myClassId !== undefined,
    refetchInterval: 15000,
  });

  const { data: birthdays } = useQuery({
    queryKey: ["birthdays-teacher"],
    queryFn: () => apiGet<any>("/reports/birthdays?days=30"),
    enabled: activeTab === "birthdays",
  });

  const tabs = [
    { key: "roster",    label: "Roster",      count: inClass.length },
    { key: "birthdays", label: "Birthdays",   count: null },
    { key: "schedule",  label: "Schedule",    count: scheduleData?.total ?? null },
  ];

  // If the teacher has no allocation today, show a locked-out screen (but still show the class-picker banner if they have no primary class)
  const isLoadingAllocation = !myAllocations && !!myTeacher?.id;
  if (!isLoadingAllocation && myTeacher && !hasAllocationToday) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
          style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}>
          <p className="text-blue-200 text-sm mb-1">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <School className="w-7 h-7" /> My Class
          </h1>
        </div>

        {/* Show class-picker banner even when not scheduled today */}
        {!hasPrimaryClass && (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <School className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-amber-900">You haven't been assigned a class yet</p>
                <p className="text-sm text-amber-700 mt-0.5 mb-3">
                  Select the class you normally teach. This becomes your permanent class until an admin reassigns you.
                </p>
                {selectClassMut.isSuccess ? (
                  <p className="text-sm font-semibold text-green-700">✓ Class saved! You're all set.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {uniqueClasses.map((cls: any) => (
                      <button key={cls.id} type="button" onClick={() => setSelfSelectClassId(cls.id)}
                        className="px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all"
                        style={selfSelectClassId === cls.id
                          ? { background: "#1e3a8a", color: "#fff", borderColor: "#1e3a8a" }
                          : { background: "#fff", color: "#1e3a8a", borderColor: "#bfdbfe" }}>
                        {cls.name}
                      </button>
                    ))}
                    {selfSelectClassId && (
                      <button type="button" disabled={selectClassMut.isPending}
                        onClick={() => selectClassMut.mutate(selfSelectClassId)}
                        className="px-4 py-1.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
                        style={{ background: "#1e3a8a", color: "#fff" }}>
                        {selectClassMut.isPending ? "Saving…" : "Confirm Selection"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {hasPrimaryClass && (
          <>
            <div className="rounded-2xl p-5 border border-blue-100 bg-blue-50 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #172554, #1d4ed8)" }}>
                <School className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-500 mb-0.5">Your Assigned Class</p>
                <p className="text-xl font-bold text-blue-900">{myTeacher?.primaryClass?.name ?? "Class"}</p>
                <p className="text-xs text-blue-600 mt-0.5">Permanent assignment — contact an admin to change</p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-700" />
                    Class Roster
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">Read-only outside service days</p>
                </div>
                {!isAssignedClassRosterLoading && !isAssignedClassRosterError && (
                  <Badge variant="secondary">{assignedClassRoster.length} enrolled</Badge>
                )}
              </div>

              {isAssignedClassRosterError ? (
                <QueryError message="Could not load your class roster." onRetry={() => refetchAssignedClassRoster()} />
              ) : isAssignedClassRosterLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
                </div>
              ) : assignedClassRoster.length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-dashed border-blue-100 bg-blue-50/50">
                  <Users className="w-10 h-10 text-blue-200 mx-auto mb-2" />
                  <p className="font-semibold text-gray-700">No children enrolled yet</p>
                  <p className="text-sm text-gray-500 mt-1">Children will appear here once they are assigned to this class.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {assignedClassRoster.map((child: any) => (
                    <div key={child.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                        {child.photoUrl ? (
                          <SecurePhoto
                            src={child.photoUrl}
                            alt={`${child.firstName} ${child.lastName}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <>{child.firstName?.[0]}{child.lastName?.[0]}</>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{child.firstName} {child.lastName}</p>
                        <p className="text-xs text-gray-500">
                          {typeof child.age === "number" ? `Age ${child.age}` : "Age not available"}
                          {" · "}
                          {child.class?.name ?? myTeacher?.primaryClass?.name ?? "Assigned class"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 text-center px-6">
          <LockKeyhole className="w-14 h-14 text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">Not Scheduled Today</h2>
          <p className="text-gray-500 text-sm max-w-sm">
            You are not on the schedule for today. Your assigned class will appear with full attendance tools on your next service day.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* ── No Primary Class Banner ── */}
      {!hasPrimaryClass && myTeacher && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <School className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-amber-900">You haven't been assigned a class yet</p>
              <p className="text-sm text-amber-700 mt-0.5 mb-3">
                Select the class you normally teach. This becomes your permanent class until an admin reassigns you.
              </p>
              {selectClassMut.isSuccess ? (
                <p className="text-sm font-semibold text-green-700">✓ Class saved! Refreshing…</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {uniqueClasses.map((cls: any) => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setSelfSelectClassId(cls.id)}
                      className="px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all"
                      style={selfSelectClassId === cls.id
                        ? { background: "#1e3a8a", color: "#fff", borderColor: "#1e3a8a" }
                        : { background: "#fff", color: "#1e3a8a", borderColor: "#bfdbfe" }}
                    >
                      {cls.name}
                    </button>
                  ))}
                  {selfSelectClassId && (
                    <button
                      type="button"
                      disabled={selectClassMut.isPending}
                      onClick={() => selectClassMut.mutate(selfSelectClassId)}
                      className="px-4 py-1.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
                      style={{ background: "#1e3a8a", color: "#fff" }}
                    >
                      {selectClassMut.isPending ? "Saving…" : "Confirm Selection"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
        style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}>
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm mb-1">
              {format(new Date(), "EEEE, d MMMM yyyy")}
            </p>
            <h1 className="text-2xl font-bold flex items-center gap-2"
              style={{ fontFamily: "'Playfair Display', serif" }}>
              <School className="w-7 h-7" /> {myClassName ?? "My Class"}
            </h1>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="text-right">
              <p className="text-4xl font-bold">{inClass.length}</p>
              <p className="text-blue-200 text-xs">children in class</p>
            </div>
            {myClassId && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <ClassTvMediaControl classId={myClassId} className={myClassName ?? undefined} />
                <button
                  type="button"
                  onClick={() => openClassroomDisplay(myClassId).catch((error: Error) => {
                    toast({
                      variant: "destructive",
                      title: "Could not open classroom display",
                      description: error.message,
                    });
                  })}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "#f59e0b", color: "#172554" }}
                >
                  <Tv className="w-4 h-4" />
                  TV Display
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: "Check-In Requests", value: custodySummary?.checkInRequests ?? 0, color: "#fbbf24" },
            { label: "In Class",     value: inClass.length,  color: "#4ade80" },
            { label: "Picked Up",    value: pickedUp.length, color: "#a3a3a3" },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-white/60 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Teacher Clock-In ── */}
      <TeacherClockIn />

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
            style={activeTab === tab.key
              ? { background: "#1e3a8a", color: "white", boxShadow: "0 2px 8px rgba(30,58,138,.3)" }
              : { color: "#6b7280" }}>
            {tab.label}
            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
              style={activeTab === tab.key
                ? { background: "rgba(255,255,255,0.2)", color: "#fff" }
                : { background: "#e5e7eb", color: "#374151" }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {isError ? (
        <QueryError message="Could not load class attendance." onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
        </div>
      ) : activeTab === "roster" ? (
        /* ── Class Roster ── */
        <>
          {inClass.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
              <Users className="w-14 h-14 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No children in class yet</p>
              <p className="text-gray-400 text-sm mt-1">Children appear here after support accepts and confirms custody.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inClass.map((a: any) => (
                <div key={a.id}
                  className="bg-white rounded-2xl border border-green-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="px-4 py-2.5 flex items-center justify-between text-sm font-semibold"
                    style={{ background: "#dcfce7", color: "#16a34a" }}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmed In Class
                    </div>
                    {a.custodyEpisodeId && (
                      <div className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "#c7d2fe", color: "#1d4ed8" }}>
                        <ShieldCheck className="w-3.5 h-3.5" /> Fast-Track Custody
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                      {a.child?.firstName?.[0]}{a.child?.lastName?.[0]}
                    </div>

                    {/* Name + allergy */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">
                        {a.child?.firstName} {a.child?.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{a.class?.name}</p>
                      {a.child?.allergies && (
                        <p className="text-xs text-red-600 flex items-center gap-1 mt-1 font-medium">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {a.child.allergies}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 items-end">
                      <TimestampPill label="In class" time={a.classArrivalTime} color="#16a34a" />
                    </div>
                  </div>
                </div>
              ))}

              {/* Picked up section */}
              {pickedUp.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CalendarCheck className="w-3.5 h-3.5" /> Picked Up Today ({pickedUp.length})
                  </p>
                  <div className="space-y-2">
                    {pickedUp.map((a: any) => (
                      <div key={a.id}
                        className="bg-gray-50 rounded-xl border border-gray-100 p-3 flex items-center gap-3 opacity-70">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{ background: "#94a3b8" }}>
                          {a.child?.firstName?.[0]}{a.child?.lastName?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-600">
                            {a.child?.firstName} {a.child?.lastName}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <TimestampPill label="In class" time={a.classArrivalTime} color="#16a34a" />
                          <TimestampPill label="Picked up" time={a.checkOutTime} color="#6b7280" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : activeTab === "birthdays" ? (
        /* ── Birthdays ── */
        <div className="space-y-4">
          <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 flex items-center gap-3">
            <PartyPopper className="w-5 h-5 text-pink-500 flex-shrink-0" />
            <p className="text-sm text-pink-800">
              <span className="font-bold">Upcoming birthdays</span> — children celebrating in the next 30 days.
              Make them feel special!
            </p>
          </div>
          {!birthdays ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
            </div>
          ) : birthdays.children?.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed">
              <Cake className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No upcoming birthdays in the next 30 days</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {birthdays.children.map((child: any) => {
                const isToday = child.daysUntil === 0;
                const isThisWeek = child.daysUntil <= 7;
                return (
                  <div key={child.id}
                    className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-4 ${
                      isToday ? "border-pink-300 bg-pink-50" : isThisWeek ? "border-amber-200" : "border-gray-100"
                    }`}>
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                      isToday ? "bg-pink-100" : "bg-blue-50"
                    }`}>
                      <Cake className={`w-5 h-5 ${isToday ? "text-pink-500" : isThisWeek ? "text-amber-500" : "text-gray-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{child.firstName} {child.lastName}</p>
                      <p className="text-xs text-gray-500">{child.className || "No class"}</p>
                      <p className={`text-xs font-semibold mt-0.5 ${isToday ? "text-pink-600" : isThisWeek ? "text-amber-600" : "text-gray-500"}`}>
                        {isToday ? "Happy Birthday Today!" : `Turning ${child.turningAge} in ${child.daysUntil} day${child.daysUntil === 1 ? "" : "s"}`}
                      </p>
                    </div>
                    {isToday && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-pink-200 text-pink-800">TODAY!</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center pt-2">
            <Link href="/reports">
              <button className="text-sm font-semibold text-blue-700 hover:underline flex items-center gap-1 mx-auto">
                <CalendarClock className="w-4 h-4" /> View full birthday report
              </button>
            </Link>
          </div>
        </div>
      ) : activeTab === "schedule" ? (
        /* ── My Schedule ── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">Upcoming Allocations</span>
          </div>
          {!scheduleData ? (
            <div className="p-8 text-center">
              <Skeleton className="h-12 w-full rounded-xl mb-2" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : scheduleData.rows?.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No upcoming allocations</p>
              <p className="text-xs text-gray-400 mt-1">Contact admin to get scheduled</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {scheduleData.rows.map((row: string[], i: number) => {
                const [date, slot, , , cls, room, status] = row;
                const isPast = date < today;
                return (
                  <div key={i} className={`px-4 py-3 flex items-center gap-4 ${isPast ? "opacity-50" : ""}`}>
                    <div className="text-center min-w-[52px]">
                      <p className="text-xs font-bold text-gray-500 uppercase">{date ? format(new Date(date), "EEE") : "—"}</p>
                      <p className="text-lg font-bold text-gray-900">{date ? format(new Date(date), "d") : "—"}</p>
                      <p className="text-xs text-gray-400">{date ? format(new Date(date), "MMM") : ""}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{cls || "—"}</p>
                      <p className="text-xs text-gray-500">{room} · {slot}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {status || "pending"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
