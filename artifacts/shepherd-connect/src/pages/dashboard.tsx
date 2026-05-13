import { useGetDashboardStats, useGetLiveView, useGetAttendanceTrends, useGetClassUtilization, useGetExceptions, useGetFeedbackAnalytics, useListTeachers, useListTeacherAllocations, useListChildren, useListAppraisals } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, Users, CheckCircle, Clock, Cake, UserX, Phone, Award, MessageSquare, School, ArrowRight, PenTool, Baby } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { apiGet } from "@/lib/api-call";
import { useAuth } from "@/contexts/auth";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

function BirthdayAndAbsenceRow() {
  const { data: bdays, isLoading: bdayLoading } = useQuery({
    queryKey: ["reports-birthdays"],
    queryFn: () => apiGet<any>("/reports/birthdays?days=30"),
  });
  const { data: absences, isLoading: absLoading } = useQuery({
    queryKey: ["reports-absence-alerts"],
    queryFn: () => apiGet<any>("/reports/absence-alerts?missedWeeks=2"),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="rounded-2xl border-amber-100 bg-amber-50/40 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-800 text-base">
            <Cake className="w-5 h-5 text-amber-500" /> Upcoming Birthdays (30 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bdayLoading ? <Skeleton className="h-20 w-full rounded-xl" /> : bdays?.children?.length ? (
            <div className="space-y-2">
              {bdays.children.slice(0, 5).map((c: any) => (
                <Link key={c.id} href={`/children/${c.id}`}>
                  <div className="flex items-center justify-between py-2 px-3 bg-white rounded-xl border border-amber-100 hover:shadow-sm transition-all cursor-pointer">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{c.firstName} {c.lastName}</p>
                      <p className="text-xs text-gray-500">{c.className || "Unassigned"} · Turning {c.turningAge}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-amber-600">{c.daysUntil === 0 ? "Today!" : `In ${c.daysUntil}d`}</p>
                      <p className="text-xs text-gray-400">{c.birthdayDate}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {bdays.total > 5 && <p className="text-xs text-amber-600 font-medium text-center">+{bdays.total - 5} more this month</p>}
            </div>
          ) : (
            <p className="text-sm text-amber-700 text-center py-3">No birthdays in the next 30 days</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-red-100 bg-red-50/30 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-red-800 text-base">
            <UserX className="w-5 h-5 text-red-500" /> Absence Alerts (2+ weeks)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {absLoading ? <Skeleton className="h-20 w-full rounded-xl" /> : absences?.children?.length ? (
            <div className="space-y-2">
              {absences.children.slice(0, 5).map((c: any) => (
                <div key={c.childId} className="flex items-center justify-between py-2 px-3 bg-white rounded-xl border border-red-100">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{c.childName}</p>
                    <p className="text-xs text-gray-500">{c.className || "Unassigned"} · Last: {c.lastAttendanceDate}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className="text-xs font-bold text-red-600">{c.daysMissed}d absent</p>
                    {c.family?.parentPhone && (
                      <a href={`tel:${c.family.parentPhone}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <Phone className="w-3 h-3" /> {c.family.parentPhone}
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {absences.total > 5 && <p className="text-xs text-red-600 font-medium text-center">+{absences.total - 5} more children absent</p>}
            </div>
          ) : (
            <p className="text-sm text-green-700 text-center py-3 font-medium">All children attended recently</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeacherDashboard() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: teachers } = useListTeachers({});
  const teacherRecord = (teachers as any[])?.find((t: any) => t.userId === user?.id);

  const { data: allocations } = useListTeacherAllocations(teacherRecord ? { teacherId: teacherRecord.id } : {});
  const allocList: any[] = Array.isArray(allocations) ? allocations : (allocations as any)?.data ?? [];
  const todayAllocs = allocList.filter((a: any) => a.serviceDate === today);
  const latestClassId = allocList.length > 0
    ? allocList.sort((a: any, b: any) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())[0]?.classId
    : undefined;

  const { data: childrenData } = useListChildren(latestClassId ? { classId: latestClassId } : { classId: -1 });
  const children: any[] = (childrenData as any)?.data ?? [];

  const { data: appraisalsData } = useListAppraisals(teacherRecord ? { teacherId: teacherRecord.id } : {});
  const appraisals: any[] = Array.isArray(appraisalsData) ? appraisalsData : (appraisalsData as any)?.data ?? [];
  const recentAppraisals = appraisals.slice(0, 3);

  const { data: msgCount } = useQuery({
    queryKey: ["msg-unread-teacher"],
    queryFn: () => apiGet<{ count: number }>("/messages/unread-count"),
  });

  const { data: classChangeReqs } = useQuery({
    queryKey: ["ccr-teacher"],
    queryFn: () => apiGet<{ data: any[] }>("/class-change-requests"),
  });
  const pendingCCR = (classChangeReqs?.data ?? []).filter((r: any) => r.status === "pending").length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
            Welcome back, {user?.firstName}
          </h1>
          <p className="text-white/70 text-sm mt-1">
            {today === format(new Date(), "yyyy-MM-dd") ? format(new Date(), "EEEE, d MMMM yyyy") : today}
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "My Class", value: children.length, icon: School, color: "#1e3a8a", bg: "#eff6ff" },
          { label: "Today's Services", value: todayAllocs.length, icon: Clock, color: "#059669", bg: "#f0fdf4" },
          { label: "Unread Messages", value: msgCount?.count ?? 0, icon: MessageSquare, color: "#7c3aed", bg: "#f5f3ff" },
          { label: "Class Change Requests", value: pendingCCR, icon: Award, color: "#d97706", bg: "#fffbeb" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="rounded-2xl border-none shadow-sm">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500 leading-tight">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Today's allocations */}
        <Card className="rounded-2xl border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#1e3a8a]" /> Today's Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAllocs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">No allocations today</p>
            ) : todayAllocs.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between py-2.5 px-3 bg-blue-50 rounded-xl border border-blue-100 mb-2">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{a.class?.name ?? `Class #${a.classId}`}</p>
                  <p className="text-xs text-gray-500">{a.serviceSlot === "7am" ? "7:00 AM" : "10:30 AM"} Service</p>
                </div>
                <Badge className={`text-xs ${a.status === "confirmed" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                  {a.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* My class children */}
        <Card className="rounded-2xl border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <School className="w-4 h-4 text-[#1e3a8a]" /> My Class ({children.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {children.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">No class assigned yet</p>
            ) : (
              <div className="space-y-1.5">
                {children.slice(0, 5).map((c: any) => (
                  <Link key={c.id} href={`/children/${c.id}`}>
                    <div className="flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                        {c.firstName[0]}{c.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.firstName} {c.lastName}</p>
                        {c.allergies && <p className="text-[10px] text-red-600">⚠ Allergies</p>}
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
                    </div>
                  </Link>
                ))}
                {children.length > 5 && (
                  <Link href="/appraisals">
                    <p className="text-xs text-center text-[#1e3a8a] font-medium pt-1 hover:underline cursor-pointer">
                      +{children.length - 5} more · view all
                    </p>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent appraisals */}
      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <PenTool className="w-4 h-4 text-amber-500" /> Recent Appraisals
          </CardTitle>
          <Link href="/appraisals">
            <span className="text-xs text-[#1e3a8a] font-medium hover:underline cursor-pointer flex items-center gap-1">
              Write appraisal <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        </CardHeader>
        <CardContent>
          {recentAppraisals.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400">No appraisals submitted yet.</p>
              <Link href="/appraisals">
                <p className="text-xs text-[#1e3a8a] font-medium hover:underline mt-1 cursor-pointer">Write your first appraisal →</p>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentAppraisals.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between py-2.5 px-3 bg-gray-50 rounded-xl border">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {a.child?.firstName} {a.child?.lastName}
                    </p>
                    <p className="text-xs text-gray-400">{a.serviceDate}</p>
                  </div>
                  <div className="flex gap-1">
                    {[a.participationLevel, a.scriptureEngagement, a.socialInteraction].map((lvl: string, i: number) => (
                      <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                        lvl === "excellent" ? "bg-green-100 text-green-800" :
                        lvl === "good" ? "bg-blue-100 text-blue-800" :
                        lvl === "fair" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                      }`}>{lvl?.replace("_", " ")}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { href: "/messages",              label: "Messages",        icon: MessageSquare, badge: msgCount?.count },
          { href: "/class-change-requests", label: "Class Changes",   icon: Award,         badge: pendingCCR },
          { href: "/attendance",            label: "Attendance",      icon: CheckCircle,   badge: undefined },
        ].map(({ href, label, icon: Icon, badge }) => (
          <Link key={href} href={href}>
            <div className="bg-white rounded-2xl border p-4 text-center cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5">
              <div className="relative inline-block">
                <div className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center mb-2"
                  style={{ background: "linear-gradient(135deg, #eff6ff, #dbeafe)" }}>
                  <Icon className="w-5 h-5 text-[#1e3a8a]" />
                </div>
                {badge != null && badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-gray-700">{label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: liveView, isLoading: liveLoading } = useGetLiveView();
  const { data: trends, isLoading: trendsLoading } = useGetAttendanceTrends({ period: "weekly" });
  const { data: utilization, isLoading: utilLoading } = useGetClassUtilization();
  const { data: exceptions, isLoading: excLoading } = useGetExceptions();
  const { data: feedback, isLoading: feedbackLoading } = useGetFeedbackAnalytics();

  if (statsLoading) return (
    <div className="p-8 space-y-4 max-w-7xl mx-auto">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div 
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}
      >
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -right-4 w-32 h-32 rounded-full bg-white/5" />
        <div className="relative z-10">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Dashboard</h1>
          <p className="text-white/70 text-sm mt-1">Overview of Shepherd Connect Operations</p>
        </div>
      </div>
      
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Link href="/children">
          <Card className="rounded-2xl border-none shadow-card hover:shadow-card-hover transition-all cursor-pointer group h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Registered Children</CardTitle>
              <div className="w-8 h-8 rounded-full bg-[#eff6ff] flex items-center justify-center">
                <Baby className="h-4 w-4 text-[#1e3a8a]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#1e3a8a]">{stats?.totalChildren ?? 0}</div>
              {(stats?.unassignedChildren ?? 0) > 0 && (
                <p className="text-xs text-amber-600 mt-1 font-medium">{stats!.unassignedChildren} unassigned</p>
              )}
            </CardContent>
          </Card>
        </Link>
        <Card className="rounded-2xl border-none shadow-card hover:shadow-card-hover transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Checked In</CardTitle>
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats?.totalCheckedIn || 0}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-card hover:shadow-card-hover transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pending Pickup</CardTitle>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats?.totalPending || 0}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-card hover:shadow-card-hover transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Teacher Attendance</CardTitle>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats?.teacherAttendanceRate || 0}%</div>
          </CardContent>
        </Card>
        <Card className={`rounded-2xl border-none transition-all ${stats?.activeEmergencies && stats.activeEmergencies > 0 ? "bg-red-50" : "shadow-card hover:shadow-card-hover"}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${stats?.activeEmergencies && stats.activeEmergencies > 0 ? "text-red-700" : "text-gray-500"}`}>Active Emergencies</CardTitle>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stats?.activeEmergencies && stats.activeEmergencies > 0 ? "bg-red-200" : "bg-gray-100"}`}>
              <AlertTriangle className={`h-4 w-4 ${stats?.activeEmergencies && stats.activeEmergencies > 0 ? "text-red-600" : "text-gray-400"}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats?.activeEmergencies && stats.activeEmergencies > 0 ? "text-red-700" : "text-gray-900"}`}>{stats?.activeEmergencies || 0}</div>
          </CardContent>
        </Card>
      </div>

      <BirthdayAndAbsenceRow />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 rounded-2xl border-none shadow-card">
          <CardHeader>
            <CardTitle style={{ fontFamily: "'Playfair Display', serif" }}>Attendance Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {trendsLoading ? <Skeleton className="h-full w-full rounded-xl" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                  <Line type="monotone" dataKey="total" stroke="#1e3a8a" strokeWidth={3} dot={{r: 4, fill: '#1e3a8a', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3 rounded-2xl border-none shadow-card">
          <CardHeader>
            <CardTitle style={{ fontFamily: "'Playfair Display', serif" }}>Class Utilization</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {utilLoading ? <Skeleton className="h-full w-full rounded-xl" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilization || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="className" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="utilizationPercent" fill="#1a237e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "teacher") return <TeacherDashboard />;
  return <AdminDashboard />;
}
