import PDFDocument from '/home/runner/workspace/node_modules/.pnpm/pdfkit@0.18.0/node_modules/pdfkit/js/pdfkit.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.resolve(__dirname, '../../user-guide.pdf');

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  royalBlue : '#1e3a8a',
  gold      : '#f59e0b',
  darkBlue  : '#172554',
  midBlue   : '#3b82f6',
  softGray  : '#f8fafc',
  borderGray: '#e2e8f0',
  textDark  : '#111827',
  textMed   : '#374151',
  textLight : '#6b7280',
  white     : '#ffffff',
  green     : '#15803d',
  amber     : '#b45309',
  red       : '#dc2626',
  indigo50  : '#eef2ff',
};

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  info: {
    Title: 'Shepherd Connect User Guide',
    Author: 'RCCG City of David – Children\'s Ministry',
    Subject: 'Complete platform user guide',
    CreationDate: new Date(),
  },
});

doc.pipe(fs.createWriteStream(OUTPUT));

const W = 595.28;
const H = 841.89;
const M = 48;
const CW = W - M * 2;

let pageNum = 0;
doc.on('pageAdded', () => { pageNum++; });

// ── Primitives ────────────────────────────────────────────────────────────────
const fillR   = (x,y,w,h,c)         => doc.save().rect(x,y,w,h).fill(c).restore();
const rndR    = (x,y,w,h,r,c)       => doc.save().roundedRect(x,y,w,h,r).fill(c).restore();
const strokeR = (x,y,w,h,r,c,lw=1) => doc.save().roundedRect(x,y,w,h,r).lineWidth(lw).stroke(c).restore();

function footer() {
  if (pageNum === 0) return;
  const y = H - 32;
  fillR(0, y-4, W, 36, C.softGray);
  doc.save().moveTo(M,y-4).lineTo(W-M,y-4).lineWidth(0.4).stroke(C.borderGray).restore();
  doc.font('Helvetica').fontSize(8).fillColor(C.textLight)
    .text('Shepherd Connect \u2013 RCCG City of David, Victoria Island', M, y+4, { align:'left',  width: CW/2 })
    .text(`Page ${pageNum}  |  Confidential \u2013 Ministry Use Only`,   M+CW/2, y+4, { align:'right', width: CW/2 });
}

// ── Cover ─────────────────────────────────────────────────────────────────────
function cover() {
  fillR(0, 0, W, H*0.65, C.darkBlue);
  fillR(0, H*0.65, W, H*0.35, C.softGray);
  fillR(0, 0, W, 6, C.gold);
  // Decorative circles
  doc.save().circle(W-80,120,140).opacity(0.06).fill(C.white).restore();
  doc.save().circle(80,H*0.4,60).opacity(0.06).fill(C.white).restore();

  doc.font('Helvetica').fontSize(9).fillColor(C.gold)
    .text('THE REDEEMED CHRISTIAN CHURCH OF GOD', M, 88, { align:'center', width:CW, characterSpacing:2 });
  doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.55)')
    .text('City of David \u2013 Victoria Island, Lagos', M, 106, { align:'center', width:CW });

  doc.save().moveTo(W/2-60,128).lineTo(W/2+60,128).lineWidth(0.8).stroke(C.gold).restore();

  doc.font('Helvetica-Bold').fontSize(52).fillColor(C.white)
    .text('Shepherd', M, 164, { align:'center', width:CW });
  doc.font('Helvetica-Bold').fontSize(52).fillColor(C.gold)
    .text('Connect', M, 214, { align:'center', width:CW });
  doc.font('Helvetica').fontSize(15).fillColor('rgba(255,255,255,0.72)')
    .text('Safe.  Known.  Celebrated.', M, 276, { align:'center', width:CW });

  const bw = 230, bh = 34, bx = (W-bw)/2;
  rndR(bx, 314, bw, bh, 17, C.gold);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.darkBlue)
    .text('COMPLETE USER GUIDE', bx, 326, { align:'center', width:bw, characterSpacing:1 });

  doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.45)')
    .text('Version 2.0  \u00b7  May 2026  \u00b7  Confidential Ministry Document', M, 364, { align:'center', width:CW });

  const pills = ['Check-in / Out', 'Messaging', 'Reports', 'Safeguarding', 'Consent Forms'];
  let px = M;
  pills.forEach(label => {
    const tw = doc.font('Helvetica').fontSize(8).widthOfString(label);
    const pw = tw + 20;
    if (px + pw > W-M) return;
    rndR(px, 408, pw, 22, 11, 'rgba(255,255,255,0.10)');
    doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.75)')
      .text(label, px+10, 415, { width: pw-20 });
    px += pw + 8;
  });

  // White card
  const ct = H*0.65;
  rndR(M, ct+22, CW, 106, 12, C.white);
  strokeR(M, ct+22, CW, 106, 12, C.borderGray);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.royalBlue)
    .text('About This Guide', M+20, ct+38);
  doc.font('Helvetica').fontSize(10).fillColor(C.textMed)
    .text(
      'This is the official reference manual for all users of Shepherd Connect. It provides step-by-step instructions for every feature across all five user roles \u2013 Super Admin, Admin, Teacher, Attendant, and Parent.',
      M+20, ct+56, { width:CW-40, lineGap:3 }
    );

  // Role cards
  const roles = [
    { r:'Super Admin', c:C.red      },
    { r:'Admin',       c:C.royalBlue },
    { r:'Teacher',     c:C.green    },
    { r:'Attendant',   c:C.amber    },
    { r:'Parent',      c:C.midBlue  },
  ];
  let rx = M;
  const ry = ct+148;
  roles.forEach(({r, c}) => {
    const bw2 = (CW-16)/5;
    rndR(rx, ry, bw2, 56, 8, C.white);
    strokeR(rx, ry, bw2, 56, 8, C.borderGray);
    fillR(rx, ry, bw2, 6, c);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(c).text(r, rx+6, ry+14, { width:bw2-12 });
    rx += bw2+4;
  });

  fillR(0, H-46, W, 46, C.darkBlue);
  fillR(0, H-46, W, 2, C.gold);
  doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.45)')
    .text('RCCG City of David  \u00b7  Victoria Island, Lagos  \u00b7  Children\'s Ministry Department', M, H-26, { align:'center', width:CW });
}

