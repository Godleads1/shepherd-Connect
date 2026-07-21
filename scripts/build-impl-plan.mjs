import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire(import.meta.url);
const XLSX = require("/tmp/node_modules/xlsx/xlsx.js");

const navy   = "1E3A8A";
const gold   = "F59E0B";
const white  = "FFFFFF";
const lightB = "EFF4FF";
const lightG = "F0FDF4";
const lightY = "FFFBEB";
const lightR = "FEF2F2";
const midGray= "F1F5F9";
const darkTx = "1E293B";
const subTx  = "64748B";
const purple = "FDF2FA";

function cell(v, bold, bg, fc, sz, wrap, border, align, italic) {
  const s = {};
  s.font = { name: "Calibri", sz: sz || 10, color: { rgb: fc || darkTx } };
  if (bold)   s.font.bold = true;
  if (italic) s.font.italic = true;
  if (bg) s.fill = { fgColor: { rgb: bg }, patternType: "solid" };
  if (wrap) s.alignment = { wrapText: true, vertical: "top", horizontal: align || "left" };
  else if (align) s.alignment = { horizontal: align, vertical: "center" };
  if (border) {
    const bd = { style: "thin", color: { rgb: "CBD5E1" } };
    s.border = { top: bd, bottom: bd, left: bd, right: bd };
  }
  return { v: v ?? "", t: typeof v === "number" ? "n" : "s", s };
}

const hdr  = (v, bg, fc) => cell(v, true, bg || navy, fc || white, 11, false, false, "left");
const sect = (v)          => cell(v, true, navy, white, 12, false, false, "left");
const sub_ = (v)          => cell(v, true, midGray, navy, 10, false, false, "left");
const bl   = ()           => cell("", false, null, null, 10);
const wc   = (v, bg, fc, bold) => cell(v, bold || false, bg || null, fc || darkTx, 10, true, true, "left");
const cc   = (v, bg, fc, bold) => cell(v, bold || false, bg || null, fc || darkTx, 10, false, true, "center");

const wb = XLSX.utils.book_new();

