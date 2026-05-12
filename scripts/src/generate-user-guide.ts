import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

// ── Colours & Font Helpers ─────────────────────────────────────────────────
const ROYAL_BLUE   = "#1e3a8a";
const GOLD         = "#f59e0b";
const DARK_BLUE    = "#172554";
const MID_BLUE     = "#3b82f6";
const SOFT_GRAY    = "#f8fafc";
const BORDER_GRAY  = "#e2e8f0";
const TEXT_DARK    = "#111827";
const TEXT_MED     = "#374151";
const TEXT_LIGHT   = "#6b7280";
const WHITE        = "#ffffff";
const GREEN        = "#15803d";
const AMBER        = "#b45309";
const RED          = "#dc2626";

const OUTPUT_PATH = path.resolve("./user-guide.pdf");

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  info: {
    Title: "Shepherd Connect — User Guide",
    Author: "RCCG City of David — Children's Ministry",
    Subject: "Complete user guide for Shepherd Connect platform",
    Keywords: "shepherd connect, children church, user guide, RCCG",
    CreationDate: new Date(),
  },
});

doc.pipe(fs.createWriteStream(OUTPUT_PATH));

// ── Geometry helpers ─────────────────────────────────────────────────────────
const W = 595.28;   // A4 width in pts
const H = 841.89;   // A4 height
const M = 48;       // left/right margin
const CW = W - M * 2; // content width

let pageNum = 0;

// ── Utility helpers ──────────────────────────────────────────────────────────
function hex(c: string) { return c; }

function fillRect(x: number, y: number, w: number, h: number, color: string) {
  doc.save().rect(x, y, w, h).fill(color).restore();
}

function filledRoundRect(x: number, y: number, w: number, h: number, r: number, color: string) {
  doc.save().roundedRect(x, y, w, h, r).fill(color).restore();
}

function strokeRoundRect(x: number, y: number, w: number, h: number, r: number, color: string, lw = 1) {
  doc.save().roundedRect(x, y, w, h, r).lineWidth(lw).stroke(color).restore();
}

function hRule(y: number, color = BORDER_GRAY, lw = 0.5) {
  doc.save().moveTo(M, y).lineTo(W - M, y).lineWidth(lw).stroke(color).restore();
}

// ── Page numbering / header/footer ───────────────────────────────────────────
function addPageFooter() {
  if (pageNum === 0) return;
  const y = H - 32;
  fillRect(0, y - 4, W, 36, SOFT_GRAY);
  doc.save()
    .moveTo(M, y - 4).lineTo(W - M, y - 4)
    .lineWidth(0.4).stroke(BORDER_GRAY)
    .restore();
  doc.font("Helvetica").fontSize(8).fillColor(TEXT_LIGHT)
    .text("Shepherd Connect — RCCG City of David, Victoria Island", M, y + 4, { align: "left", width: CW / 2 })
    .text(`Page ${pageNum} | Confidential — Ministry Use Only`, M + CW / 2, y + 4, { align: "right", width: CW / 2 });
}

doc.on("pageAdded", () => {
  pageNum++;
});

// ════════════════════════════════════════════════════════════════════════════
// COVER PAGE
// ════════════════════════════════════════════════════════════════════════════
function coverPage() {
  // Deep gradient background – two rects to fake gradient
  fillRect(0, 0, W, H * 0.65, DARK_BLUE);
  fillRect(0, H * 0.65, W, H * 0.35, SOFT_GRAY);

  // Gold accent bar across top
  fillRect(0, 0, W, 6, GOLD);

  // Decorative circles
  doc.save().circle(W - 80, 120, 140).opacity(0.06).fill(WHITE).restore();
  doc.save().circle(W - 40, H * 0.55, 90).opacity(0.05).fill(WHITE).restore();
  doc.save().circle(80, H * 0.4, 60).opacity(0.06).fill(WHITE).restore();

  // Church name above logo
  doc.font("Helvetica").fontSize(10).fillColor(GOLD)
    .text("THE REDEEMED CHRISTIAN CHURCH OF GOD", M, 90, { align: "center", width: CW, characterSpacing: 2 });

  // Church sub
  doc.font("Helvetica").fontSize(9).fillColor("rgba(255,255,255,0.6)")
    .text("City of David — Victoria Island, Lagos", M, 108, { align: "center", width: CW });

  // Gold divider
  const divY = 130;
  doc.save().moveTo(W / 2 - 60, divY).lineTo(W / 2 + 60, divY).lineWidth(1).stroke(GOLD).restore();

  // Main title
  doc.font("Helvetica-Bold").fontSize(46).fillColor(WHITE)
    .text("Shepherd", M, 170, { align: "center", width: CW });
  doc.font("Helvetica-Bold").fontSize(46).fillColor(GOLD)
    .text("Connect", M, 215, { align: "center", width: CW });

  // Tagline
  doc.font("Helvetica").fontSize(14).fillColor("rgba(255,255,255,0.75)")
    .text("Safe. Known. Celebrated.", M, 272, { align: "center", width: CW });

  // Doc type badge
  const badgeW = 220, badgeH = 34;
  const badgeX = (W - badgeW) / 2;
  filledRoundRect(badgeX, 310, badgeW, badgeH, 17, GOLD);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK_BLUE)
    .text("COMPLETE USER GUIDE", badgeX, 322, { align: "center", width: badgeW, characterSpacing: 1 });

  // Version / date row
  doc.font("Helvetica").fontSize(9).fillColor("rgba(255,255,255,0.5)")
    .text(`Version 2.0  ·  May 2026  ·  Confidential Ministry Document`, M, 362, { align: "center", width: CW });

  // Feature pill row
  const pills = ["Check-in / Check-out", "Messaging", "Reports", "Safeguarding", "Consent Forms\"];
  let pillX = M;
  const pillY = 410;
  pills.forEach(label => {
    const tw = doc.font("Helvetica").fontSize(8).widthOfString(label);
    const pw = tw + 20;
    filledRoundRect(pillX, pillY, pw, 22, 11, "rgba(255,255,255,0.12)");
    doc.font("Helvetica").fontSize(8).fillColor("rgba(255,255,255,0.8)")
      .text(label, pillX + 10, pillY + 7, { width: pw - 20 });
    pillX += pw + 8;
    if (pillX + 80 > W - M) { pillX = M; }
  });

  // White content area
  const contentTop = H * 0.65;
  fillRect(0, contentTop, W, H * 0.35, SOFT_GRAY);

  // Intro block in white
  filledRoundRect(M, contentTop + 24, CW, 100, 12, WHITE);
  strokeRoundRect(M, contentTop + 24, CW, 100, 12, BORDER_GRAY);

  doc.font("Helvetica-Bold").fontSize(13).fillColor(ROYAL_BLUE)
    .text("About This Guide", M + 20, contentTop + 40);
  doc.font("Helvetica").fontSize(10).fillColor(TEXT_MED)
    .text(
      "This document is the official reference manual for all users of the Shepherd Connect platform. "
      + "It provides step-by-step instructions for every feature across all five user roles — Super Admin, Admin, Teacher, Attendant, and Parent.",
      M + 20, contentTop + 58, { width: CW - 40, lineGap: 3 }
    );

  // Role legend
  const roles = [
    { role: "Super Admin", color: RED,       desc: "Full system access + approvals" },
    { role: "Admin",       color: ROYAL_BLUE, desc: "Ministry operations management" },
    { role: "Teacher",     color: GREEN,      desc: "Class & child management" },
    { role: "Attendant",   color: AMBER,      desc: "Check-in & check-out kiosk" },
    { role: "Parent",      color: MID_BLUE,   desc: "Family & child information" },
  ];

  let rx = M;
  const ry = contentTop + 145;
  roles.forEach(({ role, color, desc }) => {
    const boxW = (CW - 16) / 5;
    filledRoundRect(rx, ry, boxW, 64, 8, WHITE);
    strokeRoundRect(rx, ry, boxW, 64, 8, BORDER_GRAY);
    filledRoundRect(rx, ry, boxW, 6, 8, color);
    fillRect(rx, ry + 3, boxW, 3, color);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(color)
      .text(role, rx + 6, ry + 14, { width: boxW - 12 });
    doc.font("Helvetica").fontSize(8).fillColor(TEXT_LIGHT)
      .text(desc, rx + 6, ry + 28, { width: boxW - 12, lineGap: 2 });
    rx += boxW + 4;
  });

  // Footer strip at very bottom
  fillRect(0, H - 48, W, 48, DARK_BLUE);
  fillRect(0, H - 48, W, 2, GOLD);
  doc.font("Helvetica").fontSize(8).fillColor("rgba(255,255,255,0.5)")
    .text("RCCG City of David  ·  Victoria Island, Lagos  ·  Children's Ministry Department", M, H - 28, { align: "center", width: CW });
}

