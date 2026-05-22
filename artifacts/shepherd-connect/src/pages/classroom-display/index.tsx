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

// ── Media source types ────────────────────────────────────────────────────────
type MediaSource =
  | { kind: "youtube"; videoId: string }
  | { kind: "local-video"; url: string; name: string }
  | { kind: "local-image"; url: string; name: string }
  | null;

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
function NewsBar({ queue, className, height = 72 }: { queue: PickupRequest[]; className: string; height?: number }) {
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
      style={{ height }}
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

// ── Set Video / Media panel ──────────────────────────────────────────────────
function VideoPanel({ media, onSet }: { media: MediaSource; onSet: (m: MediaSource) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"youtube" | "device">("youtube");
  const [ytInput, setYtInput] = useState("");
  const [ytError, setYtError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [localName, setLocalName] = useState("");

  const hasMedia = media !== null;

  const applyYouTube = () => {
    if (!ytInput.trim()) { onSet(null); setOpen(false); return; }
    const id = extractYouTubeId(ytInput.trim());
    if (!id) { setYtError("Couldn't recognise that YouTube link. Paste the full URL or video ID."); return; }
    onSet({ kind: "youtube", videoId: id });
    setOpen(false);
    setYtInput("");
    setYtError("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      alert("Please select a video or image file.");
      return;
    }
    setLocalName(file.name);
    onSet({ kind: isVideo ? "local-video" : "local-image", url, name: file.name });
    setOpen(false);
  };

  const TabBtn = ({ id, label, icon }: { id: "youtube" | "device"; label: string; icon: string }) => (
    <button
      onClick={() => setTab(id)}
      className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
      style={{
        background: tab === id ? GOLD : "transparent",
        color: tab === id ? NAVY : "rgba(255,255,255,0.5)",
      }}
    >
      {icon} {label}
    </button>
  );

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
        style={{
          background: hasMedia ? `${GOLD}33` : "rgba(255,255,255,0.12)",
          color: "white",
          border: `1px solid ${hasMedia ? GOLD + "66" : "rgba(255,255,255,0.2)"}`,
        }}
      >
        <span>🎬</span>
        {hasMedia ? "Change Media" : "Set Video"}
      </button>

      {open && (
        <div
          className="absolute top-20 left-1/2 z-30 rounded-2xl shadow-2xl"
          style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)", minWidth: 460, transform: "translateX(-50%)" }}
        >
          {/* Tab bar */}
          <div className="flex gap-1 p-3 pb-0" style={{ background: "rgba(255,255,255,0.05)", borderRadius: "16px 16px 0 0" }}>
            <TabBtn id="youtube" label="YouTube" icon="▶️" />
            <TabBtn id="device" label="From Device" icon="📁" />
          </div>

          <div className="p-6 pt-5">
            {tab === "youtube" && (
              <>
                <h2 className="text-white font-bold text-base mb-1">Play a YouTube video</h2>
                <p className="text-white/40 text-xs mb-4">
                  Paste any YouTube link or video ID. The video fills the entire screen with full controls.
                </p>
                <input
                  className="w-full rounded-xl px-4 py-3 text-sm bg-white/10 text-white placeholder:text-white/30 border border-white/20 focus:outline-none focus:border-amber-400"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={ytInput}
                  onChange={e => { setYtInput(e.target.value); setYtError(""); }}
                  onKeyDown={e => e.key === "Enter" && applyYouTube()}
                  autoFocus
                />
                {ytError && <p className="text-red-400 text-xs mt-2">{ytError}</p>}
                <p className="text-white/25 text-xs mt-2">
                  💡 Open YouTube on another tab, copy the video URL and paste it here
                </p>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={applyYouTube}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                    style={{ background: GOLD, color: NAVY }}
                  >
                    ▶ Play Video
                  </button>
                  {hasMedia && (
                    <button
                      onClick={() => { onSet(null); setOpen(false); }}
                      className="px-4 py-2.5 rounded-xl font-semibold text-sm border border-white/20 text-white/60 hover:text-white transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="px-4 py-2.5 rounded-xl font-semibold text-sm border border-white/20 text-white/60 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {tab === "device" && (
              <>
                <h2 className="text-white font-bold text-base mb-1">Play from this device</h2>
                <p className="text-white/40 text-xs mb-5">
                  Select a video or image saved on this TV's storage. Supported: MP4, MOV, WebM, JPG, PNG, GIF.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*,image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-10 rounded-2xl border-2 border-dashed flex flex-col items-center gap-3 transition-all hover:border-amber-400 hover:bg-white/5"
                  style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.5)" }}
                >
                  <span className="text-5xl">📂</span>
                  <span className="text-sm font-semibold">Tap to browse files</span>
                  <span className="text-xs opacity-60">Video or image from this device</span>
                </button>
                {localName && (
                  <p className="text-white/40 text-xs mt-3 truncate">Last loaded: {localName}</p>
                )}
                <div className="flex gap-3 mt-4">
                  {hasMedia && (
                    <button
                      onClick={() => { onSet(null); setOpen(false); }}
                      className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-white/20 text-white/60 hover:text-white transition-colors"
                    >
                      Clear media
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-white/20 text-white/60 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Idle screen ───────────────────────────────────────────────────────────────
function IdleScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center select-none"
      style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 100%)" }}>
      <div style={{ fontSize: 100, opacity: 0.15 }}>🐑</div>
      <div>
        <p className="text-5xl font-extrabold text-white/20 mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
          Shepherd Connect
        </p>
        <p className="text-xl text-white/20">
          Tap <strong className="text-white/30">Set Video</strong> to play YouTube or load a file from this device
        </p>
      </div>
    </div>
  );
}

// ── Notification permission banner ───────────────────────────────────────────────
function NotifBanner({ onRequest }: { onRequest: () => void }) {
  return (
    <div
      className="absolute top-20 left-1/2 z-40 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl"
      style={{
        transform: "translateX(-50%)",
        background: "rgba(245,158,11,0.97)",
        border: "2px solid #1e3a8a",
        minWidth: 480,
      }}
    >
      <span className="text-3xl">🔔</span>
      <div className="flex-1">
        <p className="font-bold text-[#1e3a8a] text-base leading-tight">Allow pop-up alerts</p>
        <p className="text-[#1e3a8a]/80 text-sm mt-0.5">
          So pickup requests pop up even when the browser is minimised
        </p>
      </div>
      <button
        onClick={onRequest}
        className="px-5 py-2.5 rounded-xl font-bold text-sm flex-shrink-0"
        style={{ background: "#1e3a8a", color: "white" }}
      >
        Allow
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "classroom-display-yt-id";

export default function ClassroomDisplay() {
  const { classId } = useParams<{ classId: string }>();
  const classIdNum = Number(classId);

  const [queue, setQueue] = useState<PickupRequest[]>([]);
  const [className, setClassName] = useState<string>("");
  const [connected, setConnected] = useState(false);

  // Restore last YouTube video from localStorage; local files are session-only
  const [media, setMedia] = useState<MediaSource>(() => {
    try {
      const ytId = localStorage.getItem(STORAGE_KEY);
      return ytId ? { kind: "youtube", videoId: ytId } : null;
    } catch { return null; }
  });

  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(() =>
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [showNotifBanner, setShowNotifBanner] = useState(false);

  const notifiedIds = useRef<Set<string>>(new Set());
  const initialised = useRef(false);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") setShowNotifBanner(true);
  }, []);

  const requestNotifPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPerm(result);
    setShowNotifBanner(false);
  }, []);

  const fireNotification = useCallback((request: PickupRequest) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      new Notification("📣 Shepherd Connect — Pickup Request", {
        body: `${request.childName}'s parent is here for pickup`,
        icon: "/pwa-192.png",
        tag: `pickup-${request.id}`,
        requireInteraction: true,
      });
    } catch {}
  }, []);

  const handleSetMedia = useCallback((m: MediaSource) => {
    setMedia(m);
    try {
      if (m?.kind === "youtube") localStorage.setItem(STORAGE_KEY, m.videoId);
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
          if (data.type === "init") {
            const incomingQueue: PickupRequest[] = data.queue ?? [];
            if (!initialised.current) {
              incomingQueue.forEach(r => notifiedIds.current.add(r.id));
              initialised.current = true;
            }
            setQueue(incomingQueue);
            if (data.className) setClassName(data.className);
          } else if (data.type === "pickup" || data.type === "dismissed") {
            const incomingQueue: PickupRequest[] = data.queue ?? [];
            if (data.type === "pickup") {
              incomingQueue.forEach(r => {
                if (!notifiedIds.current.has(r.id)) {
                  notifiedIds.current.add(r.id);
                  fireNotification(r);
                }
              });
            }
            setQueue(incomingQueue);
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
  }, [classIdNum, fireNotification]);

  const today = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // News bar is 80px tall; video sits above it
  const NEWS_BAR_H = 80;

  return (
    <div className="h-screen w-screen overflow-hidden relative" style={{ background: "#0f172a", fontFamily: "Inter, sans-serif" }}>

      {/* ── Media area — leaves room for news bar at bottom ── */}
      <div className="absolute inset-0" style={{ bottom: NEWS_BAR_H }}>
        {media?.kind === "youtube" && (
          <iframe
            key={media.videoId}
            src={`https://www.youtube.com/embed/${media.videoId}?autoplay=1&loop=1&playlist=${media.videoId}&controls=1&modestbranding=1&rel=0&iv_load_policy=3`}
            className="w-full h-full"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            style={{ border: "none", display: "block" }}
          />
        )}
        {media?.kind === "local-video" && (
          <video
            key={media.url}
            src={media.url}
            className="w-full h-full"
            style={{ objectFit: "contain", background: "#000" }}
            autoPlay
            loop
            controls
          />
        )}
        {media?.kind === "local-image" && (
          <img
            key={media.url}
            src={media.url}
            alt={media.name}
            className="w-full h-full"
            style={{ objectFit: "contain", background: "#000" }}
          />
        )}
        {!media && <IdleScreen />}
      </div>

      {/* ── Top bar — gradient overlay so it floats above video ── */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-4 z-10"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
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
          <VideoPanel media={media} onSet={handleSetMedia} />
          <div className="text-right">
            <p className="text-3xl font-bold text-white tabular-nums"><Clock /></p>
            <p className="text-white/40 text-xs mt-0.5">{today}</p>
          </div>
        </div>
      </div>

      {/* ── Notification permission banner ── */}
      {showNotifBanner && <NotifBanner onRequest={requestNotifPermission} />}

      {/* ── Status dots above news bar ── */}
      <div className="absolute z-30 flex items-center gap-3" style={{ bottom: NEWS_BAR_H + 8, left: 16 }}>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-500"}`} />
          <span className="text-xs text-white/30">{connected ? "Live" : "Reconnecting…"}</span>
        </div>
        {notifPerm === "granted" && <span className="text-xs text-white/25">🔔 Alerts on</span>}
        {notifPerm === "denied" && <span className="text-xs text-red-400/60">🔕 Alerts blocked</span>}
      </div>

      {/* ── TV news lower-third bar ── */}
      <NewsBar queue={queue} className={className} height={NEWS_BAR_H} />
    </div>
  );
}
