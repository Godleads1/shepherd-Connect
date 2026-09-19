export type CustodyCheckoutRole = string | null | undefined;

type BeginCustodyCheckoutOptions = {
  role: CustodyCheckoutRole;
  episodeId: number;
  completeSupportPickup: (episodeId: number) => Promise<unknown>;
  openOverride: (episodeId: number) => void;
};

export async function beginCustodyCheckout({
  role,
  episodeId,
  completeSupportPickup,
  openOverride,
}: BeginCustodyCheckoutOptions): Promise<"override_requested" | "completed"> {
  if (role === "admin" || role === "super_admin") {
    openOverride(episodeId);
    return "override_requested";
  }

  await completeSupportPickup(episodeId);
  return "completed";
}

type SubmitCustodyOverrideOptions = {
  episodeId: number | null;
  reason: string;
  overridePickup: (episodeId: number, reason: string) => Promise<unknown>;
};

export async function submitCustodyOverride({
  episodeId,
  reason,
  overridePickup,
}: SubmitCustodyOverrideOptions): Promise<boolean> {
  const trimmedReason = reason.trim();
  if (!episodeId || !trimmedReason) return false;

  await overridePickup(episodeId, trimmedReason);
  return true;
}