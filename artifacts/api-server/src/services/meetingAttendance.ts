import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, meetingsTable, meetingParticipantsTable, usersTable, auditLogsTable, type Meeting } from "@workspace/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Pick<typeof db, "select">;
export class MeetingError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function isMeetingTeacher(user: { role: string; secondaryRoles: string | null; isActive: boolean; status: string }) {
  if (!user.isActive || user.status !== "active") return false;
  if (user.role === "teacher") return true;
  try {
    const roles: unknown = JSON.parse(user.secondaryRoles || "[]");
    return Array.isArray(roles) && roles.includes("teacher");
  } catch { return false; }
}

export function meetingWindow(startsAt: string, endsAt: string) {
  const start = new Date(startsAt), end = new Date(endsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())
      || start >= end || end.getTime() - start.getTime() > 7 * 86400_000) {
    throw new MeetingError(400, "Choose a valid sign-in window of no more than seven days.");
  }
  return { startsAt: start, endsAt: end };
}

function hash(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function parseMeetingToken(token: string) {
  const match = /^([1-9]\d{0,9})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match || Number(match[1]) > 2147483647) throw new MeetingError(400, "Invalid meeting QR code.");
  return Number(match[1]);
}
export function assertMeetingAccess(meeting: Meeting, token: string, now: Date) {
  const digest = Buffer.from(hash(token), "hex");
  const expected = Buffer.from(meeting.tokenHash || "", "hex");
  if (!meeting.isOpen || expected.length !== digest.length || !timingSafeEqual(expected, digest))
    throw new MeetingError(403, "This meeting QR code is closed, revoked or replaced.");
  if (now < meeting.startsAt || now >= meeting.endsAt)
    throw new MeetingError(403, "Meeting sign-in is outside its allowed time window.");
}