// ═══════════════════════════════════════════════════════
// SHEET 1: COVER
// ═══════════════════════════════════════════════════════
{
  const d = [];
  const e = () => d.push([bl(),bl(),bl(),bl(),bl()]);
  e(); e();
  d.push([bl(), cell("SHEPHERD CONNECT", true, navy, gold, 20), bl(), bl(), bl()]);
  d.push([bl(), cell("Implementation Plan — Rollout to RCCG City of David", true, navy, white, 13), bl(), bl(), bl()]);
  d.push([bl(), cell("Safe. Known. Celebrated.", false, navy, "CBD5E1", 11), bl(), bl(), bl()]);
  e(); e();
  d.push([bl(), cell("HOW TO USE THIS PLAN", true, midGray, navy, 11), bl(), bl(), bl()]);
  d.push([bl(), cell("This workbook covers every step needed to go from today to Official Activation on the 1st Sunday of September.", false, null, subTx, 10, true), bl(), bl(), bl()]);
  d.push([bl(), cell("Navigate each sheet in order. Responsible parties are named. Dates are relative to Activation Day.", false, null, subTx, 10, true), bl(), bl(), bl()]);
  e();
  const sheets = [
    ["Cover",              "You are here — overview and how to use this file"],
    ["Master Timeline",    "Week-by-week Gantt of all phases from now to activation"],
    ["Phase 1 Sensitise",  "Engage and onboard teachers; create church-wide awareness"],
    ["Phase 2 Pilot",      "10-family pilot: what to do, when, who is involved"],
    ["Phase 3 Feedback",   "Collect pilot feedback, iterate, prepare announcement"],
    ["Phase 4 Pastoral",   "Presentation to Pastorate for sign-off"],
    ["Phase 5 Activate",   "Official activation on 1st Sunday September + go-live checklist"],
    ["RACI",               "Who is Responsible, Accountable, Consulted, Informed for each task"],
  ];
  d.push([bl(), cell("Sheet", true, navy, gold, 10), cell("Contents", true, navy, gold, 10), bl(), bl()]);
  sheets.forEach(([s, desc]) => {
    d.push([bl(), cell(s, true, lightB, navy, 10, false, true), cell(desc, false, lightB, darkTx, 10, false, true), bl(), bl()]);
  });
  e();
  d.push([bl(), cell("Target Activation Date", true, null, navy, 10), cell("1st Sunday, September 2026", true, null, gold, 11), bl(), bl()]);
  d.push([bl(), cell("Document owner", false, null, subTx, 10), cell("Admin / Implementation Lead", false, null, darkTx, 10), bl(), bl()]);

  const ws = XLSX.utils.aoa_to_sheet(d);
  ws["!cols"] = [{wch:2},{wch:28},{wch:54},{wch:14},{wch:14}];
  ws["!merges"] = [
    {s:{r:2,c:1},e:{r:2,c:4}},{s:{r:3,c:1},e:{r:3,c:4}},{s:{r:4,c:1},e:{r:4,c:4}},
    {s:{r:7,c:1},e:{r:7,c:4}},{s:{r:8,c:1},e:{r:8,c:4}},{s:{r:9,c:1},e:{r:9,c:4}},
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Cover");
}

// ═══════════════════════════════════════════════════════
// SHEET 2: MASTER TIMELINE
// ═══════════════════════════════════════════════════════
{
  const d = [];
  d.push([sect("MASTER TIMELINE — Shepherd Connect Rollout to Activation (1st Sunday September 2026)"),bl(),bl(),bl(),bl(),bl(),bl(),bl(),bl()]);
  d.push([cell("All weeks are approximate. Adjust to match your actual church calendar.",false,null,subTx,9),bl(),bl(),bl(),bl(),bl(),bl(),bl(),bl()]);
  d.push([bl(),bl(),bl(),bl(),bl(),bl(),bl(),bl(),bl()]);
  d.push([hdr("Phase"),hdr("Activity"),hdr("Owner"),hdr("Wk 1"),hdr("Wk 2"),hdr("Wk 3"),hdr("Wk 4"),hdr("Wk 5-6"),hdr("Wk 7-8\n(LIVE)")]);

  const bgMap = {
    "P1":"3B5FC0","P2":"16A34A","P3":"D97706","P4":"7C3AED","P5":"DC2626",
  };
  const rowBgMap = {
    "P1":lightB,"P2":lightG,"P3":lightY,"P4":purple,"P5":lightR,
  };

  const rows = [
    ["P1","Phase 1\nSensitise","Teacher briefing meeting","Admin","Y","","","","",""],
    ["P1","","Teacher onboarding (accounts + app walkthrough)","Admin + IT","Y","Y","","","",""],
    ["P1","","Church-wide awareness (bulletin, announcement)","Admin + Pastor","","Y","Y","","",""],
    ["P1","","QR code / flyer distribution to families","Admin","","","Y","","",""],
    ["P2","Phase 2\nPilot","Select 10 pilot families","Admin","","","Y","","",""],
    ["P2","","Pilot families: register and add children","Parents (guided)","","","Y","","",""],
    ["P2","","Pilot Sunday 1 — check-in and check-out drill","Admin + Support","","","","Y","",""],
    ["P2","","Pilot Sunday 2 — teacher confirmation drill","Teachers + Admin","","","","Y","",""],
    ["P2","","Pilot Sunday 3 — delegate OTP pickup test","Admin + Support","","","","","Y",""],
    ["P3","Phase 3\nFeedback","Collect feedback from pilot families","Admin","","","","","Y",""],
    ["P3","","Collect feedback from teachers","Admin","","","","","Y",""],
    ["P3","","Review and fix issues raised","IT / Admin","","","","","Y",""],
    ["P3","","Prepare announcement script (based on feedback)","Pastor / Admin","","","","","Y",""],
    ["P4","Phase 4\nPastoral","Prepare presentation deck for Pastorate","Admin","","","","","Y",""],
    ["P4","","Present to Senior Pastor / Pastorate for sign-off","Admin Lead","","","","","","Y"],
    ["P4","","Receive approval and set Official Activation date","Pastor + Admin","","","","","","Y"],
    ["P5","Phase 5\nActivate","Full-church announcement (Sunday service)","Pastor","","","","","","Y"],
    ["P5","","All families register (open enrollment)","All Parents","","","","","","Y"],
    ["P5","","All teachers fully on-boarded","Admin","","","","","","Y"],
    ["P5","","OFFICIAL ACTIVATION — 1st Sunday September","All Roles","","","","","","LIVE"],
  ];

  rows.forEach(([pk, phase, activity, owner, w1,w2,w3,w4,w56,w78]) => {
    const rbg = rowBgMap[pk];
    const tick = (v) => {
      if (v === "Y")    return cc("Y", rbg, bgMap[pk], true);
      if (v === "LIVE") return cc("LIVE", "DC2626", white, true);
      return cc("", rbg, null, false);
    };
    const phaseCell = phase
      ? cell(phase, true, bgMap[pk], white, 10, true, true, "center")
      : cell("", false, rbg, null, 10, false, true, "center");
    d.push([phaseCell, cell(activity, false, rbg, darkTx, 10, false, true), cell(owner, false, rbg, subTx, 9, false, true), tick(w1),tick(w2),tick(w3),tick(w4),tick(w56),tick(w78)]);
  });

  const ws = XLSX.utils.aoa_to_sheet(d);
  ws["!cols"] = [{wch:14},{wch:48},{wch:22},{wch:8},{wch:8},{wch:8},{wch:8},{wch:10},{wch:12}];
  ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:8}},{s:{r:1,c:0},e:{r:1,c:8}}];
  ws["!rows"] = d.map((_,i)=>i===0?{hpt:28}:{hpt:24});
  XLSX.utils.book_append_sheet(wb, ws, "Master Timeline");
}

