import { useGetDashboardStats, useGetLiveView, useGetAttendanceTrends, useGetClassUtilization, useGetExceptions, useGetFeedbackAnalytics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, Users, CheckCircle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-600" />
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
                  <Bar dataKey="utilizationPercent" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
