import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "wouter";

const NAVY = "#1e3a8a";
const GOLD = "#f59e0b";

interface PickupRequest {
  id: string;
  childId: number;
  childName: string;
  parentName: string;
  classId: number;
  className: string;
  requestedAt: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono tabular-nums">
      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0];
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/");
      const embedIdx = parts.indexOf("embed");
      if (embedIdx !== -1) return parts[embedIdx + 1];
    }
  } catch {}
  // bare video ID (11 chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

// Scrolling ticker at the bottom when there are pickup requests
function PickupTicker({ queue }: { queue: PickupRequest[] }) {
  if (queue.length === 0) return null;
  const items = [...queue, ...queue, ...queue];
  return (
    <div className="overflow-hidden w-full flex-shrink-0" style={{ background: GOLD, borderTop: `4px solid ${NAVY}` }}>
      <div
        className="flex items-center gap-0 whitespace-nowrap"
        style={{ animation: `ticker ${Math.max(items.length * 8, 20)}s linear infinite` }}
      >
        {items.map((r, i) => (
          <span key={`${r.id}-${i}`} className="inline-flex items-center gap-3 px-10 py-4 text-2xl font-bold" style={{ color: NAVY }}>
            <span className="text-3xl">📣</span>
            <span>{r.parentName}</span>
            <span className="opacity-60 text-xl font-normal">is here to pick up</span>
            <span className="underline underline-offset-4">{r.childName}</span>
            <span className="opacity-40 text-lg font-normal ml-2">{formatTime(r.requestedAt)}</span>
            <span className="mx-8 opacity-30 text-4xl">·</span>
          </span>
        ))}
      </div>
      <style>{`@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-33.333%); } }`}</style>
    </div>
  );
}