// ── TOC ───────────────────────────────────────────────────────────────────────
function toc() {
  doc.addPage();
  fillR(0,0,W,80,C.royalBlue);
  fillR(0,0,W,5,C.gold);
  doc.font('Helvetica-Bold').fontSize(28).fillColor(C.white).text('Table of Contents', M, 28, { width:CW });

  let y = 106;

  const entries = [
    ['1.','Getting Started',false,'4'],
    ['1.1','System Overview',true,'4'],
    ['1.2','Logging In',true,'4'],
    ['1.3','Registering an Account',true,'5'],
    ['1.4','Navigation & Interface',true,'5'],
    ['2.','Super Admin',false,'6'],
    ['2.1','User Management & Approvals',true,'6'],
    ['2.2','Audit Logs',true,'7'],
    ['3.','Admin',false,'7'],
    ['3.1','Dashboard',true,'7'],
    ['3.2','Families',true,'8'],
    ['3.3','Children',true,'8'],
    ['3.4','Classes & Assignments',true,'9'],
    ['3.5','Teachers & Allocations',true,'9'],
    ['3.6','Emergencies',true,'10'],
    ['3.7','Safeguarding & DBS',true,'10'],
    ['3.8','Substitute Requests',true,'11'],
    ['3.9','Waitlist',true,'11'],
    ['3.10','Reports & Analytics',true,'12'],
    ['4.','Teacher',false,'13'],
    ['4.1','My Class',true,'13'],
    ['4.2','Attendance & Arrivals',true,'14'],
    ['4.3','Child Appraisals',true,'14'],
    ['4.4','Class Change Requests',true,'15'],
    ['4.5','Birthday Widget',true,'15'],
    ['4.6','Substitute Requests',true,'15'],
    ['5.','Attendant',false,'16'],
    ['5.1','Check-In Kiosk',true,'16'],
    ['5.2','Standard Check-Out',true,'17'],
    ['5.3','Delegate OTP Check-Out',true,'17'],
    ['6.','Parent',false,'18'],
    ['6.1','My Family',true,'18'],
    ['6.2','My Children & Consent Forms',true,'19'],
    ['6.3','Pickup Delegates & OTP',true,'19'],
    ['6.4','Class Change Requests',true,'20'],
    ['6.5','Messages',true,'20'],
    ['6.6','Feedback',true,'20'],
    ['7.','Messaging System',false,'21'],
    ['8.','Notifications',false,'22'],
    ['9.','Profile & Settings',false,'22'],
    ['10.','Security & Safeguarding',false,'23'],
    ['11.','Frequently Asked Questions',false,'24'],
  ];

  entries.forEach(([num, title, sub, pg]) => {
    if (y > H-100) { doc.addPage(); footer(); y = 50; }
    if (!sub) rndR(M-4, y-3, CW+8, 20, 4, C.indigo50);
    doc.font(sub ? 'Helvetica' : 'Helvetica-Bold')
       .fontSize(sub ? 10 : 11)
       .fillColor(sub ? C.textMed : C.royalBlue)
       .text(`${num}  ${title}`, M+(sub?14:0), y, { width:CW-40 });
    doc.font('Helvetica').fontSize(9).fillColor(C.textLight)
       .text(pg, W-M-28, y, { align:'right', width:28 });
    y += sub ? 18 : 22;
    if (!sub) y += 2;
  });
  footer();
}

// ── Section helpers ───────────────────────────────────────────────────────────
function sectionPage(num, title) {
  doc.addPage(); footer();
  fillR(0,0,W,80,C.royalBlue);
  fillR(0,0,W,5,C.gold);
  rndR(M,18,36,36,8,C.gold);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.darkBlue).text(num, M, 31, { width:36, align:'center' });
  doc.font('Helvetica-Bold').fontSize(24).fillColor(C.white).text(title, M+46, 26, { width:CW-46 });
  return 100;
}

const ctx = { y: 100 };

function checkPage(extra=100) {
  if (ctx.y > H-extra) { doc.addPage(); footer(); ctx.y = 40; }
}

function sub(num, title) {
  checkPage(130);
  ctx.y += 10;
  rndR(M, ctx.y, CW, 26, 6, '#eff6ff');
  strokeR(M, ctx.y, 4, 26, 2, C.royalBlue, 3);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(C.royalBlue)
    .text(`${num}  ${title}`, M+14, ctx.y+7, { width:CW-20 });
  ctx.y += 34;
}

function para(text, indent=0) {
  checkPage(80);
  doc.font('Helvetica').fontSize(10).fillColor(C.textMed)
    .text(text, M+indent, ctx.y, { width:CW-indent, lineGap:3 });
  ctx.y += doc.heightOfString(text, { width:CW-indent }) + 10;
}

function bullets(items, indent=0) {
  items.forEach(item => {
    checkPage(60);
    doc.font('Helvetica').fontSize(9).fillColor(C.gold).text('\u25b8', M+indent, ctx.y, { width:12 });
    doc.font('Helvetica').fontSize(9.5).fillColor(C.textDark)
      .text(item, M+indent+14, ctx.y, { width:CW-indent-14, lineGap:2 });
    ctx.y += doc.heightOfString(item, { width:CW-indent-14 }) + 7;
  });
}

function step(n, text) {
  checkPage(60);
  rndR(M, ctx.y, 22, 22, 11, C.royalBlue);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.white).text(String(n), M, ctx.y+6, { width:22, align:'center' });
  doc.font('Helvetica').fontSize(10).fillColor(C.textDark)
    .text(text, M+30, ctx.y+5, { width:CW-30, lineGap:2 });
  ctx.y += Math.max(26, doc.heightOfString(text, { width:CW-30 }) + 14);
}

