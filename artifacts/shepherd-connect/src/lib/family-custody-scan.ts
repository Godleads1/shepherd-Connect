const FAMILY_CODE_RE = /^FAM-[A-Z0-9]{6}$/;

export function familyQrValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return FAMILY_CODE_RE.test(normalized) ? normalized : null;
}

export function findPendingCustodyEpisode(
  episodes: unknown,
  familyId: unknown,
  childId: unknown,
): { id: number } | null {
  if (!Array.isArray(episodes) || !Number.isInteger(familyId) || !Number.isInteger(childId)) {
    return null;
  }

  const episode = episodes.find((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const row = candidate as {
      id?: unknown;
      familyId?: unknown;
      childId?: unknown;
      status?: unknown;
    };
    return Number.isInteger(row.id) &&
      row.familyId === familyId &&
      row.childId === childId &&
      row.status === "requested";
  }) as { id: number } | undefined;

  return episode ? { id: episode.id } : null;
}