// Overlay pickup alert cards (slide in from right)
function PickupOverlay({ queue }: { queue: PickupRequest[] }) {
  if (queue.length === 0) return null;
  return (
    <div className="absolute top-24 right-8 flex flex-col gap-4 z-20" style={{ maxWidth: 420, width: "100%" }}>
      {queue.slice(0, 4).map((r, i) => (
        <div
          key={r.id}
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{
            background: "rgba(255,255,255,0.97)",
            border: `3px solid ${GOLD}`,
            boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
            animation: `slideIn 0.4s ease ${i * 0.1}s both`,
          }}
        >
          <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 text-3xl font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${NAVY}, #3b82f6)` }}>
            {r.childName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-extrabold text-gray-900 leading-tight truncate" style={{ fontFamily: "'Playfair Display', serif" }}>
              {r.childName}
            </p>
            <p className="text-sm text-gray-500 mt-0.5 truncate">
              Parent: <span className="font-semibold text-gray-700">{r.parentName}</span>
            </p>
            <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: `${GOLD}33`, color: "#92400e", border: `1px solid ${GOLD}` }}>
              <span className="animate-pulse">🚶</span> Ready for pickup · {formatTime(r.requestedAt)}
            </div>
          </div>
        </div>
      ))}
      {queue.length > 4 && (
        <div className="text-center text-white/70 text-lg font-semibold bg-white/10 rounded-xl py-3">
          +{queue.length - 4} more waiting
        </div>
      )}
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }`}</style>
    </div>
  );
}

// Video set panel
function VideoPanel({ videoId, onSet }: { videoId: string | null; onSet: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleApply = () => {
    if (!input.trim()) { onSet(null); setOpen(false); return; }
    const id = extractYouTubeId(input.trim());
    if (!id) { setError("Couldn't find a YouTube video ID in that URL. Paste the full YouTube link."); return; }
    onSet(id);
    setOpen(false);
    setInput("");
    setError("");
  };

  const handleClear = () => { onSet(null); setOpen(false); setInput(""); setError(""); };

  return (
    <>
      {/* Toggle button — sits in header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
        style={{ background: videoId ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}
      >
        <span className="text-lg">🎬</span>
        {videoId ? "Change Video" : "Set Video"}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 rounded-2xl p-6 shadow-2xl" style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)", minWidth: 420 }}>
          <h2 className="text-white font-bold text-lg mb-1">Play a YouTube Video</h2>
          <p className="text-white/50 text-sm mb-4">Paste a YouTube link below. The video will play on this screen.</p>
          <input
            className="w-full rounded-xl px-4 py-3 text-sm bg-white/10 text-white placeholder:text-white/30 border border-white/20 focus:outline-none focus:border-amber-400"
            placeholder="https://www.youtube.com/watch?v=..."
            value={input}
            onChange={e => { setInput(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleApply()}
            autoFocus
          />
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          <div className="flex gap-3 mt-4">
            <button onClick={handleApply} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: GOLD, color: NAVY }}>
              Play Video
            </button>
            {videoId && (
              <button onClick={handleClear} className="px-4 py-2.5 rounded-xl font-semibold text-sm text-white/60 hover:text-white border border-white/20 hover:border-white/40 transition-colors">
                Clear
              </button>
            )}
            <button onClick={() => setOpen(false)} className="px-4 py-2.5 rounded-xl font-semibold text-sm text-white/60 hover:text-white border border-white/20 hover:border-white/40 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Idle screen when no video is set
function IdleScreen({ pickupCount }: { pickupCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 text-center select-none">
      <div className="text-9xl opacity-20">🎬</div>
      <div>
        <p className="text-4xl font-bold text-white/30 mb-3">No video playing</p>
        <p className="text-xl text-white/20">
          {pickupCount > 0
            ? `${pickupCount} pickup request${pickupCount !== 1 ? "s" : ""} are waiting →`
            : `Tap "Set Video" in the top bar to play a YouTube video for the children`}
        </p>
      </div>
    </div>
  );
}

const STORAGE_KEY = "classroom-display-video-id";

export default function ClassroomDisplay() {
  const { classId } = useParams<{ classId: string }>();
  const classIdNum = Number(classId);

  const [queue, setQueue] = useState<PickupRequest[]>([]);
  const [className, setClassName] = useState<string>("");
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [videoId, setVideoId] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
  });

  const handleSetVideo = useCallback((id: string | null) => {
    setVideoId(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!classIdNum) return;
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    const url = `${base}/api/pickup-requests/stream/${classIdNum}`;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      const es = new EventSource(url);
      esRef.current = es;
      es.onopen = () => setConnected(true);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "init" || data.type === "pickup" || data.type === "dismissed") {
            setQueue(data.queue ?? []);
            if (data.className) setClassName(data.className);
            setLastUpdate(new Date());
          }
        } catch {}
      };
      es.onerror = () => {
        setConnected(false);
        es.close();
        retryTimeout = setTimeout(connect, 4000);
      };
    }

    connect();
    return () => {
      esRef.current?.close();
      clearTimeout(retryTimeout);
      setConnected(false);
    };
  }, [classIdNum]);

  const today = new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0&iv_load_policy=3`
    : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 100%)", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 flex-shrink-0 relative z-10"
        style={{ borderBottom: "2px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.4)" }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: GOLD }}>🐑</div>
          <div>
            <p className="text-white/40 text-xs font-medium tracking-widest uppercase">Shepherd Connect</p>
            <h1 className="text-2xl font-extrabold text-white leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              {className || `Classroom ${classId}`}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <VideoPanel videoId={videoId} onSet={handleSetVideo} />
          {queue.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold animate-pulse"
              style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}55` }}>
              <span>📣</span> {queue.length} pickup{queue.length !== 1 ? "s" : ""} waiting
            </div>
          )}
          <div className="text-right">
            <p className="text-4xl font-bold text-white tabular-nums"><Clock /></p>
            <p className="text-white/40 text-xs mt-0.5">{today}</p>
          </div>
        </div>
      </div>

      {/* Main content — video or idle */}
      <div className="flex-1 relative overflow-hidden">
        {embedUrl ? (
          <iframe
            key={videoId}
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
            style={{ border: "none" }}
          />
        ) : (
          <IdleScreen pickupCount={queue.length} />
        )}

        {/* Pickup request overlay — appears on top of video */}
        <PickupOverlay queue={queue} />
      </div>

      {/* Scrolling ticker */}
      <PickupTicker queue={queue} />

      {/* Status bar */}
      <div className="flex items-center justify-between px-8 py-2 flex-shrink-0"
        style={{ background: "rgba(0,0,0,0.5)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
          <span className="text-xs text-white/40">{connected ? "Live" : "Reconnecting..."}</span>
        </div>
        <span className="text-xs text-white/30">
          {lastUpdate ? `Last update: ${formatTime(lastUpdate.toISOString())}` : "Waiting for updates..."}
        </span>
        <span className="text-xs text-white/30">RCCG City of David · Children's Ministry</span>
      </div>
    </div>
  );
}