function callout(type, text) {
  checkPage(90);
  const map = {
    info:      { bg:'#eff6ff', bdr:C.midBlue,   icon:'\u2139', label:'Note',      tc:'#1e40af' },
    warning:   { bg:'#fff7ed', bdr:C.amber,      icon:'\u26a0', label:'Warning',   tc:'#92400e' },
    tip:       { bg:'#f0fdf4', bdr:C.green,      icon:'\u2713', label:'Tip',       tc:'#14532d' },
    important: { bg:'#fef2f2', bdr:C.red,        icon:'!',      label:'Important', tc:'#991b1b' },
  };
  const cfg = map[type];
  const h2 = doc.heightOfString(text, { width:CW-44 }) + 30;
  rndR(M, ctx.y, CW, h2, 8, cfg.bg);
  fillR(M, ctx.y, 4, h2, cfg.bdr);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(cfg.bdr)
    .text(`${cfg.icon}  ${cfg.label}`, M+12, ctx.y+10);
  doc.font('Helvetica').fontSize(9.5).fillColor(cfg.tc)
    .text(text, M+12, ctx.y+26, { width:CW-22, lineGap:2 });
  ctx.y += h2+12;
}

function twoCol(pairs) {
  const cw = (CW-12)/2;
  pairs.forEach(([label, value]) => {
    checkPage(50);
    rndR(M, ctx.y, CW, 22, 4, C.softGray);
    strokeR(M, ctx.y, CW, 22, 4, C.borderGray);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.textLight)
      .text(label, M+10, ctx.y+6, { width:cw-10 });
    doc.font('Helvetica').fontSize(9.5).fillColor(C.textDark)
      .text(value, M+cw+10, ctx.y+6, { width:cw-10 });
    ctx.y += 26;
  });
  ctx.y += 6;
}

function roleTags(roles) {
  const colorMap = { 'Super Admin':C.red, 'Admin':C.royalBlue, 'Teacher':C.green, 'Attendant':C.amber, 'Parent':C.midBlue };
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.textLight).text('Accessible by:', M, ctx.y);
  ctx.y += 16;
  let rx = M;
  roles.forEach(r => {
    const color = colorMap[r]||C.royalBlue;
    const tw = doc.font('Helvetica-Bold').fontSize(8).widthOfString(r);
    const pw = tw+14;
    rndR(rx, ctx.y, pw, 18, 9, color);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white).text(r, rx+7, ctx.y+5, { width:pw-14 });
    rx += pw+6;
  });
  ctx.y += 26;
}

function faq(q, a) {
  checkPage(120);
  rndR(M, ctx.y, CW, 18, 4, C.indigo50);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.royalBlue)
    .text(`Q:  ${q}`, M+10, ctx.y+4, { width:CW-20 });
  ctx.y += 22;
  doc.font('Helvetica').fontSize(9.5).fillColor(C.textMed)
    .text(a, M+10, ctx.y, { width:CW-20, lineGap:2 });
  ctx.y += doc.heightOfString(a, { width:CW-20 }) + 16;
}

// ── SECTION 1 — Getting Started ───────────────────────────────────────────────
function s1() {
  ctx.y = sectionPage('1','Getting Started');

  sub('1.1','System Overview');
  para('Shepherd Connect is a full-stack, mobile-first church children\'s ministry management platform built exclusively for RCCG City of David, Victoria Island. It digitises every aspect of the children\'s church workflow \u2013 from family registration and Sunday check-in through to appraisals, safeguarding records, and parent-teacher messaging.');
  bullets([
    'Five role-based access levels ensure each user sees only what is relevant to their responsibility.',
    'Real-time attendance tracking with QR code and face recognition check-in.',
    'Automated notifications keep parents informed at every stage of the service.',
    'PDF and CSV exports for all key reports with professional branded layouts.',
    'Multi-language support: English, Yoruba, Igbo, Hausa, Pidgin, and French.',
  ]);

  sub('1.2','Logging In');
  para('Navigate to the Shepherd Connect URL provided by your administrator. The login screen presents four quick-select buttons (Parent, Teacher, Admin, Attendant) to pre-fill the correct demo credentials, or you may type your own.');
  step(1,'Open the Shepherd Connect web address in your browser.');
  step(2,'Enter your registered email address in the Email field.');
  step(3,'Enter your password in the Password field.');
  step(4,'Tap or click the blue "Enter the House" button to log in.');
  step(5,'You will be redirected automatically to the correct dashboard for your role.');
  callout('important','If your account was self-registered as Admin or Teacher, it must be approved by the Super Admin before you can log in. You will see a pending-approval message. Contact the ministry admin if approval is delayed.');
  twoCol([
    ['Super Admin','superadmin@shepherd.com  /  admin123'],
    ['Admin','admin@shepherd.com  /  admin123'],
    ['Teacher','teacher1@shepherd.com  /  teacher123'],
    ['Attendant','attendant@shepherd.com  /  attend123'],
    ['Parent','parent1@shepherd.com  /  parent123'],
  ]);

  sub('1.3','Registering an Account');
  para('New users not yet in the system can self-register from the login screen.');
  step(1,'Tap "Register here" on the login page.');
  step(2,'Fill in your first name, last name, email address, and a strong password.');
  step(3,'Select your role from the dropdown: Parent, Teacher, or Attendant.');
  step(4,'Tap "Create Account".');
  callout('info','Parents are activated immediately. Teachers and Admin accounts are placed in Pending Approval status and cannot log in until the Super Admin approves them.');

  sub('1.4','Navigation & Interface');
  para('The interface has three main areas: Sidebar (desktop) with all role-specific navigation links; Top bar with the global search, notification bell and profile avatar; and Bottom tab bar (mobile, for parents and teachers) giving thumb-friendly access to the four most-used pages.');
  callout('tip','The language switcher is at the bottom of the sidebar. It updates all labels and text instantly without a page reload.');
}

