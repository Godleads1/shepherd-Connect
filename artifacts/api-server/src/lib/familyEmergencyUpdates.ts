export type FamilyEmergencyUpdateRow = {
  id: number;
  emergencyId: number;
  childId: number;
  childFirstName: string;
  familyStatus: string;
  familyInstructions: string;
  publishedAt: Date;
};

/**
 * This allowlist is the only parent-facing emergency DTO. Keep staff message,
 * author identity, notes, evidence and report fields out of its input/output.
 */
export function toFamilyEmergencyUpdateDto(row: FamilyEmergencyUpdateRow) {
  return {
    id: row.id,
    emergencyId: row.emergencyId,
    childId: row.childId,
    childFirstName: row.childFirstName,
    status: row.familyStatus,
    instructions: row.familyInstructions,
    publishedAt: row.publishedAt.toISOString(),
  };
}

export function scopeFamilyEmergencyUpdates(
  rows: FamilyEmergencyUpdateRow[],
  ownedChildIds: readonly number[],
) {
  const owned = new Set(ownedChildIds);
  return rows.filter(row => owned.has(row.childId)).map(toFamilyEmergencyUpdateDto);
}