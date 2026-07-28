import { MapPin, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-call";
import { Skeleton } from "@/components/ui/skeleton";

interface LocationSettings {
  churchName: string;
  address: string;
  mapsUrl: string;
}

const LOCATION_FALLBACK: LocationSettings = {
  churchName: "RCCG City of David",
  address: "Victoria Island, Lagos",
  mapsUrl: "https://maps.app.goo.gl/uvgtpVETsCeqkzmDA",
};

export default function LocationBanner() {
  const { data: location } = useQuery<LocationSettings>({
    queryKey: ["settings-location"],
    queryFn: () => apiGet<LocationSettings>("/settings/location"),
    staleTime: 5 * 60 * 1000,
    placeholderData: LOCATION_FALLBACK,
  });

  const { churchName, address, mapsUrl } = location ?? LOCATION_FALLBACK;
  const displayName = `${churchName}, ${address}`;

  return (
    <div
      className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl mb-6"
      style={{ background: "#1e3a8a", color: "white" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(245,158,11,0.2)", border: "1.5px solid rgba(245,158,11,0.5)" }}
        >
          <MapPin className="w-4 h-4" style={{ color: "#f59e0b" }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#f59e0b" }}>
            Pickup / Drop-off Location
          </p>
          {location ? (
            <p className="text-sm font-semibold text-white leading-tight truncate">
              {displayName}
            </p>
          ) : (
            <Skeleton className="h-4 w-48 mt-1" />
          )}
        </div>
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
        style={{ background: "#f59e0b", color: "#172554" }}
      >
        Get Directions
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
