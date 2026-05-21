import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { apiGet } from "@/lib/api-call";

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

// Horizontal scrolling ticker for the pickup queue
function PickupTicker({ queue }: { queue: PickupRequest[] }) {
  const tickerRef = useRef<HTMLDivElement>(null);

  if (queue.length === 0) return null;

  // Duplicate items so the scroll loops seamlessly
  const items = [...queue, ...queue, ...queue];

  return (
    <div
      className="overflow-hidden w-full"
      style={{
        background: GOLD,
        borderTop: `4px solid ${NAVY}`,
      }}
    >
      <div
        ref={tickerRef}
        className="flex items-center gap-0 whitespace-nowrap"
        style={{
          animation: `ticker ${Math.max(items.length * 8, 20)}s linear infinite`,
        }}
      >
        {items.map((r, i) => (
          <span
            key={`${r.id}-${i}`}
            className="inline-flex items-center gap-3 px-10 py-4 text-2xl font-bold"
            style={{ color: NAVY }}
          >
            <span className="text-3xl">📣</span>
            <span>{r.parentName}</span>
            <span className="opacity-60 text-xl font-normal">is here to pick up</span>
            <span className="underline underline-offset-4">{r.childName}</span>
            <span className="opacity-40 text-lg font-normal ml-2">{formatTime(r.requestedAt)}</span>
            <span className="mx-8 opacity-30 text-4xl">·</span>
          </span>
        ))}
      </div>

      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}

// Individual card shown in the main area
function PickupCard({ request, index }: { request: PickupRequest; index: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 120);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <div
      className="rounded-3xl p-8 flex items-center gap-6 transition-all duration-500"
      style={{
        background: "white",
        border: `3px solid ${GOLD}`,
        boxShadow: "0 8px 32px rgba(30,58,138,0.12)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
      }}
    >
      {/* Avatar */}
      <div
        className="w-24 h-24 rounded-2xl flex items-center justify-center flex-shrink-0 text-4xl font-bold text-white"
        style={{ background: `linear-gradient(135deg, ${NAVY}, #3b82f6)` }}
      >
        {request.childName[0]}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-4xl font-extrabold text-gray-900 leading-tight truncate"
          style={{ fontFamily: "'Playfair Display', serif" }}>
          {request.childName}
        </p>
        <p className="text-xl text-gray-500 mt-1">
          Parent: <span className="font-semibold text-gray-700">{request.parentName}</span>
        </p>
      </div>

      <div className="flex-shrink-0 text-right">
        <div
          className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-lg font-bold"
          style={{ background: `${GOLD}22`, color: "#92400e", border: `2px solid ${GOLD}` }}
        >
          <span className="animate-pulse text-2xl">🚶</span> Ready for pickup
        </div>
        <p className="text-sm text-gray-400 mt-2">{formatTime(request.requestedAt)}</p>
      </div>
    </div>
  );
}

export default function ClassroomDisplay() {
  const { classId } = useParams<{ classId: string }>();
  const classIdNum = Number(classId);

  const [queue, setQueue] = useState<PickupRequest[]>([]);
  const [className, setClassName] = useState<string>("");
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Connect to SSE stream (class name comes in the init message)
  useEffect(() => {
    if (!classIdNum) return;

    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    const url = `${base}/api/pickup-requests/stream/${classIdNum}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "init") {
          setQueue(data.queue ?? []);
          if (data.className) setClassName(data.className);
          setLastUpdate(new Date());
        } else if (data.type === "pickup" || data.type === "dismissed") {
          setQueue(data.queue ?? []);
          setLastUpdate(new Date());
        }
      } catch {}
    };

    es.onerror = () => {
      setConnected(false);
      // Reconnect after 3s
      setTimeout(() => {
        es.close();
        // useEffect cleanup will re-run on next render if we update state
      }, 3000);
    };

    return () => { es.close(); setConnected(false); };
  }, [classIdNum]);

  const today = new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 100%)", fontFamily: "Inter, sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-10 py-6" style={{ borderBottom: `2px solid rgba(255,255,255,0.08)` }}>
        <div className="flex items-center gap-5">
          {/* Logo mark */}
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: GOLD }}>
            🐑
          </div>
          <div>
            <p className="text-white/50 text-sm font-medium tracking-widest uppercase">Shepherd Connect</p>
            <h1 className="text-3xl font-extrabold text-white leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              {className || `Classroom ${classId}`}
            </h1>
          </div>
        </div>

        <div className="text-right">
          <p className="text-5xl font-bold text-white tabular-nums">
            <Clock />
          </p>
          <p className="text-white/50 text-sm mt-1">{today}</p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-10 py-8 overflow-hidden">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="text-8xl opacity-30">🕊️</div>
            <p className="text-3xl font-bold text-white/40">No pickup requests at the moment</p>
            <p className="text-lg text-white/25">When a parent is ready to pick up their child, it will appear here</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: GOLD }} />
              <p className="text-xl font-semibold text-white/70">
                {queue.length} pickup {queue.length === 1 ? "request" : "requests"} waiting
              </p>
            </div>
            {queue.map((r, i) => (
              <PickupCard key={r.id} request={r} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Scrolling ticker */}
      <PickupTicker queue={queue} />

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-10 py-3"
        style={{ background: "rgba(0,0,0,0.3)", borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
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
