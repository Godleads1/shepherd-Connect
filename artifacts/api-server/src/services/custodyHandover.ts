import { and, eq, inArray, or, sql } from "drizzle-orm";
import { attendanceTable, childrenTable, classesTable, custodyEpisodeEventsTable, custodyEpisodesTable, familiesTable } from "@workspace/db";
import { createAttendanceNotificationIntents } from "../lib/attendanceNotificationIntents";

const slotsFor = (request: "first" | "second" | "both") =>
  request === "both" ? ["7am", "10:30am"] as const : [request === "first" ? "7am" : "10:30am"] as const;

export class CustodyHandoverError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export async function requestCustodyEpisode(tx: any, input: {
  childId: number; serviceDate: string; requestedServices: "first" | "second" | "both"; requestedBy: number; eventId?: string;
}) {
  const lockKey = Number(input.serviceDate.replace(/-/g, ""));
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.childId}, ${lockKey})`);
  if (input.eventId) {
    const [event] = await tx.select().from(custodyEpisodeEventsTable).where(and(
      eq(custodyEpisodeEventsTable.userId, input.requestedBy), eq(custodyEpisodeEventsTable.eventId, input.eventId),
      eq(custodyEpisodeEventsTable.operation, "request"),
    ));
    if (event?.episodeId) {
      const [episode] = await tx.select().from(custodyEpisodesTable).where(eq(custodyEpisodesTable.id, event.episodeId));
      if (episode) return { episode, duplicate: true };
    }
  }
  const [child] = await tx.select().from(childrenTable).where(eq(childrenTable.id, input.childId));
  if (!child) throw new CustodyHandoverError(404, "Child not found");
  const [family] = await tx.select().from(familiesTable).where(and(eq(familiesTable.id, child.familyId), or(
    eq(familiesTable.parent1Id, input.requestedBy), eq(familiesTable.parent2Id, input.requestedBy),
  )));
  if (!family) throw new CustodyHandoverError(403, "You may only request custody handover for your own child");
  const [pending] = await tx.select().from(custodyEpisodesTable).where(and(
    eq(custodyEpisodesTable.childId, input.childId), eq(custodyEpisodesTable.serviceDate, input.serviceDate),
    inArray(custodyEpisodesTable.status, ["requested", "accepted"]),
  ));
  if (pending) throw new CustodyHandoverError(409, "Child already has a pending or accepted custody episode");
  const [episode] = await tx.insert(custodyEpisodesTable).values({
    childId: child.id, familyId: child.familyId, serviceDate: input.serviceDate,
    requestedServices: input.requestedServices, requestedBy: input.requestedBy,
  }).returning();
  if (input.eventId) await tx.insert(custodyEpisodeEventsTable).values({
    userId: input.requestedBy, eventId: input.eventId, operation: "request", episodeId: episode.id,
  });
  return { episode, duplicate: false };
}

export async function acceptPhysicalCustody(tx: any, input: {
  episodeId: number; custodianUserId: number; eventId?: string;
}) {
  const [requested] = await tx.select().from(custodyEpisodesTable).where(eq(custodyEpisodesTable.id, input.episodeId));
  if (!requested) throw new CustodyHandoverError(404, "Custody episode not found");
  const lockKey = Number(requested.serviceDate.replace(/-/g, ""));
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${requested.childId}, ${lockKey})`);
  if (input.eventId) {
    const [priorEvent] = await tx.select().from(custodyEpisodeEventsTable).where(and(
      eq(custodyEpisodeEventsTable.userId, input.custodianUserId),
      eq(custodyEpisodeEventsTable.eventId, input.eventId),
      eq(custodyEpisodeEventsTable.operation, "accept"),
    ));
    if (priorEvent?.episodeId) {
      const [episode] = await tx.select().from(custodyEpisodesTable).where(eq(custodyEpisodesTable.id, priorEvent.episodeId));
      if (episode) return { episode, duplicate: true };
    }
  }
  const [episodeBeforeAcceptance] = await tx.select().from(custodyEpisodesTable).where(eq(custodyEpisodesTable.id, input.episodeId));
  if (episodeBeforeAcceptance.status !== "requested") {
    if (episodeBeforeAcceptance.status === "accepted") return { episode: episodeBeforeAcceptance, attendance: [], duplicate: true };
    throw new CustodyHandoverError(409, "Only a requested custody episode can be accepted");
  }
  const [child] = await tx.select().from(childrenTable).where(eq(childrenTable.id, requested.childId));
  if (!child) throw new CustodyHandoverError(404, "Child not found");
  const birthDate = new Date(`${child.dob}T00:00:00Z`);
  const handoverDate = new Date(`${requested.serviceDate}T00:00:00Z`);
  const age = handoverDate.getUTCFullYear() - birthDate.getUTCFullYear()
    - (handoverDate < new Date(Date.UTC(handoverDate.getUTCFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate())) ? 1 : 0);
  const [currentClass] = child.currentClassId
    ? await tx.select().from(classesTable).where(eq(classesTable.id, child.currentClassId))
    : [];
  const slots = slotsFor(requested.requestedServices);
  const assignedClasses = new Map<string, typeof classesTable.$inferSelect>();
  for (const slot of slots) {
    if (currentClass?.serviceSlot === slot) assignedClasses.set(slot, currentClass);
    else {
      const [resolved] = await tx.select().from(classesTable).where(and(
        eq(classesTable.serviceSlot, slot), sql`${classesTable.ageMin} <= ${age}`, sql`${classesTable.ageMax} >= ${age}`,
      )).limit(1);
      if (!resolved) throw new CustodyHandoverError(422, `No assigned class is available for the ${slot} service`);
      assignedClasses.set(slot, resolved);
    }
  }
  const acceptedAt = new Date();
  const [episode] = await tx.update(custodyEpisodesTable).set({
    status: "accepted", custodianUserId: input.custodianUserId, acceptedAt,
  }).where(and(eq(custodyEpisodesTable.id, requested.id), eq(custodyEpisodesTable.status, "requested"))).returning();
  if (!episode) throw new CustodyHandoverError(409, "Custody episode is no longer awaiting acceptance");
  const attendance = [];
  for (const serviceSlot of slots) {
    const assignedClass = assignedClasses.get(serviceSlot)!;
    const [row] = await tx.insert(attendanceTable).values({
      childId: requested.childId, classId: assignedClass.id, serviceDate: requested.serviceDate, serviceSlot,
      custodyEpisodeId: episode.id, checkInTime: new Date(), checkedInBy: input.custodianUserId,
      classArrivalTime: new Date(), confirmedByTeacherId: input.custodianUserId, status: "in_class",
    }).returning();
    attendance.push(row);
    await createAttendanceNotificationIntents(tx, row, "arrived");
  }
  if (input.eventId) await tx.insert(custodyEpisodeEventsTable).values({
    userId: input.custodianUserId, eventId: input.eventId, operation: "accept", episodeId: episode.id,
  });
  return { episode, attendance, duplicate: false };
}