// ── SECTION 2 — Super Admin ───────────────────────────────────────────────────
function s2() {
  ctx.y = sectionPage('2','Super Admin');
  roleTags(['Super Admin']);
  para('The Super Admin has unrestricted access to every platform feature, including all Admin capabilities plus exclusive access to User Management and the Audit Logs. There should be only one Super Admin account per ministry.');

  sub('2.1','User Management & Approvals');
  para('Navigate to Users in the sidebar. The page has two tabs: All Users (a searchable table of every registered account) and Pending Approval (accounts submitted by Teachers or Admins awaiting activation).');
  step(1,'Navigate to Users in the sidebar.');
  step(2,'Click the "Pending Approval" tab.');
  step(3,'Review the applicant\'s details: name, role, email, and registration date.');
  step(4,'Click "Approve" to activate the account or "Reject" to deny it.');
  step(5,'The user receives an in-app notification of the outcome immediately.');
  callout('warning','Rejected accounts are permanently blocked. The user must register again with a new email address. There is no way to reverse a rejection.');
  para('On the All Users tab you can: search by name or email, filter by role, toggle a user\'s active/inactive status, and view their full profile.');

  sub('2.2','Audit Logs');
  para('The Audit Log records every significant action in the system with a timestamp and the responsible user. This page is read-only and cannot be cleared.');
  bullets([
    'Filter by action type, date range, or user to narrow results.',
    'Each entry shows: timestamp, performing user, action description, and affected record.',
    'Common logged events: check-ins, check-outs, delegate additions, approvals, emergencies, class changes.',
    'Use the Custom Report Builder in Reports if you need to export filtered audit data.',
  ]);
  callout('tip','Use Audit Logs to investigate any disputed check-in, late pickup, or data change. Every entry is timestamped to the second and cannot be altered.');
}

// ── SECTION 3 — Admin ─────────────────────────────────────────────────────────
function s3() {
  ctx.y = sectionPage('3','Admin');
  roleTags(['Admin','Super Admin']);
  para('The Admin role has broad operational access covering family and child management, class administration, teacher scheduling, reports, safeguarding, messaging, and more.');

  sub('3.1','Dashboard');
  para('The Dashboard is your ministry command centre, displaying live statistics for the current service day:');
  bullets([
    'Daily Summary Card: Children checked in, in class, and already picked up \u2013 updated in real time.',
    'Not Picked Up Alert: A red alert card appears if any children have not been collected.',
    'Teacher-to-Child Ratio: Visual indicators for each class showing whether staffing levels are acceptable.',
    'Recent Activity Feed: The last 10 check-in/check-out events across all classes.',
    'Feedback Sentiment: AI-powered summary of parent feedback (positive, neutral, negative).',
    'Quick Actions: Shortcut buttons to Families, Children, Attendance, and Reports.',
  ]);

  sub('3.2','Families');
  para('The Families page lists every registered family with their unique Family Code, parent names, contact details, and child count. Click a family card to open the full Family Profile, which shows both parents, the emergency contact, all linked children with their classes, and the family check-in QR code.');

  sub('3.3','Children');
  para('Children is the master register of every enrolled child. Each child profile is the central record linking attendance, appraisals, class journey, medical information, and consent forms.');
  bullets([
    'Search and filter by name, class, or age group from the list view.',
    'The prominent allergy alert banner (red) on a child\'s profile is shown to all staff who view the record.',
    'Consent Forms: five categories (Photography, Emergency Medical, Trips, Social Media, Emergency Contact) with grant/revoke controls.',
    'Class Journey Timeline: a complete visual history of all class changes for the child.',
    'Face Enrollment: enrol or update a child\'s face descriptor for contactless check-in.',
  ]);
  callout('important','Deleting a child removes ALL their attendance, appraisal, and delegate records permanently. This cannot be undone. Only Admins and Super Admins can perform this action.');

  sub('3.4','Classes & Assignments');
  twoCol([
    ['Toddlers','Ages 0\u20133 \u2013 Nursery'],
    ['Beginners','Ages 4\u20136 \u2013 Foundation class'],
    ['Primary','Ages 7\u201310 \u2013 Junior school level'],
    ['Juniors','Ages 11\u201312 \u2013 Pre-teen level'],
  ]);
  para('Class Assignments maps children to classes. Use this page to view current membership, manually assign or reassign a child, and see unassigned children who need placement.');
  callout('tip','When a Class Change Request is approved by an admin, the child is moved automatically. You do not need to manually update Class Assignments for approved requests.');

  sub('3.5','Teachers & Allocations');
  para('Teachers lists all users with the Teacher role, their profile completeness, linked class, and DBS status summary. Teacher Allocations is the scheduling table \u2013 for each service date and slot it shows which teacher is assigned to which class and room, and their confirmation status.');
  step(1,'Navigate to Teacher Allocations.');
  step(2,'Select the service date using the date picker.');
  step(3,'Review allocation rows: teacher, class, room, slot, and status (Pending / Confirmed).');
  step(4,'Use the "Add Allocation" button to schedule a teacher for a new slot.');
  step(5,'Teachers confirm their own allocations from their My Class page.');

  sub('3.6','Emergencies');
  para('The Emergencies page logs and tracks any safeguarding incident, medical event, or urgent situation during a service.');
  step(1,'Click "Report Emergency" (red button in the header area).');
  step(2,'Select the affected child from the dropdown.');
  step(3,'Choose the incident type: Medical, Safeguarding, Fire, Security, or Other.');
  step(4,'Enter a detailed description of the incident.');
  step(5,'Set the severity: Low, Medium, High, or Critical.');
  step(6,'Click "Submit Emergency Report" to log it immediately.');
  para('Once submitted, admins can add follow-up updates, mark it resolved, and export the full log as CSV or PDF.');
  callout('important','All emergency reports are retained permanently in the audit log. Never delete an emergency record, even after resolution.');

  sub('3.7','Safeguarding & DBS');
  para('The Safeguarding & DBS page maintains a centralised record of all background checks and safeguarding certifications for every teacher and volunteer.');
  step(1,'Navigate to Safeguarding & DBS in the sidebar.');
  step(2,'Click "Add Record".');
  step(3,'Select the teacher from the dropdown.');
  step(4,'Choose the check type: DBS Enhanced, DBS Standard, DBS Basic, Safeguarding Training, or First Aid.');
  step(5,'Enter the reference number, issued date, and expiry date.');
  step(6,'Set the status: Clear, Pending, Expired, or Not Submitted.');
  step(7,'Click "Add Record" to save.');
  bullets([
    'Clear (green): DBS is valid and active.',
    'Pending (amber): Application submitted, result awaited.',
    'Expired (red): DBS has passed its expiry date. A red alert banner appears at the page top.',
    'Not Submitted (grey): No DBS application on file \u2013 action required immediately.',
  ]);
  callout('warning','Do not allow any volunteer to work with children if their DBS shows Expired or Not Submitted. An amber warning auto-appears for checks expiring within 30 days.');

  sub('3.8','Substitute Requests');
  para('Substitute Requests allows teachers to formally notify administration when they cannot attend a scheduled service and need cover arranged.');
  step(1,'Navigate to Substitute Requests in the sidebar.');
  step(2,'Review pending requests: requesting teacher, class, service date, and reason.');
  step(3,'Click "Assign Cover" to open the assignment panel.');
  step(4,'Select a substitute teacher from the dropdown and optionally add admin notes.');
  step(5,'Click "Assign". Status changes to Assigned.');
  step(6,'Once the substitute confirms attendance, click "Confirm" to finalise.');
  callout('tip','A pending count badge on the page header shows how many requests need attention. Check this each week before the service date.');

  sub('3.9','Waitlist');
  para('The Waitlist manages children whose preferred class is at capacity. Admins can promote children from the waitlist into a Class Assignment, or reject their request with a parent notification. The list is sorted first-in-first-out by date added.');

  sub('3.10','Reports & Analytics');
  para('The Reports module has six views:');
  bullets([
    'Live Reports: Real-time view of who is in church, who has not been collected, and teacher-to-child ratios.',
    'Export Data: Generate dated PDF and CSV exports of attendance, feedback, emergency logs, teacher schedules, and the family registry.',
    'Analytics: Pie charts and bar graphs for class distribution, feedback sentiment, class utilisation, and teacher schedule.',
    'Trends: Weekly attendance line charts and class-level bar charts over 4, 8, 12, or 24 weeks.',
    'Room Heatmap: Visual occupancy grid showing headcount per room per slot for a selected date.',
    'Custom Builder: Fully configurable report with seven report types, date range, class, slot, teacher, and family filters \u2013 export to PDF or CSV.',
    'Annual Summary: Year-view summary of total sessions, unique children, peak day, and class breakdown.',
  ]);
  callout('tip','Use the Trends tab to identify seasonal patterns (e.g. lower attendance during school exams) so you can plan staffing well in advance.');
}

