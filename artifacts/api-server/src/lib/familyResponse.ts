import { familiesTable } from "@workspace/db";

/** Public family profile fields. Internal staff notes are deliberately absent. */
export function toSafeFamilyResponse(family: typeof familiesTable.$inferSelect) {
  return {
    id: family.id,
    familyCode: family.familyCode,
    parent1Id: family.parent1Id,
    parent2Id: family.parent2Id,
    address: family.address,
    emergencyContactName: family.emergencyContactName,
    emergencyContactPhone: family.emergencyContactPhone,
    isGuest: family.isGuest,
    createdAt: family.createdAt,
  };
}