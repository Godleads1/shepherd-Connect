import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const BLUE = "#1e3a8a";
const GOLD = "#f59e0b";
const GREEN = "#059669";
const PURPLE = "#7c3aed";
const AMBER = "#d97706";
const LIGHT_BLUE = "#eff6ff";
const GRAY = "#6b7280";
const DARK = "#111827";
const RED = "#dc2626";
const BORDER = "#e5e7eb";

const OUT_DIR = path.join(process.cwd(), "public");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT = path.join(OUT_DIR, "shepherd-connect-user-guide.pdf");

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 50, bottom: 50, left: 55, right: 55 },
  info: {
    Title: "Shepherd Connect — User Guide",
    Author: "RCCG City of David",
    Subject: "Children's Ministry Platform User Guide",
    Keywords: "shepherd connect, children ministry, user guide",
    CreationDate: new Date(),
  },
});

const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

const W = doc.page.width - 110; // usable width

// ─── helpers ────────────────────────────────────────────────────────────────

function pageHeader() {
  const y = doc.page.margins.top / 2 - 8;
  doc.fontSize(7).fillColor("#9ca3af")
    .text("Shepherd Connect — User Guide", 55, y, { width: W / 2 })
    .text("RCCG City of David · Confidential", 55, y, { width: W, align: "right" });
  doc.moveTo(55, doc.page.margins.top - 8).lineTo(55 + W, doc.page.margins.top - 8)
    .strokeColor(BORDER).lineWidth(0.5).stroke();
}

function pageFooter() {
  const y = doc.page.height - doc.page.margins.bottom + 12;
  doc.fontSize(7).fillColor("#9ca3af")
    .text(`Page ${(doc as any)._pageBuffer?.length ?? 1}`, 55, y, { width: W, align: "right" });
  doc.moveTo(55, y - 8).lineTo(55 + W, y - 8)
    .strokeColor(BORDER).lineWidth(0.5).stroke();
}

function newPage() {
  doc.addPage();
  pageHeader();
}

function checkSpace(needed: number) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 20) {
    newPage();
  }
}

function h1(text: string) {
  checkSpace(40);
  doc.fontSize(20).font("Helvetica-Bold").fillColor(BLUE).text(text, { paragraphGap: 6 });
  doc.moveTo(55, doc.y).lineTo(55 + W, doc.y).strokeColor(GOLD).lineWidth(2).stroke();
  doc.moveDown(0.6);
}

function h2(text: string, color = BLUE) {
  checkSpace(32);
  doc.moveDown(0.5);
  doc.fontSize(13).font("Helvetica-Bold").fillColor(color).text(text, { paragraphGap: 4 });
  doc.moveDown(0.3);
}

function h3(text: string, color = DARK) {
  checkSpace(24);
  doc.fontSize(10).font("Helvetica-Bold").fillColor(color).text(text, { paragraphGap: 2 });
  doc.moveDown(0.25);
}

function body(text: string, opts: Record<string, unknown> = {}) {
  doc.fontSize(9.5).font("Helvetica").fillColor(DARK).text(text, { lineGap: 3, paragraphGap: 4, ...opts });
}

function bullet(text: string, indent = 12) {
  const x = doc.x;
  const y = doc.y;
  doc.circle(x + indent - 5, y + 5.5, 2).fill(BLUE);
  doc.fontSize(9.5).font("Helvetica").fillColor(DARK)
    .text(text, x + indent, y, { lineGap: 2, paragraphGap: 3, width: W - indent });
  doc.x = x;
}

function step(n: number, title: string, detail: string) {
  checkSpace(40);
  const x = doc.x;
  const y = doc.y;
  // circle
  doc.circle(x + 9, y + 9, 9).fill(BLUE);
  doc.fontSize(8).font("Helvetica-Bold").fillColor("white").text(String(n), x + 5.5, y + 5, { width: 7, align: "center" });
  // title + detail
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor(DARK).text(title, x + 24, y, { width: W - 24, lineGap: 1 });
  doc.fontSize(9).font("Helvetica").fillColor(GRAY).text(detail, x + 24, doc.y, { width: W - 24, lineGap: 2, paragraphGap: 5 });
  doc.x = x;
  doc.moveDown(0.3);
}

function tip(text: string) {
  checkSpace(36);
  const x = doc.x; const y = doc.y;
  const boxH = Math.max(32, doc.heightOfString(text, { width: W - 36, fontSize: 9 }) + 16);
  doc.roundedRect(x, y, W, boxH, 6).fill("#eff6ff");
  doc.roundedRect(x, y, W, boxH, 6).strokeColor("#bfdbfe").lineWidth(0.8).stroke();
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#1d4ed8").text("💡 Tip", x + 10, y + 9, { continued: true });
  doc.font("Helvetica").fillColor("#1e40af").text("  " + text, { width: W - 28, lineGap: 2 });
  doc.y = y + boxH + 6;
  doc.x = x;
}

function warn(text: string) {
  checkSpace(36);
  const x = doc.x; const y = doc.y;
  const boxH = Math.max(32, doc.heightOfString(text, { width: W - 36, fontSize: 9 }) + 16);
  doc.roundedRect(x, y, W, boxH, 6).fill("#fffbeb");
  doc.roundedRect(x, y, W, boxH, 6).strokeColor("#fcd34d").lineWidth(0.8).stroke();
  doc.fontSize(9).font("Helvetica-Bold").fillColor(AMBER).text("⚠ Warning", x + 10, y + 9, { continued: true });
  doc.font("Helvetica").fillColor("#92400e").text("  " + text, { width: W - 28, lineGap: 2 });
  doc.y = y + boxH + 6;
  doc.x = x;
}

function note(text: string) {
  checkSpace(30);
  const x = doc.x; const y = doc.y;
  const boxH = Math.max(28, doc.heightOfString(text, { width: W - 36, fontSize: 9 }) + 14);
  doc.roundedRect(x, y, W, boxH, 6).fill("#f9fafb");
  doc.roundedRect(x, y, W, boxH, 6).strokeColor(BORDER).lineWidth(0.8).stroke();
  doc.fontSize(9).font("Helvetica-Bold").fillColor(GRAY).text("ℹ Note", x + 10, y + 8, { continued: true });
  doc.font("Helvetica").fillColor("#374151").text("  " + text, { width: W - 28, lineGap: 2 });
  doc.y = y + boxH + 6;
  doc.x = x;
}

