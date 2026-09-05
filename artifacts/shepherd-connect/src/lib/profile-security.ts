/**
 * Security boundary for self-service profile updates.  The password only
 * travels in the request body when changing the account's own phone number.
 */
export function phoneChangeRequiresPassword(currentPhone: string | null | undefined, nextPhone: string): boolean {
  return (currentPhone ?? "").trim() !== nextPhone.trim();
}

export function buildSelfProfileUpdate<T extends { phone: string }>(
  values: T,
  currentPhone: string | null | undefined,
  currentPassword: string,
): T & { currentPassword?: string } {
  if (!phoneChangeRequiresPassword(currentPhone, values.phone)) return { ...values };
  if (!currentPassword) throw new Error("Current password is required to change your phone number.");
  return { ...values, currentPassword };
}