// ── SECTION 4 — Teacher ───────────────────────────────────────────────────────
function s4() {
  ctx.y = sectionPage('4','Teacher');
  roleTags(['Teacher']);
  para('Teachers have everything they need to manage their class: confirming arrivals, writing appraisals, requesting substitute cover, messaging parents, and tracking birthdays.');

  sub('4.1','My Class');
  para('My Class is the teacher\'s home page with four tabs:');
  bullets([
    'Awaiting Confirmation: Children checked in at the front desk but not yet confirmed as arrived in your classroom. Tap "Confirm Arrival" for each child as they come through the door.',
    'Roster: All children currently in class (confirmed arrivals not yet picked up). Shows check-in and pickup times.',
    'Birthdays: Children celebrating a birthday in the next 30 days, ordered by date. Today\'s birthdays show a special cake badge.',
    'Schedule: Your upcoming teacher allocations \u2013 dates, classes, rooms, and slots.',
  ]);
  step(1,'Go to My Class \u2192 Awaiting tab when a child arrives in your classroom.');
  step(2,'Find the child\'s card in the list.');
  step(3,'Tap "Confirm Arrival" to record the classroom arrival time.');
  callout('info','The time gap between front-desk drop-off and your classroom arrival confirmation is measured in the "Class Arrivals" report. Confirm arrivals promptly to keep this data accurate.');

  sub('4.2','Attendance & Arrivals');
  para('The Attendance page shows the full attendance record for your class across all sessions. Use it to review past dates, check record statuses (Checked In, In Class, Picked Up), filter by date range, and identify children with low attendance for pastoral follow-up.');

  sub('4.3','Child Appraisals');
  para('Appraisals are weekly written assessments building a developmental record visible to parents and admins.');
  step(1,'Navigate to Appraisals in the sidebar.');
  step(2,'Click "New Appraisal".');
  step(3,'Select the child and the service date.');
  step(4,'Set ratings for: Participation Level, Scripture Engagement, and Social Interaction.');
  step(5,'Optionally add a Milestone Note to celebrate an achievement (e.g. memorised a scripture).');
  step(6,'Click "Submit Appraisal".');
  callout('tip','Milestone notes are highlighted on the child\'s profile and visible to parents. Use them to celebrate achievements and encourage families to continue supporting their child\'s growth.');

  sub('4.4','Class Change Requests');
  para('If a parent or you as teacher feel a child would be better suited to another class, submit a Class Change Request. The admin will review and notify you and the parent of the outcome via in-app notification.');

  sub('4.5','Birthday Widget');
  para('The Birthdays tab on My Class shows children celebrating in the next 30 days, giving advance notice to prepare a card, coordinate a class celebration, or inform the parent. Today\'s birthdays are highlighted prominently.');

  sub('4.6','Substitute Requests');
  step(1,'Go to Substitute Requests in the sidebar.');
  step(2,'Click "New Request".');
  step(3,'Select the service date you need cover for.');
  step(4,'Write a reason (e.g. travel, illness, family commitment).');
  step(5,'Click "Submit Request".');
  step(6,'The admin will assign a substitute and you will see the status update to Assigned or Confirmed.');
  callout('warning','Submit substitute requests as early as possible \u2013 ideally at least one week before the service date \u2013 to give admin enough time to arrange cover.');
}

