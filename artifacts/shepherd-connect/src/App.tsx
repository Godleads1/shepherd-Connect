import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { LanguageProvider } from "@/contexts/language";
import { ProtectedRoute } from "@/components/protected-route";
import { Layout } from "@/components/layout";
import "@/lib/api-setup";

import { ThemeProvider } from "@/components/theme-provider";

// Pages
import Login from "@/pages/login";
import Register from "@/pages/register";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Families from "@/pages/families/index";
import FamilyProfile from "@/pages/families/[id]";
import Children from "@/pages/children/index";
import ChildProfile from "@/pages/children/[id]";
import Classes from "@/pages/classes/index";
import CheckIn from "@/pages/checkin/index";
import Emergencies from "@/pages/emergencies/index";
import ClassAssignments from "@/pages/class-assignments/index";
import Checkout from "@/pages/checkout/index";
import Teachers from "@/pages/teachers/index";
import TeacherAllocations from "@/pages/teacher-allocations/index";
import Attendance from "@/pages/attendance/index";
import PickupDelegates from "@/pages/pickup-delegates/index";
import Notifications from "@/pages/notifications/index";
import Feedback from "@/pages/feedback/index";
import Appraisals from "@/pages/appraisals/index";
import AuditLogs from "@/pages/audit/index";
import UsersPage from "@/pages/users/index";
import MyFamily from "@/pages/my-family/index";
import MyChildren from "@/pages/my-children/index";
import MyClass from "@/pages/my-class/index";
import Reports from "@/pages/reports/index";
import ClassChangeRequests from "@/pages/class-change-requests/index";
import Profile from "@/pages/profile/index";
import Waitlist from "@/pages/waitlist/index";
import Messages from "@/pages/messages/index";
import SubstituteRequests from "@/pages/substitute-requests/index";
import Safeguarding from "@/pages/safeguarding/index";
import UserGuide from "@/pages/user-guide/index";

const queryClient = new QueryClient();

function DefaultRedirect() {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated || !user) return <Redirect to="/login" />;
  
  const role = user.role;
  if (role === "parent") return <Redirect to="/my-family" />;
  if (role === "teacher") return <Redirect to="/my-class" />;
  if (role === "attendant") return <Redirect to="/checkin" />;
  return <Redirect to="/dashboard" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/">
        <DefaultRedirect />
      </Route>
      
      <Route path="/*">
        <ProtectedRoute>
          <Layout>
            <Switch>
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/families" component={Families} />
              <Route path="/families/:id" component={FamilyProfile} />
              <Route path="/children" component={Children} />
              <Route path="/children/:id" component={ChildProfile} />
              <Route path="/classes" component={Classes} />
              <Route path="/checkin" component={CheckIn} />
              <Route path="/emergencies" component={Emergencies} />
              <Route path="/class-assignments" component={ClassAssignments} />
              <Route path="/checkout" component={Checkout} />
              <Route path="/teachers" component={Teachers} />
              <Route path="/teacher-allocations" component={TeacherAllocations} />
              <Route path="/attendance" component={Attendance} />
              <Route path="/pickup-delegates" component={PickupDelegates} />
              <Route path="/notifications" component={Notifications} />
              <Route path="/feedback" component={Feedback} />
              <Route path="/appraisals" component={Appraisals} />
              <Route path="/audit" component={AuditLogs} />
              <Route path="/users" component={UsersPage} />
              <Route path="/my-family" component={MyFamily} />
              <Route path="/my-children" component={MyChildren} />
              <Route path="/my-class" component={MyClass} />
              <Route path="/reports" component={Reports} />
              <Route path="/class-change-requests" component={ClassChangeRequests} />
              <Route path="/profile" component={Profile} />
              <Route path="/waitlist" component={Waitlist} />
              <Route path="/messages" component={Messages} />
              <Route path="/substitute-requests" component={SubstituteRequests} />
              <Route path="/safeguarding" component={Safeguarding} />
              <Route path="/user-guide" component={UserGuide} />

              {/* Fallback inside Layout */}
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="shepherd-theme">
        <LanguageProvider>
          <TooltipProvider>
            <AuthProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
            </AuthProvider>
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