function tableRow(cols: string[], widths: number[], isHeader: boolean, isAlt: boolean) {
  checkSpace(20);
  const x = doc.x; const y = doc.y;
  const rowH = Math.max(20, ...cols.map((c, i) => doc.heightOfString(c, { width: widths[i] - 10, fontSize: 9 }) + 10));
  if (isHeader) {
    doc.rect(x, y, W, rowH).fill(BLUE);
  } else if (isAlt) {
    doc.rect(x, y, W, rowH).fill("#f8faff");
  } else {
    doc.rect(x, y, W, rowH).fill("white");
  }
  doc.rect(x, y, W, rowH).strokeColor(BORDER).lineWidth(0.4).stroke();
  let cx = x;
  cols.forEach((col, i) => {
    doc.fontSize(isHeader ? 8.5 : 9).font(isHeader ? "Helvetica-Bold" : "Helvetica")
      .fillColor(isHeader ? "white" : DARK)
      .text(col, cx + 6, y + 6, { width: widths[i] - 10, lineGap: 1 });
    cx += widths[i];
  });
  doc.y = y + rowH;
  doc.x = x;
}

function divider() {
  doc.moveDown(0.4);
  doc.moveTo(55, doc.y).lineTo(55 + W, doc.y).strokeColor(BORDER).lineWidth(0.5).stroke();
  doc.moveDown(0.4);
}

// ─── COVER PAGE ──────────────────────────────────────────────────────────────

doc.rect(0, 0, doc.page.width, doc.page.height).fill("#f0f4ff");
doc.rect(0, 0, doc.page.width, 240).fill(BLUE);

// Gold accent bar
doc.rect(0, 240, doc.page.width, 6).fill(GOLD);

// Title area
doc.fontSize(11).font("Helvetica").fillColor("rgba(255,255,255,0.6)")
  .text("THE REDEEMED CHRISTIAN CHURCH OF GOD", 0, 70, { width: doc.page.width, align: "center" });

doc.fontSize(32).font("Helvetica-Bold").fillColor("white")
  .text("Shepherd Connect", 0, 95, { width: doc.page.width, align: "center" });

doc.fontSize(14).font("Helvetica").fillColor("#93c5fd")
  .text("Children's Ministry Management Platform", 0, 140, { width: doc.page.width, align: "center" });

doc.fontSize(12).font("Helvetica-Bold").fillColor(GOLD)
  .text("Complete User Guide", 0, 168, { width: doc.page.width, align: "center" });

// Tagline
doc.fontSize(10).font("Helvetica").fillColor("#d1d5db")
  .text("Safe. Known. Celebrated.", 0, 218, { width: doc.page.width, align: "center" });

// Info box
doc.roundedRect(90, 280, doc.page.width - 180, 130, 10).fill("white");
doc.roundedRect(90, 280, doc.page.width - 180, 130, 10).strokeColor("#c7d2fe").lineWidth(1).stroke();

const infoItems = [
  ["Platform", "Shepherd Connect v1.0"],
  ["Organisation", "RCCG City of David — Victoria Island"],
  ["Document", "User Guide — All Roles"],
  ["Date", new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })],
  ["Status", "Live Production"],
];
infoItems.forEach(([label, value], i) => {
  doc.fontSize(9).font("Helvetica-Bold").fillColor(GRAY).text(label + ":", 110, 295 + i * 20, { continued: true });
  doc.font("Helvetica").fillColor(DARK).text("  " + value);
});

// Role badges
const roles = [
  { label: "Admin", color: BLUE },
  { label: "Teacher", color: GREEN },
  { label: "Attendant", color: PURPLE },
  { label: "Parent", color: AMBER },
];
const badgeY = 440;
doc.fontSize(9).font("Helvetica").fillColor(GRAY)
  .text("Covers all user roles:", 0, badgeY - 16, { width: doc.page.width, align: "center" });
const totalBadgeW = roles.length * 100 + (roles.length - 1) * 10;
let bx = (doc.page.width - totalBadgeW) / 2;
roles.forEach(r => {
  doc.roundedRect(bx, badgeY, 100, 26, 6).fill(r.color);
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor("white")
    .text(r.label, bx, badgeY + 8, { width: 100, align: "center" });
  bx += 110;
});

doc.fontSize(9).font("Helvetica").fillColor(GRAY)
  .text("For internal church use only. All information is confidential.", 0, doc.page.height - 70, { width: doc.page.width, align: "center" });

// ─── PAGE 2: TABLE OF CONTENTS ───────────────────────────────────────────────

newPage();

doc.fontSize(22).font("Helvetica-Bold").fillColor(BLUE)
  .text("Table of Contents", { paragraphGap: 8 });
doc.moveTo(55, doc.y).lineTo(55 + W, doc.y).strokeColor(GOLD).lineWidth(2).stroke();
doc.moveDown(0.8);

const toc = [
  { section: "1", title: "Introduction & Platform Overview", page: 3 },
  { section: "2", title: "Getting Started — Login & Registration", page: 4 },
  { section: "3", title: "Admin & Super Admin Guide", page: 5 },
  { section: "3.1", title: "  Dashboard — Command Centre", page: 5 },
  { section: "3.2", title: "  Families Management", page: 6 },
  { section: "3.3", title: "  Children Directory & Bulk Import", page: 7 },
  { section: "3.4", title: "  Classes & Assignments", page: 8 },
  { section: "3.5", title: "  Teachers & Service Allocations", page: 9 },
  { section: "3.6", title: "  Attendance Records", page: 10 },
  { section: "3.7", title: "  Emergencies", page: 10 },
  { section: "3.8", title: "  Class Change Requests", page: 11 },
  { section: "3.9", title: "  Reports", page: 11 },
  { section: "3.10", title: "  Notifications & Broadcasts", page: 12 },
  { section: "3.11", title: "  User Management (Super Admin)", page: 12 },
  { section: "3.12", title: "  Audit Logs", page: 13 },
  { section: "3.13", title: "  Waitlist & Substitute Requests", page: 13 },
  { section: "4", title: "Teacher Guide", page: 14 },
  { section: "4.1", title: "  My Class & Schedule", page: 14 },
  { section: "4.2", title: "  Child Appraisals", page: 15 },
  { section: "4.3", title: "  Class Change Requests & Messages", page: 15 },
  { section: "5", title: "Attendant Guide", page: 16 },
  { section: "5.1", title: "  Standard Check-In", page: 16 },
  { section: "5.2", title: "  QR Code Check-In", page: 16 },
  { section: "5.3", title: "  Check-Out — Parent Pickup", page: 17 },
  { section: "5.4", title: "  Check-Out — Delegate OTP", page: 17 },
  { section: "6", title: "Parent Guide", page: 18 },
  { section: "6.1", title: "  Registration Walkthrough", page: 18 },
  { section: "6.2", title: "  My Family & My Children", page: 19 },
  { section: "6.3", title: "  Pickup Delegates & OTP", page: 19 },
  { section: "6.4", title: "  Feedback, Notifications & Messages", page: 20 },
  { section: "7", title: "Demo Accounts Reference", page: 21 },
  { section: "8", title: "Support & Troubleshooting", page: 21 },
];

