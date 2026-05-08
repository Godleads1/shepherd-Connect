import { useEffect, useRef, useState, useCallback } from "react";
import { useFaceApi } from "@/hooks/useFaceApi";
import { Camera, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FaceCaptureProps {
  onDescriptor: (descriptor: number[]) => void;
  mode: "enroll" | "scan";
  label?: string;
}

export default function FaceCapture({ onDescriptor, mode, label }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<"idle" | "success" | "no-face" | "error">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { status: faceStatus, errorMsg, load, detectDescriptor } = useFaceApi();

  useEffect(() => {
    load();
    startCamera();
    return () => stopCamera();
  }, [load]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch {
      setCaptureStatus("error");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || faceStatus !== "ready") return;
    setCapturing(true);
    setCaptureStatus("idle");
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      setPreviewUrl(canvas.toDataURL("image/jpeg", 0.8));

      const descriptor = await detectDescriptor(video);
      if (!descriptor) {
        setCaptureStatus("no-face");
        setCapturing(false);
        return;
      }
      setCaptureStatus("success");
      onDescriptor(Array.from(descriptor));
    } catch {
      setCaptureStatus("error");
    } finally {
      setCapturing(false);
    }
  }, [faceStatus, detectDescriptor, onDescriptor]);

  const isLoading = faceStatus === "loading";
  const isReady = faceStatus === "ready" && cameraReady;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative rounded-2xl overflow-hidden bg-gray-900 w-full max-w-xs aspect-[4/3] shadow-inner flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Loading overlay */}
        {(isLoading || !cameraReady) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 text-white gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <p className="text-xs text-gray-300">
              {isLoading ? "Loading face recognition..." : "Starting camera..."}
            </p>
          </div>
        )}

        {/* Face guide overlay */}
        {isReady && captureStatus === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-40 h-48 rounded-full border-2 border-dashed border-white/60 opacity-70" />
          </div>
        )}

        {/* Status overlays */}
        {captureStatus === "success" && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-600/30">
            <CheckCircle2 className="w-16 h-16 text-green-400" />
          </div>
        )}
        {captureStatus === "no-face" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-amber-600/30 gap-2">
            <AlertCircle className="w-12 h-12 text-amber-300" />
            <p className="text-amber-100 text-sm font-medium">No face detected</p>
          </div>
        )}
        {captureStatus === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-600/30 gap-2">
            <AlertCircle className="w-12 h-12 text-red-300" />
            <p className="text-red-100 text-sm font-medium">Camera unavailable</p>
          </div>
        )}
      </div>

      {faceStatus === "error" && (
        <p className="text-xs text-red-500 text-center max-w-xs">{errorMsg}</p>
      )}

      <div className="flex gap-2 w-full max-w-xs">
        <Button
          onClick={capture}
          disabled={!isReady || capturing}
          className="flex-1 h-12 font-semibold"
          style={{ background: "linear-gradient(135deg, #1a237e, #1e3a8a)" }}
        >
          {capturing ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Scanning...</>
          ) : (
            <><Camera className="w-4 h-4 mr-2" /> {label || (mode === "enroll" ? "Capture Face" : "Scan Face")}</>
          )}
        </Button>
        {captureStatus !== "idle" && (
          <Button
            variant="outline"
            onClick={() => { setCaptureStatus("idle"); setPreviewUrl(null); }}
            className="h-12 px-3"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {captureStatus === "no-face" && (
        <p className="text-xs text-amber-600 text-center">
          Position your face inside the oval guide and ensure good lighting, then try again.
        </p>
      )}
      {captureStatus === "success" && (
        <p className="text-xs text-green-600 text-center font-medium">
          {mode === "enroll" ? "Face captured successfully! Click Save to enroll." : "Match found!"}
        </p>
      )}
    </div>
  );
}
