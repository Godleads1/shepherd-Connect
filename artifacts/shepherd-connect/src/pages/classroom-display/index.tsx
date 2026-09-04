import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "wouter";
import { apiPost } from "../../lib/api-call";

const NAVY = "#1e3a8a";
const GOLD = "#f59e0b";

// Height of the lower-third news ticker. Slides and images render full-bleed
// underneath it so they use the entire TV screen.
const NEWS_BAR_H = 80;

interface PickupRequest {
  id: string;
  childId: number;
  childName: string;
  parentName: string;
  classId: number;
  className: string;
  requestedAt: string;
}

interface CheckInAlert {
  id: string;
  childId: number;
  childName: string;
  parentName: string;
  classId: number;
  className: string;
  homeClassName?: string;
  requestedServices: "first" | "second" | "both";
  serviceDate: string;
  requestedAt: string;
}

// ── Media source types ────────────────────────────────────────────────────────
type MediaSource =
  | { kind: "youtube"; videoId: string }
  | { kind: "local-video"; url: string; name: string }
  | { kind: "local-image"; url: string; name: string }
  | { kind: "pdf"; url: string; name: string; page: number | null }
  | null;

// Media set remotely from a teacher's phone/laptop (My Class → TV Video).
// Delivered over the live display connection; overrides anything set on the TV.
type ServerMedia =
  | { kind: "youtube"; videoId: string }
  | { kind: "file"; url: string; contentType: string; name: string; page?: number | null; pageCount?: number | null; v?: string }
  | null;

function serverToMediaSource(m: ServerMedia): MediaSource {
  if (!m) return null;
  if (m.kind === "youtube") return { kind: "youtube", videoId: m.videoId };
  if (m.contentType === "application/pdf") return { kind: "pdf", url: m.url, name: m.name, page: m.page ?? null };
  return m.contentType.startsWith("video/")
    ? { kind: "local-video", url: m.url, name: m.name }
    : { kind: "local-image", url: m.url, name: m.name };
}

// ── PDF slides renderer ───────────────────────────────────────────────────────
// Renders PDF pages full-screen with pdf.js. Auto-advances every 12s unless a
// page has been pinned from a teacher's phone (the "clicker").
const PDF_AUTO_ADVANCE_MS = 12000;

