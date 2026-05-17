import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { X, Camera, Loader2 } from "lucide-react";

interface QrCameraScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function QrCameraScanner({ onScan, onClose }: QrCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setLoading(false);
        tick();
      } catch (err) {
        setLoading(false);
        setError(
          "Camera access denied. Please allow camera permissions and try again.",
        );
      }
    }

    function tick() {
      if (!active) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      if (code?.data) {
        onScan(code.data);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    startCamera();

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-black shadow-2xl">
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: "#1e3a8a" }}
        >
          <div className="flex items-center gap-2 text-white font-semibold">
            <Camera className="w-4 h-4" />
            Scan QR Code
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative aspect-square bg-black flex items-center justify-center">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Starting camera…</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-red-400 text-sm">
              {error}
            </div>
          )}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          {!loading && !error && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className="w-52 h-52 border-4 rounded-lg"
                style={{ borderColor: "#f59e0b", boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }}
              />
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="px-4 py-3 bg-gray-900 text-center text-white/60 text-xs">
          Point the camera at a family QR code
        </div>
      </div>
    </div>
  );
}