// ── SECTION 5 — Attendant ─────────────────────────────────────────────────────
function s5() {
  ctx.y = sectionPage('5','Attendant');
  roleTags(['Attendant']);
  para('Attendants operate the check-in and check-out kiosks at the front entrance of the children\'s area. Their role is to securely admit children at the start of a service and release them only to authorised parents or verified delegates at the end.');

  sub('5.1','Check-In Kiosk');
  para('Three check-in methods are supported:');
  bullets([
    'QR Code Scan: The parent presents their family QR code. The system checks in all children linked to that family for the current service.',
    'Manual Search: Search by child name and click "Check In" on the card.',
    'Face Recognition: Position the child in front of the camera. The system identifies the child from their enrolled face descriptor and checks them in automatically.',
  ]);
  step(1,'Open the Check-In page.');
  step(2,'Select the service slot: 7am, 9am, 11am, or 1pm.');
  step(3,'Choose a check-in method: QR, Manual, or Face Recognition.');
  step(4,'Complete the check-in. A success confirmation card appears with the child\'s name, class, and any allergy alerts.');
  callout('important','If a red allergy alert appears, verbally confirm the allergy with the parent and ensure the class teacher is notified before the parent leaves the area.');

  sub('5.2','Standard Check-Out');
  step(1,'Open the Check-Out page \u2192 Standard Checkout tab.');
  step(2,'Search for the child by name.');
  step(3,'Verify the identity of the collecting adult visually or by asking for their name.');
  step(4,'Click "Check Out" on the correct child record.');
  step(5,'The child\'s status updates to Picked Up and the parent receives a confirmation notification.');
  para('The Service Clock at the top of the page counts down to service end. At T\u221210 minutes, all parents of checked-in children receive an automatic pre-dismissal alert.');
  callout('tip','Set the service end time at the beginning of each service using the clock icon in the Service Clock bar to enable the automatic pre-dismissal notification.');

  sub('5.3','Delegate OTP Check-Out');
  step(1,'Ask the delegate for their 6-digit OTP code (provided by the parent via their Shepherd Connect app).');
  step(2,'Open Check-Out \u2192 "Delegate OTP Checkout" tab.');
  step(3,'Enter the 6-digit OTP code in the input field.');
  step(4,'Click "Verify OTP".');
  step(5,'The system confirms which child the OTP belongs to and who the delegate is.');
  step(6,'Visually verify the delegate\'s identity matches the name shown on screen.');
  step(7,'Click "Check Out" to release the child.');
  callout('important','OTP codes are single-use and valid for 24 hours only. If an OTP fails verification, do NOT release the child. Contact the parent directly by phone before taking any further action. Never release a child to an unverified individual under any circumstances.');
}

// ── SECTION 6 — Parent ────────────────────────────────────────────────────────
function s6() {
  ctx.y = sectionPage('6','Parent');
  roleTags(['Parent']);
  para('Parents use Shepherd Connect to stay connected with their children\'s church journey: viewing attendance, reading appraisals, managing delegates, and communicating with teachers.');

  sub('6.1','My Family');
  para('My Family is your household dashboard. It shows your Family Code, emergency contact details, both parents\' information, and all linked children with their current class. The family check-in QR code appears here \u2013 enlarge it to present at the check-in kiosk.');
  step(1,'Tap "Add Child" on the My Family page to register a new child.');
  step(2,'Enter the child\'s first name, last name, date of birth, and gender.');
  step(3,'Select the appropriate class from the dropdown.');
  step(4,'Optionally add allergy information and medical notes.');
  step(5,'Tap "Add Child" to save.');

  sub('6.2','My Children & Consent Forms');
  para('Open any child\'s profile to see attendance history, teacher appraisals, the class journey timeline, and medical information. As a parent you can also manage consent forms for your child.');
  twoCol([
    ['Photography & Video','Permission to photograph/video your child during ministry activities.'],
    ['Emergency Medical Treatment','Permission to seek emergency medical treatment on your behalf.'],
    ['Off-site Trips & Outings','Permission for your child to participate in ministry trips.'],
    ['Social Media Sharing','Permission to share your child\'s image on ministry social media.'],
    ['Emergency Contact Authority','Permission for designated contacts to act in an emergency.'],
  ]);
  callout('info','Consent can be updated at any time. Changes take effect immediately and the timestamp of each grant is recorded for audit purposes.');

  sub('6.3','Pickup Delegates & OTP');
  para('If someone other than yourself will collect your child, register them as a Pickup Delegate before the service.');
  step(1,'Navigate to Pickup Delegates in the sidebar.');
  step(2,'Tap "Add Delegate".');
  step(3,'Enter the delegate\'s full name, relationship to your child, and phone number.');
  step(4,'Select which child(ren) the delegate is authorised to collect.');
  step(5,'Tap "Add Delegate". A 6-digit OTP is generated and shown once \u2013 copy it immediately.');
  step(6,'Share the OTP with your delegate. They must present it at the check-out kiosk.');
  callout('important','The OTP is displayed only once. If your delegate loses it, delete the entry and add them again to generate a new OTP. OTPs expire after 24 hours.');

  sub('6.4','Class Change Requests');
  para('If you feel your child would be better placed in a different class, submit a Class Change Request from the sidebar. Select the child, choose the desired class, provide a reason, and submit. An admin will review and notify you via in-app notification.');

  sub('6.5','Messages');
  para('Messages enables direct private communication between parents and teachers or ministry staff. Compose messages, tag a specific child, view your inbox, and reply to staff messages \u2013 all within the app.');
  callout('info','Messages are in-app only \u2013 not sent as SMS or email. Remind recipients to check the app if your message is urgent.');

  sub('6.6','Feedback');
  para('Rate your service experience and leave comments. Your feedback is reviewed by ministry leadership and analysed for overall sentiment. You may submit anonymously if preferred.');
}

