import { RefreshCw, ArrowDown } from "lucide-react";

const THRESHOLD = 72;
const MAX_PULL  = 110;

type Props = {
  pullDistance: number;
  isRefreshing: boolean;
  triggered: boolean;
  /** dark = for dark-background pages (scan page); light = default */
  variant?: "light" | "dark";
};

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  triggered,
  variant = "light",
}: Props) {
  const visible = isRefreshing || pullDistance > 0;
  if (!visible) return null;

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  // translate the indicator down as the user pulls, capped at 56px
  const translateY = isRefreshing ? 56 : Math.min((pullDistance / MAX_PULL) * 64, 56);
  const arrowRotate = triggered ? 180 : progress * 150;

  const bg    = variant === "dark" ? "bg-blue-800/80"   : "bg-white/90";
  const ring  = variant === "dark" ? "border-blue-500"  : "border-gray-200";
  const icon  = variant === "dark" ? "text-yellow-400"  : "text-blue-700";
  const text  = variant === "dark" ? "text-blue-200"    : "text-gray-500";

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ transform: `translateY(${translateY}px)`, transition: isRefreshing ? "transform 0.2s ease" : "none" }}
    >
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border backdrop-blur-sm ${bg} ${ring}`}
        style={{ opacity: Math.max(progress, isRefreshing ? 1 : 0) }}
      >
        {isRefreshing ? (
          <RefreshCw className={`w-4 h-4 animate-spin ${icon}`} />
        ) : (
          <ArrowDown
            className={`w-4 h-4 transition-transform duration-150 ${icon}`}
            style={{ transform: `rotate(${arrowRotate}deg)` }}
          />
        )}
        <span className={`text-xs font-medium ${text}`}>
          {isRefreshing ? "Refreshing…" : triggered ? "Release to refresh" : "Pull to refresh"}
        </span>
      </div>
    </div>
  );
}