export async function releasePhysicalCustody(tx: any, input: {
  episodeId: number; actorUserId: number; overrideReason?: string;
}) {
  const [episode] = await tx.select().from(custodyEpisodesTable).where(eq(custodyEpisodesTable.id, input.episodeId));
  if (!episode) throw new CustodyHandoverError(404, "Custody episode not found");
  const lockKey = Number(episode.serviceDate.replace(/-/g, ""));
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${episode.childId}, ${lockKey})`);
  const [current] = await tx.select().from(custodyEpisodesTable).where(eq(custodyEpisodesTable.id, input.episodeId));
  if (!current) throw new CustodyHandoverError(404, "Custody episode not found");
  if (current.status === "picked_up") return { episode: current, attendance: [], duplicate: true };
  if (current.status !== "accepted") throw new CustodyHandoverError(409, "Only accepted custody can be checked out");
  if (!input.overrideReason && current.custodianUserId !== input.actorUserId) {
    throw new CustodyHandoverError(403, "Only the accepting support custodian can complete normal checkout");
  }
  const now = new Date();
  const [released] = await tx.update(custodyEpisodesTable).set({
    status: "picked_up", pickedUpAt: now, pickedUpBy: input.actorUserId,
    ...(input.overrideReason ? { overrideReason: input.overrideReason, overriddenBy: input.actorUserId } : {}),
    checkoutMode: input.overrideReason ? "admin_override" : "normal",
  }).where(and(eq(custodyEpisodesTable.id, input.episodeId), eq(custodyEpisodesTable.status, "accepted"))).returning();
  if (!released) return { episode: current, attendance: [], duplicate: true };
  const rows = await tx.update(attendanceTable).set({
    status: "picked_up", checkOutTime: now, checkedOutBy: input.actorUserId,
  }).where(and(eq(attendanceTable.custodyEpisodeId, input.episodeId), inArray(attendanceTable.status, ["dropped_off", "in_transit", "in_class"]))).returning();
  for (const row of rows) await createAttendanceNotificationIntents(tx, row, "picked_up");
  return { episode: released, attendance: rows, duplicate: false };
}

export async function cancelCustodyRequest(tx: any, input: { episodeId: number; parentUserId: number }) {
  const [episode] = await tx.select().from(custodyEpisodesTable).where(eq(custodyEpisodesTable.id, input.episodeId));
  if (!episode) throw new CustodyHandoverError(404, "Custody episode not found");
  const lockKey = Number(episode.serviceDate.replace(/-/g, ""));
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${episode.childId}, ${lockKey})`);
  const [owned] = await tx.select().from(familiesTable).where(and(eq(familiesTable.id, episode.familyId), or(
    eq(familiesTable.parent1Id, input.parentUserId), eq(familiesTable.parent2Id, input.parentUserId),
  )));
  if (!owned) throw new CustodyHandoverError(403, "You may only cancel your own child's request");
  if (episode.status !== "requested") {
    if (episode.status === "cancelled") return { episode, duplicate: true };
    throw new CustodyHandoverError(409, "A custody request may only be cancelled before acceptance");
  }
  const [cancelled] = await tx.update(custodyEpisodesTable).set({ status: "cancelled" })
    .where(and(eq(custodyEpisodesTable.id, input.episodeId), eq(custodyEpisodesTable.status, "requested"))).returning();
  return { episode: cancelled ?? episode, duplicate: !cancelled };
}