function PdfSlides({ url, page, displayToken }: { url: string; page: number | null; displayToken: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [autoPage, setAutoPage] = useState(1);
  const [error, setError] = useState("");
  // Re-render the current page when the TV's viewport changes (browser chrome
  // hiding, entering fullscreen, resolution switch) — otherwise the canvas
  // keeps the size measured at load time and can look small on the screen.
  const [viewportTick, setViewportTick] = useState(0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => setViewportTick((n) => n + 1), 250);
    };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); clearTimeout(t); };
  }, []);

  // Load the document once per URL; fetched same-origin with the display token.
  useEffect(() => {
    let cancelled = false;
    let task: any = null;
    setDoc(null);
    setError("");
    (async () => {
      try {
        // Legacy build: smart-TV browsers lack the newest JS APIs the modern
        // pdf.js build assumes (v6 crashed on Map.getOrInsertComputed here).
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        // Vite's ?url import resolves the worker asset URL
        const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const sep = url.includes("?") ? "&" : "?";
        task = pdfjs.getDocument({
          url: `${url}${sep}displayToken=${encodeURIComponent(displayToken)}`,
          disableRange: true, // our endpoint streams the whole file
        });
        const loaded = await task.promise;
        if (cancelled) return;
        setDoc(loaded);
        setNumPages(loaded.numPages);
        setAutoPage(1);
      } catch (e) {
        console.error("[pdf-slides] failed to load document", e);
        if (!cancelled) setError("Could not load the slides — ask a teacher to re-upload the PDF.");
      }
    })();
    return () => { cancelled = true; if (task) void task.destroy(); };
  }, [url, displayToken]);

  // Auto-advance only while no page is pinned from a phone.
  useEffect(() => {
    if (!doc || page !== null || numPages <= 1) return;
    const iv = setInterval(() => setAutoPage((p) => (p % numPages) + 1), PDF_AUTO_ADVANCE_MS);
    return () => clearInterval(iv);
  }, [doc, page, numPages]);

  const activePage = doc
    ? Math.min(Math.max(page ?? autoPage, 1), numPages || 1)
    : 1;

  // Render the active page scaled to fill the screen. The previous render
  // task is cancelled on every page change so an older render can never
  // finish late and overwrite a newer page on the shared canvas.
  useEffect(() => {
    if (!doc || !canvasRef.current || !containerRef.current) return;
    let cancelled = false;
    let renderTask: any = null;
    (async () => {
      try {
        const p = await doc.getPage(activePage);
        if (cancelled) return;
        const canvas = canvasRef.current!;
        const container = containerRef.current!;
        const dpr = window.devicePixelRatio || 1;
        const base = p.getViewport({ scale: 1 });
        const fit = Math.min(container.clientWidth / base.width, container.clientHeight / base.height);
        const viewport = p.getViewport({ scale: fit * dpr });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;
        renderTask = p.render({ canvasContext: canvas.getContext("2d")!, viewport } as any);
        await renderTask.promise;
      } catch (e: any) {
        // Cancellations are expected on fast page flips; log real failures.
        if (e?.name !== "RenderingCancelledException") {
          console.error("[pdf-slides] render failed", e);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (renderTask) renderTask.cancel();
    };
  }, [doc, activePage, viewportTick]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center relative" style={{ background: "#000" }}>
      {error ? (
        <p className="text-white/40 text-xl px-8 text-center">{error}</p>
      ) : !doc ? (
        <p className="text-white/30 text-xl animate-pulse">Loading slides…</p>
      ) : (
        <canvas ref={canvasRef} />
      )}
      {doc && numPages > 0 && (
        <div
          className="absolute right-4 px-3 py-1.5 rounded-lg text-sm font-semibold tabular-nums"
          style={{ bottom: NEWS_BAR_H + 12, background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.7)" }}
        >
          {activePage} / {numPages}{page === null ? " · Auto" : " · 📱"}
        </div>
      )}
    </div>
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
function VideoPanel({ media, onSet, remoteActive }: { media: MediaSource; onSet: (m: MediaSource) => void; remoteActive: boolean }) {
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
            {remoteActive && (
              <div
                className="mb-4 rounded-xl px-4 py-3 text-xs leading-relaxed"
                style={{ background: `${GOLD}22`, border: `1px solid ${GOLD}55`, color: "rgba(255,255,255,0.75)" }}
              >
                📱 This screen is playing media set from a teacher's phone (My Class → <strong>TV Video</strong>).
                It overrides anything set here — clear it from the phone to use these options.
              </div>
            )}
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
          Set the video from your phone in <strong className="text-white/30">My Class → TV Video</strong>
          {" "}— or tap <strong className="text-white/30">Set Video</strong> on this screen
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

function ChildComingBanner({ alerts }: { alerts: CheckInAlert[] }) {
  if (alerts.length === 0) return null;
  const alert = alerts[0];
  const services = alert.requestedServices === "both"
    ? "7am & 10:30am services"
    : alert.requestedServices === "first" ? "7am service" : "10:30am service";
  return (
    <div
      className="absolute left-1/2 z-30 w-[min(760px,calc(100%-3rem))] rounded-2xl border-2 px-7 py-5 shadow-2xl"
      style={{
        top: 92,
        transform: "translateX(-50%)",
        background: "rgba(14,116,144,0.96)",
        borderColor: "#67e8f9",
        color: "white",
      }}
      data-testid="child-coming-banner"
    >
      <div className="flex items-center gap-5">
        <span className="text-5xl" aria-hidden="true">👋</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">Child coming / check-in</p>
          <p className="mt-1 text-3xl font-extrabold">{alert.childName}</p>
          <p className="mt-1 text-lg text-cyan-50">
            Requested by {alert.parentName} for the {services}
            {alert.homeClassName ? ` · ${alert.homeClassName} merged into ${alert.className}` : ""}
          </p>
        </div>
        {alerts.length > 1 && (
          <div className="rounded-full bg-cyan-200 px-4 py-2 text-lg font-black text-cyan-900">
            +{alerts.length - 1}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "classroom-display-yt-id";
const DISPLAY_TOKEN_KEY = "classroom-display-token";

export default function ClassroomDisplay() {
  const { classId } = useParams<{ classId: string }>();
  const classIdNum = Number(classId);

  const [queue, setQueue] = useState<PickupRequest[]>([]);
  const [checkInAlerts, setCheckInAlerts] = useState<CheckInAlert[]>([]);
  const [className, setClassName] = useState<string>("");
  const [connected, setConnected] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const [displayToken, setDisplayToken] = useState<string>(() => {
    if (!Number.isFinite(classIdNum)) return "";
    const key = `${DISPLAY_TOKEN_KEY}-${classIdNum}`;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("display") ?? sessionStorage.getItem(key) ?? "";
    if (token) {
      sessionStorage.setItem(key, token);
      if (params.has("display")) {
        params.delete("display");
        const query = params.toString();
        window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
      }
    }
    return token;
  });

  // Restore last YouTube video from localStorage; local files are session-only
  const [media, setMedia] = useState<MediaSource>(() => {
    try {
      const ytId = localStorage.getItem(STORAGE_KEY);
      return ytId ? { kind: "youtube", videoId: ytId } : null;
    } catch { return null; }
  });
  // Media pushed from a teacher's phone via the server — takes precedence.
  const [serverMedia, setServerMedia] = useState<ServerMedia>(null);

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

  // Staff viewing this page on their own (logged-in) device can issue a fresh
  // display link in place instead of hitting a dead end. Real TVs have no
  // login, so they still need a teacher's phone to reopen the display.
  const hasStaffSession = typeof localStorage !== "undefined" && !!localStorage.getItem("token");
  const reconnectDisplay = useCallback(async () => {
    if (!Number.isFinite(classIdNum)) return;
    setReconnecting(true);
    setReconnectError(null);
    try {
      const cred = await apiPost<{ token: string }>("/pickup-requests/display-credentials", { classId: classIdNum });
      sessionStorage.setItem(`${DISPLAY_TOKEN_KEY}-${classIdNum}`, cred.token);
      setAccessError(null);
      setDisplayToken(cred.token); // SSE effect reconnects with the new token
    } catch (e) {
      setReconnectError(e instanceof Error ? e.message : "Could not reconnect — please try again");
    } finally {
      setReconnecting(false);
    }
  }, [classIdNum]);

  const handleSetMedia = useCallback((m: MediaSource) => {
    setMedia(m);
    try {
      if (m?.kind === "youtube") localStorage.setItem(STORAGE_KEY, m.videoId);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  useEffect(() => {
    if (!classIdNum || !displayToken) {
      setAccessError("This classroom display link is missing or has expired. Open a new display link from Classes or My Class.");
      return;
    }
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    const url = `${base}/api/pickup-requests/stream/${classIdNum}?displayToken=${encodeURIComponent(displayToken)}`;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let failures = 0;
    // Set on cleanup so a superseded connection (e.g. after the token is
    // rotated by "Reconnect this screen") can never schedule retries, clear
    // the stored token, or resurface the access-error overlay.
    let disposed = false;
    let es: EventSource | null = null;

    function connect() {
      if (disposed) return;
      es = new EventSource(url);
      es.onopen = () => {
        if (disposed) return;
        failures = 0;
        setAccessError(null);
        setConnected(true);
      };
      es.onmessage = (e) => {
        if (disposed) return;
        try {
          const data = JSON.parse(e.data);
          if (data.type === "init") {
            const incomingQueue: PickupRequest[] = data.queue ?? [];
            if (!initialised.current) {
              incomingQueue.forEach(r => notifiedIds.current.add(r.id));
              initialised.current = true;
            }
            setQueue(incomingQueue);
            setCheckInAlerts((data.checkInAlerts as CheckInAlert[]) ?? []);
            if (data.className) setClassName(data.className);
            setServerMedia((data.media as ServerMedia) ?? null);
          } else if (data.type === "refresh") {
            const incomingQueue = (data.queue as PickupRequest[]) ?? [];
            incomingQueue.forEach(request => {
              if (!notifiedIds.current.has(request.id)) {
                notifiedIds.current.add(request.id);
                fireNotification(request);
              }
            });
            setQueue(incomingQueue);
            setCheckInAlerts((data.checkInAlerts as CheckInAlert[]) ?? []);
          } else if (data.type === "media") {
            setServerMedia((data.media as ServerMedia) ?? null);
          } else if (data.type === "media-page") {
            // Lightweight page-turn from a teacher's phone — don't reload the
            // PDF. Ignore events for a file this TV is no longer showing.
            setServerMedia((prev) =>
              prev && prev.kind === "file" && (!data.v || !prev.v || prev.v === data.v)
                ? { ...prev, page: data.page ?? null }
                : prev,
            );
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
          } else if (data.type === "checkin-requested") {
            const alert = data.alert as CheckInAlert;
            if (alert?.id) {
              setCheckInAlerts(current => current.some(item => item.id === alert.id) ? current : [...current, alert]);
            }
          } else if (data.type === "checkin-accepted" || data.type === "checkin-cancelled") {
            if (Array.isArray(data.alerts)) setCheckInAlerts(data.alerts as CheckInAlert[]);
            else setCheckInAlerts(current => current.filter(alert => alert.id !== String(data.id)));
          }
        } catch {}
      };
      es.onerror = () => {
        if (disposed) return;
        setConnected(false);
        es?.close();
        failures += 1;
        if (failures >= 3) {
          sessionStorage.removeItem(`${DISPLAY_TOKEN_KEY}-${classIdNum}`);
          setAccessError("This classroom display link is invalid, expired, or revoked. Open a new display link from Classes or My Class.");
          return;
        }
        retryTimeout = setTimeout(connect, 4000);
      };
    }

    connect();
    return () => {
      disposed = true;
      es?.close();
      clearTimeout(retryTimeout);
      setConnected(false);
    };
  }, [classIdNum, displayToken, fireNotification]);

  const today = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Media pushed from a teacher's phone wins over anything set on the TV itself.
  const remoteMedia = serverToMediaSource(serverMedia);
  const activeMedia = remoteMedia ?? media;
  // Slides and images use the whole screen (the news ticker overlays them);
  // videos keep their own space above the ticker so playback controls stay
  // reachable.
  const fullBleed = activeMedia?.kind === "pdf" || activeMedia?.kind === "local-image";

  return (
    <div className="h-screen w-screen overflow-hidden relative" style={{ background: "#0f172a", fontFamily: "Inter, sans-serif" }}>
      {accessError && (
        <div className="absolute inset-0 z-[100] bg-slate-950 flex items-center justify-center p-8">
          <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-white shadow-2xl">
            <div className="text-5xl mb-5">🔒</div>
            <h1 className="text-2xl font-bold">Classroom display access required</h1>
            <p className="mt-3 text-slate-300 leading-relaxed">
              {hasStaffSession
                ? "This screen's display link has expired or been replaced."
                : accessError}
            </p>
            {hasStaffSession && Number.isFinite(classIdNum) && (
              <div className="mt-6">
                <button
                  onClick={reconnectDisplay}
                  disabled={reconnecting}
                  className="rounded-2xl px-8 py-4 text-lg font-bold text-white shadow-lg transition-opacity disabled:opacity-60"
                  style={{ background: GOLD }}
                >
                  {reconnecting ? "Reconnecting…" : "🔄 Reconnect this screen"}
                </button>
                <p className="mt-3 text-sm text-slate-400">
                  Any other screen showing this class's display will need a new link.
                </p>
                {reconnectError && (
                  <p className="mt-2 text-sm text-red-400">{reconnectError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Media area — slides/images go full-screen; videos leave room for the news bar ── */}
      <div className="absolute inset-0" style={{ bottom: fullBleed ? 0 : NEWS_BAR_H }}>
        {activeMedia?.kind === "youtube" && (
          <iframe
            key={activeMedia.videoId}
            src={`https://www.youtube.com/embed/${activeMedia.videoId}?autoplay=1&loop=1&playlist=${activeMedia.videoId}&controls=1&modestbranding=1&rel=0&iv_load_policy=3`}
            className="w-full h-full"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            style={{ border: "none", display: "block" }}
          />
        )}
        {activeMedia?.kind === "local-video" && (
          <video
            key={activeMedia.url}
            src={activeMedia.url}
            className="w-full h-full"
            style={{ objectFit: "contain", background: "#000" }}
            autoPlay
            loop
            controls
          />
        )}
        {activeMedia?.kind === "local-image" && (
          <img
            key={activeMedia.url}
            src={activeMedia.url}
            alt={activeMedia.name}
            className="w-full h-full"
            style={{ objectFit: "contain", background: "#000" }}
          />
        )}
        {activeMedia?.kind === "pdf" && (
          <PdfSlides
            key={activeMedia.url}
            url={activeMedia.url}
            page={activeMedia.page}
            displayToken={displayToken}
          />
        )}
        {!activeMedia && <IdleScreen />}
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
          <VideoPanel media={media} onSet={handleSetMedia} remoteActive={remoteMedia !== null} />
          <div className="text-right">
            <p className="text-3xl font-bold text-white tabular-nums"><Clock /></p>
            <p className="text-white/40 text-xs mt-0.5">{today}</p>
          </div>
        </div>
      </div>

      {/* ── Notification permission banner ── */}
      {showNotifBanner && <NotifBanner onRequest={requestNotifPermission} />}
      <ChildComingBanner alerts={checkInAlerts} />

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
