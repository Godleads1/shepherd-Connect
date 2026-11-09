import React, { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

/**
 * Branding and service details for the church this deployment serves.
 * Loaded from GET /api/church-profile (public). The defaults are the original
 * church, so the first paint matches before the request returns and the app
 * still works offline.
 */
export interface ChurchProfile {
  appName: string;
  churchName: string;
  churchShortName: string;
  denominationName: string;
  ministryName: string;
  locality: string;
  address: string;
  mapsUrl: string;
  tagline: string;
  logoUrl: string;
  emailLogoUrl: string;
  brandColor: string;
  appUrl: string;
  service1Start: string;
  service2Start: string;
  service1Label: string;
  service2Label: string;
  service1MessageName: string;
  service2MessageName: string;
  service1TimeText: string;
  service2TimeText: string;
}

export const DEFAULT_CHURCH_PROFILE: ChurchProfile = {
  appName: "Shepherd Connect",
  churchName: "RCCG City of David",
  churchShortName: "City of David",
  denominationName: "THE REDEEMED CHRISTIAN CHURCH OF GOD",
  ministryName: "Junior Church",
  locality: "Victoria Island",
  address: "Victoria Island, Lagos",
  mapsUrl: "https://maps.app.goo.gl/uvgtpVETsCeqkzmDA",
  tagline: "Safe. Known. Celebrated.",
  logoUrl: "/rccg-logo-new.png",
  emailLogoUrl: "",
  brandColor: "#1e3a8a",
  appUrl: "",
  service1Start: "07:00",
  service2Start: "10:30",
  service1Label: "1st Service",
  service2Label: "2nd Service",
  service1MessageName: "First Service",
  service2MessageName: "Second Service",
  service1TimeText: "7:00 – 10:00 AM",
  service2TimeText: "10:30 AM onwards",
};

const STORAGE_KEY = "shepherd-church-profile";

function readCached(): ChurchProfile | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_CHURCH_PROFILE, ...JSON.parse(raw) } : undefined;
  } catch {
    return undefined;
  }
}

let snapshot: ChurchProfile = readCached() ?? DEFAULT_CHURCH_PROFILE;

/** Latest profile for code outside React components (print templates, constants). */
export function churchProfileSnapshot(): ChurchProfile {
  return snapshot;
}

const ChurchProfileContext = createContext<ChurchProfile>(DEFAULT_CHURCH_PROFILE);

export function ChurchProfileProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery<ChurchProfile>({
    queryKey: ["church-profile"],
    queryFn: async () => {
      const res = await fetch("/api/church-profile");
      if (!res.ok) throw new Error(`church profile ${res.status}`);
      return { ...DEFAULT_CHURCH_PROFILE, ...(await res.json()) };
    },
    initialData: readCached,
    // Cached copy is only for the first paint; always refresh from the server.
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
    retry: 2,
  });
  const profile = data ?? DEFAULT_CHURCH_PROFILE;

  snapshot = profile;
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* storage unavailable */ }
    const root = document.documentElement;
    root.style.setProperty("--rccg-blue", profile.brandColor);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", profile.brandColor);
  }, [profile]);

  return <ChurchProfileContext.Provider value={profile}>{children}</ChurchProfileContext.Provider>;
}

export function useChurchProfile(): ChurchProfile {
  return useContext(ChurchProfileContext);
}

/** True for the original church, whose texts also have hand-made translations. */
export function useIsDefaultChurch(): boolean {
  const profile = useChurchProfile();
  return useMemo(() => profile.churchName === DEFAULT_CHURCH_PROFILE.churchName, [profile.churchName]);
}

/** "7am" | "10:30am" are internal IDs for the first / second service. */
export function serviceStartLabel(slot: string, profile: ChurchProfile): string {
  const start = slot === "7am" ? profile.service1Start : slot === "10:30am" ? profile.service2Start : null;
  if (!start) return slot;
  const [h, m] = start.split(":").map(Number) as [number, number];
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/** The church's logo; replaces the hard-coded RCCG logo images. */
export function ChurchLogoImg(props: Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src">) {
  const profile = useChurchProfile();
  return <img src={profile.logoUrl} alt={props.alt ?? `${profile.churchShortName} logo`} {...props} />;
}

/** Inline church text (e.g. short name) that updates when the profile loads. */
export function ChurchText({ field }: { field: "churchName" | "churchShortName" | "ministryName" | "locality" | "address" }) {
  const profile = useChurchProfile();
  return <>{profile[field]}</>;
}

/** Compact form used in short texts: "7am", "10:30am". */
export function serviceShortLabel(slot: string, profile: ChurchProfile): string {
  const start = slot === "7am" ? profile.service1Start : slot === "10:30am" ? profile.service2Start : null;
  if (!start) return slot;
  const [h, m] = start.split(":").map(Number) as [number, number];
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h >= 12 ? "pm" : "am"}`;
}
