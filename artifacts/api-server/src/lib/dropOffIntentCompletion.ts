import { eq, and, inArray } from "drizzle-orm";
import { db, attendanceTable, childrenTable, dropOffIntentsTable } from "@workspace/db";

/**
 * Mark a family's "on our way" intent as arrived — but only once its selection
 * is actually fulfilled: every intended child (that has a class) has an
 * attendance record for every intended service slot on that date.
 *
 * Shared by the QR auto-check-in flow and the normal manual check-in route so
 * a partial check-in (one child of three, or one slot of two) keeps the intent
 * open for the remaining children/slots.
 *
 * Returns true if the intent was transitioned to arrived.
 */
export async function resolveDropOffIntentIfFulfilled(familyId: number, serviceDate: string): Promise<boolean> {
  const [intent] = await db.select().from(dropOffIntentsTable)
    .where(and(
      eq(dropOffIntentsTable.familyId, familyId),
      eq(dropOffIntentsTable.serviceDate, serviceDate),
      eq(dropOffIntentsTable.status, "on_the_way"),
    ));
  if (!intent) return false;

  const familyChildren = await db.select().from(childrenTable)
    .where(eq(childrenTable.familyId, familyId));

  // Intended children: the selection, or the whole family when unset.
  // Children without a class can never be checked in — exclude them so the
  // intent doesn't stay open forever.
  const selectedIds = intent.childIds && intent.childIds.length > 0
    ? new Set(intent.childIds)
    : null;
  const intended = familyChildren.filter(c =>
    c.currentClassId && (!selectedIds || selectedIds.has(c.id)));

  const slots: ("7am" | "10:30am")[] =
    intent.serviceSlot === "both" ? ["7am", "10:30am"] : [intent.serviceSlot];

  let fulfilled = true;
  if (intended.length > 0) {
    const rows = await db.select().from(attendanceTable)
      .where(and(
        eq(attendanceTable.serviceDate, serviceDate),
        inArray(attendanceTable.childId, intended.map(c => c.id)),
      ));
    const have = new Set(rows.map(r => `${r.childId}:${r.serviceSlot}`));
    fulfilled = intended.every(c => slots.every(s => have.has(`${c.id}:${s}`)));
  }

  if (!fulfilled) return false;
  await db.update(dropOffIntentsTable)
    .set({ status: "arrived" })
    .where(and(eq(dropOffIntentsTable.id, intent.id), eq(dropOffIntentsTable.status, "on_the_way")));
  return true;
}
