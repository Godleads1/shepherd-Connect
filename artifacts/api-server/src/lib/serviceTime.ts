export const SERVICE_TIME_ZONE = "Africa/Lagos";

const serviceDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SERVICE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function serviceDateAt(date: Date = new Date()): string {
  const parts = serviceDateFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(value => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatServiceTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SERVICE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

export function formatServiceDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SERVICE_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatServiceDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SERVICE_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

export function formatServiceLongDate(date: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SERVICE_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export function serviceHourAt(date: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: SERVICE_TIME_ZONE,
    hour: "numeric",
    hourCycle: "h23",
  }).format(date);
  return Number(hour);
}