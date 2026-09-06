type DatedAllocation = { serviceDate: string };

export function sortAllocationsCurrentFirst<T extends DatedAllocation>(
  allocations: readonly T[],
  today: string,
): T[] {
  return [...allocations].sort((a, b) => {
    if (a.serviceDate === today && b.serviceDate !== today) return -1;
    if (b.serviceDate === today && a.serviceDate !== today) return 1;

    const aFuture = a.serviceDate > today;
    const bFuture = b.serviceDate > today;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    return aFuture
      ? a.serviceDate.localeCompare(b.serviceDate)
      : b.serviceDate.localeCompare(a.serviceDate);
  });
}