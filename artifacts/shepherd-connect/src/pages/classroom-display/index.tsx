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
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
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

// ── TV-style lower-third news bar ──────────────────────────────────────────────
function NewsBar({ queue, className }: { queue: PickupRequest[]; className: string }) {
  const hasPickups = queue.length > 0;

  // Build ticker items — triplicate for seamless loop
  const baseItems: string[] = hasPickups
    ? queue.map(r => `📣  ${r.childName}'s parent is here for pickup`)
    : [`Welcome to Children's Church  ·  ${className || "Shepherd Connect"}  ·  RCCG City of David`];

  const items = [...baseItems, ...baseItems, ...baseItems];
  const duration = Math.max(items.length * 6, 20);

  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-stretch z-20 select-none"
      style={{ height: 72 }}
    >
      {/* Left badge — "SHEPHERD NEWS" branding */}
      <div
        className="flex flex-col items-center justify-center flex-shrink-0 px-6 gap-0.5"
        style={{
          background: hasPickups ? GOLD : NAVY,
          minWidth: 180,
          transition: "background 0.6s ease",
        }}
      >
        <span className="text-2xl leading-none">🐑</span>
        <span
          className="text-xs font-black tracking-widest uppercase leading-none"
          style={{ color: hasPickups ? NAVY : GOLD, letterSpacing: "0.15em" }}
        >
          Shepherd
        </span>
        <span
          className="text-xs font-black tracking-widest uppercase leading-none"
          style={{ color: hasPickups ? NAVY : "white", letterSpacing: "0.15em" }}
        >
          News
        </span>
      </div>

      {/* Scrolling ticker */}
      <div
        className="flex-1 overflow-hidden flex items-center"
        style={{
          background: hasPickups
            ? "rgba(245,158,11,0.92)"
            : "rgba(15,23,42,0.88)",
          backdropFilter: "blur(4px)",
        }}
      >
        <div
          key={hasPickups ? "pickups" : "idle"}
          className="flex items-center whitespace-nowrap"
          style={{ animation: `newsScroll ${duration}s linear infinite` }}
        >
          {items.map((text, i) => (
            <span
              key={i}
              className="inline-flex items-center text-2xl font-bold tracking-wide px-12"
              style={{ color: hasPickups ? NAVY : "rgba(255,255,255,0.6)" }}
            >
              {text}
              <span className="mx-10 opacity-40">◆</span>
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes newsScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}

// ── Set Video panel ─────────────────────────────────────────────────────────────
function VideoPanel({ videoId, onSet }: { videoId: string | null; onSet: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleApply = () => {
    if (!input.trim()) { onSet(null); setOpen(false); return; }
    const id = extractYouTubeId(input.trim());
    if (!id) { setError("Couldn't recognise that YouTube link. Paste the full URL."); return; }
    onSet(id);
    setOpen(false);
    setInput("");
    setError("");
  };

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
        style={{
          background: videoId ? `${GOLD}33` : "rgba(255,255,255,0.12)",
          color: "white",
          border: `1px solid ${videoId ? GOLD + "66" : "rgba(255,255,255,0.2)"}`,
        }}
      >
        <span>🎬</span>
        {videoId ? "Change Video" : "Set Video"}
      </button>

      {open && (
        <div
          className="absolute top-20 left-1/2 z-30 rounded-2xl p-6 shadow-2xl"
          style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)", minWidth: 440, transform: "translateX(-50%)" }}
        >
          <h2 className="text-white font-bold text-lg mb-1">Play a YouTube Video</h2>
          <p className="text-white/50 text-sm mb-4">Paste any YouTube link. The video plays full screen on this TV.</p>
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
            <button
              onClick={handleApply}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: GOLD, color: NAVY }}
            >
              Play Video
            </button>
            {videoId && (
              <button
                onClick={() => { onSet(null); setOpen(false); }}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Idle screen (no video set) ───────────────────────────────────────────────────
function IdleScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center select-none"
      style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 100%)" }}>
      <div style={{ fontSize: 100, opacity: 0.15 }}>🐑</div>
      <div>
        <p className="text-5xl font-extrabold text-white/20 mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
          Shepherd Connect
        </p>
        <p className="text-xl text-white/20">Tap <strong className="text-white/30">Set Video</strong> in the top bar to play a YouTube video</p>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "classroom-display-video-id";

export default function ClassroomDisplay() {
  const { classId } = useParams<{ classId: string }>();
  const classIdNum = Number(classId);

  const [queue, setQueue] = useState<PickupRequest[]>([]);
  const [className, setClassName] = useState<string>("");
  const [connected, setConnected] = useState(false);
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

  useEffect(() => {
    if (!classIdNum) return;
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    const url = `${base}/api/pickup-requests/stream/${classIdNum}`;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      const es = new EventSource(url);
      es.onopen = () => setConnected(true);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "init" || data.type === "pickup" || data.type === "dismissed") {
            setQueue(data.queue ?? []);
            if (data.className) setClassName(data.className);
          }
        } catch {}
      };
      es.onerror = () => {
        setConnected(false);
        es.close();
        retryTimeout = setTimeout(connect, 4000);
      };
      return es;
    }

    const es = connect();
    return () => { es.close(); clearTimeout(retryTimeout); setConnected(false); };
  }, [classIdNum]);

  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0&iv_load_policy=3`
    : null;

  const today = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="h-screen w-screen overflow-hidden relative" style={{ background: "#0f172a", fontFamily: "Inter, sans-serif" }}>

      {/* ── Video / Idle ── */}
      <div className="absolute inset-0" style={{ bottom: 72 }}>
        {embedUrl ? (
          <iframe
            key={videoId}
            src={embedUrl}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
            style={{ border: "none", display: "block" }}
          />
        ) : (
          <IdleScreen />
        )}
      </div>

      {/* ── Top bar (header) — semi-transparent overlay ── */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-4 z-10"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)" }}
      >
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: GOLD }}>🐑</div>
          <div>
            <p className="text-white/40 text-xs font-semibold tracking-widest uppercase">Shepherd Connect</p>
            <h1 className="text-2xl font-extrabold text-white leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              {className || `Classroom ${classId}`}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <VideoPanel videoId={videoId} onSet={handleSetVideo} />
          <div className="text-right">
            <p className="text-3xl font-bold text-white tabular-nums"><Clock /></p>
            <p className="text-white/40 text-xs mt-0.5">{today}</p>
          </div>
        </div>
      </div>

      {/* ── Connection dot (bottom-left, above news bar) ── */}
      <div className="absolute z-30 flex items-center gap-1.5" style={{ bottom: 80, left: 16 }}>
        <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-500"}`} />
        <span className="text-xs text-white/30">{connected ? "Live" : "Reconnecting…"}</span>
      </div>

      {/* ── TV news lower-third bar ── */}
      <NewsBar queue={queue} className={className} />
    </div>
  );
}