// ═══════════════════════════════════════════════════════
// SHEET 3: PHASE 1 — SENSITISE
// ═══════════════════════════════════════════════════════
{
  const d = [];
  d.push([sect("PHASE 1 — SENSITISE: Teacher Onboarding and Church Awareness"),bl(),bl(),bl(),bl()]);
  d.push([cell("Objective: Every teacher knows the app, has an active account, and the congregation knows Shepherd Connect is coming.",false,null,subTx,9,true),bl(),bl(),bl(),bl()]);
  d.push([bl(),bl(),bl(),bl(),bl()]);
  d.push([hdr("#"),hdr("What to do"),hdr("When"),hdr("What is required"),hdr("Who is involved")]);

  const rows = [
    ["1",
     "Hold a Teacher Briefing Meeting\nIntroduce Shepherd Connect — purpose, features, and the teacher role in the system.",
     "Week 1",
     "Projector or TV screen\nDemo login: teacher1@shepherd.com\nPrinted one-page overview\nMeeting room booked",
     "Admin Lead\nSenior Teacher\nPastor (optional opening prayer)"],
    ["2",
     "Create teacher accounts\nEach teacher self-registers with role = Teacher. Admin approves each account in the Users tab.",
     "Week 1-2",
     "Teachers have smartphones with a browser\nApp link shared via WhatsApp or email\nAdmin ready to approve accounts on the spot",
     "All Teachers\nAdmin (for approvals)"],
    ["3",
     "App walkthrough with teachers\nLive demo: My Class, Attendance, Appraisals, Class Change Requests. Teachers follow on their own phones.",
     "Week 2",
     "App running on a shared screen\nTeachers follow on their own phones\nQ&A time built in (allow 30 min)",
     "Admin Lead\nIT Support\nAll Teachers"],
    ["4",
     "Church bulletin and announcement\nAnnounce the upcoming rollout. Something exciting is coming to Children's Church.",
     "Week 2-3",
     "Bulletin insert designed and printed\nAnnouncement script prepared for Sunday service\nSocial media post (if applicable)",
     "Admin\nPastor or MC\nMedia Team"],
    ["5",
     "Distribute parent awareness materials\nQR code posters in children's church area, flyers for families to take home.",
     "Week 3",
     "QR codes printed pointing to registration page\nFlyer explaining what Shepherd Connect does for parents\nStaff available to answer questions after service",
     "Admin\nSupport Staff\nChildren's Church Ushers"],
    ["6",
     "Set up all classes and class assignments\nEnsure every child is in the correct class in the system before the pilot begins.",
     "Week 3",
     "Admin access to the app\nClass structure agreed with senior teacher\nAll existing children registered in system",
     "Admin\nSenior Teacher"],
  ];

  rows.forEach(([num, what, when, req, who]) => {
    d.push([cc(num, lightB, navy, true), wc(what, null, darkTx), cc(when, lightB, navy), wc(req, lightY, darkTx), wc(who, lightG, darkTx)]);
  });

  d.push([bl(),bl(),bl(),bl(),bl()]);
  d.push([cell("TIP: Use the teacher1@shepherd.com demo account for all demos. Have the admin approve new teacher accounts on the spot — it takes 30 seconds.",false,null,subTx,9,true),bl(),bl(),bl(),bl()]);

  const ws = XLSX.utils.aoa_to_sheet(d);
  ws["!cols"] = [{wch:4},{wch:44},{wch:12},{wch:38},{wch:28}];
  ws["!rows"] = d.map((_,i)=>i===0?{hpt:26}:i<4?{hpt:20}:{hpt:72});
  ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:4}},{s:{r:1,c:0},e:{r:1,c:4}},{s:{r:d.length-1,c:0},e:{r:d.length-1,c:4}}];
  XLSX.utils.book_append_sheet(wb, ws, "Phase 1 Sensitise");
}

