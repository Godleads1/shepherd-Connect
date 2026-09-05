const WAT_OFFSET_MS = 60 * 60 * 1000;
export const SERVICE_TIME_ZONE = "Africa/Lagos";
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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SERVICE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(value => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isWatSundayAt(date: Date = new Date()): boolean {
  return new Date(date.getTime() + WAT_OFFSET_MS).getUTCDay() === 0;
}

export function watWeekdayAt(date: Date = new Date()): string {
  return WEEKDAYS[new Date(date.getTime() + WAT_OFFSET_MS).getUTCDay()];
}

export function formatWatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SERVICE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

export function formatServiceDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}