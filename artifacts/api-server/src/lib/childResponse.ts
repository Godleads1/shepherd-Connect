import { childrenTable } from "@workspace/db";

/**
 * The face descriptor is an authentication-grade biometric template, never a
 * general child profile field. Keep generic API responses on this explicit
 * allow-list so adding a database credential column cannot disclose it.
 */
export function toSafeChildResponse(
  child: typeof childrenTable.$inferSelect,
  extra: Record<string, unknown> = {},
) {
  return {
    id: child.id,
    familyId: child.familyId,
    firstName: child.firstName,
    lastName: child.lastName,
    dob: child.dob,
    gender: child.gender,
    servicePreference: child.servicePreference,
    allergies: child.allergies,
    medicalNotes: child.medicalNotes,
    photoUrl: child.photoUrl,
    hasFaceDescriptor: Boolean(child.faceDescriptorJson),
    currentClassId: child.currentClassId,
    createdAt: child.createdAt,
    ...extra,
  };
}