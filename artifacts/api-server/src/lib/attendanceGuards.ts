/**
 * Cross-service check-in guard.
 *
 * Rule: a child who is checked in for one service and has NOT been checked
 * out (picked up) may not be checked in for a different service on the same
 * day. Staff must check the child out of the first service before checking
 * them in for the second — this keeps pickup accountability intact between
 * services.
 *
 * The only exception is a deliberate "both services" booking made at
 * drop-off (family staying for both services), which callers opt into
 * explicitly.
 */

export type SlotStatusRecord = { serviceSlot: string; status: string };

/**
 * Given all of a child's attendance records for one service date, returns
 * the slot name of a record that blocks a fresh check-in to `targetSlot`
 * (i.e. an active — not picked up — record in a DIFFERENT slot), or null
 * if nothing blocks it.
 */
export function findActiveOtherSlot(
  records: SlotStatusRecord[],
  targetSlot: string,
): string | null {
  const blocking = records.find(
    (r) => r.serviceSlot !== targetSlot && r.status !== "picked_up",
  );
  return blocking ? blocking.serviceSlot : null;
}

/** Friendly message telling staff why the check-in was blocked. */
export function stillCheckedInMessage(blockingSlot: string, targetSlot: string): string {
  return `This child is still checked in for the ${blockingSlot} service. Check them out of the ${blockingSlot} service first, then check in for ${targetSlot}.`;
}