toc.forEach(({ section, title, page }) => {
  const isMain = section.split(".").length === 1;
  const x = doc.x;
  const y = doc.y;
  if (isMain) doc.moveDown(0.3);
  doc.fontSize(isMain ? 10 : 9)
    .font(isMain ? "Helvetica-Bold" : "Helvetica")
    .fillColor(isMain ? BLUE : DARK)
    .text(title, x, y, { continued: true, width: W - 40 });
  // Dots
  const textW = doc.widthOfString(title);
  const dotStart = x + textW + 4;
  const dotEnd = x + W - 35;
  if (dotEnd > dotStart) {
    doc.fontSize(9).font("Helvetica").fillColor("#d1d5db")
      .text(".".repeat(Math.floor((dotEnd - dotStart) / 3.2)), dotStart, y, { continued: true });
  }
  doc.fillColor(isMain ? BLUE : GRAY).text(String(page), { align: "right" });
  doc.x = x;
});

// ─── PAGE 3: INTRODUCTION ─────────────────────────────────────────────────────

newPage();
h1("1. Introduction & Platform Overview");
body(
  "Shepherd Connect is the full-stack digital management platform for the children's ministry (Children's Church) at RCCG City of David, Victoria Island. " +
  "It provides a unified system for every person involved in running Sunday services — from senior administrators down to parents dropping off their children.",
);
doc.moveDown(0.5);
body(
  "The platform manages the complete lifecycle of every service: family registration, child check-in and checkout, " +
  "class assignment, teacher scheduling, real-time attendance tracking, emergency logging, appraisals, reports, and secure delegate pickup.",
);
doc.moveDown(0.7);

h2("Core Principles");
const principles = [
  ["Safe", "Every child has a verified check-in and secure checkout process. Medical and allergy alerts are surfaced at every critical touchpoint."],
  ["Known", "Each child's class, attendance history, teacher appraisals, and family record are always a click away."],
  ["Celebrated", "Teachers record appraisals after each service so parents can see how their child engaged with the Word."],
];
principles.forEach(([label, desc]) => {
  checkSpace(24);
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor(GOLD).text(label + " — ", { continued: true });
  doc.font("Helvetica").fillColor(DARK).text(desc, { lineGap: 2, paragraphGap: 6 });
});

doc.moveDown(0.5);
h2("User Roles");
const roleRows: [string, string][] = [
  ["Super Admin", "Full system access — user management, approvals, all admin functions"],
  ["Admin", "Command centre, families, children, classes, teachers, emergencies, reports"],
  ["Teacher", "My class view, attendance, appraisals, class change requests, substitutes"],
  ["Attendant", "Check-in kiosk, QR scan, standard and delegate OTP checkout"],
  ["Parent", "My family, my children, pickup delegates, class change requests, feedback"],
];
tableRow(["Role", "Access Level"], [120, W - 120], true, false);
roleRows.forEach(([role, access], i) => tableRow([role, access], [120, W - 120], false, i % 2 === 1));

doc.moveDown(0.7);
h2("Technology & Access");
body("Shepherd Connect is a web application — accessible on any device with a modern browser (Chrome, Firefox, Safari, Edge). No app installation is required. The platform is optimised for mobile phones so attendants and parents can use it comfortably on the go.");
doc.moveDown(0.3);
bullet("Desktop: full sidebar navigation");
bullet("Mobile: bottom tab bar for quick access to the most used pages");
bullet("All data is synced in real time — no page refresh needed");

// ─── PAGE 4: GETTING STARTED ─────────────────────────────────────────────────

newPage();
h1("2. Getting Started — Login & Registration");

h2("Logging In");
step(1, "Navigate to the platform URL", "Open your browser and go to the Shepherd Connect web address provided by your admin.");
step(2, "Select your role tab", "On the login screen, choose your role (Parent, Teacher, Admin, or Attendant) — this is for display only and does not restrict which account you use.");
step(3, "Enter your credentials", "Type your email address and password. Click 'Enter the House'.");
step(4, "You are redirected to your home page", "Admins land on the Dashboard. Teachers land on My Class. Attendants land on Check-In. Parents land on My Family.");
tip("If you have forgotten your password, click 'Forgot your password?' on the login screen to request a reset link.");

doc.moveDown(0.5);
h2("Registering a New Account");
body("New users register directly from the login page by clicking 'Register here'. The process differs slightly by role.");

h3("Parents — 3-step registration");
step(1, "Account details", "Enter your first name, last name, email address, phone number, and choose a password. Select 'Parent' as your role. Click Next.");
step(2, "Family setup", "Enter your family name, home address, and emergency contact details. Click Next.");
step(3, "Add your children", "Click '+ Add Child' for each child. Enter name, date of birth, gender, and any allergy or medical notes. Click 'Finish & Register'. You are logged in immediately.");

doc.moveDown(0.3);
h3("Admins & Teachers — approval required");
body("Admin and Teacher accounts go through an approval step. After registering, your account is marked 'Pending Approval'. You will not be able to log in until a Super Admin approves your account. You will receive a notification once approved.");
warn("Do not share your login credentials with anyone. Each person should have their own account.");

doc.moveDown(0.5);
h2("Navigating the Platform");
body("All pages are accessible from the sidebar (desktop) or bottom tab bar (mobile). The navigation adapts to your role — you only see the pages relevant to your access level.");
const navItems = [
  ["Bell icon", "Notifications — red badge shows unread count"],
  ["Message icon", "Messages — direct messages with staff/parents"],
  ["Avatar (top right)", "My Profile — edit your details and preferences"],
  ["User Guide", "This guide — always accessible at the bottom of the sidebar"],
];
tableRow(["Nav Element", "What it does"], [150, W - 150], true, false);
navItems.forEach(([el, desc], i) => tableRow([el, desc], [150, W - 150], false, i % 2 === 1));

// ─── PAGE 5+: ADMIN GUIDE ─────────────────────────────────────────────────────

newPage();
h1("3. Admin & Super Admin Guide");
body("Admins have access to every operational module. Super Admins additionally control user accounts and approvals. This section covers every admin function in detail.");

h2("3.1 Dashboard — Command Centre", BLUE);
body("The Dashboard is the admin home screen. It provides a live operational overview of the current service and auto-refreshes every 30 seconds.");