// ── SECTION 7 — Messaging ─────────────────────────────────────────────────────
function s7() {
  ctx.y = sectionPage('7','Messaging System');
  roleTags(['Super Admin','Admin','Teacher','Parent']);
  para('The Messaging System provides secure two-way private messaging between parents, teachers, and ministry staff. All messages are stored in the platform and visible only to the sender and recipient.');
  bullets([
    'Inbox: All received messages, sorted by date. Unread messages appear in bold with a blue dot indicator.',
    'Sent: All messages you have sent.',
    'Unread count badge: Shown on the Messages nav link so you never miss a new message.',
    'Reply: Open any message and tap "Reply" to send a response \u2013 the subject is pre-filled automatically.',
    'Trash: Delete messages you no longer need from either tab.',
  ]);
  para('Composing a message:');
  step(1,'Tap "New Message" from the Messages page header.');
  step(2,'Select a recipient from the dropdown (all users you are permitted to message).');
  step(3,'Optionally link the message to a specific child \u2013 useful when discussing a child\'s progress with a teacher.');
  step(4,'Enter an optional subject line.');
  step(5,'Write your message in the body field.');
  step(6,'Tap "Send Message".');
  callout('important','All messages are recorded in the audit trail. Use professional, respectful language. Do not share sensitive personal information (e.g. home addresses, financial details) via the messaging system.');
}

// ── SECTION 8 — Notifications ────────────────────────────────────────────────
function s8() {
  ctx.y = sectionPage('8','Notifications');
  para('The Notifications page shows all system alerts sent to your account. The bell icon in the top-right header shows a count of unread notifications.');
  bullets([
    'Check-In Confirmation: Sent to parents when their child is checked in at the front desk.',
    'Check-Out Confirmation: Sent to parents when their child is picked up.',
    'Pre-Dismissal Alert: Sent to all parents of children in class 10 minutes before service end.',
    'Late Pickup Alert: Sent to parents if their child is still in church after an extended period.',
    'Class Change Decision: Notifies the requester when their request is approved or rejected.',
    'Account Approval / Rejection: Sent to new teachers and admins when their account status changes.',
    'Broadcast Messages: Sent by admins to specific roles (all parents, all teachers, etc.).',
    'Appraisal Added: Notifies parents when a new appraisal is written for their child.',
    'Emergency Alert: Sent to relevant staff when an emergency is logged.',
  ]);
  step(1,'Tap the bell icon in the top-right header.');
  step(2,'A dropdown panel shows your most recent unread notifications.');
  step(3,'Click "View All" to go to the full Notifications page.');
  step(4,'Click a notification to mark it as read and view the full content.');
  step(5,'Use the filter to show only unread notifications.');
  callout('tip','Admins can send broadcast notifications from the Notifications admin page. Use "Pre-Dismissal Notify" on the Check-Out page to send an immediate alert to all parents of currently checked-in children.');
}

// ── SECTION 9 — Profile ───────────────────────────────────────────────────────
function s9() {
  ctx.y = sectionPage('9','Profile & Settings');
  para('Every user has a personal profile accessible from "My Profile" at the bottom of the sidebar, or by tapping the avatar circle in the header.');
  bullets([
    'Profile completeness progress bar showing what percentage of your profile is filled in.',
    'Personal details: first name, last name, date of birth, gender.',
    'Contact information: phone number and place of work.',
    'Profile photo URL: link to your profile photo hosted externally.',
    'Communication preferences: toggle in-app notifications, WhatsApp alerts, and SMS on or off.',
  ]);
  step(1,'Go to My Profile in the sidebar.');
  step(2,'Click "Edit Profile".');
  step(3,'Update any fields you wish to change.');
  step(4,'Click "Save Changes".');
  twoCol([
    ['In-App','Receive notifications inside Shepherd Connect. Recommended: ON.'],
    ['WhatsApp','Receive notifications via WhatsApp (requires WhatsApp integration).'],
    ['SMS','Receive notifications via SMS (requires SMS integration \u2013 contact admin).'],
  ]);
  callout('info','To change your password or email address, contact the Super Admin. These fields cannot be updated from the profile page for security reasons.');
}

// ── SECTION 10 — Security ─────────────────────────────────────────────────────
function s10() {
  ctx.y = sectionPage('10','Security & Safeguarding');
  para('Shepherd Connect is built with child safety as its primary design principle.');

  sub('10.1','Platform Security');
  bullets([
    'All data is transmitted over HTTPS (TLS encryption) \u2013 your connection is always encrypted.',
    'Passwords are stored using bcrypt hashing \u2013 plain-text passwords are never stored anywhere.',
    'Authentication uses signed JWT tokens that expire and must be refreshed.',
    'Role-Based Access Control (RBAC) ensures users can only access data for their role.',
    'Every sensitive action is recorded in the Audit Log with a timestamp and user ID.',
    'OTP codes for delegate pickup are cryptographically random 6-digit codes valid for 24 hours only.',
  ]);

  sub('10.2','Child Protection Responsibilities');
  callout('important','Every adult working with children must hold a valid DBS Enhanced check. No adult should be alone with a child without valid DBS clearance on record in the Safeguarding page.');
  bullets([
    'Never share your login credentials with another person.',
    'Log out of the app on shared devices immediately after your session.',
    'Do not photograph or video any child on a personal device during ministry activities.',
    'Report any safeguarding concern immediately using the Emergency Report function.',
    'If in doubt about releasing a child to any adult \u2013 verified or not \u2013 contact the parent directly first.',
    'Never release a child to someone who cannot provide a valid OTP or who is not on the registered parent list.',
  ]);

  sub('10.3','Data Protection');
  bullets([
    'All personal data is held in accordance with the Nigeria Data Protection Act (NDPA) and GDPR guidelines.',
    'Family and child data is accessible only to authorised ministry staff on a need-to-know basis.',
    'Do not export reports and share them via unencrypted channels (e.g. open WhatsApp groups).',
    'Contact the Super Admin to request data deletion or amendment under your rights as a data subject.',
  ]);
  callout('warning','Misuse of child data or any breach of platform security controls is a disciplinary matter and may be referred to statutory authorities. All access is logged and permanently retained.');
}