// ═══════════════════════════════════════════════════════
// SHEET 4: PHASE 2 — PILOT
// ═══════════════════════════════════════════════════════
{
  const d = [];
  d.push([sect("PHASE 2 — PILOT: 10-Family Live Test (3 Practice Sundays)"),bl(),bl(),bl(),bl()]);
  d.push([cell("Objective: Iron out any issues before full rollout. Pilot families experience the full journey — registration, check-in, escort, pick-up, delegate OTP, and appraisals.",false,null,subTx,9,true),bl(),bl(),bl(),bl()]);
  d.push([bl(),bl(),bl(),bl(),bl()]);
  d.push([hdr("#"),hdr("What to do"),hdr("When"),hdr("What is required"),hdr("Who is involved")]);

  const rows = [
    ["1",
     "Select 10 pilot families\nChoose a mix: different class ages, at least 2 families with delegates, 1 with a medical alert on file.",
     "Week 3",
     "Admin decides selection criteria\nFamilies notified and briefed via WhatsApp\nTheir children already added to the system",
     "Admin Lead\nSenior Teacher"],
    ["2",
     "Pilot families register parent accounts\nGuided session — parents create accounts, see their child profiles, and explore the app.",
     "Week 3",
     "Parents have smartphones\nApp link shared in advance\nAdmin on standby to help with registration\nChildren's profiles verified in system",
     "All 10 Pilot Families\nAdmin + Support Staff"],
    ["3",
     "PILOT SUNDAY 1 — Check-in drill\nScan QR, check children in, walk them to class, confirm arrival in app.",
     "Week 4",
     "Support staff at check-in desk with a device\nQR codes for pilot family cards\nAdmin monitoring dashboard live\nTeachers confirm children arrive in class",
     "Support Staff (check-in)\nAdmin (monitoring)\nAll Teachers\n10 Pilot Families"],
    ["4",
     "PILOT SUNDAY 2 — Teacher confirmation drill\nTeachers mark attendance live. Test the class change request flow.",
     "Week 4",
     "Teachers logged in on their phones during service\nAdmin reviews class change requests in real-time\nNote any UX confusion or errors",
     "Teachers\nAdmin\n10 Pilot Families"],
    ["5",
     "PILOT SUNDAY 3 — Delegate OTP pickup test\nAt least 2 families use a delegate. Attendant verifies OTP at the gate.",
     "Week 5-6",
     "Pilot families pre-add a pickup delegate in app\nOTP shown and copied before Sunday\nSupport staff use Delegate OTP Checkout tab at pick-up",
     "Support Staff (checkout)\nAdmin\n2+ Pilot Families with delegates"],
    ["6",
     "Appraisal test\nTeachers submit appraisals for pilot children. Parents check that they received the notification.",
     "Week 5-6",
     "Teachers log in after service\nWrite at least 1 appraisal per child\nParents confirm they received the notification",
     "All Teachers\n10 Pilot Families"],
    ["7",
     "Document issues and fixes\nLog any bugs, confusion, or missing features encountered during the pilot.",
     "Week 5-6",
     "Simple issues log (WhatsApp group or spreadsheet)\nIT team addresses any bugs between pilot Sundays\nAdmin notes process gaps",
     "Admin\nIT / Developer\nAll Pilot Participants"],
  ];

  rows.forEach(([num, what, when, req, who]) => {
    d.push([cc(num, lightG, "16A34A", true), wc(what, null, darkTx), cc(when, lightG, "16A34A"), wc(req, lightY, darkTx), wc(who, lightB, darkTx)]);
  });

  d.push([bl(),bl(),bl(),bl(),bl()]);
  d.push([cell("TIP: Keep a shared WhatsApp group with pilot families throughout. It is the fastest way to collect real-time feedback and resolve confusion.",false,null,subTx,9,true),bl(),bl(),bl(),bl()]);
  d.push([cell("TIP: Ask pilot families to screenshot any error or confusing moment — these become the most useful feedback.",false,null,subTx,9,true),bl(),bl(),bl(),bl()]);

  const ws = XLSX.utils.aoa_to_sheet(d);
  ws["!cols"] = [{wch:4},{wch:46},{wch:12},{wch:36},{wch:30}];
  ws["!rows"] = d.map((_,i)=>i===0?{hpt:26}:i<4?{hpt:20}:{hpt:72});
  ws["!merges"] = [
    {s:{r:0,c:0},e:{r:0,c:4}},{s:{r:1,c:0},e:{r:1,c:4}},
    {s:{r:d.length-2,c:0},e:{r:d.length-2,c:4}},{s:{r:d.length-1,c:0},e:{r:d.length-1,c:4}},
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Phase 2 Pilot");
}

// ═══════════════════════════════════════════════════════
// SHEET 5: PHASE 3 — FEEDBACK
// ═══════════════════════════════════════════════════════
{
  const d = [];
  d.push([sect("PHASE 3 — FEEDBACK, ITERATION AND ANNOUNCEMENT PREP"),bl(),bl(),bl(),bl()]);
  d.push([cell("Objective: Gather structured feedback from pilot families and teachers, fix issues, then prepare the church-wide announcement using real pilot outcomes.",false,null,subTx,9,true),bl(),bl(),bl(),bl()]);
  d.push([bl(),bl(),bl(),bl(),bl()]);

  d.push([sub_("PART A — PILOT FAMILY FEEDBACK (collect via WhatsApp, Google Form, or in person)"),bl(),bl(),bl(),bl()]);
  d.push([hdr("Question"),hdr("Answer options"),bl(),bl(),bl()]);
  const pfq = [
    ["How easy was it to register and add your child?",                         "5 stars / 4 stars / 3 stars / 2 stars / 1 star"],
    ["Did you receive a notification when your child was checked in?",          "Yes, immediately  /  Yes, but late  /  No"],
    ["How confident did you feel using the app on Sunday?",                     "Very confident  /  Somewhat confident  /  Needed help  /  Struggled"],
    ["Did the delegate OTP pickup work smoothly? (if applicable)",              "Yes  /  No  /  Did not use this feature"],
    ["What was the most useful feature?",                                        "Open text"],
    ["What was the most confusing part?",                                        "Open text"],
    ["Would you recommend Shepherd Connect to other families?",                 "Definitely  /  Probably  /  Not sure  /  No"],
    ["Any other comments or suggestions?",                                       "Open text"],
  ];
  pfq.forEach(([q, a]) => {
    d.push([wc(q, null, darkTx), wc(a, lightB, subTx), bl(), bl(), bl()]);
  });

  d.push([bl(),bl(),bl(),bl(),bl()]);
  d.push([sub_("PART B — TEACHER FEEDBACK"),bl(),bl(),bl(),bl()]);
  d.push([hdr("Question"),hdr("Answer options"),bl(),bl(),bl()]);
  const tfq = [
    ["How easy was the app to use on a Sunday morning?",              "5 stars / 4 stars / 3 stars / 2 stars / 1 star"],
    ["Did you find My Class helpful for managing children?",           "Very helpful  /  Somewhat  /  Not really"],
    ["Did appraisals take too long to complete?",                      "No, quick and easy  /  A little slow  /  Yes, too long"],
    ["Did you have any issues with class assignments?",                "None  /  Minor issues  /  Major issues (describe below)"],
    ["What would make this app more useful for teachers?",             "Open text"],
  ];
  tfq.forEach(([q, a]) => {
    d.push([wc(q, null, darkTx), wc(a, lightY, subTx), bl(), bl(), bl()]);
  });

  d.push([bl(),bl(),bl(),bl(),bl()]);
  d.push([sub_("PART C — ANNOUNCEMENT PREPARATION CHECKLIST"),bl(),bl(),bl(),bl()]);
  d.push([hdr("Item"),hdr("Owner"),hdr("Status"),bl(),bl()]);
  const ac = [
    ["Review feedback summary (top 3 positives + top 3 issues)", "Admin", "Not started"],
    ["Fix critical issues raised in pilot", "IT / Developer", "Not started"],
    ["Draft announcement script for Sunday service (quote real pilot feedback)", "Admin + Pastor", "Not started"],
    ["Prepare 2-slide visual for announcement (optional)", "Admin / Media Team", "Not started"],
    ["Add announcement to Sunday bulletin", "Admin / Bulletin Team", "Not started"],
    ["Prepare pastoral presentation (for Phase 4 sign-off)", "Admin Lead", "Not started"],
  ];
  ac.forEach(([item, owner, status]) => {
    d.push([wc(item, lightG, darkTx), wc(owner, lightB, darkTx), wc(status, null, subTx), bl(), bl()]);
  });

  const ws = XLSX.utils.aoa_to_sheet(d);
  ws["!cols"] = [{wch:52},{wch:38},{wch:16},{wch:10},{wch:10}];
  ws["!rows"] = d.map((_,i)=>i===0?{hpt:26}:i===1?{hpt:30}:{hpt:38});
  ws["!merges"] = [
    {s:{r:0,c:0},e:{r:0,c:4}},{s:{r:1,c:0},e:{r:1,c:4}},
    {s:{r:3,c:0},e:{r:3,c:4}},
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Phase 3 Feedback");
}

// ═══════════════════════════════════════════════════════
// SHEET 6: PHASE 4 — PASTORAL
// ═══════════════════════════════════════════════════════
{
  const d = [];
  d.push([sect("PHASE 4 — PASTORAL PRESENTATION AND SIGN-OFF"),bl(),bl(),bl()]);
  d.push([cell("Objective: Present the system, the pilot outcomes, and the rollout plan to the Senior Pastor and Pastorate — and get official sign-off to activate.",false,null,subTx,9,true),bl(),bl(),bl()]);
  d.push([bl(),bl(),bl(),bl()]);
  d.push([hdr("#"),hdr("What to do"),hdr("What is required"),hdr("Who is involved")]);

  const rows = [
    ["1",
     "Schedule the pastoral meeting\nRequest 20-30 minutes on the Pastorate agenda — allow at least 1 week's notice.",
     "Diary access for Pastorate\nAgenda item submitted in advance",
     "Admin Lead\nPastor's PA or Secretary"],
    ["2",
     "Prepare the presentation\nCover: What is Shepherd Connect, pilot results, feedback highlights, activation plan, costs.",
     "Pilot feedback summary (from Phase 3)\nCost summary from Annual Cost Planner\nShepherd Connect demo available on a device\nPrinted 1-page summary as a leave-behind",
     "Admin Lead\nIT / Developer (for demo support)"],
    ["3",
     "Deliver the presentation\nWalk through: problem, solution, pilot outcome, feedback, activation date, and cost.",
     "Laptop or tablet for live demo\nPrinted one-pagers\nTime: 20 min presentation + 10 min Q&A",
     "Admin Lead\nSenior Teacher (to speak to teacher experience)\nIT Support (on standby)"],
    ["4",
     "Receive pastoral questions and address concerns\nCommon questions: data privacy, cost, what if app is down, how parents register.",
     "Prepared FAQ sheet (see below)\nAnnual Cost Planner open on a device\nKnow who handles technical issues",
     "Admin Lead\nPastor / Pastorate Members"],
    ["5",
     "Receive sign-off and set official date\nGet verbal or written approval. Confirm 1st Sunday September as activation date.",
     "Meeting minutes or approval email drafted in advance\nActivation date confirmed with children's church schedule\nCommunicate approval to all relevant teams",
     "Senior Pastor\nAdmin Lead"],
  ];

  rows.forEach(([num, what, req, who]) => {
    d.push([cc(num, "7C3AED", white, true), wc(what, null, darkTx), wc(req, lightY, darkTx), wc(who, purple, darkTx)]);
  });

  d.push([bl(),bl(),bl(),bl()]);
  d.push([sub_("SUGGESTED FAQ SHEET FOR PASTORATE"),bl(),bl(),bl()]);
  d.push([hdr("Question the Pastor may ask"),hdr("Suggested answer"),bl(),bl()]);
  const faq = [
    ["Is children's data safe?",
     "All data is stored securely in a private database. Only authorised staff (admin, teachers, support) can see child records. Parents only see their own children."],
    ["What happens if the app goes down on Sunday?",
     "We keep a paper register as backup. Once the app is restored, data is entered manually. The system has been tested over 3 pilot Sundays without any downtime."],
    ["How do parents sign up?",
     "Parents register with their email and phone number. They are shown only their own children. No technical skill is needed — it works like any church app."],
    ["What is the cost?",
     "Approximately $194 per month (or about NGN 314,000 per month at current rates). This covers hosting, SMS check-in alerts, and email reports. A full breakdown is in the Annual Cost Planner."],
    ["Who manages the system?",
     "The Children's Admin manages day-to-day operations. IT support handles any technical issues. Shepherd Connect has a dedicated support guide for every staff role."],
  ];
  faq.forEach(([q, a]) => {
    d.push([wc(q, lightB, navy), wc(a, null, darkTx), bl(), bl()]);
  });

  const ws = XLSX.utils.aoa_to_sheet(d);
  ws["!cols"] = [{wch:4},{wch:46},{wch:36},{wch:26}];
  ws["!rows"] = d.map((_,i)=>i===0?{hpt:26}:i<4?{hpt:20}:{hpt:60});
  ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:3}},{s:{r:1,c:0},e:{r:1,c:3}}];
  XLSX.utils.book_append_sheet(wb, ws, "Phase 4 Pastoral");
}