doc.moveDown(0.3);
h3("Stat Cards");
const statCards = [
  ["Registered Children", "Total children ever registered. Click the card to go to the full Children Directory."],
  ["Checked In", "Children currently confirmed in class for today's service."],
  ["Pending Pickup", "Children who have been dropped off but not yet collected by a parent."],
  ["Teacher Attendance", "Percentage of today's scheduled teachers who confirmed their attendance."],
  ["Active Emergencies", "Open emergency incidents. The card turns red when any emergency is unresolved."],
];
statCards.forEach(([card, desc]) => {
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor(BLUE).text(card + ": ", { continued: true });
  doc.font("Helvetica").fillColor(DARK).text(desc, { lineGap: 2, paragraphGap: 5 });
});

doc.moveDown(0.3);
h3("Dashboard Widgets");
bullet("Upcoming Birthdays (30 days) — children with birthdays in the next month. Clickable — opens child profile.");
bullet("Absence Alerts — children absent for 2 or more consecutive Sundays, with parent phone numbers for follow-up.");
bullet("Attendance Trends — line chart showing weekly check-in numbers over the past several weeks.");
bullet("Class Utilization — bar chart of enrolled children vs class capacity for every class.");
tip("The dashboard date defaults to today's date. All check-in stats are per service day.");

newPage();
h2("3.2 Families Management", BLUE);
body("A family record is the foundation of everything. Every child must belong to a family, and every check-in is linked back to a family.");

step(1, "Create a new family", "Go to Families → click '+ Add Family'. Fill in: Parent 1 (required), Parent 2 (optional), home address, emergency contact name, and emergency contact phone. Click Save.");
step(2, "Search for a family", "Use the search bar at the top of the Families page. It searches by family code, parent name, and address in real time as you type.");
step(3, "View a family profile", "Click 'View' on any family card. The profile shows: both parents' details, all registered children with their classes, and the family code for check-in.");
step(4, "Edit family details", "Inside the family profile, click 'Edit Family' to update parent details, emergency contact, or address.");
step(5, "Add a second parent", "Edit the family record and fill in the Parent 2 section with the second parent's user account.");

doc.moveDown(0.3);
h3("Family Codes");
body("Every family is assigned a unique family code (e.g. FAM-MENS01) automatically when they register. This code is:");
bullet("Displayed on the parent's My Family page");
bullet("Used at the check-in kiosk to locate the family instantly");
bullet("Printed on any export or report relating to that family");
tip("Encourage parents to memorise or screenshot their family code — it makes check-in significantly faster during busy services.");

newPage();
h2("3.3 Children Directory & Bulk Import", BLUE);
body("The Children page is the complete registry of every child in the ministry. Admins can add children individually or import many at once using a CSV file.");

h3("Adding a Child Manually");
step(1, "Open the Add Child form", "Go to Children → click '+ Add Child'.");
step(2, "Select the family", "Choose the family from the dropdown. The family must exist before you can add a child to it.");
step(3, "Enter child details", "Fill in: First Name, Last Name, Date of Birth, and Gender (required). Optionally set a Class, upload a Photo, and add Allergy or Medical Notes.");
step(4, "Save", "Click 'Register Child'. The child is immediately added to the directory and assigned to the selected class.");

doc.moveDown(0.3);
h3("Bulk Import via CSV");
step(1, "Open the import modal", "Click 'Import CSV' on the Children page.");
step(2, "Prepare your CSV", "Required columns: firstName, lastName, dateOfBirth. Optional: gender, allergies, medicalNotes. The dateOfBirth format must be YYYY-MM-DD.");
step(3, "Paste and import", "Paste your CSV data into the text area (a template is provided). Click 'Import Children'.");
step(4, "Review the results", "A summary shows how many children were created and any rows that failed, with the reason for each failure.");

doc.moveDown(0.3);
h3("Filtering the Children List");
bullet("Search bar: filters by child first name or last name in real time");
bullet("Unassigned Only toggle: shows only children not yet placed in a class — useful after a registration drive");
warn("The 'Unassigned Only' toggle must be OFF to see all children. If the list appears empty, check this toggle is not accidentally enabled.");

doc.moveDown(0.3);
h3("Child Profile");
body("Click 'View' on any child card to open their full profile. The profile contains:");
bullet("Personal details: name, date of birth, age, gender, photo");
bullet("Current class assignment");
bullet("Medical & allergy alerts (displayed prominently in red)");
bullet("Attendance history with dates and check-in/checkout times");
bullet("Appraisals written by their teacher");
bullet("Family record with parent contact details");

newPage();
h2("3.4 Classes & Assignments", BLUE);
body("Classes define the age groups and physical rooms. Class Assignments place individual children into specific classes based on their age.");

h3("Creating a Class");
step(1, "Go to Classes", "Navigate to Classes in the sidebar.");
step(2, "Click '+ New Class'", "Fill in: Class Name (e.g. Nursery, Toddlers, Juniors), Age Range (minimum and maximum age in years), Room Location, and Service Slot (7 AM or 10:30 AM).");
step(3, "Set capacity", "Enter the maximum number of children the room can hold. This is used for utilization reporting.");
step(4, "Save", "Click Save. The class is immediately available for child assignments.");

doc.moveDown(0.3);
h3("Assigning Children to Classes");
step(1, "Go to Assignments", "Navigate to Assignments in the sidebar.");
step(2, "Click '+ Assign Child'", "Select the child from the dropdown and then the target class.");
step(3, "Age warning", "The system warns you if the child's age falls outside the class's age range. You can override this warning if needed.");
step(4, "Confirm", "Click Assign. The child's current class is updated immediately across all pages.");

doc.moveDown(0.3);
h3("Reviewing Class Utilization");
body("Go to Reports → Analytics tab. The 'Class Enrollment vs Capacity' grouped bar chart shows enrolled count (blue) against capacity (gold) for every class. Over-enrolled classes are highlighted in red.");
tip("Children can only be in one class at a time. Moving a child via a Class Change Request automatically updates their assignment.");

newPage();
h2("3.5 Teachers & Service Allocations", BLUE);
body("Teachers are staff members registered on the platform. Allocations schedule them to specific classes on specific service dates.");

h3("Registering a Teacher");
step(1, "The person registers first", "The teacher must have a registered user account (Teacher role). Their account must be approved by a Super Admin before proceeding.");
step(2, "Go to Teachers → + Add Teacher", "Select the user account from the dropdown. Enter their qualification (e.g. Child Psychology Diploma) and specialisation (e.g. Nursery, Toddlers).");
step(3, "Save", "The teacher record is created and linked to their user account.");

