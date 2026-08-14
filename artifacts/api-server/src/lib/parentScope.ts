import { or, eq, inArray } from "drizzle-orm";
import { db, familiesTable, childrenTable } from "@workspace/db";

/**
 * Parent-ownership helpers. A parent "owns" a family when they are parent1 or
 * parent2 of it, and owns a child when the child belongs to an owned family.
 * Used to scope parent-role access on child/family/attendance/consent routes.
 */

export async function getParentFamilyIds(userId: number): Promise<number[]> {
  const fams = await db
    .select({ id: familiesTable.id })
    .from(familiesTable)
    .where(or(eq(familiesTable.parent1Id, userId), eq(familiesTable.parent2Id, userId)));
  return fams.map(f => f.id);
}

export async function parentOwnsFamily(userId: number, familyId: number): Promise<boolean> {
  const ids = await getParentFamilyIds(userId);
  return ids.includes(familyId);
}

export async function getParentChildIds(userId: number): Promise<number[]> {
  const familyIds = await getParentFamilyIds(userId);
  if (familyIds.length === 0) return [];
  const kids = await db
    .select({ id: childrenTable.id })
    .from(childrenTable)
    .where(inArray(childrenTable.familyId, familyIds));
  return kids.map(k => k.id);
}

export async function parentOwnsChild(userId: number, childId: number): Promise<boolean> {
  const [child] = await db
    .select({ familyId: childrenTable.familyId })
    .from(childrenTable)
    .where(eq(childrenTable.id, childId));
  if (!child) return false;
  return parentOwnsFamily(userId, child.familyId);
}
