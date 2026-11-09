import { churchProfileSnapshot, serviceShortLabel } from "@/contexts/church-profile";
/**
 * Classroom TV alert bar: every alert (pickups and "child is coming" alerts,
 * raised once support accepts the child)
 * scrolls across the bottom of the TV. When a new alert arrives the bar
 * appears, scrolls the current alerts 3 times, then hides so the screen stays
 * clear for verses, slides and videos.
 */

export const TICKER_PASSES = 3;

export interface TickerPickup {
  id: string;
  childName: string;
}

export interface TickerCheckIn {
  id: string;
  childName: string;
  parentName: string;
  className: string;
  homeClassName?: string;
  requestedServices: "first" | "second" | "both";
}

export interface TickerAlert {
  /** Unique across kinds, e.g. "pickup:12" / "checkin:7". */
  key: string;
  kind: "pickup" | "checkin";
  text: string;
}

export function buildTickerAlerts(queue: TickerPickup[], checkIns: TickerCheckIn[]): TickerAlert[] {
  const pickups = queue.map(r => ({
    key: `pickup:${r.id}`,
    kind: "pickup" as const,
    text: `📣  ${r.childName}'s parent is here for pickup`,
  }));
  const arrivals = checkIns.map(a => {
    const church = churchProfileSnapshot();
    const first = serviceShortLabel("7am", church), second = serviceShortLabel("10:30am", church);
    const service = a.requestedServices === "both"
      ? `${first} & ${second} services`
      : a.requestedServices === "first" ? `${first} service` : `${second} service`;
    const merged = a.homeClassName ? ` (${a.homeClassName} merged into ${a.className})` : "";
    return {
      key: `checkin:${a.id}`,
      kind: "checkin" as const,
      text: `👋  ${a.childName} is coming — ${service}${merged}`,
    };
  });
  return [...pickups, ...arrivals];
}

/** Keys in `alerts` the TV hasn't announced yet. */
export function unseenAlertKeys(seen: ReadonlySet<string>, alerts: TickerAlert[]): string[] {
  return alerts.filter(a => !seen.has(a.key)).map(a => a.key);
}

/** Seconds for one pass, scaled to the text length so long lists stay readable. */
export function tickerPassSeconds(alerts: TickerAlert[]): number {
  const chars = alerts.reduce((sum, a) => sum + a.text.length + 8, 0);
  return Math.max(12, Math.round(chars * 0.2));
}

/** How long the bar stays up for a run: all passes plus a short grace. */
export function tickerRunMs(alerts: TickerAlert[]): number {
  return (tickerPassSeconds(alerts) * TICKER_PASSES + 1) * 1000;
}