doc.moveDown(0.3);
h3("Scheduling Teachers (Allocations)");
step(1, "Go to Allocations → + Allocate Teacher", "Select: Teacher, Class, Service Date, and Service Slot (7 AM or 10:30 AM).");
step(2, "Status: Scheduled", "The allocation is created with status 'Scheduled'. The teacher receives a notification and can confirm or raise a substitute request.");
step(3, "Monitor confirmation", "The Dashboard Teacher Attendance card shows the % of today's confirmed teachers. Drill into Allocations for the full list.");

doc.moveDown(0.3);
h3("Monitoring Teacher Presence");
const allocCols = [170, W - 170];
tableRow(["Status", "Meaning"], allocCols, true, false);
[
  ["Scheduled", "Allocation created, teacher notified — not yet confirmed"],
  ["Confirmed", "Teacher has confirmed they will attend"],
  ["Substituted", "Original teacher raised a substitute request — cover assigned"],
  ["Cancelled", "Allocation was cancelled by admin"],
].forEach(([s, m], i) => tableRow([s, m], allocCols, false, i % 2 === 1));

newPage();
h2("3.6 Attendance Records", BLUE);
body("Attendance records are created automatically when a child is checked in by an attendant. Admins can view and filter historical attendance data.");
const attCols = [200, W - 200];
tableRow(["Task", "Where to do it"], attCols, true, false);
[
  ["View today's attendance", "Attendance page → filter by today's date"],
  ["Filter by class", "Attendance page → use the Class dropdown"],
  ["Filter by date range", "Attendance page → set Start and End date"],
  ["Export to CSV", "Reports → Exports tab → Attendance CSV (with date range)"],
  ["View absence alerts", "Dashboard → Absence Alerts widget (2+ missed Sundays)"],
  ["See a child's full history", "Children → View child → Attendance tab on profile"],
].forEach(([t, w], i) => tableRow([t, w], attCols, false, i % 2 === 1));

doc.moveDown(0.6);
h2("3.7 Emergencies", BLUE);
body("The Emergencies module logs any safeguarding incident, medical event, or operational emergency that occurs during a service.");

h3("Logging an Emergency");
step(1, "Go to Emergencies → + Log Emergency", "Select the emergency type from the dropdown: Medical Incident, Fire / Evacuation, Missing Child, Safeguarding Concern, or Other.");
step(2, "Fill in the details", "Write a clear description of what happened. Optionally link a specific child's record. The severity level is set to the appropriate level.");
step(3, "Submit", "Click 'Log Emergency'. The record is immediately marked Active and the Dashboard emergency counter turns red.");
step(4, "Resolve when addressed", "Once the situation is handled, click 'Resolve' on the emergency record. Add a resolution note describing the outcome and actions taken.");

doc.moveDown(0.3);
h3("Exporting the Emergency Log");
body("Go to Reports → Exports tab → click 'Export Emergency Log (CSV)'. This downloads all emergencies with timestamps, types, descriptions, and resolution notes.");
warn("Emergency records are permanent. They cannot be edited or deleted — only resolved. All actions are captured in the audit log.");

newPage();
h2("3.8 Class Change Requests", BLUE);
body("Parents or teachers can request that a child moves to a different class. Admins review and action these requests.");

step(1, "Go to Class Changes → Pending tab", "Each pending request shows: the child's name, current class, requested class, who submitted the request, and the reason provided.");
step(2, "Approve", "Click 'Approve'. Optionally add an admin note. The child is immediately moved to the new class and the requester is notified.");
step(3, "Reject", "Click 'Reject' and add a note explaining the decision. The child remains in their current class. The requester is notified with the reason.");

note("Resolved requests (approved or rejected) are shown on the 'Resolved' tab with the admin note and timestamp.");

doc.moveDown(0.5);
h2("3.9 Reports", BLUE);
body("The Reports page has three tabs: Live, Analytics, and Exports.");

h3("Live Tab");
bullet("Not Picked Up — children still in class at the end of service, with parent phone numbers for immediate contact");
bullet("Teacher Ratio — classes below the required teacher-to-child ratio, flagged in red");
bullet("Daily Summary — total checked in, still present, and picked up for today's service");

h3("Analytics Tab");
bullet("Attendance Trends — weekly line chart of total check-ins over time");
bullet("Class Enrollment vs Capacity — grouped bar chart showing each class's fill rate");
bullet("Feedback Analytics — ratings and sentiment from parent feedback submissions");

h3("Exports Tab");
bullet("Attendance CSV — choose a date range and download all attendance records");
bullet("Emergency Log CSV — full history of all emergencies and their resolutions");

newPage();
h2("3.10 Notifications & Broadcasts", BLUE);
body("The notification system lets admins send targeted messages to specific roles, or broadcast to all parents of currently checked-in children.");

step(1, "Send a broadcast", "Go to Notifications → click 'Broadcast Message'. Write a title and body. Select which roles receive it (Parents, Teachers, Attendants, Admins). Click Send.");
step(2, "Pre-dismissal alert", "Click 'Send Pre-Dismissal Alert' on the Notifications page. This automatically creates one notification for every parent whose child is currently checked in — ideal 15 minutes before service ends.");
step(3, "Monitor delivery", "Notification counts appear as red badge numbers on the Bell icon in every recipient's nav bar. Recipients see unread notifications highlighted.");
tip("Use pre-dismissal alerts consistently — parents who receive the alert collect their children faster, reducing post-service congestion.");

doc.moveDown(0.5);
h2("3.11 User Management — Super Admin Only", BLUE);
body("The Users page is accessible only to Super Admins. It controls who can access Shepherd Connect and at what permission level.");

h3("Approving Pending Accounts");
step(1, "Go to Users → Pending Approval tab", "All admin and teacher accounts waiting for approval appear here.");
step(2, "Review the request", "Check the person's name, email, and role. Verify they are a legitimate member of the ministry team.");
step(3, "Approve or Reject", "Click 'Approve' to activate the account (they can now log in). Click 'Reject' to deactivate — they will not be able to access the platform.");

doc.moveDown(0.3);
h3("Managing Existing Users");
bullet("Deactivate: removes a user's access without deleting their data — useful when someone leaves the team");
bullet("View by role: use the role filter tabs (All, Admin, Teacher, Parent, Attendant) to find users quickly");
bullet("Search: use the search bar to find a specific user by name or email");
note("Parents and Attendants who self-register are automatically approved — only Admin and Teacher accounts require manual approval.");

newPage();
h2("3.12 Audit Logs", BLUE);
body("The Audit Log records every significant action in the system with a timestamp, the user who performed it, and what changed. It is the definitive record of all activity on the platform.");