// ════════════════════════════════════════════════════════════════════════════
// TABLE OF CONTENTS
// ════════════════════════════════════════════════════════════════════════════
function tocEntry(num: string, title: string, sub: boolean, pgRef: string, y: number) {
  const indent = sub ? 16 : 0;
  if (!sub) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor(ROYAL_BLUE)
      .text(num, M + indent, y, { continued: true })
      .text(`  ${title}`, { continued: false });
  } else {
    doc.font("Helvetica").fontSize(10).fillColor(TEXT_MED)
      .text(`${num}`, M + indent, y, { continued: true })
      .text(`  ${title}`, { continued: false });
  }
  // dot leaders
  doc.font("Helvetica").fontSize(9).fillColor(TEXT_LIGHT)
    .text(pgRef, W - M - 30, y, { align: "right", width: 30 });
  return y + (sub ? 18 : 22);
}

function tableOfContents() {
  doc.addPage();

  // Header
  fillRect(0, 0, W, 90, ROYAL_BLUE);
  fillRect(0, 0, W, 5, GOLD);
  doc.font("Helvetica-Bold").fontSize(28).fillColor(WHITE)
    .text("Table of Contents", M, 30, { width: CW });

  let y = 110;

  const entries: [string, string, boolean, string][] = [
    ["1.",  "Getting Started",                    false, "4\"],
    ["1.1", "System Overview",                    true,  "4\"],
    ["1.2", "Logging In",                         true,  "4\"],
    ["1.3", "Registering an Account",             true,  "5\"],
    ["1.4", "Navigation & Interface",             true,  "5\"],
    ["2.",  "Super Admin",                        false, "6\"],
    ["2.1", "User Management & Approvals",        true,  "6\"],
    ["2.2", "Audit Logs",                         true,  "7\"],
    ["3.",  "Admin",                              false, "7\"],
    ["3.1", "Dashboard",                          true,  "7\"],
    ["3.2", "Families",                           true,  "8\"],
    ["3.3", "Children",                           true,  "8\"],
    ["3.4", "Classes & Assignments",              true,  "9\"],
    ["3.5", "Teachers & Allocations",             true,  "9\"],
    ["3.6", "Emergencies",                        true,  "10\"],
    ["3.7", "Safeguarding & DBS",                 true,  "10\"],
    ["3.8", "Substitute Requests",               true,  "11\"],
    ["3.9", "Waitlist",                           true,  "11\"],
    ["3.10","Reports & Analytics",               true,  "12\"],
    ["4.",  "Teacher",                            false, "13\"],
    ["4.1", "My Class",                          true,  "13\"],
    ["4.2", "Attendance & Arrivals",             true,  "14\"],
    ["4.3", "Child Appraisals",                  true,  "14\"],
    ["4.4", "Class Change Requests",             true,  "15\"],
    ["4.5", "Birthday Widget",                   true,  "15\"],
    ["4.6", "Substitute Requests",              true,  "15\"],
    ["5.",  "Attendant",                         false, "16\"],
    ["5.1", "Check-In Kiosk",                    true,  "16\"],
    ["5.2", "Standard Check-Out",                true,  "17\"],
    ["5.3", "Delegate OTP Check-Out",           true,  "17\"],
    ["6.",  "Parent",                            false, "18\"],
    ["6.1", "My Family",                         true,  "18\"],
    ["6.2", "My Children & Consent Forms",       true,  "19\"],
    ["6.3", "Pickup Delegates & OTP",            true,  "19\"],
    ["6.4", "Class Change Requests",             true,  "20\"],
    ["6.5", "Messages",                          true,  "20\"],
    ["6.6", "Feedback",                          true,  "20\"],
    ["7.",  "Messaging System",                  false, "21\"],
    ["8.",  "Notifications",                     false, "22\"],
    ["9.",  "Profile & Settings",               false, "22\"],
    ["10.", "Security & Safeguarding",           false, "23\"],
    ["11.", "Frequently Asked Questions",        false, "24\"],
  ];

  entries.forEach(([num, title, sub, pg]) => {
    if (y > H - 100) { doc.addPage(); addPageFooter(); y = 60; }
    // Alternate row background for readability
    if (!sub) {
      filledRoundRect(M - 4, y - 3, CW + 8, 20, 4, "#eef2ff");
    }
    y = tocEntry(num, title, sub, pg, y);
    if (!sub) y += 2;
  });

  addPageFooter();
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION HELPERS
// ════════════════════════════════════════════════════════════════════════════
function sectionHeader(num: string, title: string) {
  doc.addPage();
  addPageFooter();
  fillRect(0, 0, W, 80, ROYAL_BLUE);
  fillRect(0, 0, W, 5, GOLD);
  // Section number badge
  filledRoundRect(M, 18, 36, 36, 8, GOLD);
  doc.font("Helvetica-Bold").fontSize(14).fillColor(DARK_BLUE)
    .text(num, M, 31, { width: 36, align: "center" });
  doc.font("Helvetica-Bold").fontSize(24).fillColor(WHITE)
    .text(title, M + 46, 26, { width: CW - 46 });
  return 100;
}

interface SubCtx { y: number }

function subSection(ctx: SubCtx, num: string, title: string) {
  if (ctx.y > H - 130) {
    doc.addPage();
    addPageFooter();
    ctx.y = 40;
  }
  ctx.y += 10;
  filledRoundRect(M, ctx.y, CW, 26, 6, "#eff6ff");
  strokeRoundRect(M, ctx.y, 4, 26, 2, ROYAL_BLUE, 3);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(ROYAL_BLUE)
    .text(`${num}  ${title}`, M + 14, ctx.y + 7, { width: CW - 20 });
  ctx.y += 34;
}

function para(ctx: SubCtx, text: string, indent = 0) {
  if (ctx.y > H - 120) {
    doc.addPage();
    addPageFooter();
    ctx.y = 40;
  }
  doc.font("Helvetica").fontSize(10).fillColor(TEXT_MED)
    .text(text, M + indent, ctx.y, { width: CW - indent, lineGap: 3 });
  ctx.y += doc.heightOfString(text, { width: CW - indent }) + 10;
}

function bullet(ctx: SubCtx, items: string[], indent = 0) {
  items.forEach(item => {
    if (ctx.y > H - 80) {
      doc.addPage();
      addPageFooter();
      ctx.y = 40;
    }
    doc.font("Helvetica").fontSize(9).fillColor(GOLD)
      .text("▸", M + indent, ctx.y, { continued: false, width: 12 });
    doc.font("Helvetica").fontSize(9.5).fillColor(TEXT_DARK)
      .text(item, M + indent + 14, ctx.y, { width: CW - indent - 14, lineGap: 2 });
    ctx.y += doc.heightOfString(item, { width: CW - indent - 14 }) + 7;
  });
}

function step(ctx: SubCtx, number: number, text: string) {
  if (ctx.y > H - 80) {
    doc.addPage();
    addPageFooter();
    ctx.y = 40;
  }
  filledRoundRect(M, ctx.y, 22, 22, 11, ROYAL_BLUE);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(WHITE)
    .text(String(number), M, ctx.y + 6, { width: 22, align: "center" });
  doc.font("Helvetica").fontSize(10).fillColor(TEXT_DARK)
    .text(text, M + 30, ctx.y + 5, { width: CW - 30, lineGap: 2 });
  ctx.y += Math.max(24, doc.heightOfString(text, { width: CW - 30 }) + 14);
}

function callout(ctx: SubCtx, type: "info\" | \"warning\" | \"tip\" | \"important", text: string) {
  if (ctx.y > H - 100) {
    doc.addPage();
    addPageFooter();
    ctx.y = 40;
  }
  const configs = {
    info:      { bg: "#eff6ff", border: MID_BLUE,  icon: "ℹ",  label: "Note",      textC: "#1e40af\" },
    warning:   { bg: "#fff7ed", border: AMBER,      icon: "⚠",  label: "Warning",   textC: "#92400e\" },
    tip:       { bg: "#f0fdf4", border: GREEN,      icon: "✓",  label: "Tip",       textC: "#14532d\" },
    important: { bg: "#fef2f2", border: RED,        icon: "!",  label: "Important", textC: "#991b1b\" },
  };
  const cfg = configs[type];
  const h = doc.heightOfString(text, { width: CW - 50 }) + 28;
  filledRoundRect(M, ctx.y, CW, h, 8, cfg.bg);
  fillRect(M, ctx.y, 4, h, cfg.border);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(cfg.border)
    .text(`${cfg.icon}  ${cfg.label}`, M + 12, ctx.y + 10);
  doc.font("Helvetica").fontSize(9.5).fillColor(cfg.textC)
    .text(text, M + 12, ctx.y + 24, { width: CW - 20, lineGap: 2 });
  ctx.y += h + 12;
}

function twoColInfo(ctx: SubCtx, pairs: [string, string][]) {
  const colW = (CW - 12) / 2;
  pairs.forEach(([label, value]) => {
    if (ctx.y > H - 60) {
      doc.addPage();
      addPageFooter();
      ctx.y = 40;
    }
    filledRoundRect(M, ctx.y, CW, 22, 4, SOFT_GRAY);
    strokeRoundRect(M, ctx.y, CW, 22, 4, BORDER_GRAY);
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(TEXT_LIGHT)
      .text(label, M + 10, ctx.y + 6, { width: colW - 10 });
    doc.font("Helvetica").fontSize(9.5).fillColor(TEXT_DARK)
      .text(value, M + colW + 10, ctx.y + 6, { width: colW - 10 });
    ctx.y += 26;
  });
  ctx.y += 6;
}

function roleTag(ctx: SubCtx, roles: string[]) {
  const colorMap: Record<string, string> = {
    "Super Admin\": RED, \"Admin\": ROYAL_BLUE, \"Teacher\": GREEN,
    "Attendant": AMBER, "Parent": MID_BLUE,
  };
  let x = M;
  const y2 = ctx.y;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(TEXT_LIGHT)
    .text("Accessible by:", M, y2, { continued: false });
  ctx.y += 16;
  x = M;
  roles.forEach(r => {
    const color = colorMap[r] || ROYAL_BLUE;
    const tw = doc.font("Helvetica-Bold").fontSize(8).widthOfString(r);
    const pw = tw + 14;
    filledRoundRect(x, ctx.y, pw, 18, 9, color);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(WHITE)
      .text(r, x + 7, ctx.y + 5, { width: pw - 14 });
    x += pw + 6;
  });
  ctx.y += 26;
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — GETTING STARTED
// ════════════════════════════════════════════════════════════════════════════
function section1() {
  const ctx: SubCtx = { y: sectionHeader("1", "Getting Started") };

  subSection(ctx, "1.1", "System Overview");
  para(ctx, "Shepherd Connect is a full-stack, mobile-first church children's ministry management platform built exclusively for RCCG City of David, Victoria Island. It digitises every aspect of the children's church workflow — from family registration and Sunday check-in through to appraisals, safeguarding records, and parent-teacher messaging.");
  para(ctx, "The platform operates via a web browser on any device (phone, tablet, or desktop) and requires no installation. All data is stored securely in a private database and all communication is encrypted in transit.");

  bullet(ctx, [
    "Five role-based access levels ensure each user sees only what is relevant to their responsibility.",
    "Real-time attendance tracking with QR code and face recognition check-in.",
    "Automated notifications keep parents informed at every stage of the service.",
    "PDF and CSV exports for all key reports with professional branded layouts.",
    "Multi-language support for English, Yoruba, Igbo, Hausa, Pidgin, and French.",
  ]);

  subSection(ctx, "1.2", "Logging In");
  para(ctx, "Navigate to the Shepherd Connect URL provided by your administrator. The login screen presents four quick-select buttons (Parent, Teacher, Admin, Attendant) to pre-fill the correct demo account, or you may enter your credentials manually.");
  step(ctx, 1, "Open the Shepherd Connect web address in your browser.");
  step(ctx, 2, "Enter your registered email address in the Email field.");
  step(ctx, 3, "Enter your password in the Password field.");
  step(ctx, 4, "Tap or click \"Enter the House\" to log in.");
  step(ctx, 5, "You will be redirected automatically to the dashboard appropriate for your role.");
  callout(ctx, "important", "If your account was self-registered as Admin or Teacher, it must be approved by the Super Admin before you can log in. You will see a message: \"Your account is pending approval.\" Contact the ministry admin if approval is delayed.");
  twoColInfo(ctx, [
    ["Super Admin email", "superadmin@shepherd.com"],
    ["Admin email",       "admin@shepherd.com"],
    ["Teacher email",     "teacher1@shepherd.com"],
    ["Attendant email",   "attendant@shepherd.com"],
    ["Parent email",      "parent1@shepherd.com"],
    ["Default passwords", "admin123 (admin/super) · teacher123 (teacher) · attend123 (attendant) · parent123 (parent)"],
  ]);

  subSection(ctx, "1.3", "Registering an Account");
  para(ctx, "New users who are not yet in the system can self-register from the login screen.");
  step(ctx, 1, "Tap "Register here" on the login page.");
  step(ctx, 2, "Fill in your first name, last name, email address, and a strong password.");
  step(ctx, 3, "Select your role from the dropdown (Parent, Teacher, or Attendant).");
  step(ctx, 4, "Tap "Create Account".");
  callout(ctx, "info", "Parents are activated immediately. Teachers and Admin accounts are placed in \"Pending Approval\" status and cannot log in until approved by the Super Admin.");

  subSection(ctx, "1.4", "Navigation & Interface");
  para(ctx, "The interface consists of three main areas:");
  bullet(ctx, [
    "Sidebar (desktop): Expands on the left with all navigation links for your role. Collapses on mobile to save screen space.",
    "Top bar (header): Shows the app logo, global search bar (desktop), notifications bell with unread count, and your profile avatar.",
    "Bottom tab bar (mobile, parents & teachers): Provides quick one-thumb access to the four most important pages.",
  ]);
  para(ctx, "The global search bar (desktop only) lets you search for any child, family, or user by name. Results appear as you type and clicking a result navigates directly to that record.");
  callout(ctx, "tip", "The language switcher is at the bottom of the sidebar. Changing language updates all navigation labels and interface text instantly without requiring a reload.");

  addPageFooter();
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — SUPER ADMIN
// ════════════════════════════════════════════════════════════════════════════
function section2() {
  const ctx: SubCtx = { y: sectionHeader("2", "Super Admin") };
  roleTag(ctx, ["Super Admin"]);
  para(ctx, "The Super Admin has unrestricted access to every feature in the platform, including all Admin capabilities plus exclusive access to User Management and Audit Logs. There should only be one Super Admin account per ministry.");

  subSection(ctx, "2.1", "User Management & Approvals");
  para(ctx, "Navigate to Users in the sidebar. The page contains two tabs:");
  bullet(ctx, [
    "All Users — A searchable, filterable table of every registered account showing name, role, email, status, and join date.",
    "Pending Approval — Accounts submitted by Teachers or Admins awaiting activation.",
  ]);
  para(ctx, "Actions available on the All Users tab:");
  bullet(ctx, [
    "Search: Type any name or email in the search box to filter the list instantly.",
    "Filter by role: Use the role dropdown to narrow the table to a single role.",
    "Deactivate / Activate: Toggle a user's active status. Deactivated users cannot log in.",
    "View profile: Click a user row to see their full profile details.",
  ]);
  step(ctx, 1, "Navigate to Users in the sidebar.");
  step(ctx, 2, "Click the "Pending Approval" tab.");
  step(ctx, 3, "Review the applicant's details — name, role, email, and registration date.");
  step(ctx, 4, "Click \"Approve\" to activate the account, or \"Reject\" to deny it.");
  step(ctx, 5, "The user receives an in-app notification of the outcome.");
  callout(ctx, "warning", "Rejected accounts are permanently blocked. The user must register again with a new email address. There is no \"undo\" for a rejection.");

  subSection(ctx, "2.2", "Audit Logs");
  para(ctx, "The Audit Log records every significant action performed in the system with a timestamp and the responsible user. This page is read-only and cannot be cleared.");
  bullet(ctx, [
    "Filter by action type, date range, or user to narrow results.",
    "Each entry shows: timestamp, performing user, action description, and affected record.",
    "Common logged events include: check-ins, check-outs, delegate additions, user approvals, emergency creation, and class changes.",
    "Export is not available from this page to preserve log integrity; use the Reports → Custom Builder for export.",
  ]);
  callout(ctx, "tip", "Use Audit Logs to investigate any disputed check-in, late pickup, or data change. The log is tamper-proof and timestamped to the second.");
  addPageFooter();
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — ADMIN
// ════════════════════════════════════════════════════════════════════════════
function section3() {
  const ctx: SubCtx = { y: sectionHeader("3", "Admin") };
  roleTag(ctx, ["Admin", "Super Admin"]);
  para(ctx, "The Admin role has broad operational access covering family and child management, class administration, teacher scheduling, reports, safeguarding, and more. Admins cannot access the Users page unless they are Super Admins.");

  subSection(ctx, "3.1", "Dashboard");
  para(ctx, "The dashboard is your ministry command centre. It loads automatically after login and displays live statistics for the current service day.");
  bullet(ctx, [
    "Daily Summary Card: Total children checked in, currently in class, and already picked up — updated in real time.",
    "Not Picked Up Alert: A red alert card appears if any children have not been collected past a configurable threshold.",
    "Teacher-to-Child Ratio: Visual indicators for each class showing whether staffing levels are acceptable.",
    "Recent Activity Feed: The last 10 check-in/check-out events across all classes.",
    "Feedback Sentiment: AI-powered summary of parent feedback sentiment (positive, neutral, negative).",
    "Quick Actions: Shortcut buttons to Families, Children, Attendance, and Reports.",
  ]);
  callout(ctx, "tip", "Bookmark the Dashboard URL. Refreshing the page will pull the latest live data without any further navigation.");

  subSection(ctx, "3.2", "Families");
  para(ctx, "The Families page lists every registered family with their unique Family Code, parent names, contact details, and child count.");
  step(ctx, 1, "Go to Families in the sidebar.");
  step(ctx, 2, "Use the search bar to find a family by surname or Family Code.");
  step(ctx, 3, "Click a family card to open the full Family Profile.");
  para(ctx, "The Family Profile shows:");
  bullet(ctx, [
    "Parent 1 and Parent 2 details (name, phone, email).",
    "Emergency contact name and phone number.",
    "All children linked to the family with age and current class assignment.",
    "Family check-in QR code — tap the QR code to enlarge it for scanning.",
    "Add / remove children from the family.",
  ]);

  subSection(ctx, "3.3", "Children");
  para(ctx, "Children is a master register of every enrolled child. Each child profile is the central record linking attendance, appraisals, class journey, medical info, and consent forms.");
  bullet(ctx, [
    "Search and filter by name, class, or age group.",
    "Click any child to open their full profile.",
    "Add a new child using the "Add Child" button (also available from the family profile).",
  ]);
  para(ctx, "The Child Profile contains:");
  bullet(ctx, [
    "Vital statistics: name, date of birth, age, gender.",
    "Class assignment badge and link to family.",
    "Attendance summary: total sessions, pickup rate percentage.",
    "Allergy alert banner (red) if any allergies are recorded — shown prominently at the top.",
    "Medical & emergency information card.",
    "Consent Forms section — five consent categories with grant/revoke controls.",
    "Class Journey Timeline — a visual history of all class changes.",
    "Recent Attendance list — last 8 attendance records with status.",
    "Appraisals — all written appraisals from teachers.",
    "QR Code — the family's check-in QR for this child.",
    "Face Enrollment — enrol or update the child's face recognition descriptor.",
  ]);
  callout(ctx, "important", "Deleting a child removes ALL their attendance, appraisal, and delegate records permanently. This action cannot be undone. Only Super Admins and Admins can delete children.");

  subSection(ctx, "3.4", "Classes & Assignments");
  para(ctx, "Classes defines the four ministry groups:");
  twoColInfo(ctx, [
    ["Toddlers",  "Ages 0–3 — Nursery"],
    ["Beginners", "Ages 4–6 — Foundation class"],
    ["Primary",   "Ages 7–10 — Junior school level"],
    ["Juniors",   "Ages 11–12 — Pre-teen level"],
  ]);
  para(ctx, "Class Assignments maps children to classes. Use this page to:");
  bullet(ctx, [
    "View current class membership for each class.",
    "Manually assign or reassign a child to a different class.",
    "See unassigned children who need to be placed.",
  ]);
  callout(ctx, "tip", "When a Class Change Request is approved, the child is moved automatically. You do not need to manually update Class Assignments for approved requests.");

  subSection(ctx, "3.5", "Teachers & Allocations");
  para(ctx, "Teachers lists all users with the Teacher role together with their profile completeness, linked class, and DBS status summary.");
  para(ctx, "Teacher Allocations is the scheduling table. For each service date and slot, it shows which teacher is assigned to which class and room, and their confirmation status.");
  step(ctx, 1, "Navigate to Teacher Allocations.");
  step(ctx, 2, "Select the service date using the date picker.");
  step(ctx, 3, "Review allocation rows — each row shows: teacher, class, room, slot, and status (Pending / Confirmed).");
  step(ctx, 4, "Use the "Add Allocation" button to schedule a teacher for a new slot.");
  step(ctx, 5, "Teachers can confirm their own allocations from their My Class page.");

  subSection(ctx, "3.6", "Emergencies");
  para(ctx, "The Emergencies page is used to log and track any safeguarding incident, medical event, or other urgent situation that occurs during a service.");
  step(ctx, 1, "Click "Report Emergency" (red button in the header).");
  step(ctx, 2, "Select the affected child from the dropdown.");
  step(ctx, 3, "Choose the incident type (Medical, Safeguarding, Fire, Security, Other).");
  step(ctx, 4, "Enter a detailed description of the incident.");
  step(ctx, 5, "Set the severity level (Low, Medium, High, Critical).");
  step(ctx, 6, "Click "Submit Emergency Report".");
  para(ctx, "Once submitted, the emergency appears in the live feed. Admins can add follow-up updates, mark it as resolved, and export the full log as CSV or PDF.");
  callout(ctx, "important", "All emergency reports are retained permanently in the audit log regardless of resolution status. Never delete an emergency record.");

  subSection(ctx, "3.7", "Safeguarding & DBS");
  para(ctx, "The Safeguarding & DBS page maintains a centralised record of all background checks and safeguarding certifications for every teacher and volunteer.");
  step(ctx, 1, "Navigate to Safeguarding & DBS in the sidebar.");
  step(ctx, 2, "Click "Add Record" to create a new entry.");
  step(ctx, 3, "Select the teacher from the dropdown.");
  step(ctx, 4, "Choose the check type: DBS Enhanced, DBS Standard, DBS Basic, Safeguarding Training, or First Aid.");
  step(ctx, 5, "Enter the reference number, issued date, and expiry date.");
  step(ctx, 6, "Set the status: Clear, Pending, Expired, or Not Submitted.");
  step(ctx, 7, "Click "Add Record" to save.");
  para(ctx, "Status indicators:");
  bullet(ctx, [
    "Clear (green) — DBS is valid and active.",
    "Pending (amber) — Application submitted, result awaited.",
    "Expired (red) — DBS has passed its expiry date. A red alert banner appears at the top of the page.",
    "Not Submitted (grey) — No DBS application on file — action required.",
  ]);
  callout(ctx, "warning", "An amber warning banner appears automatically for any DBS expiring within 30 days. A red alert appears for expired checks. Do not allow volunteers to work with children if their DBS shows Expired or Not Submitted.");

  subSection(ctx, "3.8", "Substitute Requests");
  para(ctx, "Substitute Requests allows teachers to formally notify administration when they cannot attend a scheduled service and need cover arranged.");
  para(ctx, "Admin workflow:");
  step(ctx, 1, "Navigate to Substitute Requests in the sidebar.");
  step(ctx, 2, "Review pending requests — each shows the requesting teacher, their class, the service date, and their reason.");
  step(ctx, 3, "Click "Assign Cover" to open the assignment panel.");
  step(ctx, 4, "Select a substitute teacher from the dropdown.");
  step(ctx, 5, "Optionally add admin notes for the substitute.");
  step(ctx, 6, "Click \"Assign\". The status changes to \"Assigned\".");
  step(ctx, 7, "Once the substitute confirms attendance, click "Confirm" to finalise.");
  callout(ctx, "tip", "A pending count badge on the header shows how many requests need attention. Check this each week before the service date.");

  subSection(ctx, "3.9", "Waitlist");
  para(ctx, "The Waitlist manages children whose preferred class is at capacity. Admins can view, approve, reject, or promote children from the waitlist to the class.");
  bullet(ctx, [
    "Each entry shows the child's name, preferred class, family, and date added.",
    ""Promote" moves the child off the waitlist and into a Class Assignment.",
    ""Reject" removes the child from the waitlist and sends a parent notification.",
    "The waitlist is sorted by date added — oldest requests first (first in, first out).",
  ]);

  subSection(ctx, "3.10", "Reports & Analytics");
  para(ctx, "The Reports module is the most powerful section of the platform, providing six different reporting views:");
  bullet(ctx, [
    "Live Reports — Real-time view of who is in church, who hasn't been collected, and teacher-to-child ratios for the current service day.",
    "Export Data — Generate dated PDF and CSV exports of attendance, feedback, emergency logs, teacher schedules, and the family registry.",
    "Analytics — Pie charts and bar graphs for class distribution, feedback sentiment, class utilisation, and teacher schedule.",
    "Trends — Weekly attendance line charts and class-level bar charts over 4, 8, 12, or 24 weeks.",
    "Room Heatmap — Visual occupancy grid showing headcount per room per slot for a selected date.",
    "Custom Builder — Fully configurable report with seven report types, date range, class, slot, teacher, and family filters — export to PDF or CSV.",
    "Annual Summary — Year-view summary of total sessions, unique children, peak day, and class breakdown.",
  ]);
  callout(ctx, "tip", "Use the Attendance Trends tab to identify seasonal patterns, such as lower attendance during school exam periods or holiday weekends. This helps plan staffing in advance.");
  addPageFooter();
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 4 — TEACHER
// ════════════════════════════════════════════════════════════════════════════
function section4() {
  const ctx: SubCtx = { y: sectionHeader("4", "Teacher") };
  roleTag(ctx, ["Teacher"]);
  para(ctx, "Teachers have access to everything they need to manage their class effectively — from confirming arrivals and writing appraisals to requesting substitute cover and sending messages to parents.");

  subSection(ctx, "4.1", "My Class");
  para(ctx, "My Class is the teacher's home page. It has four tabs:");
  bullet(ctx, [
    "Awaiting Confirmation — Children who have been checked in at the front desk but not yet confirmed as arrived in the classroom. Tap "Confirm Arrival" for each child as they come through the door.",
    "Roster — All children currently in class (confirmed arrivals who have not been picked up yet). Shows check-in time and pickup time for each child.",
    "Birthdays — Children from your class celebrating a birthday in the next 30 days, ordered by date. Today's birthdays appear with a special 🎂 badge.",
    "Schedule — Your upcoming teacher allocations — which dates, classes, rooms, and slots you are assigned to.",
  ]);
  step(ctx, 1, "When a child arrives in your classroom, go to My Class → Awaiting tab.");
  step(ctx, 2, "Find the child's card in the list.");
  step(ctx, 3, "Tap "Confirm Arrival" — this records the classroom arrival time separately from the front-desk drop-off time.");
  callout(ctx, "info", "The time gap between front-desk drop-off and your classroom arrival confirmation is measured and reported in the \"Class Arrivals\" report. Try to confirm arrivals promptly to keep this data accurate.");

  subSection(ctx, "4.2", "Attendance & Arrivals");
  para(ctx, "The Attendance page shows the full attendance record for your class — all sessions, not just today. Use it to:");
  bullet(ctx, [
    "Review which children attended on a specific date.",
    "Check the status of each record: Checked In, In Class, Picked Up.",
    "Filter by date range to see attendance patterns for a child over several weeks.",
    "Identify children with low attendance for pastoral follow-up.",
  ]);

  subSection(ctx, "4.3", "Child Appraisals");
  para(ctx, "Appraisals are weekly written assessments of each child's participation, Scripture engagement, and social behaviour. Regular appraisals build a developmental record that is visible to parents and admins.");
  step(ctx, 1, "Navigate to Appraisals in the sidebar.");
  step(ctx, 2, "Click "New Appraisal".");
  step(ctx, 3, "Select the child from the dropdown.");
  step(ctx, 4, "Choose the service date.");
  step(ctx, 5, "Set ratings for: Participation Level, Scripture Engagement, and Social Interaction (each has options: Excellent, Good, Developing, Needs Support).");
  step(ctx, 6, "Optionally add a Milestone Note — e.g., \"Memorised John 3:16 today!\" or \"Helped a new child settle in.\"");
  step(ctx, 7, "Click "Submit Appraisal".");
  callout(ctx, "tip", "Milestone notes are highlighted specially on the child's profile and are visible to parents. Use them to celebrate achievements and encourage families.");

  subSection(ctx, "4.4", "Class Change Requests");
  para(ctx, "If a parent asks for their child to move to a different class — or if you as a teacher feel a child would be better suited to another class — submit a Class Change Request.");
  step(ctx, 1, "Go to Class Changes in the sidebar.");
  step(ctx, 2, "Click "New Request".");
  step(ctx, 3, "Select the child and the desired target class.");
  step(ctx, 4, "Write a clear reason for the request.");
  step(ctx, 5, "Submit. An admin will review and approve or reject with notes.");
  callout(ctx, "info", "If approved, the child is moved automatically. You will receive an in-app notification of the decision.");

  subSection(ctx, "4.5", "Birthday Widget");
  para(ctx, "The Birthdays tab on My Class shows all children in the ministry (not just your class) who have birthdays in the next 30 days. This gives you advance notice to:");
  bullet(ctx, [
    "Prepare a birthday card or small celebration.",
    "Inform the parent their child will be celebrated on Sunday.",
    "Coordinate with admin for any special ministry birthday acknowledgement.",
  ]);

  subSection(ctx, "4.6", "Substitute Requests");
  para(ctx, "If you are unable to attend a scheduled service, submit a Substitute Request so admin can arrange cover in advance.");
  step(ctx, 1, "Go to Substitute Requests in the sidebar.");
  step(ctx, 2, "Click "New Request".");
  step(ctx, 3, "Select the service date you need cover for.");
  step(ctx, 4, "Write a reason (e.g., travel, illness, family commitment).");
  step(ctx, 5, "Click "Submit Request".");
  step(ctx, 6, "The admin will assign a substitute and you will see the status update to \"Assigned\" or \"Confirmed\".");
  callout(ctx, "warning", "Submit substitute requests as early as possible — ideally at least one week before the service date — to give admin enough time to arrange cover.");
  addPageFooter();
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 5 — ATTENDANT
// ════════════════════════════════════════════════════════════════════════════
function section5() {
  const ctx: SubCtx = { y: sectionHeader("5", "Attendant") };
  roleTag(ctx, ["Attendant"]);
  para(ctx, "Attendants operate the check-in and check-out kiosks at the front entrance of the children's area. Their job is to securely admit children at the start of a service and release them only to authorised parents or verified delegates at the end.");

  subSection(ctx, "5.1", "Check-In Kiosk");
  para(ctx, "Three check-in methods are supported:");
  bullet(ctx, [
    "QR Code Scan: The parent presents their family QR code (from their Shepherd Connect app or printed from the child's profile). The system checks in all children linked to that family for the current service.",
    "Manual Search: Search for a child by name and click "Check In" on their card.",
    "Face Recognition: Position the child in front of the camera. The system identifies the child from their enrolled face descriptor and checks them in automatically.",
  ]);
  step(ctx, 1, "Open the Check-In page from the sidebar or bottom tab bar.");
  step(ctx, 2, "Select the service slot (7am, 9am, 11am, or 1pm).");
  step(ctx, 3, "Choose a check-in method: QR, Manual, or Face Recognition.");
  step(ctx, 4, "For QR: Point the camera at the parent's QR code. For Manual: type the child's name in the search box and tap "Check In".");
  step(ctx, 5, "A success confirmation card appears with the child's name, class, and any allergy alerts.");
  callout(ctx, "important", "If an allergy alert appears (shown in red), verbally confirm the allergy with the parent and ensure the class teacher is notified. Allergy alerts are also shown on the child's profile visible to teachers.");

  subSection(ctx, "5.2", "Standard Check-Out");
  para(ctx, "At the end of service, children are released to their registered parent or guardian.");
  step(ctx, 1, "Open the Check-Out page → Standard Checkout tab.");
  step(ctx, 2, "Search for the child by name using the search box.");
  step(ctx, 3, "Verify the identity of the adult collecting the child visually or by asking for a name.");
  step(ctx, 4, "Click "Check Out" on the correct child record.");
  step(ctx, 5, "The child's status updates to "Picked Up" and the parent receives a notification.");
  para(ctx, "The Service Clock at the top of the page shows countdown to service end. At T−10 minutes, all parents of checked-in children are automatically notified via a pre-dismissal alert.");
  callout(ctx, "tip", "Set the service end time at the beginning of the service using the clock icon in the Service Clock bar. This enables the automatic pre-dismissal notification.");

  subSection(ctx, "5.3", "Delegate OTP Check-Out");
  para(ctx, "When a child is being collected by someone other than their registered parent, the Delegate OTP system is used to verify authority.");
  step(ctx, 1, "Ask the delegate for their 6-digit OTP code (provided by the parent in their Shepherd Connect app).");
  step(ctx, 2, "Open the Check-Out page → "Delegate OTP Checkout" tab.");
  step(ctx, 3, "Enter the 6-digit OTP in the input field.");
  step(ctx, 4, "Click "Verify OTP".");
  step(ctx, 5, "The system confirms which child the OTP belongs to and who the delegate is.");
  step(ctx, 6, "Visually verify the delegate's identity matches the name shown.");
  step(ctx, 7, "Click "Check Out" to release the child.");
  callout(ctx, "important", "OTP codes are single-use and valid for 24 hours only. If an OTP fails verification, do NOT release the child. Contact the parent directly via phone before taking any action. Never release a child to an unverified individual.");
  addPageFooter();
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 6 — PARENT
// ════════════════════════════════════════════════════════════════════════════
function section6() {
  const ctx: SubCtx = { y: sectionHeader("6", "Parent") };
  roleTag(ctx, ["Parent"]);
  para(ctx, "Parents use Shepherd Connect to stay connected with their children's church journey — viewing attendance, reading appraisals, managing delegates, and communicating with teachers.");

  subSection(ctx, "6.1", "My Family");
  para(ctx, "My Family is your household dashboard. It shows:");
  bullet(ctx, [
    "Your family name, Family Code, and emergency contact details.",
    "Parent 1 and Parent 2 information.",
    "All children linked to your family with their current class and a quick view of their last attendance.",
    "Family check-in QR code — tap to enlarge and present this at the check-in kiosk each Sunday.",
    ""Add Child" button — to register a new child under your family.",
  ]);
  step(ctx, 1, "Tap "Add Child" on the My Family page.");
  step(ctx, 2, "Enter the child's first name, last name, date of birth, and gender.");
  step(ctx, 3, "Select the appropriate class from the dropdown.");
  step(ctx, 4, "Optionally add allergy information and medical notes.");
  step(ctx, 5, "Tap "Add Child" to save.");
  callout(ctx, "info", "The class selected when adding a child is a request. An admin may adjust the placement based on age and capacity.");

  subSection(ctx, "6.2", "My Children & Consent Forms");
  para(ctx, "Tap any child's name from My Family, or navigate to My Children in the sidebar, to view their full profile. As a parent you can see:");
  bullet(ctx, [
    "Attendance history and pick-up rate.",
    "Appraisals written by teachers — celebrating milestones and noting areas for growth.",
    "Class Journey Timeline — a complete history of every class the child has been in.",
    "Allergy alerts and medical notes.",
    "Consent Forms — the five consent categories you can grant or revoke at any time.",
  ]);
  para(ctx, "Consent categories:");
  twoColInfo(ctx, [
    ["Photography & Video",         "Permission to photograph/video your child during ministry activities."],
    ["Emergency Medical Treatment", "Permission to seek emergency medical treatment on your behalf."],
    ["Off-site Trips & Outings",    "Permission for your child to participate in ministry trips."],
    ["Social Media Sharing",        "Permission to share your child's image on ministry social media."],
    ["Emergency Contact Authority", "Permission for designated contacts to act in an emergency."],
  ]);
  callout(ctx, "info", "Consent can be updated at any time. Changes take effect immediately and the timestamp of each grant is recorded for audit purposes.");

  subSection(ctx, "6.3", "Pickup Delegates & OTP");
  para(ctx, "If someone other than yourself (spouse, grandparent, older sibling, trusted friend) will collect your child, you must register them as a Pickup Delegate before the service.");
  step(ctx, 1, "Navigate to Pickup Delegates in the sidebar.");
  step(ctx, 2, "Tap "Add Delegate".");
  step(ctx, 3, "Enter the delegate's full name, their relationship to your child, and their phone number.");
  step(ctx, 4, "Select which child(ren) the delegate is authorised to collect.");
  step(ctx, 5, "Tap "Add Delegate". A 6-digit OTP is generated and shown ONCE — copy it immediately.");
  step(ctx, 6, "Share the OTP with your delegate. They must present this code at the check-out kiosk.");
  callout(ctx, "important", "The OTP is displayed only once at the moment of creation. If your delegate loses it, you must delete the delegate entry and add them again to generate a new OTP. OTPs expire after 24 hours.");

  subSection(ctx, "6.4", "Class Change Requests");
  para(ctx, "If you feel your child would be better placed in a different class — for example, due to age progression, learning needs, or a sibling connection — submit a Class Change Request.");
  step(ctx, 1, "Navigate to Class Changes in the sidebar.");
  step(ctx, 2, "Tap "New Request".");
  step(ctx, 3, "Select your child and the desired class.");
  step(ctx, 4, "Provide a clear reason for the request.");
  step(ctx, 5, "Submit — an admin will review and notify you of the outcome via in-app notification.");

  subSection(ctx, "6.5", "Messages");
  para(ctx, "The Messages feature enables direct private communication between parents and teachers or ministry staff.");
  step(ctx, 1, "Navigate to Messages in the sidebar.");
  step(ctx, 2, "Tap "New Message".");
  step(ctx, 3, "Select the recipient (a teacher, admin, or attendant) from the dropdown.");
  step(ctx, 4, "Optionally tag a specific child the message relates to.");
  step(ctx, 5, "Write your subject and message body.");
  step(ctx, 6, "Tap "Send Message".");
  para(ctx, "Your inbox shows all messages received. Unread messages appear with a blue dot. Tap a message to read it in full and reply.");

  subSection(ctx, "6.6", "Feedback");
  para(ctx, "The Feedback page lets you rate your service experience and leave comments. Your feedback is reviewed by admins and analysed for overall ministry sentiment.");
  bullet(ctx, [
    "Rate overall satisfaction from 1 (poor) to 5 (excellent).",
    "Rate the check-in experience, teacher interaction, and facility cleanliness.",
    "Leave an optional comment or prayer request.",
    "Submit anonymously if you prefer — the anonymous option removes your name from admin reports.",
  ]);
  callout(ctx, "tip", "Your feedback is read personally by ministry leadership. If you have a concern that needs an immediate response, use the Messages feature to contact an admin directly.");
  addPageFooter();
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 7 — MESSAGING SYSTEM
// ════════════════════════════════════════════════════════════════════════════
function section7() {
  const ctx: SubCtx = { y: sectionHeader("7", "Messaging System") };
  roleTag(ctx, ["Super Admin", "Admin", "Teacher", "Parent\"]);
  para(ctx, "The Messaging System provides secure, two-way private messaging between parents, teachers, and ministry staff. All messages are stored in the platform and only visible to the sender and recipient.");

  bullet(ctx, [
    "Inbox: All messages received, sorted by date. Unread messages are shown in bold with a blue indicator dot.",
    "Sent: All messages you have sent.",
    "Unread count badge: Shown on the Messages nav link so you never miss a message.",
    "Reply: Open any message and tap "Reply" to send a response — the subject is pre-filled.",
    "Trash: Delete messages you no longer need from either tab.",
  ]);

  para(ctx, "Composing a message:");
  step(ctx, 1, "Tap "New Message" from the Messages page header.");
  step(ctx, 2, "Select a recipient — the list shows all users you are permitted to message.");
  step(ctx, 3, "Optionally link the message to a specific child (useful when discussing a child's progress).");
  step(ctx, 4, "Enter an optional subject line.");
  step(ctx, 5, "Write your message in the body field.");
  step(ctx, 6, "Tap "Send Message".");

  callout(ctx, "info", "Messages are not yet pushed as SMS or email — they are in-app only. Recipients see a notification badge when a new message arrives. Remind recipients to check the app if urgent.");
  callout(ctx, "important", "All messages are logged in the audit trail. Use professional, respectful language at all times. Do not share sensitive personal information (e.g., home addresses, financial details) via the messaging system.");
  addPageFooter();
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 8 — NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════
function section8() {
  const ctx: SubCtx = { y: sectionHeader("8", "Notifications") };
  para(ctx, "The Notifications page shows all system alerts sent to your account. The bell icon in the top-right header shows a count of unread notifications.");

  para(ctx, "Types of notifications you may receive:");
  bullet(ctx, [
    "Check-In Confirmation — Sent to parents when their child is checked in at the front desk.",
    "Check-Out Confirmation — Sent to parents when their child is picked up.",
    "Pre-Dismissal Alert — Sent to all parents of children currently in class 10 minutes before service end.",
    "Late Pickup Alert — Sent to parents if their child is still in church after an extended period.",
    "Class Change Decision — Notifies the requester when their class change request is approved or rejected.",
    "Account Approval / Rejection — Sent to new teachers and admins when their account is approved or rejected.",
    "Broadcast Messages — Sent by admins to specific roles (all parents, all teachers, etc.).",
    "Appraisal Added — Notifies parents when a new appraisal is written for their child.",
    "Emergency Alert — Sent to relevant staff when an emergency is logged.",
  ]);

  step(ctx, 1, "Tap the bell icon in the top-right header.");
  step(ctx, 2, "A dropdown panel shows your most recent unread notifications.");
  step(ctx, 3, "Click "View All" to go to the full Notifications page.");
  step(ctx, 4, "Click a notification to mark it as read.");
  step(ctx, 5, "Use the filter to show only Unread notifications.");

  callout(ctx, "tip", "Admins can send broadcast notifications from the Notifications admin page. Use \"Pre-Dismissal Notify\" on the Check-Out page to send an immediate alert to all parents of currently checked-in children.");
  addPageFooter();
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 9 — PROFILE & SETTINGS
// ════════════════════════════════════════════════════════════════════════════
function section9() {
  const ctx: SubCtx = { y: sectionHeader("9", "Profile & Settings") };
  para(ctx, "Every user has a personal profile accessible from the "My Profile" link at the bottom of the sidebar, or by tapping the avatar circle in the top-right corner.");

  para(ctx, "Your profile contains:");
  bullet(ctx, [
    "Profile completeness progress bar — shows what percentage of your profile is filled in.",
    "Personal details: first name, last name, date of birth, gender.",
    "Contact information: phone number, place of work.",
    "Profile photo URL — link to your profile photo (hosted externally).",
    "Communication preferences: toggle in-app notifications, WhatsApp alerts, and SMS on or off.",
  ]);

  step(ctx, 1, "Go to My Profile in the sidebar.");
  step(ctx, 2, "Click "Edit Profile".");
  step(ctx, 3, "Update any fields you wish to change.");
  step(ctx, 4, "Click "Save Changes".");

  para(ctx, "Communication preferences:");
  twoColInfo(ctx, [
    ["In-App",    "Receive notifications inside the Shepherd Connect app. Recommended: ON."],
    ["WhatsApp",  "Receive notifications via WhatsApp (requires WhatsApp integration — contact admin)."],
    ["SMS",       "Receive notifications via SMS (requires SMS integration — contact admin)."],
  ]);

  callout(ctx, "tip", "Completing your profile to 100% helps admin and teachers identify you at the door. A profile photo is particularly useful for delegate verification and teacher identification.");
  callout(ctx, "info", "To change your password or email address, contact the Super Admin. These fields cannot be updated from the profile page for security reasons.");
  addPageFooter();
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 10 — SECURITY & SAFEGUARDING
// ════════════════════════════════════════════════════════════════════════════
function section10() {
  const ctx: SubCtx = { y: sectionHeader("10", "Security & Safeguarding") };
  para(ctx, "Shepherd Connect is built with child safety as its primary design principle. This section describes the security measures in place and the responsibilities of all platform users.");

  subSection(ctx, "10.1", "Platform Security");
  bullet(ctx, [
    "All data is transmitted over HTTPS (TLS encryption) — your connection is always encrypted.",
    "Passwords are stored using bcrypt hashing — plain-text passwords are never stored.",
    "Authentication uses signed JWT tokens that expire and must be refreshed.",
    "Role-Based Access Control (RBAC) ensures users can only access data appropriate to their role.",
    "Every sensitive action is recorded in the Audit Log with a timestamp and user ID.",
    "OTP codes for delegate pickup are cryptographically random 6-digit codes valid for 24 hours only.",
  ]);

  subSection(ctx, "10.2", "Child Protection Responsibilities");
  callout(ctx, "important", "Every adult using this platform who works with children must hold a valid DBS (Disclosure and Barring Service) Enhanced check. No adult should be alone with a child without a valid DBS clearance on record in the Safeguarding page.");
  bullet(ctx, [
    "Never share your login credentials with another person.",
    "Log out of the app on shared devices immediately after your session.",
    "Do not photograph or video any child using a personal device during ministry activities.",
    "Report any safeguarding concern immediately using the Emergency Report function.",
    "If in doubt about releasing a child to any adult — verified or not — contact the parent directly first.",
    "Never release a child to someone who cannot provide a valid OTP or who is not on the registered parent list.",
  ]);

  subSection(ctx, "10.3", "Data Protection");
  bullet(ctx, [
    "All personal data is held in accordance with the principles of the Nigeria Data Protection Act (NDPA) and GDPR guidelines.",
    "Family and child data is accessible only to authorised ministry staff on a need-to-know basis.",
    "Do not export reports and share them via unencrypted channels (e.g., WhatsApp groups, email without encryption).",
    "Contact the Super Admin to request data deletion or amendment under your rights as a data subject.",
  ]);

  callout(ctx, "warning", "Misuse of child data or any breach of the platform's security controls is a disciplinary matter and may be referred to statutory authorities. All access is logged.");
  addPageFooter();
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 11 — FAQ
// ════════════════════════════════════════════════════════════════════════════
function section11() {
  const ctx: SubCtx = { y: sectionHeader("11", "Frequently Asked Questions") };

  const faqs: [string, string][] = [
    [
      "I cannot log in. What should I do?",
      "Check you are using the correct email and password. If your account is Teacher or Admin, it may be pending approval — wait for the Super Admin to approve it. If you have forgotten your password, contact the Super Admin to reset it.",
    ],
    [
      "The QR code scan is not working at check-in. What should I do?",
      "Ensure the camera has permission to access the device camera in your browser settings. Try cleaning the camera lens and ensuring the QR code is not damaged or screen-protected. As a fallback, use Manual Search by typing the child's name.",
    ],
    [
      "My child's allergy information is not showing. How do I add it?",
      "Go to My Family, tap the child's name to open their profile, and then tap "Edit". Add the allergy in the Allergies field. The allergy alert will appear prominently on the check-in confirmation and on the child's profile for all staff.",
    ],
    [
      "I forgot to give the delegate their OTP. Can I retrieve it?",
      "No — the OTP is shown only once for security reasons. Delete the delegate entry and add them again to generate a fresh OTP.",
    ],
    [
      "A teacher has not confirmed their allocation. What should I do?",
      "Contact the teacher directly. If they cannot attend, prompt them to submit a Substitute Request. Admins can also update the allocation status manually from the Teacher Allocations page.",
    ],
    [
      "The attendance report is missing records. Why?",
      "Check the date range filter in the Custom Report Builder. Also verify that the correct service slot filter is applied — filtering by a specific slot (e.g., 9am) will exclude records from other slots.",
    ],
    [
      "How do I deactivate a user who is no longer serving?",
      "Go to Users (Super Admin only) → find the user → click the toggle to set their status to \"Inactive\". They will immediately be unable to log in but their historical data is preserved.",
    ],
    [
      "Can parents see the Safeguarding & DBS records?",
      "No. The Safeguarding & DBS page is accessible only to Super Admin and Admin roles. Parents cannot view DBS records.",
    ],
    [
      "The pre-dismissal notification didn't send automatically. Why?",
      "The automatic pre-dismissal alert only fires if a service end time has been set in the Service Clock bar on the Check-Out page. If no end time is set, the automatic alert does not trigger. Use the manual "Notify Parents Now" button instead.",
    ],
    [
      "How do I export attendance data for a specific class only?",
      "Go to Reports → Custom Builder → select \"Attendance Log\" as the report type → choose the class from the Class dropdown → set your date range → click \"Generate\" → then export as CSV or PDF.",
    ],
    [
      "A parent says they received a notification but didn't act on it. Can I resend it?",
      "Go to Notifications (admin) and use the Broadcast function to send a new notification to the specific parent. Alternatively, call the parent directly using the phone number on the family profile.",
    ],
    [
      "How is attendance rate calculated on a child's profile?",
      "The pickup rate shown on a child's profile is the percentage of check-in records where the child was successfully checked out (status = \"Picked Up\") versus total check-ins. A low pickup rate may indicate a pattern of late collection.",
    ],
  ];

  faqs.forEach(([q, a]) => {
    if (ctx.y > H - 140) {
      doc.addPage();
      addPageFooter();
      ctx.y = 40;
    }
    filledRoundRect(M, ctx.y, CW, 18, 4, "#eef2ff");
    doc.font("Helvetica-Bold").fontSize(10).fillColor(ROYAL_BLUE)
      .text(`Q: ${q}`, M + 10, ctx.y + 4, { width: CW - 20 });
    ctx.y += 22;
    doc.font("Helvetica").fontSize(9.5).fillColor(TEXT_MED)
      .text(a, M + 10, ctx.y, { width: CW - 20, lineGap: 2 });
    ctx.y += doc.heightOfString(a, { width: CW - 20 }) + 16;
  });

  addPageFooter();
}

// ════════════════════════════════════════════════════════════════════════════
// BACK COVER
// ════════════════════════════════════════════════════════════════════════════
function backCover() {
  doc.addPage();
  fillRect(0, 0, W, H, DARK_BLUE);
  fillRect(0, H - 6, W, 6, GOLD);
  fillRect(0, 0, W, 6, GOLD);

  // Decorative circles
  doc.save().circle(W - 80, 80, 180).opacity(0.05).fill(WHITE).restore();
  doc.save().circle(60, H - 100, 120).opacity(0.05).fill(WHITE).restore();

  const midY = H / 2 - 100;

  doc.font("Helvetica-Bold").fontSize(32).fillColor(WHITE)
    .text("Shepherd Connect", M, midY, { align: "center", width: CW });
  doc.font("Helvetica").fontSize(13).fillColor(GOLD)
    .text("Safe. Known. Celebrated.", M, midY + 44, { align: "center", width: CW });

  const lineY = midY + 76;
  doc.save().moveTo(W / 2 - 80, lineY).lineTo(W / 2 + 80, lineY).lineWidth(0.5).stroke(GOLD).restore();

  doc.font("Helvetica").fontSize(11).fillColor("rgba(255,255,255,0.7)")
    .text("RCCG City of David\nVictoria Island, Lagos, Nigeria\nChildren's Ministry Department", M, lineY + 16, { align: "center", width: CW, lineGap: 4 });

  doc.font("Helvetica").fontSize(9).fillColor("rgba(255,255,255,0.4)")
    .text(`Shepherd Connect User Guide v2.0 · May 2026\nThis document is confidential and intended for ministry use only.`, M, lineY + 80, { align: "center", width: CW, lineGap: 3 });
}

// ════════════════════════════════════════════════════════════════════════════
// BUILD THE DOCUMENT
// ════════════════════════════════════════════════════════════════════════════
coverPage();
tableOfContents();
section1();
section2();
section3();
section4();
section5();
section6();
section7();
section8();
section9();
section10();
section11();
backCover();

doc.end();

doc.on("finish", () => {
  console.log(`✅ PDF written to ${OUTPUT_PATH}`);
  const stats = fs.statSync(OUTPUT_PATH);
  console.log(`   Size: ${(stats.size / 1024).toFixed(1)} KB · Pages: ${pageNum}`);
});
