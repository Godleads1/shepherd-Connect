import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/auth";
import {
  LayoutDashboard, Users, Baby, School, ClipboardCheck, CheckSquare,
  Bell, MessageSquare, AlertTriangle, UserCog, FileText, Star,
  Clock, ShieldCheck, Home, UserCircle, BarChart3,
  ChevronRight, ChevronDown, Info, Lightbulb, TriangleAlert, BookOpen,
  CalendarClock, QrCode, Phone, KeyRound,
  CheckCircle2, ArrowRight, BadgeCheck, Printer,
} from "lucide-react";

type RoleTab = "admin" | "teacher" | "support" | "parent";

const ROLES: { id: RoleTab; label: string; color: string; bg: string }[] = [
  { id: "admin",     label: "Admin / Super Admin", color: "#1e3a8a", bg: "#eff6ff" },
  { id: "teacher",   label: "Teacher",              color: "#059669", bg: "#f0fdf4" },
  { id: "support", label: "Support",            color: "#7c3aed", bg: "#f5f3ff" },
  { id: "parent",    label: "Parent",               color: "#d97706", bg: "#fffbeb" },
];

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl bg-blue-50 border border-blue-100 p-3.5 text-sm text-blue-800">
      <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
      <span>{children}</span>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl bg-amber-50 border border-amber-100 p-3.5 text-sm text-amber-800">
      <TriangleAlert className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
      <span>{children}</span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl bg-gray-50 border border-gray-200 p-3.5 text-sm text-gray-700">
      <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
      <span>{children}</span>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1e3a8a] text-white text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </div>
      <div className="flex-1 pb-4">
        <p className="font-semibold text-gray-900 text-sm mb-1">{title}</p>
        <div className="text-sm text-gray-600 leading-relaxed space-y-1">{children}</div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, color = "#1e3a8a", children }: {
  icon: React.ElementType; title: string; color?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <span className="flex-1 font-bold text-gray-900">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4 border-t border-gray-50">{children}</div>}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: `${color}18`, color }}>
      {label}
    </span>
  );
}