export async function meetingAudit(tx: Pick<typeof db, "insert">, actor: number, action: string, id: number, metadata: Record<string, unknown> = {}) {
  await tx.insert(auditLogsTable).values({
    userId: actor, action, entityType: "meeting_attendance", entityId: id,
    metadataJson: JSON.stringify(metadata),
  });
}
async function lockMeeting(tx: Tx, id: number) {
  const [meeting] = await tx.select().from(meetingsTable).where(eq(meetingsTable.id, id)).for("update");
  if (!meeting) throw new MeetingError(404, "Meeting not found.");
  return meeting;
}
export async function eligibleMeetingTeachers(reader: Reader = db) {
  const users = await reader.select({
    userId: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName,
    role: usersTable.role, secondaryRoles: usersTable.secondaryRoles,
    isActive: usersTable.isActive, status: usersTable.status,
  }).from(usersTable).where(and(eq(usersTable.isActive, true), eq(usersTable.status, "active")));
  return users.filter(isMeetingTeacher).map(u => ({ userId: u.userId, name: `${u.firstName} ${u.lastName}` }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
const summaryFields = {
  id: meetingsTable.id, title: meetingsTable.title,
  startsAt: meetingsTable.startsAt, endsAt: meetingsTable.endsAt, isOpen: meetingsTable.isOpen,
  activatedCount: sql<number>`(select count(*)::int from meeting_participants p where p.meeting_id = ${meetingsTable.id} and p.active)`,
  attendedCount: sql<number>`(select count(*)::int from meeting_participants p where p.meeting_id = ${meetingsTable.id} and p.signed_in_at is not null)`,
};
export async function listMeetingsFor(userId: number, admin: boolean) {
  return db.select({
    ...summaryFields,
    signedInAt: sql<string | null>`(select p.signed_in_at from meeting_participants p where p.meeting_id = ${meetingsTable.id} and p.user_id = ${userId})`,
  }).from(meetingsTable).where(admin ? undefined : sql`exists (
    select 1 from meeting_participants p where p.meeting_id = ${meetingsTable.id}
    and p.user_id = ${userId} and (p.active or p.signed_in_at is not null)
  )`).orderBy(desc(meetingsTable.startsAt), desc(meetingsTable.id));
}
export async function meetingDetail(id: number, reader: Reader = db) {
  const [meeting] = await reader.select(summaryFields).from(meetingsTable).where(eq(meetingsTable.id, id));
  if (!meeting) throw new MeetingError(404, "Meeting not found.");
  const participants = await reader.select({
    userId: meetingParticipantsTable.userId,
    name: sql<string>`${usersTable.firstName} || ' ' || ${usersTable.lastName}`,
    active: meetingParticipantsTable.active, signedInAt: meetingParticipantsTable.signedInAt,
  }).from(meetingParticipantsTable).innerJoin(usersTable, eq(usersTable.id, meetingParticipantsTable.userId))
    .where(eq(meetingParticipantsTable.meetingId, id)).orderBy(usersTable.lastName, usersTable.firstName);
  return { meeting: { ...meeting, signedInAt: null }, participants };
}
export async function saveMeeting(actor: number, input: { title: string; startsAt: string; endsAt: string }, id?: number) {
  const title = input.title.trim();
  if (!title) throw new MeetingError(400, "A meeting title is required.");
  const window = meetingWindow(input.startsAt, input.endsAt);
  return db.transaction(async tx => {
    if (id !== undefined) await lockMeeting(tx, id);
    const values = { title, ...window, isOpen: false, tokenHash: null };
    const [meeting] = id === undefined
      ? await tx.insert(meetingsTable).values({ ...values, createdBy: actor }).returning()
      : await tx.update(meetingsTable).set(values).where(eq(meetingsTable.id, id)).returning();
    await meetingAudit(tx, actor, id === undefined ? "meeting_created" : "meeting_updated", meeting.id);
    return (await meetingDetail(meeting.id, tx)).meeting;
  });
}
export async function setMeetingTeachers(actor: number, id: number, teacherIds: number[]) {
  if (teacherIds.some(id => !Number.isSafeInteger(id) || id < 1))
    throw new MeetingError(400, "Select valid teacher accounts.");
  const ids = [...new Set(teacherIds)];
  return db.transaction(async tx => {
    await lockMeeting(tx, id);
    const eligible = new Set((await eligibleMeetingTeachers(tx)).map(t => t.userId));
    if (ids.some(id => !eligible.has(id))) throw new MeetingError(400, "Only active teacher accounts can be activated for a meeting.");
    await tx.update(meetingParticipantsTable).set({ active: false }).where(eq(meetingParticipantsTable.meetingId, id));
    if (ids.length) await tx.insert(meetingParticipantsTable).values(ids.map(userId => ({ meetingId: id, userId, active: true })))
      .onConflictDoUpdate({
        target: [meetingParticipantsTable.meetingId, meetingParticipantsTable.userId], set: { active: true },
      });
    await meetingAudit(tx, actor, "meeting_participants_updated", id, { activatedCount: ids.length });
    return meetingDetail(id, tx);
  });
}
export async function issueMeetingToken(actor: number, id: number) {
  return db.transaction(async tx => {
    const meeting = await lockMeeting(tx, id);
    const [{ now }] = await tx.select({ now: sql<Date>`clock_timestamp()` }).from(meetingsTable).where(eq(meetingsTable.id, id));
    if (new Date(now) >= meeting.endsAt) throw new MeetingError(409, "This meeting sign-in window has ended. Edit the window before reopening.");
    const [participant] = await tx.select({ id: meetingParticipantsTable.userId }).from(meetingParticipantsTable)
      .where(and(eq(meetingParticipantsTable.meetingId, id), eq(meetingParticipantsTable.active, true))).limit(1);
    if (!participant) throw new MeetingError(409, "Activate at least one teacher before generating a QR code.");
    const token = `${id}.${randomBytes(32).toString("base64url")}`;
    await tx.update(meetingsTable).set({ tokenHash: hash(token), isOpen: true }).where(eq(meetingsTable.id, id));
    await meetingAudit(tx, actor, "meeting_qr_issued", id);
    return { token, meeting: (await meetingDetail(id, tx)).meeting };
  });
}
export async function closeMeetingSignIn(actor: number, id: number) {
  return db.transaction(async tx => {
    await lockMeeting(tx, id);
    await tx.update(meetingsTable).set({ isOpen: false, tokenHash: null }).where(eq(meetingsTable.id, id));
    await meetingAudit(tx, actor, "meeting_closed", id);
    return (await meetingDetail(id, tx)).meeting;
  });
}
export async function recordMeetingSignIn(userId: number, token: string) {
  const id = parseMeetingToken(token);
  // QR replacement, closure, participant activation and sign-ins all serialize on
  // this row. The composite participant PK also prevents concurrent duplicates.
  return db.transaction(async tx => {
    const meeting = await lockMeeting(tx, id);
    const [user] = await tx.select({
      role: usersTable.role, secondaryRoles: usersTable.secondaryRoles,
      isActive: usersTable.isActive, status: usersTable.status,
    }).from(usersTable).where(eq(usersTable.id, userId)).for("share");
    if (!user || !isMeetingTeacher(user)) throw new MeetingError(403, "Only active teacher accounts can sign in.");
    const [{ now }] = await tx.select({ now: sql<Date>`clock_timestamp()` }).from(meetingsTable).where(eq(meetingsTable.id, id));
    const signedInAt = new Date(now);
    assertMeetingAccess(meeting, token, signedInAt);
    const [participant] = await tx.select().from(meetingParticipantsTable)
      .where(and(eq(meetingParticipantsTable.meetingId, id), eq(meetingParticipantsTable.userId, userId)));
    if (!participant?.active) throw new MeetingError(403, "You have not been activated for this meeting. Please contact an administrator.");
    if (participant.signedInAt) return { meetingId: id, title: meeting.title, signedInAt: participant.signedInAt, duplicate: true };
    await tx.update(meetingParticipantsTable).set({ signedInAt })
      .where(and(eq(meetingParticipantsTable.meetingId, id), eq(meetingParticipantsTable.userId, userId)));
    await meetingAudit(tx, userId, "meeting_signed_in", id);
    return { meetingId: id, title: meeting.title, signedInAt, duplicate: false };
  });
}