// ═══════════════════════════════════════════════════════
// SHEET 7: PHASE 5 — ACTIVATE
// ═══════════════════════════════════════════════════════
{
  const d = [];
  d.push([sect("PHASE 5 — OFFICIAL ACTIVATION: 1st Sunday September 2026"),bl(),bl(),bl(),bl()]);
  d.push([cell("Objective: Full church goes live on Shepherd Connect. Every family registered. All staff at posts. Check-in desk operational from day one.",false,null,subTx,9,true),bl(),bl(),bl(),bl()]);
  d.push([bl(),bl(),bl(),bl(),bl()]);

  d.push([sub_("PRE-ACTIVATION WEEK CHECKLIST — Complete by Saturday before Activation Sunday"),bl(),bl(),bl(),bl()]);
  d.push([hdr("Done?"),hdr("Task"),hdr("Owner"),hdr("Notes"),bl()]);
  const pre = [
    ["All teacher accounts created and approved", "Admin", ""],
    ["All children registered and in correct classes", "Admin + Teachers", ""],
    ["Class assignments reviewed with senior teacher", "Admin + Senior Teacher", ""],
    ["Support staff briefed on check-in and check-out procedure", "Admin", ""],
    ["Check-in desk device(s) charged and logged in", "Support Staff", ""],
    ["QR code cards printed for all registered families", "Admin", ""],
    ["Backup paper register printed for check-in desk", "Admin", ""],
    ["All pilot family feedback issues resolved", "IT / Developer", ""],
    ["Announcement prepared for Sunday service", "Pastor / MC", ""],
    ["Family registration link shared via WhatsApp and bulletin", "Admin", ""],
    ["Admin logged in and monitoring dashboard from start of service", "Admin", ""],
  ];
  pre.forEach(([task, owner, notes]) => {
    d.push([cc("[ ]", lightR, "DC2626", true), wc(task, null, darkTx), wc(owner, lightB, darkTx), wc(notes, null, subTx), bl()]);
  });

  d.push([bl(),bl(),bl(),bl(),bl()]);
  d.push([sub_("ACTIVATION SUNDAY — ROLE ASSIGNMENTS"),bl(),bl(),bl(),bl()]);
  d.push([hdr("Post"),hdr("Role / Person"),hdr("Responsibility"),bl(),bl()]);
  const roles = [
    ["Check-in Desk", "Support Staff (2 people)", "Scan QR codes, check in all children, handle walk-in families who need to register on the spot."],
    ["Church Entrance", "Ushers / Support", "Direct families to check-in desk. Hand out QR card if family has none."],
    ["Each Classroom", "Class Teacher", "Confirm children arrive (mark in app). Run class as normal. Write appraisals after service."],
    ["Escort Corridor", "Support Staff", "Escort children from lobby to classrooms. Mark In Transit in the app."],
    ["Pick-up Desk", "Support Staff (2 people)", "Verify parent identity, confirm pickup in app. Handle delegate OTP if applicable."],
    ["Monitoring Dashboard", "Admin", "Watch live dashboard for any child not yet collected. Trigger late-pickup alerts if needed."],
    ["Helpdesk / Registration", "Admin + IT", "Help families register on the spot. Resolve any app issues immediately."],
  ];
  roles.forEach(([post, person, resp]) => {
    d.push([cell(post, true, lightR, "DC2626", 10, true, true), wc(person, null, darkTx), wc(resp, lightG, darkTx), bl(), bl()]);
  });

  d.push([bl(),bl(),bl(),bl(),bl()]);
  d.push([sub_("POST-ACTIVATION WEEK — FOLLOW-UP TASKS"),bl(),bl(),bl(),bl()]);
  d.push([hdr("#"),hdr("Task"),hdr("Owner"),bl(),bl()]);
  const post = [
    ["1", "Review first-Sunday attendance data in Reports tab", "Admin"],
    ["2", "Collect any remaining family registrations (follow-up WhatsApp)", "Admin"],
    ["3", "Address any issues raised by staff or parents on Day 1", "Admin + IT"],
    ["4", "Send a Thank You notification to all parents via app broadcast", "Admin"],
    ["5", "Debrief meeting with teachers and support staff (15 min)", "Admin Lead"],
    ["6", "Share first-Sunday summary with Pastorate", "Admin Lead"],
  ];
  post.forEach(([num, task, owner]) => {
    d.push([cc(num, navy, white, true), wc(task, null, darkTx), wc(owner, lightB, darkTx), bl(), bl()]);
  });

  const ws = XLSX.utils.aoa_to_sheet(d);
  ws["!cols"] = [{wch:7},{wch:46},{wch:26},{wch:22},{wch:8}];
  ws["!rows"] = d.map((_,i)=>i===0?{hpt:26}:i<4?{hpt:20}:{hpt:44});
  ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:4}},{s:{r:1,c:0},e:{r:1,c:4}}];
  XLSX.utils.book_append_sheet(wb, ws, "Phase 5 Activate");
}