function QuickRef({ rows }: { rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden text-sm">
      {rows.map(([action, where], i) => (
        <div key={i} className={`flex items-start gap-3 px-4 py-2.5 ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
          <ArrowRight className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#1e3a8a]" />
          <span className="font-medium text-gray-800 min-w-[180px]">{action}</span>
          <span className="text-gray-500">{where}</span>
        </div>
      ))}
    </div>
  );
}

function AdminGuide() {
  return (
    <div className="space-y-4">
      <Section icon={LayoutDashboard} title="Dashboard — Command Centre">
        <p className="text-sm text-gray-600 mt-3">
          The dashboard gives you a live operational overview of every service. All key numbers refresh automatically every 30 seconds.
        </p>
        <QuickRef rows={[
          ["Registered Children", "Blue card (top-left) — click it to go straight to the full children directory"],
          ["Checked In", "Children currently in class today"],
          ["Pending Pickup", "Dropped off but not yet collected"],
          ["Teacher Attendance", "% of scheduled teachers who confirmed today"],
          ["Active Emergencies", "Turns red when any emergency is open — click Emergencies in nav"],
          ["Upcoming Birthdays", "Children with birthdays in the next 30 days"],
          ["Absence Alerts", "Children missing 2+ consecutive Sundays — includes parent phone number"],
          ["Attendance Trends", "Weekly/monthly check-in line chart"],
          ["Class Utilization", "Enrolled vs capacity bar chart per class"],
        ]} />
        <Tip>The dashboard date defaults to today. Most operational data (checked in, pending) resets per service day.</Tip>
      </Section>

      <Section icon={Users} title="Families">
        <p className="text-sm text-gray-600 mt-3">A family record links one or two parents to their children and holds emergency contact details.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="Create a family">
            <p>Go to <strong>Families</strong> → click <strong>+ Add Family</strong>. Fill in Parent 1 (required), Parent 2 (optional), home address, and emergency contact name and phone. Click <strong>Save</strong>.</p>
          </Step>
          <Step n={2} title="Search for a family">
            <p>Use the search bar at the top of the Families page — it searches by family code, parent name, or address in real time.</p>
          </Step>
          <Step n={3} title="View a family profile">
            <p>Click <strong>View</strong> on any family card. The profile shows both parents, all children, and the family code used during check-in.</p>
          </Step>
        </div>
        <Tip>Family codes (e.g. FAM-MENS01) are auto-generated and can be used at the check-in kiosk to look up a family quickly.</Tip>
      </Section>

      <Section icon={Baby} title="Children">
        <p className="text-sm text-gray-600 mt-3">Every child must belong to a family. You can add children individually or import many at once via CSV.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="Add a child manually">
            <p>Go to <strong>Children</strong> → click <strong>+ Add Child</strong>. Select the family, enter name, date of birth, gender, and optionally a class, allergies, and medical notes.</p>
          </Step>
          <Step n={2} title="Bulk import via CSV">
            <p>Click <strong>Import CSV</strong>. The modal shows a template — paste your data in the same format. Required columns: <code className="bg-gray-100 px-1 rounded text-xs">firstName, lastName, dateOfBirth</code>. Optional: gender, allergies, medicalNotes. Click <strong>Import Children</strong>. A results summary shows how many were created and any errors.</p>
          </Step>
          <Step n={3} title="Filter unassigned children">
            <p>Toggle <strong>Unassigned Only</strong> on the Children page to see children not yet placed in a class. Use this after registration drives to assign new joiners.</p>
          </Step>
          <Step n={4} title="View a child profile">
            <p>Click <strong>View</strong> on any child card. The profile shows their class, allergy alerts, attendance history, appraisals, and family details.</p>
          </Step>
        </div>
        <Warn>Allergy and medical notes are displayed with a red alert banner on the child card and on the check-in screen. Always verify these before placing a child in class.</Warn>
      </Section>

      <Section icon={School} title="Classes & Assignments">
        <p className="text-sm text-gray-600 mt-3">Classes define age groups and rooms. Class Assignments place individual children into specific classes.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="Create a class">
            <p>Go to <strong>Classes</strong> → click <strong>+ New Class</strong>. Set the name (e.g. Nursery), age range (min–max), room location, and service slot (7 AM or 10:30 AM). Save.</p>
          </Step>
          <Step n={2} title="Assign a child to a class">
            <p>Go to <strong>Assignments</strong> → click <strong>+ Assign Child</strong>. Select the child and target class. The system warns if the child's age falls outside the class range.</p>
          </Step>
          <Step n={3} title="Review class utilization">
            <p>The <strong>Reports → Analytics</strong> tab shows a grouped bar chart of enrolled vs capacity for every class. Red bars indicate over-enrolled classes.</p>
          </Step>
        </div>
        <Tip>Children can only be in one class at a time. Class assignments are managed by admins — contact your admin if a child needs to move class.</Tip>
      </Section>

      <Section icon={UserCog} title="Teachers & Allocations">
        <p className="text-sm text-gray-600 mt-3">Teachers are staff members linked to user accounts. Allocations schedule them to classes on specific service dates.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="Register a teacher">
            <p>Go to <strong>Teachers</strong> → click <strong>+ Add Teacher</strong>. Select the user account (the person must have registered first), enter their qualification and specialisation.</p>
          </Step>
          <Step n={2} title="Schedule a teacher (Allocation)">
            <p>Go to <strong>Allocations</strong> → click <strong>+ Allocate Teacher</strong>. Choose the teacher, class, service date, and service slot. Status starts as <em>Scheduled</em>; the teacher can confirm or decline from their dashboard.</p>
          </Step>
          <Step n={3} title="Monitor teacher attendance">
            <p>The <strong>Dashboard</strong> Teacher Attendance card shows the % of today's scheduled teachers who confirmed. Drill into <strong>Allocations</strong> for the full list with statuses.</p>
          </Step>
        </div>
      </Section>

      <Section icon={CheckSquare} title="Attendance Records">
        <p className="text-sm text-gray-600 mt-3">Attendance is created automatically when a child is checked in. The Attendance page lets you view and filter historical records.</p>
        <QuickRef rows={[
          ["View today's attendance", "Attendance page — filter by today's date"],
          ["Filter by class", "Use the Class dropdown on the Attendance page"],
          ["Export to CSV", "Reports → Attendance CSV export with date range filter"],
          ["Absence alerts", "Dashboard → Absence Alerts widget (2+ missed Sundays)"],
        ]} />
      </Section>

      <Section icon={AlertTriangle} title="Emergencies">
        <p className="text-sm text-gray-600 mt-3">Log and resolve safeguarding incidents, medical events, or any on-site emergency during a service.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="Log an emergency">
            <p>Go to <strong>Emergencies</strong> → click <strong>+ Log Emergency</strong>. Select the type (medical, fire, missing child, safeguarding, other), enter a description, and optionally link a child. The emergency is immediately marked <em>Active</em> and the Dashboard counter turns red.</p>
          </Step>
          <Step n={2} title="Resolve an emergency">
            <p>On the Emergencies page, find the active record → click <strong>Resolve</strong>. Add a resolution note describing the outcome. Status changes to <em>Resolved</em>.</p>
          </Step>
          <Step n={3} title="Export the emergency log">
            <p>Go to <strong>Reports → Exports</strong> → click <strong>Export Emergency Log (CSV)</strong>. This downloads all emergencies with timestamps and resolutions.</p>
          </Step>
        </div>
        <Warn>All emergency records are permanent and audited. They cannot be deleted — only resolved.</Warn>
      </Section>

      <Section icon={BarChart3} title="Reports">
        <p className="text-sm text-gray-600 mt-3">The Reports page has three tabs: Live, Analytics, and Exports.</p>
        <QuickRef rows={[
          ["Not Picked Up", "Live tab — children still in class at end of service with parent phone numbers"],
          ["Teacher Ratio", "Live tab — flags classes below the required teacher-to-child ratio"],
          ["Daily Summary", "Live tab — total checked in, still present, and picked up for today"],
          ["Attendance Trends chart", "Analytics tab — line chart of weekly attendance over time"],
          ["Class Enrollment vs Capacity", "Analytics tab — grouped bar chart per class"],
          ["Attendance CSV export", "Exports tab — choose date range and download"],
          ["Emergency log CSV", "Exports tab — full emergency history"],
        ]} />
      </Section>

      <Section icon={Bell} title="Notifications & Broadcasts">
        <p className="text-sm text-gray-600 mt-3">Send targeted notifications to one or more roles, or broadcast a pre-dismissal alert to all parents of children currently checked in.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="Send a broadcast">
            <p>Go to <strong>Notifications</strong> → click <strong>Broadcast Message</strong>. Write a title and message, select which roles receive it (Parents, Teachers, etc.), and click <strong>Send</strong>.</p>
          </Step>
          <Step n={2} title="Pre-dismissal alert">
            <p>On the Notifications page click <strong>Send Pre-Dismissal Alert</strong>. This automatically creates a notification for every parent whose child is currently checked in — useful 15 minutes before service ends.</p>
          </Step>
        </div>
        <Tip>Unread notification counts appear as red badge numbers on the Bell icon in the nav bar for all recipients.</Tip>
      </Section>

      <Section icon={ShieldCheck} title="User Management (Super Admin)">
        <p className="text-sm text-gray-600 mt-3">The Users page is only visible to Super Admins. It controls who can access Shepherd Connect and at what role level.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="Approve a pending admin or teacher">
            <p>When an admin or teacher registers, their account is held in <em>Pending Approval</em>. Go to <strong>Users</strong> → <strong>Pending Approval</strong> tab → click <strong>Approve</strong> next to their name. They can now log in.</p>
          </Step>
          <Step n={2} title="Reject a registration">
            <p>Click <strong>Reject</strong> on a pending account. The account is deactivated. The person will not be able to log in.</p>
          </Step>
          <Step n={3} title="Deactivate an existing user">
            <p>On the <strong>All Users</strong> tab, find the user and click <strong>Deactivate</strong>. They lose access immediately without deleting their data.</p>
          </Step>
        </div>
        <Note>Parents and Supports who self-register are automatically approved and can log in immediately — only Admin and Teacher accounts require manual approval.</Note>
      </Section>

      <Section icon={FileText} title="Audit Logs">
        <p className="text-sm text-gray-600 mt-3">Every significant action in the system (check-ins, approvals, emergencies, profile changes) is recorded with a timestamp and the acting user.</p>
        <QuickRef rows={[
          ["Filter by user", "Use the User dropdown on the Audit Logs page"],
          ["Filter by action type", "Use the Action dropdown (e.g. checkin, approve_user)"],
          ["Filter by date range", "Set Start Date and End Date at the top of the page"],
          ["Who made a change?", "Each log entry shows the user's name and role"],
        ]} />
        <Warn>Audit logs are read-only. They cannot be edited or deleted by anyone.</Warn>
      </Section>

      <Section icon={CalendarClock} title="Substitute Requests">
        <p className="text-sm text-gray-600 mt-3">When a teacher cannot attend, they or an admin can raise a substitute request so another teacher can cover the class.</p>
        <QuickRef rows={[
          ["Raise a substitute request", "Substitute Requests page → + New Request → select class, date, and reason"],
          ["Assign a substitute", "Click Assign on a pending request → choose an available teacher"],
          ["View pending/filled requests", "Toggle between Pending and Filled tabs on the Substitute Requests page"],
        ]} />
      </Section>
    </div>
  );
}

function TeacherGuide() {
  return (
    <div className="space-y-4">
      <Section icon={School} title="My Class" color="#059669">
        <p className="text-sm text-gray-600 mt-3">My Class is your home page — it shows the children currently assigned to your class with their age, photo, and any allergy alerts.</p>
        <QuickRef rows={[
          ["See your class list", "My Class in the sidebar"],
          ["View a child's profile", "Click any child card → opens their full profile"],
          ["Check allergy alerts", "Red 'Medical / Allergy' banner on child cards — always review before class"],
          ["See attendance today", "Attendance page → filter by your class and today's date"],
        ]} />
        <Tip>If your class list is empty, your admin may not have allocated you to a class yet. Contact your admin or check the Allocations page.</Tip>
      </Section>

      <Section icon={Clock} title="Service Schedule & Allocations" color="#059669">
        <p className="text-sm text-gray-600 mt-3">Your admin schedules you to classes via Allocations. You can view your upcoming schedule and confirm or decline.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="View your schedule">
            <p>Your Teacher Dashboard shows <strong>Today's Schedule</strong> — all classes you are allocated to serve today, with service time (7 AM or 10:30 AM).</p>
          </Step>
          <Step n={2} title="Confirm your attendance">
            <p>Go to <strong>Allocations</strong> → find your upcoming allocation → click <strong>Confirm</strong>. Status changes from <em>Scheduled</em> to <em>Confirmed</em>.</p>
          </Step>
          <Step n={3} title="Raise a substitute request">
            <p>If you cannot attend, go to <strong>Substitute Requests</strong> → click <strong>+ New Request</strong>. Fill in the class, date, service slot, and reason. Your admin will be notified and can assign a cover teacher.</p>
          </Step>
        </div>
      </Section>

      <Section icon={FileText} title="Child Appraisals" color="#059669">
        <p className="text-sm text-gray-600 mt-3">Appraisals let you record how each child engaged during the service — useful for tracking progress and sharing insights with parents.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="Create an appraisal">
            <p>Go to <strong>Appraisals</strong> → click <strong>+ New Appraisal</strong>. Select the child, service date, and rate three areas:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li><strong>Participation Level</strong> — how actively the child joined in</li>
              <li><strong>Scripture Engagement</strong> — engagement with the Bible lesson</li>
              <li><strong>Social Interaction</strong> — how well they engaged with peers</li>
            </ul>
            <p>Each is rated: Excellent / Good / Fair / Needs Attention. Add personal notes and any milestones reached.</p>
          </Step>
          <Step n={2} title="View past appraisals">
            <p>On the Appraisals page, use the Child filter to see all appraisals for a specific child over time.</p>
          </Step>
        </div>
        <Tip>Parents can see their child's appraisal history on the My Children page. Write notes as if speaking directly to the parent — keep them encouraging and constructive.</Tip>
      </Section>

      <Section icon={CheckSquare} title="Attendance" color="#059669">
        <p className="text-sm text-gray-600 mt-3">Attendance records are auto-created during check-in. You can view your class's attendance history on the Attendance page.</p>
        <QuickRef rows={[
          ["Today's check-ins for my class", "Attendance page → filter by your class and today"],
          ["Absence history for a child", "Children profile → Attendance tab"],
          ["Mark a note on attendance", "Contact your admin — only admins can edit attendance records"],
        ]} />
      </Section>

      <Section icon={MessageSquare} title="Messages" color="#059669">
        <p className="text-sm text-gray-600 mt-3">Use the Messages page to send and receive direct messages with other staff members or parents.</p>
        <QuickRef rows={[
          ["Send a message", "Messages → + New Message → select recipient → type and send"],
          ["Unread count", "Red badge on the Messages nav item — updates every 30 seconds"],
          ["Reply to a message", "Open the conversation thread and type your reply at the bottom"],
        ]} />
      </Section>

      <Section icon={UserCircle} title="My Profile" color="#059669">
        <p className="text-sm text-gray-600 mt-3">Keep your profile up to date so your admin and parents can reach you correctly.</p>
        <QuickRef rows={[
          ["Edit your name / phone / photo", "My Profile → Edit Profile → update fields → Save"],
          ["Set communication preferences", "My Profile → Communication Preferences toggle (In-App, WhatsApp, SMS)"],
          ["Profile completeness", "A progress bar shows which fields are still missing"],
        ]} />
      </Section>
    </div>
  );
}

function SupportGuide() {
  return (
    <div className="space-y-4">
      <Section icon={ClipboardCheck} title="Check In — Standard" color="#7c3aed">
        <p className="text-sm text-gray-600 mt-3">Check-in registers a child as present for today's service. The support role is designed for fast, kiosk-style operation.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="Find the family">
            <p>Go to <strong>Check In</strong>. Search by the child's name, parent name, or family code (e.g. FAM-MENS01). Results appear instantly as you type.</p>
          </Step>
          <Step n={2} title="Select the child to check in">
            <p>Click the family card to expand it and see all children. Click <strong>Check In</strong> next to the child's name.</p>
          </Step>
          <Step n={3} title="Confirm the service slot">
            <p>A confirmation dialog shows the child's name, class, and allergy alerts (if any). Select the service slot (7 AM or 10:30 AM) and click <strong>Confirm Check In</strong>.</p>
          </Step>
          <Step n={4} title="Child is checked in">
            <p>The child's status changes to <em>Checked In</em>. Their card is greyed out so you cannot double-check-in accidentally.</p>
          </Step>
        </div>
        <Warn>Always read allergy and medical notes shown on the confirmation screen. Never check in a child without acknowledging any medical alert.</Warn>
        <Tip>Family code is the fastest way to find a family when there is a queue. Ask the parent for their code — it is shown on their My Family page.</Tip>
      </Section>

      <Section icon={QrCode} title="Check In — QR Code" color="#7c3aed">
        <p className="text-sm text-gray-600 mt-3">Families can present a QR code from their parent app for instant check-in without searching.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="Open the QR scanner">
            <p>On the Check In page, click the <strong>QR Code</strong> tab (or the QR icon in the mobile bottom bar). Allow camera access when prompted.</p>
          </Step>
          <Step n={2} title="Scan the parent's QR code">
            <p>Point the camera at the parent's QR code displayed on their phone. The family is looked up automatically and the check-in screen opens.</p>
          </Step>
          <Step n={3} title="Complete check-in">
            <p>Verify the child and confirm — same as standard check-in from Step 3 above.</p>
          </Step>
        </div>
      </Section>

      <Section icon={CheckSquare} title="Check Out — Parent Pickup" color="#7c3aed">
        <p className="text-sm text-gray-600 mt-3">When a parent collects their child, check out records the pickup and clears the child from the present list.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="Find the child">
            <p>Go to <strong>Check Out</strong> → <strong>Standard Pickup</strong> tab. Search by child or parent name.</p>
          </Step>
          <Step n={2} title="Verify the parent">
            <p>Confirm the collecting adult matches the parent on record. If a different adult is collecting, switch to the Delegate OTP tab.</p>
          </Step>
          <Step n={3} title="Complete checkout">
            <p>Click <strong>Check Out</strong> next to the child. The child's status changes to <em>Picked Up</em> and they are removed from the present list.</p>
          </Step>
        </div>
      </Section>

      <Section icon={KeyRound} title="Check Out — Delegate OTP" color="#7c3aed">
        <p className="text-sm text-gray-600 mt-3">When someone other than the registered parent collects a child, they must present a one-time password (OTP) issued by the parent.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="Switch to the Delegate tab">
            <p>On the <strong>Check Out</strong> page, click the <strong>Delegate OTP Checkout</strong> tab.</p>
          </Step>
          <Step n={2} title="Enter the 6-digit OTP">
            <p>Ask the collecting adult for their 6-digit OTP (provided by the parent on their app). Type it into the OTP field and click <strong>Verify &amp; Check Out</strong>.</p>
          </Step>
          <Step n={3} title="OTP validated">
            <p>If valid, the system shows the child's name and the delegate's name. Confirm by clicking <strong>Complete Checkout</strong>. The OTP is single-use and expires after 24 hours.</p>
          </Step>
        </div>
        <Warn>Never release a child to a delegate without a valid OTP. If the OTP fails or is expired, the parent must issue a new one from their app. Do not override this process.</Warn>
        <Note>OTPs are generated by the parent in their <strong>Pickup Delegates</strong> section. Each delegate gets a unique code. Once used, the code is invalidated.</Note>
      </Section>

      <Section icon={Bell} title="Notifications" color="#7c3aed">
        <p className="text-sm text-gray-600 mt-3">Supports receive system notifications (broadcasts, alerts). Check the Bell icon for updates during the service.</p>
        <Tip>During a busy check-in period, keep an eye on the notification badge — admins sometimes send pre-dismissal alerts or important updates through the broadcast system.</Tip>
      </Section>
    </div>
  );
}

function ParentInfographic() {
  const steps = [
    { icon: "📋", label: "Register",      sub: "Sign up online or at church",  bg: "#1e3a8a", text: "#fff" },
    { icon: "👶", label: "Add Children",  sub: "Name, class & allergies",       bg: "#2563eb", text: "#fff" },
    { icon: "📱", label: "QR Check-In",   sub: "Scan at the kiosk",             bg: "#1e3a8a", text: "#fff" },
    { icon: "🏫", label: "In Class",      sub: "Learning & celebrated",         bg: "#f59e0b", text: "#1d1d1f" },
    { icon: "🚶", label: "In Transit",    sub: "Teacher walks them to you",     bg: "#d97706", text: "#fff" },
    { icon: "✅", label: "Picked Up",     sub: "Safely checked out",            bg: "#16a34a", text: "#fff" },
  ];

  const features = [
    {
      icon: "👥", color: "#1e3a8a", title: "Delegate Pickup",
      items: ["Add a trusted person", "Get a 6-digit OTP", "Share OTP with them", "They present it at kiosk"],
    },
    {
      icon: "💬", color: "#15803d", title: "WhatsApp Bot",
      items: ["\"Where is my child?\"", "\"Generate my OTP\"", "\"Show my notifications\"", "Sunday service reminders"],
      note: "Save +2349012345678 · text anything",
    },
    {
      icon: "🔔", color: "#dc2626", title: "Real-time Alerts",
      items: ["Child checked in", "Teacher heading to you", "Pickup confirmed", "Church broadcasts"],
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Title bar */}
      <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-100"
        style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 100%)" }}>
        <span className="text-xl">🗺️</span>
        <div>
          <p className="font-bold text-white text-sm">App at a Glance</p>
          <p className="text-white/60 text-xs">Everything a parent needs to know, pictured</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Journey */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
            Your child's Sunday journey
          </p>
          <div className="flex gap-0 overflow-x-auto pb-1 -mx-1 px-1">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center text-center" style={{ minWidth: "72px" }}>
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-xl mb-1.5 shadow-sm flex-shrink-0"
                    style={{ backgroundColor: step.bg, color: step.text }}
                  >
                    {step.icon}
                  </div>
                  <p className="text-[11px] font-bold text-gray-800 leading-tight">{step.label}</p>
                  <p className="text-[10px] text-gray-400 leading-tight mt-0.5 max-w-[64px]">{step.sub}</p>
                </div>
                {i < steps.length - 1 && (
                  <span className="text-gray-300 text-base mx-0.5 mb-4 flex-shrink-0">→</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {features.map(feat => (
            <div
              key={feat.title}
              className="rounded-xl border border-gray-100 p-3 relative overflow-hidden"
              style={{ backgroundColor: "#fafafa" }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                style={{ backgroundColor: feat.color }}
              />
              <div className="flex items-center gap-2 mt-1 mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                  style={{ backgroundColor: feat.color + "18" }}
                >
                  {feat.icon}
                </div>
                <p className="text-xs font-bold text-gray-800">{feat.title}</p>
              </div>
              <ul className="space-y-0.5">
                {feat.items.map(item => (
                  <li key={item} className="flex items-start gap-1.5 text-[11px] text-gray-600">
                    <span className="mt-0.5 flex-shrink-0 text-[9px]" style={{ color: feat.color }}>●</span>
                    {item}
                  </li>
                ))}
              </ul>
              {feat.note && (
                <div
                  className="mt-2 rounded-lg px-2 py-1 text-[10px] font-semibold text-center"
                  style={{ backgroundColor: "#f0fdf4", color: "#15803d" }}
                >
                  {feat.note}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ParentGuide() {
  return (
    <div className="space-y-4">
      <ParentInfographic />
      <Section icon={Home} title="Getting Started — Registration" color="#d97706">
        <p className="text-sm text-gray-600 mt-3">New to Shepherd Connect? Here is how to register your family in three steps.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="Create your account">
            <p>On the login page, click <strong>Register here</strong>. Select <strong>Parent</strong> as your role. Fill in your name, email, phone number, and choose a password. Click <strong>Next</strong>.</p>
          </Step>
          <Step n={2} title="Set up your family">
            <p>Enter your family name, home address, and emergency contact details (name and phone number of someone who can be reached during church). Click <strong>Next</strong>.</p>
          </Step>
          <Step n={3} title="Add your children">
            <p>Click <strong>+ Add Child</strong> for each child. Enter their first name, last name, date of birth, and gender. The system auto-assigns them to the right class based on age. Add any allergy or medical notes — these will be visible to staff at check-in. Click <strong>Finish &amp; Register</strong>.</p>
          </Step>
        </div>
        <Tip>You can add more children later from the My Family page. You do not need to add all children during registration.</Tip>
      </Section>

      <Section icon={Users} title="My Family" color="#d97706">
        <p className="text-sm text-gray-600 mt-3">My Family is your home screen. It shows your family profile, all registered children, and your family code for fast check-in.</p>
        <QuickRef rows={[
          ["See your family code", "My Family page — large code at the top (e.g. FAM-MENS01) — show this at check-in"],
          ["Add another child", "My Family → + Add Child button"],
          ["Update emergency contact", "My Family → Edit Family → change emergency contact fields"],
          ["Add a second parent", "My Family → Edit Family → fill in Parent 2 details"],
        ]} />
      </Section>

      <Section icon={Baby} title="My Children" color="#d97706">
        <p className="text-sm text-gray-600 mt-3">View each child's class, attendance history, and appraisals written by their teacher.</p>
        <QuickRef rows={[
          ["See which class my child is in", "My Children → child card shows current class"],
          ["View attendance history", "My Children → expand a child's card → Attendance tab"],
          ["Read teacher appraisals", "My Children → expand a child's card → Appraisals section with star ratings"],
        ]} />
        <Tip>Teacher appraisals include star ratings for Participation, Scripture Engagement, and Social Interaction, plus personal notes. These are updated after each service.</Tip>
      </Section>

      <Section icon={UserCog} title="Pickup Delegates & OTP" color="#d97706">
        <p className="text-sm text-gray-600 mt-3">If someone other than yourself will collect your child, add them as a pickup delegate and share their one-time password (OTP) with them in advance.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="Add a delegate">
            <p>Go to <strong>Pickup Delegates</strong> → click <strong>+ Add Delegate</strong>. Enter the delegate's full name, phone number, and your relationship to them (e.g. Grandparent, Uncle). Click <strong>Save</strong>.</p>
          </Step>
          <Step n={2} title="Get the OTP">
            <p>Immediately after saving, the system displays a <strong>6-digit OTP</strong> with a copy button. This is shown <em>once only</em>. Copy it and share it with the delegate via WhatsApp, text, or in person before church.</p>
          </Step>
          <Step n={3} title="Delegate collects the child">
            <p>At check-out, the delegate gives the 6-digit OTP to the support at the exit. The support verifies it and releases the child.</p>
          </Step>
        </div>
        <Warn>OTPs are valid for 24 hours and can only be used once. If the delegate loses the code, delete the delegate and add them again to generate a new OTP.</Warn>
        <Note>You can have multiple delegates at the same time — each gets their own unique OTP.</Note>
      </Section>

      <Section icon={Star} title="Feedback" color="#d97706">
        <p className="text-sm text-gray-600 mt-3">Share your experience of the children's ministry. Feedback helps the team improve the service.</p>
        <div className="space-y-2 mt-2">
          <Step n={1} title="Submit feedback">
            <p>Go to <strong>Notifications → Feedback</strong> (or find Feedback in your nav). Click <strong>+ Submit Feedback</strong>. Rate the service out of 5, select a category (general, safety, curriculum, staff, facilities), and write your comments.</p>
          </Step>
        </div>
        <Tip>Feedback is anonymous to other parents but visible to admins. Your name is recorded internally for follow-up if needed.</Tip>
      </Section>

      <Section icon={Bell} title="Notifications" color="#d97706">
        <p className="text-sm text-gray-600 mt-3">Admins send you important updates through the notification system — service announcements, pre-dismissal alerts, and general church communications.</p>
        <QuickRef rows={[
          ["See all notifications", "Bell icon in the nav bar → opens Notifications page"],
          ["Unread count", "Red badge number on the Bell icon"],
          ["Mark as read", "Click a notification to open it — it is marked read automatically"],
          ["Pre-dismissal alerts", "Sent by admin ~15 mins before service ends — time to come to the exit"],
        ]} />
      </Section>

      <Section icon={MessageSquare} title="Messages" color="#d97706">
        <p className="text-sm text-gray-600 mt-3">Send and receive direct messages with the children's ministry team.</p>
        <QuickRef rows={[
          ["Send a message to staff", "Messages → + New Message → select a teacher or admin"],
          ["Check for replies", "Messages page — unread threads are shown in bold with a badge count"],
        ]} />
      </Section>

      <Section icon={UserCircle} title="My Profile" color="#d97706">
        <p className="text-sm text-gray-600 mt-3">Keep your contact details up to date so the team can reach you quickly during a service.</p>
        <QuickRef rows={[
          ["Edit name / phone / photo", "My Profile → Edit Profile → update → Save"],
          ["Set communication preferences", "My Profile → toggle In-App, WhatsApp, SMS preferences"],
          ["Profile completeness bar", "Shows which fields are still missing — complete your profile for faster check-in"],
        ]} />
      </Section>
    </div>
  );
}

export default function UserGuide() {
  const { user } = useAuth();
  const defaultTab: RoleTab =
    user?.role === "teacher" ? "teacher" :
    user?.role === "support" ? "support" :
    user?.role === "parent" ? "parent" : "admin";

  const [activeTab, setActiveTab] = useState<RoleTab>(defaultTab);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Print-specific styles */}
      <style>{`
        @media print {
          /* Hide everything except the guide content */
          nav, header, aside, [data-no-print], .no-print { display: none !important; }
          body { background: white !important; }
          .print-page-break { page-break-before: always; }
          .print-section-heading {
            font-size: 18pt;
            font-weight: bold;
            color: #1e3a8a;
            border-bottom: 2pt solid #1e3a8a;
            padding-bottom: 6pt;
            margin-top: 24pt;
            margin-bottom: 12pt;
          }
          /* Make all role sections visible when printing */
          .role-section { display: block !important; }
          /* Expand all collapsed sections */
          .section-body { display: block !important; }
          /* Remove shadows and rounded corners for cleaner print */
          * { box-shadow: none !important; border-radius: 4px !important; }
          /* Ensure text is dark */
          p, span, li { color: #1a1a1a !important; }
          a { text-decoration: none !important; color: #1e3a8a !important; }
          /* Print footer */
          @page {
            margin: 18mm 15mm;
            size: A4;
          }
        }
      `}</style>

      {/* Header */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}>
        <div className="absolute -top-6 -right-6 w-36 h-36 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 right-10 w-24 h-24 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
                User Guide
              </h1>
              <p className="text-white/70 text-sm mt-1">
                Step-by-step instructions for every role on Shepherd Connect
              </p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            data-no-print
            className="no-print flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }}
            title="Download as PDF — use your browser's Save as PDF option"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Download PDF</span>
          </button>
        </div>
      </div>

      {/* Quick intro */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <Info className="w-4 h-4 text-[#1e3a8a]" /> About Shepherd Connect
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Shepherd Connect is the children's ministry management platform for RCCG City of David. It handles the full lifecycle of every Sunday service — from family registration and child check-in, through class management and teacher scheduling, to safe checkout and post-service reporting.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {[
            { icon: Baby,      label: "Children registered", color: "#1e3a8a" },
            { icon: School,    label: "Classes managed",     color: "#059669" },
            { icon: CheckCircle2, label: "Safe check-in/out", color: "#7c3aed" },
            { icon: BadgeCheck, label: "Secure & audited",  color: "#d97706" },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 bg-gray-50 rounded-xl p-3 text-center">
              <Icon className="w-5 h-5" style={{ color }} />
              <span className="text-xs font-medium text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Role Tabs */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Select your role</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ROLES.map(role => (
            <button
              key={role.id}
              onClick={() => setActiveTab(role.id)}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold transition-all border"
              style={activeTab === role.id
                ? { background: role.color, color: "#fff", borderColor: role.color, boxShadow: `0 4px 12px ${role.color}40` }
                : { background: role.bg, color: role.color, borderColor: `${role.color}30` }
              }
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>

      {/* Role-specific content — on screen shows active tab only; on print shows all */}
      <div className={activeTab === "admin" ? "" : "hidden print:block"}>
        <div className="print-section-heading" style={{ display: "none" }}>Admin &amp; Super Admin Guide</div>
        <AdminGuide />
      </div>
      <div className={activeTab === "teacher" ? "" : "hidden print:block"}>
        <div className="print-section-heading print-page-break" style={{ display: "none" }}>Teacher Guide</div>
        <TeacherGuide />
      </div>
      <div className={activeTab === "support" ? "" : "hidden print:block"}>
        <div className="print-section-heading print-page-break" style={{ display: "none" }}>Support Guide</div>
        <SupportGuide />
      </div>
      <div className={activeTab === "parent" ? "" : "hidden print:block"}>
        <div className="print-section-heading print-page-break" style={{ display: "none" }}>Parent Guide</div>
        <ParentGuide />
      </div>

      {/* Support footer */}
      <div className="bg-[#eff6ff] rounded-2xl border border-blue-100 p-5 flex items-start gap-3">
        <Phone className="w-5 h-5 text-[#1e3a8a] flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-[#1e3a8a] text-sm">Need help?</p>
          <p className="text-sm text-blue-700 mt-0.5">
            Contact your church administrator or send a message via the <Link href="/messages" className="underline font-medium">Messages</Link> page.
            For urgent issues during a service, speak to an support at the check-in desk.
          </p>
        </div>
      </div>
    </div>
  );
}
