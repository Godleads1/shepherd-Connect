import { Router, type Request, type Response, type NextFunction } from "express";
import { CreateMeetingBody, ScanMeetingBody, SetMeetingParticipantsBody } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import {
  MeetingError, closeMeetingSignIn, deleteMeeting, eligibleMeetingTeachers, issueMeetingToken, listMeetingsFor,
  meetingAudit, meetingDetail, recordMeetingSignIn, saveMeeting, setMeetingTeachers,
} from "../services/meetingAttendance";
import { streamPdf, renderReportPdf } from "../lib/pdf";
import { formatServiceDateTime } from "../lib/serviceTime";
import { teacherReportCsv } from "./teacherAttendanceReports";
import { sendRouteError } from "../lib/httpErrors";

const router = Router();
const admin = (req: Request) => ["admin", "super_admin"].includes(req.user!.role);
const idOf = (req: Request) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) throw new MeetingError(400, "Invalid meeting.");
  return id;
};
function wrap(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof MeetingError) {
        res.status(error.status).json({ error: error.message }); return;
      }
      req.log.error({ err: error }, "Meeting attendance request failed");
      sendRouteError(req, res, error, "Meeting attendance is unavailable. Please try again.");
    }
  };
}
const adminsOnly = async (req: Request, res: Response, next: NextFunction) => {
  if (admin(req)) { next(); return; }
  await meetingAudit(db, req.user!.userId, "meeting_access_denied", 0);
  res.status(403).json({ error: "Only administrators can manage meeting attendance." });
};
router.use("/meetings", authMiddleware, (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

router.get("/meetings", wrap(async (req, res) => {
  // Active teacher membership (including secondary roles) is rechecked on scan.
  if (!admin(req) && req.user!.role !== "teacher") {
    res.status(403).json({ error: "Switch to your teacher role to view meeting invitations." }); return;
  }
  res.json(await listMeetingsFor(req.user!.userId, admin(req)));
}));
router.get("/meetings/teachers", adminsOnly, wrap(async (_req, res) => {
  res.json(await eligibleMeetingTeachers());
}));
router.post("/meetings/scan", wrap(async (req, res) => {
  const parsed = ScanMeetingBody.strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Scan a valid meeting QR code." }); return; }
  res.json(await recordMeetingSignIn(req.user!.userId, parsed.data.token));
}));
router.post("/meetings", adminsOnly, wrap(async (req, res) => {
  const parsed = CreateMeetingBody.strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Provide a title and valid sign-in start and end times." }); return; }
  res.status(201).json(await saveMeeting(req.user!.userId, parsed.data));
}));
router.get("/meetings/:id", adminsOnly, wrap(async (req, res) => {
  res.json(await db.transaction(tx => meetingDetail(idOf(req), tx), { isolationLevel: "repeatable read", accessMode: "read only" }));
}));
router.patch("/meetings/:id", adminsOnly, wrap(async (req, res) => {
  const parsed = CreateMeetingBody.strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Provide a title and valid sign-in start and end times." }); return; }
  res.json(await saveMeeting(req.user!.userId, parsed.data, idOf(req)));
}));
router.delete("/meetings/:id", adminsOnly, wrap(async (req, res) => {
  res.json(await deleteMeeting(req.user!.userId, idOf(req)));
}));
router.put("/meetings/:id/participants", adminsOnly, wrap(async (req, res) => {
  const parsed = SetMeetingParticipantsBody.strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Select valid teacher accounts." }); return; }
  res.json(await setMeetingTeachers(req.user!.userId, idOf(req), parsed.data.teacherIds));
}));
router.post("/meetings/:id/qr", adminsOnly, wrap(async (req, res) => {
  res.json(await issueMeetingToken(req.user!.userId, idOf(req)));
}));
router.post("/meetings/:id/close", adminsOnly, wrap(async (req, res) => {
  res.json(await closeMeetingSignIn(req.user!.userId, idOf(req)));
}));
router.get("/meetings/:id/report", adminsOnly, wrap(async (req, res) => {
  const id = idOf(req), format = req.query.format;
  if (format !== "csv" && format !== "pdf") { res.status(400).json({ error: "Choose CSV or PDF." }); return; }
  const detail = await db.transaction(async tx => {
    const result = await meetingDetail(id, tx);
    await meetingAudit(tx, req.user!.userId, "meeting_report_export", id, { format, rowCount: result.participants.length });
    return result;
  }, { isolationLevel: "repeatable read" });
  const { meeting, participants } = detail;
  const rows = participants.map(p => [
    p.name, p.active ? "Activated" : "Deactivated",
    p.signedInAt ? "Present" : "Not signed in",
    p.signedInAt ? formatServiceDateTime(p.signedInAt) : "Not recorded",
  ]);
  const filename = `meeting-${id}-attendance.${format}`;
  const window = `${formatServiceDateTime(meeting.startsAt)} to ${formatServiceDateTime(meeting.endsAt)} WAT`;
  if (format === "csv") {
    res.type("text/csv").attachment(filename).send("\uFEFF" + teacherReportCsv([
      ["Meeting", meeting.title], ["Sign-in window", window],
      ["Activated teachers", String(meeting.activatedCount)], ["Recorded attendees", String(meeting.attendedCount)],
      [], ["Teacher", "Meeting activation", "Attendance", "Sign-in time (WAT)"], ...rows,
    ])); return;
  }
  streamPdf(res, filename, doc => renderReportPdf(doc, {
    title: "Meeting Attendance",
    subtitle: `${meeting.title}\n${window}`,
    columns: [{ label: "Teacher", width: 170 }, { label: "Activation", width: 90 }, { label: "Attendance", width: 100 }, { label: "Sign-in (WAT)", width: 155 }],
    rows,
    summaryStats: [
      { label: "Activated teachers", value: String(meeting.activatedCount) },
      { label: "Recorded attendees", value: String(meeting.attendedCount) },
      { label: "Awaiting sign-in", value: String(participants.filter(p => p.active && !p.signedInAt).length) },
    ],
  }));
}));
export default router;
