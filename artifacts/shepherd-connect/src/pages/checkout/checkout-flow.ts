export type CheckoutRefreshResult =
  | { status: "refreshed" }
  | { status: "refresh_failed"; error: unknown };

/**
 * Reconciliation happens only after the authoritative checkout has committed.
 * A refresh failure is returned as a separate outcome and must never be
 * reclassified as a failed checkout.
 */
export async function refreshAfterCommittedCheckout(
  refresh: () => Promise<void>,
): Promise<CheckoutRefreshResult> {
  try {
    await refresh();
    return { status: "refreshed" };
  } catch (error) {
    return { status: "refresh_failed", error };
  }
}