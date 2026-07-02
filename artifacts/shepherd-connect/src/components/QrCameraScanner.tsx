import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { X, Camera, Loader2, RefreshCcw } from "lucide-react";

interface QrCameraScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  /** Label shown on the instruction footer — defaults to "Point camera at the QR code" */
  hint?: string;
}

export default function QrCameraScanner({ onScan, onClose, hint }: QrCameraScannerProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number>(0);
  const activeRef = useRef(true);

  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [facing,  setFacing]  = useState<"environment" | "user">("environment");

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async (facingMode: "environment" | "user") => {
    stopCamera();
    setLoading(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 } },
      });
      if (!activeRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setLoading(false);

      const tick = () => {
        if (!activeRef.current) return;
        const canvas = canvasRef.current!;
        if (video.readyState < video.HAVE_ENOUGH_DATA) {
          rafRef.current = requestAnimationFrame(tick); return;
        }
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          stopCamera();
          onScan(code.data);
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setLoading(false);
      setError("Camera access denied. Please allow camera permissions and try again.");
    }
  }, [onScan, stopCamera]);

  useEffect(() => {
    activeRef.current = true;
    startCamera(facing);
    return () => {
      activeRef.current = false;
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: "#1e3a8a" }}>
        <div className="flex items-center gap-2 text-white font-semibold">
          <Camera className="w-4 h-4" />
          Scan QR Code
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setFacing(f => f === "environment" ? "user" : "environment")}
            className="text-white/70 hover:text-white transition-colors"
            title="Flip camera"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Camera area */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70 z-10">
            <Loader2 className="w-10 h-10 animate-spin text-yellow-400" />
            <span className="text-sm">Starting camera…</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center z-10">
            <p className="text-red-400 font-semibold">Camera unavailable</p>
            <p className="text-white/60 text-sm">{error}</p>
            <button
              onClick={() => startCamera(facing)}
              className="px-5 py-2 bg-yellow-400 text-blue-950 rounded-xl text-sm font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />

        {/* Viewfinder overlay */}
        {!loading && !error && (
          <div className="relative z-10 flex flex-col items-center gap-4 pointer-events-none">
            <div className="relative w-64 h-64">
              {/* Corner brackets */}
              <span className="absolute top-0 left-0  w-8 h-8 border-t-4 border-l-4 border-yellow-400 rounded-tl" />
              <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-yellow-400 rounded-tr" />
              <span className="absolute bottom-0 left-0  w-8 h-8 border-b-4 border-l-4 border-yellow-400 rounded-bl" />
              <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-yellow-400 rounded-br" />
              {/* Animated scan line */}
              <span
                className="absolute left-2 right-2 h-0.5 bg-yellow-400/90 rounded-full"
                style={{ animation: "scan-line 2s ease-in-out infinite" }}
              />
            </div>
          </div>
        )}

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 55% 55% at 50% 50%, transparent 28%, rgba(0,0,0,0.60) 100%)" }}
        />
      </div>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Footer hint */}
      <div className="px-4 py-3 text-center" style={{ background: "#1e3a8a" }}>
        <p className="text-white/60 text-xs">
          {hint ?? "Point the camera at the QR code on the church screen"}
        </p>
      </div>

      {/* Scan-line keyframe */}
      <style>{`
        @keyframes scan-line {
          0%   { top: 8px;  opacity: 1; }
          50%  { top: calc(100% - 8px); opacity: 1; }
          100% { top: 8px;  opacity: 1; }
        }
      `}</style>
    </div>
  );
}