tableRow(["What is logged", "Examples"], [180, W - 180], true, false);
[
  ["Authentication", "Login, logout, failed login attempts"],
  ["Child records", "Child created, updated, deleted"],
  ["Check-in / Checkout", "Each check-in and checkout with time and attendant name"],
  ["Emergency actions", "Emergency logged, resolved"],
  ["User management", "Account approved, rejected, deactivated"],
  ["Class changes", "Request submitted, approved, rejected"],
  ["Broadcasts", "Notification sent, pre-dismissal alert triggered"],
].forEach(([what, ex], i) => tableRow([what, ex], [180, W - 180], false, i % 2 === 1));

doc.moveDown(0.3);
h3("Filtering the Audit Log");
bullet("By User: select a specific user from the dropdown to see only their actions");
bullet("By Action Type: filter by action category (e.g. checkin, approve_user, emergency)");
bullet("By Date Range: set a start and end date to focus on a specific period");
warn("Audit logs are read-only. They cannot be edited, filtered out, or deleted by anyone — including Super Admins.");

doc.moveDown(0.5);
h2("3.13 Waitlist & Substitute Requests", BLUE);

h3("Waitlist");
body("The Waitlist tracks families waiting for a space in a full class.");
bullet("Add to waitlist: Waitlist page → + Add to Waitlist → select child and class");
bullet("Enrol from waitlist: Click 'Enrol' when a space opens in the class");
bullet("Remove: Click 'Remove' if the family no longer needs a space");

doc.moveDown(0.3);
h3("Substitute Requests");
body("Substitute Requests manage teacher cover when a scheduled teacher cannot attend.");
bullet("Raise a request: Substitute Requests → + New Request → select class, date, slot, and reason");
bullet("Assign a substitute: Click 'Assign' on a pending request → select an available teacher from the list");
bullet("Track status: toggle between Pending and Filled tabs to see open and resolved requests");

// ─── TEACHER GUIDE ────────────────────────────────────────────────────────────

newPage();
h1("4. Teacher Guide");
body("Teachers use Shepherd Connect to manage their class, record child appraisals, confirm service allocations, and communicate with parents and admin.");

h2("4.1 My Class & Schedule", GREEN);
body("My Class is your home screen. It shows all children assigned to your class with their ages, photos, and allergy alerts.");

h3("Viewing Your Class");
bullet("Go to My Class in the sidebar to see your full class list");
bullet("Each child card shows: name, age, current class, and a red allergy banner if applicable");
bullet("Click any child card to open their full profile");
warn("Always review allergy and medical notes on child cards before every service. A red 'Medical / Allergy' banner means there is a critical note on file.");

doc.moveDown(0.3);
h3("Your Service Schedule");
body("Your Teacher Dashboard shows all allocations assigned to you:");
bullet("Today's Schedule: classes you are scheduled to serve today, with service time");
bullet("Upcoming allocations: future scheduled services");

step(1, "Confirm your attendance", "Go to Allocations → find your upcoming allocation → click 'Confirm'. This notifies admin that you will be present.");
step(2, "If you cannot attend", "Go to Substitute Requests → + New Request. Fill in the class, service date, slot, and reason. Your admin is notified and can assign a cover teacher.");
tip("Confirm your allocations as early as possible — admin needs accurate counts to ensure enough teachers are present for safety ratios.");

newPage();
h2("4.2 Child Appraisals", GREEN);
body("After each service, record an appraisal for the children in your class. Appraisals are visible to parents on their My Children page — write them as encouragement to the family.");

h3("Creating an Appraisal");
step(1, "Go to Appraisals → + New Appraisal", "Select the child (from your class) and the service date.");
step(2, "Rate three areas", "Each area is rated: Excellent, Good, Fair, or Needs Attention.");
const appraisalAreas = [
  ["Participation Level", "How actively the child joined in activities, songs, and discussions"],
  ["Scripture Engagement", "How well the child engaged with the Bible lesson and memory verse"],
  ["Social Interaction", "How the child interacted with peers and teachers"],
];
tableRow(["Area", "What to assess"], [160, W - 160], true, false);
appraisalAreas.forEach(([area, desc], i) => tableRow([area, desc], [160, W - 160], false, i % 2 === 1));

step(3, "Add notes", "Write a personal note to the parent (e.g. 'Adaeze recited the memory verse perfectly today and helped a younger child with their craft!'). Add any milestone reached.");
step(4, "Save", "Click 'Save Appraisal'. The parent can see it immediately on their My Children page.");
tip("Aim to complete appraisals within 48 hours of the service while your memory is fresh. Specific, positive notes mean much more to parents than generic ones.");

doc.moveDown(0.5);
h2("4.3 Class Change Requests & Messages", GREEN);

h3("Requesting a Class Change for a Child");
step(1, "Go to Class Changes → + New Request", "Select the child and the class you are recommending they move to.");
step(2, "Write a clear reason", "Explain why the move would benefit the child — age appropriateness, learning pace, social dynamics, etc.");
step(3, "Track the outcome", "Check the Resolved tab to see if admin approved or rejected your request, and any notes they left.");

doc.moveDown(0.3);
h3("Messages");
body("Use the Messages page to communicate directly with parents or admin staff.");
bullet("New message: Messages → + New Message → select recipient → type and send");
bullet("Replies: click on a conversation thread to see the full exchange and reply");
bullet("Unread badge: red number on the Messages nav icon — updates every 30 seconds");

// ─── ATTENDANT GUIDE ──────────────────────────────────────────────────────────

newPage();
h1("5. Attendant Guide");
body("Attendants operate the check-in and check-out kiosks. Speed and accuracy are essential — especially during busy service arrivals. Shepherd Connect is optimised for fast kiosk operation.");

h2("5.1 Standard Check-In", PURPLE);
step(1, "Open Check In", "Navigate to Check In in the sidebar (or tap Check In in the bottom tab bar on mobile).");
step(2, "Find the family", "Type the child's name, parent name, or family code into the search bar. Results appear instantly.");
step(3, "Expand the family", "Click the family card to reveal all children in the family.");
step(4, "Check in the child", "Click 'Check In' next to the correct child's name.");
step(5, "Review the confirmation dialog", "The dialog shows: child's name, assigned class, allergy alerts (RED — must be acknowledged), and the service slot selector.");
step(6, "Select service slot and confirm", "Choose '7:00 AM Service' or '10:30 AM Service'. Click 'Confirm Check In'. The child's status changes to Checked In.");
warn("ALWAYS read any allergy or medical alert shown on the confirmation screen. Never check in a child without acknowledging a medical alert. Inform the class teacher before the child enters.");
tip("Family code is the fastest lookup method. Ask the parent: 'Do you have your family code?' — it is on their My Family page.");

