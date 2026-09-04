import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { attendanceTable, childrenTable, classesTable, classMergesTable, custodyEpisodeEventsTable, custodyEpisodesTable, familiesTable, teachersTable, teacherAllocationsTable, usersTable } from "@workspace/db";
import { createAttendanceNotificationIntents } from "../lib/attendanceNotificationIntents";
import { notifyClassRefresh, resolveCustodyClassIds, resolvePickupRequestsForCheckout } from "./classroomDisplayAlerts";
import { createNotificationDelivery } from "./notificationOutbox";

const slotsFor = (request: "first" | "second" | "both") =>
  request === "both" ? ["7am", "10:30am"] as const : [request === "first" ? "7am" : "10:30am"] as const;

export class CustodyHandoverError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

async function createCustodyRequestTeacherIntents(tx: any, episode: typeof custodyEpisodesTable.$inferSelect, child: typeof childrenTable.$inferSelect) {
  if (!child.currentClassId) return [];
  const [parent] = await tx.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(usersTable).where(eq(usersTable.id, episode.requestedBy));
  const [home] = await tx.select({ name: classesTable.name }).from(classesTable)
    .where(eq(classesTable.id, child.currentClassId));
  const services = episode.requestedServices === "both" ? ["first", "second"] as const : [episode.requestedServices];
  const destinations = new Map<number, { name: string; homeName?: string }>();
  for (const service of services) {
    const slot = service === "first" ? "7am" : "10:30am";
    const [merge] = await tx.select({ targetClassId: classMergesTable.targetClassId }).from(classMergesTable)
      .where(and(eq(classMergesTable.sourceClassId, child.currentClassId), eq(classMergesTable.serviceDate, episode.serviceDate),
        or(isNull(classMergesTable.serviceSlot), eq(classMergesTable.serviceSlot, slot)))).limit(1);
    const classId = merge?.targetClassId ?? child.currentClassId;
    const [target] = await tx.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, classId));
    destinations.set(classId, { name: target?.name ?? home?.name ?? "Classroom", ...(merge ? { homeName: home?.name ?? "Assigned class" } : {}) });
  }
  const childName = `${child.firstName} ${child.lastName}`;
  const parentName = parent ? `${parent.firstName} ${parent.lastName}` : "A parent";
  const serviceText = episode.requestedServices === "both" ? "7am and 10:30am services" : episode.requestedServices === "first" ? "7am service" : "10:30am service";
  const teacherDestinations = new Map<number, Array<{ classId: number; name: string; homeName?: string }>>();
  for (const [classId, destination] of destinations) {
    const allocations = await tx.select({ userId: teachersTable.userId }).from(teacherAllocationsTable)
      .innerJoin(teachersTable, eq(teachersTable.id, teacherAllocationsTable.teacherId))
      .where(and(eq(teacherAllocationsTable.classId, classId), eq(teacherAllocationsTable.serviceDate, episode.serviceDate)));
    for (const userId of new Set<number>(allocations.map((row: { userId: number }) => row.userId))) {
      const assigned = teacherDestinations.get(userId) ?? [];
      assigned.push({ classId, ...destination });
      teacherDestinations.set(userId, assigned);
    }
  }
  for (const [userId, assigned] of teacherDestinations) {
    const contexts = assigned.map(destination => destination.homeName
      ? `${destination.homeName} merged into ${destination.name}`
      : destination.name);
    await createNotificationDelivery(tx, {
      logicalIdentity: `custody-request:${episode.id}:teacher:${userId}`,
      domainType: "custody_request",
      domainIdentifier: String(episode.id),
      projection: {
        userId, type: "custody_checkin_request", title: "Child Coming to Class",
        message: `${childName} is being checked in by ${parentName} for the ${serviceText}. Destination${contexts.length === 1 ? "" : "s"}: ${contexts.join("; ")}.`,
        metadata: {
          episodeId: episode.id,
          childId: child.id,
          classIds: assigned.map(destination => destination.classId),
          serviceDate: episode.serviceDate,
        },
      },
      channels: ["whatsapp"],
      templateKey: "custody_checkin_request",
    });
  }
  return [...destinations.keys()];
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
  if (pending) {
    if (
      pending.status === "requested"
      && pending.requestedBy === input.requestedBy
      && pending.requestedServices === input.requestedServices
    ) return { episode: pending, duplicate: true };
    throw new CustodyHandoverError(409, "Child already has a pending or accepted custody episode");
  }
  const [episode] = await tx.insert(custodyEpisodesTable).values({
    childId: child.id, familyId: child.familyId, serviceDate: input.serviceDate,
    requestedServices: input.requestedServices, requestedBy: input.requestedBy,
  }).returning();
  const classIds = await createCustodyRequestTeacherIntents(tx, episode, child);
  await notifyClassRefresh(tx, classIds);
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
    if (episodeBeforeAcceptance.status === "accepted") {
      if (episodeBeforeAcceptance.custodianUserId !== input.custodianUserId) {
        throw new CustodyHandoverError(403, "This custody request was accepted by another support custodian");
      }
      return { episode: episodeBeforeAcceptance, attendance: [], duplicate: true };
    }
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
    // Classes serve both services operationally. A child's assigned class
    // remains authoritative regardless of which service the family selected.
    if (currentClass) assignedClasses.set(slot, currentClass);
    else {
      const [resolved] = await tx.select().from(classesTable).where(and(
        sql`${classesTable.ageMin} <= ${age}`, sql`${classesTable.ageMax} >= ${age}`,
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
  await notifyClassRefresh(tx, await resolveCustodyClassIds(
    tx, requested.childId, requested.serviceDate, requested.requestedServices,
  ));
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
  if (current.status === "picked_up") return { episode: current, attendance: [], resolvedPickupRequests: [], duplicate: true };
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
  if (!released) return { episode: current, attendance: [], resolvedPickupRequests: [], duplicate: true };
  const rows = await tx.update(attendanceTable).set({
    status: "picked_up", checkOutTime: now, checkedOutBy: input.actorUserId,
  }).where(and(eq(attendanceTable.custodyEpisodeId, input.episodeId), inArray(attendanceTable.status, ["dropped_off", "in_transit", "in_class"]))).returning();
  for (const row of rows) await createAttendanceNotificationIntents(tx, row, "picked_up");
  const resolvedPickupRequests = await resolvePickupRequestsForCheckout(tx, {
    childId: current.childId,
    serviceDate: current.serviceDate,
    actorUserId: input.actorUserId,
    resolvedAt: now,
  });
  return { episode: released, attendance: rows, resolvedPickupRequests, duplicate: false };
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
  if (cancelled) await notifyClassRefresh(tx, await resolveCustodyClassIds(
    tx, episode.childId, episode.serviceDate, episode.requestedServices,
  ));
  return { episode: cancelled ?? episode, duplicate: !cancelled };
}