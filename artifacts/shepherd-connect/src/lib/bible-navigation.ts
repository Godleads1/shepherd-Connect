/**
 * Previous/Next for a projected Bible passage. Navigation stays inside the
 * chapter but may go past the range the teacher originally chose.
 */
export function adjacentVerse(verseNumbers: number[], current: number, direction: -1 | 1): number | null {
  const sorted = [...new Set(verseNumbers)].sort((a, b) => a - b);
  if (direction === 1) return sorted.find(n => n > current) ?? null;
  for (let i = sorted.length - 1; i >= 0; i -= 1) if (sorted[i] < current) return sorted[i];
  return null;
}

export function isOutsideChosenRange(verse: number, start: number | null, end: number | null): boolean {
  if (start === null) return false;
  return verse < start || verse > (end ?? start);
}

export function verseRangeLabel(chapterReference: string, start: number, end: number | null): string {
  return end !== null && end !== start ? `${chapterReference}:${start}–${end}` : `${chapterReference}:${start}`;
}