doc.moveDown(0.5);
h2("5.2 QR Code Check-In", PURPLE);
step(1, "Open the QR scanner", "On the Check In page, click the QR Code tab (or the QR icon in the mobile bottom bar). Allow camera access when prompted.");
step(2, "Scan the parent's QR code", "Ask the parent to show their QR code from the Shepherd Connect app. Hold the camera steady — the code is detected automatically.");
step(3, "Complete check-in", "The family is looked up and the check-in screen opens automatically. Proceed from Step 5 of the Standard Check-In process.");
tip("QR check-in is ideal for parents who attend regularly. It removes the need to type and speeds up the queue significantly.");

newPage();
h2("5.3 Check-Out — Parent Pickup", PURPLE);
body("When a parent collects their child at the end of the service, the checkout marks the child as 'Picked Up' and removes them from the present list.");

step(1, "Go to Check Out → Standard Pickup tab", "Navigate to Check Out in the sidebar.");
step(2, "Search for the child", "Type the child's or parent's name into the search bar.");
step(3, "Verify the collecting adult", "Confirm the adult matches the parent on record. If a different person is collecting, switch to the Delegate OTP tab.");
step(4, "Complete checkout", "Click 'Check Out' next to the child. A confirmation is shown and the child's status changes to Picked Up.");
note("A child can only be checked out if they are currently checked in. Children with status 'Picked Up' or 'Not Checked In' will not appear on the checkout list.");

doc.moveDown(0.5);
h2("5.4 Check-Out — Delegate OTP", PURPLE);
body("When someone other than the registered parent collects a child, they must present a one-time password (OTP) that was issued by the parent through their app.");

step(1, "Switch to the Delegate OTP tab", "On the Check Out page, click the 'Delegate OTP Checkout' tab.");
step(2, "Enter the 6-digit OTP", "Ask the collecting adult for their 6-digit OTP. The parent generates this in advance from their Pickup Delegates page. Type the code into the OTP field.");
step(3, "Click 'Verify & Check Out'", "The system validates the OTP and displays the child's name and the delegate's registered name.");
step(4, "Confirm the identity", "Visually confirm the collecting adult matches the delegate name shown on screen. Click 'Complete Checkout'.");
step(5, "OTP is invalidated", "The OTP is single-use. Once used, it cannot be used again. The checkout is recorded with the delegate's name.");

warn("NEVER release a child to a delegate without a valid OTP confirmation from the system. If the OTP fails or is expired, the parent must generate a new one. Do not override this process under any circumstances — it exists to protect the child.");
note("OTPs are valid for 24 hours from when the parent created them. Delegates should receive their OTP from the parent before arriving at church.");

const otpTrouble = [
  ["OTP says 'Invalid'", "The code was typed incorrectly. Ask the delegate to read it again carefully."],
  ["OTP says 'Expired'", "The 24-hour validity has passed. The parent must generate a new code."],
  ["OTP says 'Already Used'", "The code was already used in a previous checkout. Contact admin."],
  ["Delegate has no OTP", "Do not release the child. Contact the parent directly to verify and generate a new OTP."],
];
doc.moveDown(0.3);
h3("OTP Troubleshooting");
tableRow(["Situation", "Action"], [180, W - 180], true, false);
otpTrouble.forEach(([sit, act], i) => tableRow([sit, act], [180, W - 180], false, i % 2 === 1));

// ─── PARENT GUIDE ─────────────────────────────────────────────────────────────

newPage();
h1("6. Parent Guide");
body("Shepherd Connect gives parents full visibility into their children's ministry experience — from registration through to appraisals and pickup. Everything is managed from your phone or computer.");

h2("6.1 Registration Walkthrough", AMBER);
body("New parents register in three steps from the login page. The whole process takes about 3–5 minutes.");

step(1, "Go to the login page and click 'Register here'", "Select 'Parent' as your role on the tab bar. Click 'Register here' below the login form.");
step(2, "Step 1 — Your account details", "Fill in: First Name, Last Name, Email Address, Phone Number, and Password. Your email will be your login username. Click Next.");
step(3, "Step 2 — Your family details", "Fill in: Family Name (e.g. 'The Mensah Family'), Home Address, Emergency Contact Name, and Emergency Contact Phone. This contact is used if we cannot reach you during a service. Click Next.");
step(4, "Step 3 — Add your children", "Click '+ Add Child' for each child. For each child enter: First Name, Last Name, Date of Birth, Gender. Optionally add Allergies (e.g. 'Peanuts, Dairy') and Medical Notes (e.g. 'Has mild asthma — inhaler in bag'). Click 'Finish & Register'.");
step(5, "You're in!", "You are logged in automatically and taken to your My Family page. Your family code is displayed at the top.");
tip("You can add more children after registration — just use the '+ Add Child' button on your My Family page at any time.");

newPage();
h2("6.2 My Family & My Children", AMBER);

h3("My Family Page");
body("My Family is your home screen. It shows your complete family profile and all your registered children.");
tableRow(["What you see", "What it means / what to do"], [180, W - 180], true, false);
[
  ["Family Code (e.g. FAM-MENS01)", "Show this to the attendant at check-in for instant lookup — no searching needed"],
  ["Parent 1 & Parent 2", "The adults linked to this family — edit via 'Edit Family' if details change"],
  ["Emergency Contact", "Shown to staff if we cannot reach you — keep this updated"],
  ["Children cards", "Each registered child with their current class — click to manage"],
  ["+ Add Child button", "Register an additional child to your family"],
].forEach(([w, m], i) => tableRow([w, m], [180, W - 180], false, i % 2 === 1));

doc.moveDown(0.3);
h3("My Children Page");
body("My Children shows a more detailed view of each child including their attendance history and teacher appraisals.");
bullet("Expand a child's card to see their attendance history — dates, check-in time, checkout time, and status");
bullet("Read teacher appraisals — star ratings for Participation, Scripture Engagement, and Social Interaction, plus personal notes from the teacher");
bullet("Submit a class change request directly from this page if you feel your child would benefit from a different class");
tip("Teacher appraisals are usually updated within 48 hours after each service. Check My Children on Monday or Tuesday to see how your child got on.");

doc.moveDown(0.5);
h2("6.3 Pickup Delegates & OTP", AMBER);
body("If someone other than yourself will collect your child — a grandparent, aunt, uncle, family friend — you must add them as a pickup delegate and share their one-time password (OTP) before they arrive at church.");

h3("Adding a Pickup Delegate");
step(1, "Go to Pickup Delegates", "Navigate to Pickup Delegates in your sidebar or tap the Delegates icon.");
step(2, "Click '+ Add Delegate'", "Fill in: Delegate's Full Name, Phone Number, and Relationship to your child (e.g. Grandmother, Uncle, Family Friend).");
step(3, "Save and copy the OTP", "After saving, a 6-digit OTP is displayed ONCE. Copy it immediately using the copy button. Share it with your delegate via WhatsApp or phone call.");
step(4, "The delegate presents the OTP at church", "When collecting your child, the delegate gives the 6-digit code to the attendant at the exit. The system verifies it and releases your child.");