// ═══════════════════════════════════════════════════════
// SHEET 8: RACI
// ═══════════════════════════════════════════════════════
{
  const d = [];
  d.push([sect("RACI MATRIX — Responsibility Assignment for Shepherd Connect Rollout"),bl(),bl(),bl(),bl(),bl(),bl()]);
  d.push([cell("R = Responsible (does the work)   A = Accountable (owns the outcome)   C = Consulted   I = Informed",false,null,subTx,9),bl(),bl(),bl(),bl(),bl(),bl()]);
  d.push([bl(),bl(),bl(),bl(),bl(),bl(),bl()]);
  d.push([hdr("Task"),hdr("Senior\nPastor"),hdr("Admin\nLead"),hdr("Teacher"),hdr("Support\nStaff"),hdr("IT /\nDeveloper"),hdr("Parents")]);

  const raciColor = { "R":"16A34A","A":"D97706","R/A":"059669","C":"1E3A8A","I":subTx };
  const raciCellBg= { "R":lightG,"A":lightY,"R/A":"ECFDF5","C":lightB,"I":midGray };

  const raciRows = [
    ["Define rollout timeline and milestones",            "A","R","I","I","C",""],
    ["Teacher briefing and onboarding",                  "I","R/A","C","","",""],
    ["Approve teacher accounts in system",               "","R/A","I","","",""],
    ["Set up classes and assign children",               "","R/A","C","","",""],
    ["Select 10 pilot families",                         "","R/A","C","I","",""],
    ["Register pilot families in app",                   "","C","","R","","A"],
    ["Pilot Sunday check-in operations",                 "","I","R","R","I","C"],
    ["Pilot Sunday class confirmation",                  "","I","R/A","I","",""],
    ["Collect pilot feedback",                           "","R/A","C","C","","C"],
    ["Fix bugs and technical issues",                    "","A","","","R",""],
    ["Draft church-wide announcement",                   "A","R","","","",""],
    ["Prepare pastoral presentation",                    "","R/A","C","","I",""],
    ["Present to Pastorate and get sign-off",            "A","R","","","",""],
    ["Pre-activation setup and checks",                  "","R/A","C","C","C",""],
    ["Activation Sunday check-in desk",                  "","I","","R/A","",""],
    ["Activation Sunday class management",               "","I","R/A","I","",""],
    ["Activation Sunday monitoring dashboard",           "","R/A","I","I","I",""],
    ["Post-activation debrief and report",               "I","R/A","C","C","C",""],
    ["Ongoing: weekly attendance and appraisals",        "","A","R","R","","I"],
    ["Ongoing: broadcast notifications to parents",      "","R/A","","","","I"],
    ["Ongoing: approve class change requests",           "","R/A","C","","","I"],
    ["Ongoing: cost management and top-ups",             "","R/A","","","",""],
  ];

  raciRows.forEach(([task,...cols]) => {
    const cells = cols.map(v => {
      if (!v) return cc("", null, null);
      return cc(v, raciCellBg[v]||null, raciColor[v]||darkTx, true);
    });
    d.push([wc(task, null, darkTx), ...cells]);
  });

  d.push([bl(),bl(),bl(),bl(),bl(),bl(),bl()]);
  d.push([cell("Where two roles share responsibility (R/A), both are accountable but one person leads. Agree in advance who leads each task.",false,null,subTx,9,true),bl(),bl(),bl(),bl(),bl(),bl()]);

  const ws = XLSX.utils.aoa_to_sheet(d);
  ws["!cols"] = [{wch:44},{wch:10},{wch:10},{wch:10},{wch:10},{wch:10},{wch:10}];
  ws["!rows"] = d.map((_,i)=>i===0?{hpt:26}:i<4?{hpt:18}:{hpt:22});
  ws["!merges"] = [
    {s:{r:0,c:0},e:{r:0,c:6}},{s:{r:1,c:0},e:{r:1,c:6}},
    {s:{r:d.length-1,c:0},e:{r:d.length-1,c:6}},
  ];
  XLSX.utils.book_append_sheet(wb, ws, "RACI");
}

// ─── Write ─────────────────────────────────────────────
const outPath = path.resolve("Shepherd_Connect_Implementation_Plan.xlsx");
XLSX.writeFile(wb, outPath);
console.log("Done:", outPath);
