const WAT_OFFSET_MS = 60 * 60 * 1000;
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function watServiceDateAt(date: Date = new Date()): string {
  return new Date(date.getTime() + WAT_OFFSET_MS).toISOString().slice(0, 10);
}

export function isWatSundayAt(date: Date = new Date()): boolean {
  return new Date(date.getTime() + WAT_OFFSET_MS).getUTCDay() === 0;
}

export function watWeekdayAt(date: Date = new Date()): string {
  return WEEKDAYS[new Date(date.getTime() + WAT_OFFSET_MS).getUTCDay()];
}