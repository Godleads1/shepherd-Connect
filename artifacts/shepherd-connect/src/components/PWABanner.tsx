import { usePWA } from "@/hooks/usePWA";
import { WifiOff, Download, RefreshCw, X } from "lucide-react";
import { useState } from "react";

export function PWABanner() {
  const { installPrompt, isOffline, updateAvailable, promptInstall, applyUpdate } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (isOffline) {
    return (
      <div className="fixed top-0 inset-x-0 z-[9999] flex items-center gap-3 bg-red-600 text-white px-4 py-2.5 text-sm font-medium shadow-lg">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span className="flex-1">You're offline — showing cached data</span>
      </div>
    );
  }

  if (updateAvailable) {
    return (
      <div className="fixed top-0 inset-x-0 z-[9999] flex items-center gap-3 bg-[#1e3a8a] text-white px-4 py-2.5 text-sm font-medium shadow-lg">
        <RefreshCw className="w-4 h-4 shrink-0" />
        <span className="flex-1">A new version is available</span>
        <button
          onClick={applyUpdate}
          className="bg-[#f59e0b] text-[#1e3a8a] font-bold text-xs px-3 py-1 rounded-full hover:bg-amber-400 transition-colors"
        >
          Update now
        </button>
      </div>
    );
  }

  if (installPrompt && !dismissed) {
    return (
      <div className="fixed bottom-20 inset-x-3 z-[9999] flex items-center gap-3 bg-[#1e3a8a] text-white px-4 py-3 rounded-2xl shadow-2xl text-sm">
        <img src="/rccg-logo-new.png" alt="" className="w-9 h-9 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">Add to Home Screen</p>
          <p className="text-xs opacity-75">Use Shepherd Connect like a native app</p>
        </div>
        <button
          onClick={promptInstall}
          className="bg-[#f59e0b] text-[#1e3a8a] font-bold text-xs px-3 py-1.5 rounded-full hover:bg-amber-400 transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setDismissed(true)} className="opacity-60 hover:opacity-100 transition-opacity shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}