// ── SECTION 11 — FAQ ──────────────────────────────────────────────────────────
function s11() {
  ctx.y = sectionPage('11','Frequently Asked Questions');

  faq(
    'I cannot log in. What should I do?',
    'Check you are using the correct email and password. If your account is Teacher or Admin, it may be pending approval \u2013 wait for the Super Admin to approve it. If you have forgotten your password, contact the Super Admin to reset it.'
  );
  faq(
    'The QR code scan is not working at check-in. What should I do?',
    'Ensure the camera has permission to access the device camera in your browser settings. Try cleaning the camera lens and ensuring the QR code is not damaged. As a fallback, use Manual Search by typing the child\'s name in the search box.'
  );
  faq(
    'My child\'s allergy information is not showing. How do I add it?',
    'Go to My Family, tap the child\'s name to open their profile, then tap Edit. Add the allergy in the Allergies field. The alert will appear prominently on the check-in confirmation screen and on the child\'s profile for all staff.'
  );
  faq(
    'I forgot to give the delegate their OTP. Can I retrieve it?',
    'No \u2013 the OTP is shown only once for security reasons. Delete the delegate entry and add them again to generate a fresh OTP. The old OTP is automatically invalidated.'
  );
  faq(
    'A teacher has not confirmed their allocation. What should I do?',
    'Contact the teacher directly. If they cannot attend, prompt them to submit a Substitute Request. Admins can also update the allocation status manually from the Teacher Allocations page.'
  );
  faq(
    'The attendance report is missing records. Why?',
    'Check the date range filter in the Custom Report Builder. Also verify that the service slot filter is correct \u2013 filtering by a specific slot (e.g. 9am) will exclude records from other slots.'
  );
  faq(
    'How do I deactivate a user who is no longer serving?',
    'Go to Users (Super Admin only), find the user, click the toggle to set their status to Inactive. They will immediately be unable to log in but all their historical data is preserved.'
  );
  faq(
    'Can parents see the Safeguarding & DBS records?',
    'No. The Safeguarding & DBS page is accessible only to Super Admin and Admin roles. Parents and Teachers cannot view DBS records.'
  );
  faq(
    'The pre-dismissal notification did not send automatically. Why?',
    'The automatic pre-dismissal alert only fires if a service end time has been set in the Service Clock bar on the Check-Out page. If no end time is set, the automatic alert does not trigger. Use the manual "Notify Parents Now" button instead.'
  );
  faq(
    'How do I export attendance data for a specific class only?',
    'Go to Reports \u2192 Custom Builder \u2192 select "Attendance Log" as the report type \u2192 choose the class from the Class dropdown \u2192 set your date range \u2192 click Generate \u2192 then export as CSV or PDF.'
  );
  faq(
    'How is the pickup rate calculated on a child\'s profile?',
    'The pickup rate is the percentage of check-in records where the child was successfully checked out (status: Picked Up) versus total check-ins. A low pickup rate may indicate a pattern of late collection and warrants a pastoral conversation with the family.'
  );
  faq(
    'A parent says their child was in church but has no attendance record. What happened?',
    'This usually means the child was never formally checked in at the kiosk. Verify with the Attendant on duty. Admins can manually create an attendance record from the Attendance page using the "Add Manual Record" option.'
  );
}

// ── Back cover ────────────────────────────────────────────────────────────────
function backCover() {
  doc.addPage();
  fillR(0,0,W,H,C.darkBlue);
  fillR(0,H-6,W,6,C.gold);
  fillR(0,0,W,6,C.gold);
  doc.save().circle(W-80,80,180).opacity(0.05).fill(C.white).restore();
  doc.save().circle(60,H-100,120).opacity(0.05).fill(C.white).restore();

  const my = H/2-90;
  doc.font('Helvetica-Bold').fontSize(34).fillColor(C.white)
    .text('Shepherd Connect', M, my, { align:'center', width:CW });
  doc.font('Helvetica').fontSize(14).fillColor(C.gold)
    .text('Safe.  Known.  Celebrated.', M, my+48, { align:'center', width:CW });
  doc.save().moveTo(W/2-80,my+80).lineTo(W/2+80,my+80).lineWidth(0.5).stroke(C.gold).restore();
  doc.font('Helvetica').fontSize(11).fillColor('rgba(255,255,255,0.65)')
    .text('RCCG City of David\nVictoria Island, Lagos, Nigeria\nChildren\'s Ministry Department', M, my+96, { align:'center', width:CW, lineGap:4 });
  doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.35)')
    .text('Shepherd Connect User Guide v2.0  \u00b7  May 2026\nThis document is confidential and intended for ministry use only.', M, my+160, { align:'center', width:CW, lineGap:3 });
}

// ── Build ──────────────────────────────────────────────────────────────────────
cover();
toc();
s1();
s2();
s3();
s4();
s5();
s6();
s7();
s8();
s9();
s10();
s11();
backCover();
footer();

doc.end();
doc.on('finish', () => {
  const sz = (fs.statSync(OUTPUT).size/1024).toFixed(1);
  console.log(`PDF saved to ${OUTPUT}`);
  console.log(`Size: ${sz} KB  |  Pages: ${pageNum}`);
});
