import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiGet, apiPut, apiDelete } from "@/lib/api-call";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Youtube, Upload, Trash2, MonitorPlay, CheckCircle2 } from "lucide-react";

const NAVY = "#1e3a8a";
const GOLD = "#f59e0b";

interface CurrentMedia {
  kind: "youtube" | "file";
  youtubeVideoId: string | null;
  fileName: string | null;
  contentType: string | null;
  updatedAt: string;
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
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx !== -1) return parts[shortsIdx + 1];
    }
  } catch {}
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

/**
 * Lets staff set what plays on the classroom TV from their own phone/laptop —
 * no typing on the TV. The TV updates instantly over its live connection.
 */
export function ClassTvMediaControl({
  classId,
  className,
  trigger = "button",
}: {
  classId: number;
  className?: string;
  trigger?: "button" | "compact";
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ytInput, setYtInput] = useState("");
  const [ytError, setYtError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["display-media", classId],
    queryFn: () => apiGet<{ media: CurrentMedia | null }>(`/pickup-requests/display-media/${classId}`),
    enabled: open,
  });
  const current = data?.media ?? null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["display-media", classId] });

  const setYoutube = useMutation({
    mutationFn: (videoId: string) =>
      apiPut(`/pickup-requests/display-media/${classId}`, { kind: "youtube", youtubeVideoId: videoId }),
    onSuccess: () => {
      invalidate();
      setYtInput("");
      toast({ title: "TV updated", description: "The classroom screen is now playing your YouTube video." });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Could not update the TV", description: e.message }),
  });

  const clearMedia = useMutation({
    mutationFn: () => apiDelete(`/pickup-requests/display-media/${classId}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "TV cleared", description: "The classroom screen returned to the welcome view." });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Could not clear the TV", description: e.message }),
  });

  const applyYouTube = () => {
    const id = extractYouTubeId(ytInput.trim());
    if (!id) {
      setYtError("Couldn't recognise that YouTube link. Paste the full URL from the YouTube app or website.");
      return;
    }
    setYtError("");
    setYoutube.mutate(id);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast({ variant: "destructive", title: "Unsupported file", description: "Please choose a video or image file." });
      return;
    }
    setUploading(true);
    setUploadPct(5);
    try {
      const token = localStorage.getItem("token");
      const metaRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!metaRes.ok) throw new Error("Could not start the upload");
      const { uploadURL, objectPath } = await metaRes.json();
      setUploadPct(15);

      // Upload with progress via XHR (fetch has no upload progress).
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadURL);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadPct(15 + Math.round((ev.loaded / ev.total) * 75));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
        xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
        xhr.send(file);
      });
      setUploadPct(95);

      await apiPut(`/pickup-requests/display-media/${classId}`, {
        kind: "file",
        objectPath,
        contentType: file.type,
        fileName: file.name,
      });
      setUploadPct(100);
      invalidate();
      toast({ title: "TV updated", description: `The classroom screen is now showing “${file.name}”.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message || "Please try again." });
    } finally {
      setUploading(false);
      setUploadPct(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const busy = uploading || setYoutube.isPending || clearMedia.isPending;

  return (
    <>
      {trigger === "button" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
          style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }}
        >
          <MonitorPlay className="w-4 h-4" />
          TV Video
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-blue-200 text-blue-800 hover:bg-blue-50 transition-colors"
          title="Set the video or image playing on this classroom's TV"
        >
          <MonitorPlay className="w-3.5 h-3.5" /> TV Video
        </button>
      )}

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }} className="text-xl">
              {className ? `${className} — TV Video` : "Classroom TV Video"}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-500 -mt-2">
            Whatever you set here plays on the classroom TV instantly — no typing on the TV needed.
          </p>

          {/* Current media */}
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking what's on the TV…
            </div>
          ) : current ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-900 truncate">
                    {current.kind === "youtube"
                      ? "YouTube video playing"
                      : current.fileName || "Uploaded file playing"}
                  </p>
                  <p className="text-xs text-emerald-700/80">Currently on the TV</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => clearMedia.mutate()}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors flex-shrink-0 disabled:opacity-50"
              >
                {clearMedia.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Clear
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
              Nothing is set — the TV is showing the welcome screen.
            </div>
          )}

          {/* YouTube */}
          <div className="rounded-xl border border-gray-100 p-4">
            <p className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
              <Youtube className="w-4 h-4 text-red-600" /> Play a YouTube video
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Share the link from the YouTube app, or copy the URL and paste it below.
            </p>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl px-3 py-2.5 text-sm border border-gray-200 focus:outline-none focus:border-blue-500 min-w-0"
                placeholder="https://youtube.com/watch?v=…"
                value={ytInput}
                onChange={(e) => { setYtInput(e.target.value); setYtError(""); }}
                onKeyDown={(e) => e.key === "Enter" && !busy && ytInput.trim() && applyYouTube()}
                disabled={busy}
              />
              <button
                type="button"
                onClick={applyYouTube}
                disabled={busy || !ytInput.trim()}
                className="px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                style={{ background: GOLD, color: NAVY }}
              >
                {setYoutube.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "▶"} Play
              </button>
            </div>
            {ytError && <p className="text-red-500 text-xs mt-2">{ytError}</p>}
          </div>

          {/* Upload */}
          <div className="rounded-xl border border-gray-100 p-4">
            <p className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
              <Upload className="w-4 h-4 text-blue-600" /> Upload a video or image
            </p>
            <p className="text-xs text-gray-400 mb-3">
              MP4, MOV, WebM, JPG or PNG from this device. Large videos may take a while on church Wi-Fi — YouTube links play faster.
            </p>
            <input ref={fileRef} type="file" accept="video/*,image/*" className="hidden" onChange={handleFile} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading… {uploadPct}%
                </span>
              ) : (
                "Choose a file from this device"
              )}
            </button>
            {uploading && (
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${uploadPct}%`, background: NAVY }} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
