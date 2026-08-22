import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { Camera, Loader2, Check } from "lucide-react";

interface PhotoUploaderProps {
  currentPhotoUrl?: string | null;
  fallbackLabel?: string;
  onChange: (objectPath: string) => void;
  size?: "sm" | "md" | "lg";
  shape?: "circle" | "rounded";
  disabled?: boolean;
}

const sizes = {
  sm: "w-14 h-14 text-lg",
  md: "w-20 h-20 text-2xl",
  lg: "w-28 h-28 text-3xl",
};

export function resolvePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/objects/")) return `/api/storage${url}`;
  if (url.startsWith("http")) return url;
  return url;
}

export function useSecurePhotoUrl(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!url || url.startsWith("/objects/")) return null;
    return resolvePhotoUrl(url);
  });

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    if (!url) {
      setResolved(null);
      return;
    }
    if (!url.startsWith("/objects/")) {
      setResolved(resolvePhotoUrl(url));
      return;
    }

    setResolved(null);
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch(`/api/storage${url}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(response => {
        if (!response.ok) throw new Error("Photo unavailable");
        return response.blob();
      })
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResolved(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setResolved(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return resolved;
}

export function SecurePhoto({
  src,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string | null }) {
  const resolved = useSecurePhotoUrl(src);
  return resolved ? <img {...props} src={resolved} /> : null;
}

export function PhotoUploader({
  currentPhotoUrl,
  fallbackLabel = "?",
  onChange,
  size = "md",
  shape = "circle",
  disabled = false,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const secureCurrentPhoto = useSecurePhotoUrl(currentPhotoUrl);

  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-2xl";
  const sizeClass = sizes[size];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setIsUploading(true);
    setProgress(10);

    try {
      const token = localStorage.getItem("token");
      const metaRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "image/jpeg",
        }),
      });

      if (!metaRes.ok) throw new Error("Could not get upload URL");
      const { uploadURL, objectPath } = await metaRes.json();
      setProgress(40);

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      });

      if (!putRes.ok) throw new Error("Upload to storage failed");
      setProgress(100);
      onChange(objectPath);
      setUploaded(true);
      setTimeout(() => setUploaded(false), 2500);
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setPreview(null);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const displayUrl = preview ?? secureCurrentPhoto;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => !disabled && !isUploading && inputRef.current?.click()}
          className={`${sizeClass} ${shapeClass} overflow-hidden relative flex items-center justify-center focus:outline-none active:scale-95 transition-transform border-2 border-white shadow-md`}
          style={{ background: displayUrl ? "transparent" : "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}
          disabled={disabled || isUploading}
        >
          {displayUrl ? (
            <img src={displayUrl} alt="Photo" className="w-full h-full object-cover" />
          ) : (
            <span className="font-bold text-white select-none">{fallbackLabel}</span>
          )}

          {isUploading && (
            <div className={`absolute inset-0 ${shapeClass} bg-black/55 flex flex-col items-center justify-center gap-1`}>
              <Loader2 className="w-5 h-5 text-white animate-spin" />
              <span className="text-white text-[10px] font-bold">{Math.round(progress)}%</span>
            </div>
          )}

          {uploaded && !isUploading && (
            <div className={`absolute inset-0 ${shapeClass} bg-green-500/80 flex items-center justify-center`}>
              <Check className="w-6 h-6 text-white" />
            </div>
          )}

          {!disabled && !isUploading && !uploaded && (
            <div className={`absolute inset-0 ${shapeClass} bg-black/30 opacity-0 hover:opacity-100 active:opacity-100 flex items-center justify-center transition-opacity`}>
              <Camera className="w-5 h-5 text-white" />
            </div>
          )}
        </button>

        {!disabled && (
          <button
            type="button"
            onClick={() => !isUploading && inputRef.current?.click()}
            disabled={isUploading}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center shadow-lg border-2 border-white active:scale-95 transition-transform disabled:opacity-60"
          >
            {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error && <p className="text-xs text-red-500 text-center max-w-[120px]">{error}</p>}
      {!error && !disabled && (
        <p className="text-[10px] text-gray-400 text-center leading-tight">
          Tap to {displayUrl ? "change" : "upload"} photo<br />
          <span className="font-medium">Camera or Gallery</span>
        </p>
      )}
    </div>
  );
}
