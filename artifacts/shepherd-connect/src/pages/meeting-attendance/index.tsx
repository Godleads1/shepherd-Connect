import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/auth";
import { ProtectedRoute } from "@/components/protected-route";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { captureMeetingTokenFromHash, clearPendingMeetingToken, readPendingMeetingToken } from "@/lib/meeting-attendance";
import AdminMeetingView from "./admin";
import TeacherMeetingView from "./teacher";
import { QrCode } from "lucide-react";

const ALLOWED = ["teacher", "admin", "super_admin"];

/**
 * Public-route wrapper: captures a #token= fragment into sessionStorage before
 * the global auth redirect would drop it, then defers to the normal guard.
 */
export default function MeetingAttendanceEntry() {
  const [token] = useState(() => captureMeetingTokenFromHash() ?? readPendingMeetingToken());
  const { isAuthenticated, isLoading, token: bearer } = useAuth();

  if (!isLoading && !bearer && !isAuthenticated && token) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-background">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3"><QrCode className="w-6 h-6 text-blue-800" /></div>
          <h1 className="font-bold text-lg text-gray-900">Meeting sign-in</h1>
          <p className="text-sm text-gray-600 mt-1">Sign in to your teacher account. You will return here to confirm your attendance.</p>
          <Link href="/login" className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900" data-testid="link-meeting-login">Sign in</Link>
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => { clearPendingMeetingToken(); window.location.replace(`${import.meta.env.BASE_URL}login`); }}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <Layout><MeetingAttendancePage token={token} /></Layout>
    </ProtectedRoute>
  );
}

function MeetingAttendancePage({ token }: { token: string | null }) {
  const { user } = useAuth();
  const role = user?.role ?? "";
  if (!ALLOWED.includes(role)) {
    return <div className="max-w-xl mx-auto py-16 text-center text-gray-600">Meeting attendance is available to teachers and admins.</div>;
  }
  const isAdmin = role === "admin" || role === "super_admin";
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Meeting Attendance</h1>
        <p className="text-gray-500 text-sm mt-1">
          {isAdmin ? "Staff meeting sign-in, separate from Sunday service attendance. All times in Lagos time (WAT)." : "Sign in to staff meetings you have been invited to. Times are Lagos time (WAT)."}
        </p>
      </div>
      {isAdmin && token && (
        <p className="text-sm rounded-xl border border-amber-200 bg-amber-50 text-amber-900 p-3">
          A meeting code was opened on this device. Switch to your teacher role to confirm attendance.
        </p>
      )}
      {isAdmin ? <AdminMeetingView /> : <TeacherMeetingView initialToken={token} />}
    </div>
  );
}
