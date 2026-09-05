import { and, eq, inArray } from "drizzle-orm";
import { attendanceTable, childrenTable, classesTable, familiesTable, teacherAllocationsTable, teachersTable } from "@workspace/db";
import { createNotificationDelivery } from "../services/notificationOutbox";

export type AttendanceNotificationTransition = "checked_in" | "checked_in_reset" | "in_transit" | "arrived" | "picked_up";

/** Writes attendance notification projections and delivery intent through the caller's transaction. */
export async function createAttendanceNotificationIntents(
  tx: any,
  record: typeof attendanceTable.$inferSelect,
  transition: AttendanceNotificationTransition,
) {
  const [child] = await tx.select().from(childrenTable).where(eq(childrenTable.id, record.childId));
  if (!child) return;
  const [family] = await tx.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
  const [cls] = await tx.select().from(classesTable).where(eq(classesTable.id, record.classId));
  const className = cls?.name ?? "class";
  const serviceName = record.serviceSlot === "7am"
    ? "First Service"
    : record.serviceSlot === "10:30am"
      ? "Second Service"
      : `${record.serviceSlot} service`;
  const parents = [...new Set([family?.parent1Id, family?.parent2Id].filter((id): id is number => !!id))];
  let teachers: number[] = [];
  if (transition !== "arrived") {
    const allocations = await tx.select().from(teacherAllocationsTable).where(and(
      eq(teacherAllocationsTable.classId, record.classId), eq(teacherAllocationsTable.serviceDate, record.serviceDate),
    ));
    const teacherIds = [...new Set<number>(allocations.map((a: any) => Number(a.teacherId)).filter(Number.isSafeInteger))];
    if (teacherIds.length) {
      const rows = await tx.select({ userId: teachersTable.userId }).from(teachersTable).where(inArray(teachersTable.id, teacherIds));
      teachers = [...new Set<number>(rows.map((row: any) => Number(row.userId)).filter(Number.isSafeInteger))];
    }
  }
  const parentCopy = {
    checked_in: ["child_checked_in", "Drop-off Confirmed", `${child.firstName} has been safely dropped off for the ${record.serviceSlot} service. They will be escorted to ${className} shortly.`],
    checked_in_reset: ["child_checked_in", "Drop-off Confirmed", `${child.firstName} has been safely dropped off for the ${record.serviceSlot} service. They will be escorted to ${className} shortly.`],
    in_transit: ["child_in_transit", "Child En Route to Class", `${child.firstName} is being escorted to ${className} right now.`],
    arrived: ["child_arrived_in_class", "Child Safely in Class", `${child.firstName} is now safely in ${className}. Have a blessed service!`],
    picked_up: ["child_picked_up", "Child Picked Up", `${child.firstName} has been successfully checked out from ${serviceName}. Safe journey home!`],
  } as const;
  const teacherCopy = {
    checked_in: ["child_dropped_off", "Child Dropped Off", `${child.firstName} ${child.lastName} has just been dropped off for the ${record.serviceSlot} service and will be heading to ${className} shortly.`],
    checked_in_reset: ["child_dropped_off", "Child Dropped Off", `${child.firstName} ${child.lastName} has just been dropped off for the ${record.serviceSlot} service and will be heading to ${className} shortly.`],
    in_transit: ["child_in_transit", "Child En Route to Your Class", `${child.firstName} ${child.lastName} is being escorted to ${className} right now — expect them shortly.`],
    picked_up: ["child_picked_up", "Child Checked Out", `${child.firstName} ${child.lastName} has been checked out from ${serviceName} and is no longer in your care.`],
  } as const;
  const recipients = transition === "arrived"
    ? parents.map(userId => ({ userId, copy: parentCopy[transition], channels: ["whatsapp", "sms", "email"] as const }))
    : [
        ...parents.map(userId => ({
          userId,
          copy: parentCopy[transition],
          channels: ["whatsapp", "sms", "email"] as const,
        })),
        ...teachers.map(userId => ({
          userId,
          copy: teacherCopy[transition as Exclude<AttendanceNotificationTransition, "arrived">],
          channels: ["whatsapp"] as const,
        })),
      ];
  for (const { userId, copy, channels } of recipients) {
    await createNotificationDelivery(tx, {
      logicalIdentity: `attendance:${record.id}:${transition}:${userId}`,
      domainType: "attendance", domainIdentifier: String(record.id),
      projection: { userId, type: copy[0], title: copy[1], message: copy[2], metadata: { attendanceId: record.id, childId: record.childId, classId: record.classId, serviceDate: record.serviceDate, serviceSlot: record.serviceSlot, transition } },
      channels: [...channels], templateKey: copy[0],
    });
  }
}