doc.moveDown(0.3);
warn("The OTP is shown ONLY ONCE when the delegate is created. If you did not copy it, you must delete the delegate and add them again to generate a new code. OTPs expire after 24 hours and can only be used once.");

doc.moveDown(0.3);
h3("Managing Delegates");
bullet("You can have multiple delegates at the same time — each gets their own unique OTP");
bullet("Delete a delegate to revoke their access immediately — their OTP becomes invalid");
bullet("If a delegate's OTP expires before use, delete and re-add them to get a new code");
note("Your delegate does not need a Shepherd Connect account. They only need the 6-digit OTP code you share with them.");

newPage();
h2("6.4 Feedback, Notifications & Messages", AMBER);

h3("Submitting Feedback");
body("Use the Feedback page to share your experience of the children's ministry with the admin team.");
step(1, "Go to Feedback → + Submit Feedback", "Rate the service out of 5 stars.");
step(2, "Select a category", "Choose from: General, Safety & Security, Curriculum & Teaching, Staff Attitude, or Facilities.");
step(3, "Write your comments", "Be as specific as possible — detailed feedback helps the team make real improvements. Click Submit.");
note("Feedback is visible to church admins only — not to other parents. Your name is recorded for possible follow-up if you raise a concern.");

doc.moveDown(0.4);
h3("Notifications");
body("Admins send you important updates through the notification system. A red badge on the Bell icon tells you how many unread notifications you have.");
tableRow(["Notification type", "When you receive it"], [200, W - 200], true, false);
[
  ["Service announcements", "General news from the children's ministry admin"],
  ["Pre-dismissal alert", "Sent ~15 minutes before service ends — time to come to the exit"],
  ["Class change approved/rejected", "When your class change request is actioned by admin"],
  ["New appraisal", "When your teacher submits an appraisal for your child"],
].forEach(([type, when], i) => tableRow([type, when], [200, W - 200], false, i % 2 === 1));

doc.moveDown(0.4);
h3("Messages");
body("The Messages page lets you send direct messages to the ministry team — teachers, admins, or other designated staff.");
bullet("New message: Messages → + New Message → select recipient → type and send");
bullet("Unread replies: shown with a bold thread and a badge number on the Messages nav icon");
bullet("Keep messages professional and relevant to your child's ministry experience");

// ─── DEMO ACCOUNTS ─────────────────────────────────────────────────────────────

newPage();
h1("7. Demo Accounts Reference");
body("The following accounts are available in the platform for testing and demonstration purposes. These are pre-configured with seed data to demonstrate all features.");

doc.moveDown(0.3);
tableRow(["Role", "Email Address", "Password", "Notes"], [100, 190, 100, W - 390], true, false);
[
  ["Super Admin", "superadmin@shepherd.com", "admin123", "Full access including user approvals"],
  ["Admin", "admin@shepherd.com", "admin123", "Full admin — no user management"],
  ["Teacher", "teacher1@shepherd.com", "teacher123", "Linked to a teacher record and class"],
  ["Attendant", "attendant@shepherd.com", "attend123", "Check-in and checkout kiosks only"],
  ["Parent", "parent1@shepherd.com", "parent123", "Has 2 children and 1 delegate"],
].forEach(([role, email, pass, notes], i) => {
  tableRow([role, email, pass, notes], [100, 190, 100, W - 390], false, i % 2 === 1);
});

doc.moveDown(0.5);
warn("These demo accounts are for testing only. In a live production environment, all staff must register their own personal accounts. Demo passwords must be changed before the platform goes live with real families.");

// ─── SUPPORT ──────────────────────────────────────────────────────────────────

doc.moveDown(0.5);
h1("8. Support & Troubleshooting");

h2("Common Issues");
const issues = [
  ["I cannot log in", "Check your email and password. If your account is Admin or Teacher, it may be pending approval — contact your Super Admin."],
  ["Children page shows empty", "Ensure the 'Unassigned Only' toggle is switched OFF. Also confirm you have children registered in your family."],
  ["OTP says invalid or expired", "OTPs expire after 24 hours. The parent must delete the delegate and re-add them to generate a new code."],
  ["I don't see my notification", "Check the Notifications page directly — the bell badge may not update instantly. Refresh the page if needed."],
  ["My class list is empty (teacher)", "Your admin may not have allocated you to a class yet. Check the Allocations page or contact your admin."],
  ["CSV import failed", "Ensure dateOfBirth is in YYYY-MM-DD format (e.g. 2018-04-12). All required columns must be present."],
  ["I registered but can't log in", "If you registered as Admin or Teacher, you are pending approval. Contact your Super Admin to approve your account."],
];
tableRow(["Issue", "Resolution"], [180, W - 180], true, false);
issues.forEach(([issue, res], i) => tableRow([issue, res], [180, W - 180], false, i % 2 === 1));

doc.moveDown(0.5);
h2("Getting Help");
step(1, "Check the User Guide on the platform", "The User Guide page is always accessible from the bottom of the sidebar — navigate to User Guide for role-specific instructions.");
step(2, "Send a message to your admin", "Use the Messages page to send a direct message to an admin. Include your name and a clear description of the issue.");
step(3, "During a service — speak to an attendant", "For urgent check-in or checkout issues during a service, approach the attendant at the check-in desk directly.");

doc.moveDown(0.5);
// Final footer box
checkSpace(60);
const fx = doc.x; const fy = doc.y;
doc.roundedRect(fx, fy, W, 55, 8).fill(BLUE);
doc.fontSize(11).font("Helvetica-Bold").fillColor("white")
  .text("Shepherd Connect", fx + 15, fy + 12, { continued: true });
doc.fontSize(10).font("Helvetica").fillColor("#93c5fd").text("   ·   Children's Ministry Platform");
doc.fontSize(9).font("Helvetica").fillColor("#bfdbfe")
  .text("RCCG City of David — Victoria Island   |   Safe. Known. Celebrated.", fx + 15, fy + 32);
doc.fontSize(8).fillColor("#60a5fa")
  .text(`Document generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`, fx + 15, fy + 46);

// ─── FINALISE ────────────────────────────────────────────────────────────────

doc.end();

stream.on("finish", () => {
  console.log(`✅ PDF generated: ${OUT}`);
  console.log(`   File size: ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
});
stream.on("error", (err) => {
  console.error("❌ PDF generation failed:", err);
  process.exit(1);
});
