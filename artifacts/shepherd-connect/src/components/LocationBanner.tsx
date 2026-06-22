import { MapPin, ExternalLink } from "lucide-react";

export default function LocationBanner() {
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
          <p className="text-sm font-semibold text-white leading-tight truncate">
            RCCG City of David, Victoria Island, Lagos
          </p>
        </div>
      </div>
      <a
        href="https://maps.app.goo.gl/uvgtpVETsCeqkzmDA"
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
