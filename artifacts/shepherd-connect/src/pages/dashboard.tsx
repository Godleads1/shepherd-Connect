import { useGetDashboardStats, useGetLiveView, useGetAttendanceTrends, useGetClassUtilization, useGetExceptions, useGetFeedbackAnalytics } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, Users, CheckCircle, Clock, Cake, UserX, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { apiGet } from "@/lib/api-call";

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

export default function Dashboard() {
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
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
