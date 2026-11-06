import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-call";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Youtube, Upload, Trash2, MonitorPlay, CheckCircle2, ChevronLeft, ChevronRight, Play, Plus } from "lucide-react";
import { BiblePicker, BibleRemote, type BibleMediaState } from "./BibleTvControl";
import { ClassTvPlaylist, type PlaylistResponse } from "./ClassTvPlaylist";

const NAVY = "#1e3a8a";
const GOLD = "#f59e0b";

interface CurrentMedia extends BibleMediaState {
  kind: "youtube" | "file" | "bible";
  youtubeVideoId: string | null;
  fileName: string | null;
  contentType: string | null;
  /** PDFs only: pinned page from the phone clicker; null = auto-playing. */
  pdfPage: number | null;
  pdfPageCount: number | null;
  updatedAt: string;
}

/** Counts PDF pages on the uploader's device so the TV clicker can show "3 / 12". */
async function countPdfPages(file: File): Promise<number | undefined> {
  try {
    // Legacy build: church smart-TV browsers (and older phones) lack the
    // newest JS APIs the modern pdf.js build assumes.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // Vite's ?url import resolves the worker asset URL
    const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
    const doc = await task.promise;
    const n = doc.numPages;
    void task.destroy();
    return n;
  } catch {
    return undefined; // best effort — the TV still auto-plays without a count
  }
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
  // PowerPoint uploads are converted to PDF on the server after the upload
  // finishes — that takes a few extra seconds, so show a distinct status.
  const [converting, setConverting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["display-media", classId],
    queryFn: () => apiGet<{ media: CurrentMedia | null }>(`/pickup-requests/display-media/${classId}`),
    enabled: open,
  });
  const current = data?.media ?? null;

  // Today's list of items teachers can play; cleared automatically each day.
  const playlist = useQuery({
    queryKey: ["display-media", classId, "playlist"],
    queryFn: () => apiGet<PlaylistResponse>(`/pickup-requests/display-media/${classId}/playlist`),
    enabled: open,
  });
  const listFull = (playlist.data?.items.length ?? 0) >= (playlist.data?.limit ?? Infinity);

  // Invalidates both what's on the TV and today's list (shared key prefix).
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["display-media", classId] });

  const addYoutube = useMutation({
    mutationFn: (videoId: string) =>
      apiPost(`/pickup-requests/display-media/${classId}/playlist`, { kind: "youtube", youtubeVideoId: videoId }),
    onSuccess: () => {
      invalidate();
      setYtInput("");
      toast({ title: "Added to the TV list", description: "Press Play on it when you're ready to show it." });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Could not add the video", description: e.message }),
  });

  const clearMedia = useMutation({
    mutationFn: () => apiDelete(`/pickup-requests/display-media/${classId}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "TV cleared", description: "The classroom screen returned to its normal view." });
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
    addYoutube.mutate(id);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || (!file.type && /\.pdf$/i.test(file.name));
    // Some phones report a blank/generic type for PowerPoint files, so also
    // match on the extension.
    const isPpt =
      !isPdf &&
      (file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
        file.type === "application/vnd.ms-powerpoint" ||
        ((!file.type || file.type === "application/octet-stream") && /\.pptx?$/i.test(file.name)));
    if (!isVideo && !isImage && !isPdf && !isPpt) {
      toast({ variant: "destructive", title: "Unsupported file", description: "Please choose a video, image, PDF, or PowerPoint file." });
      return;
    }
    const contentType =
      file.type ||
      (isPdf
        ? "application/pdf"
        : /\.pptx$/i.test(file.name)
          ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          : "application/vnd.ms-powerpoint");
    setUploading(true);
    setUploadPct(5);
    try {
      const pdfPageCount = isPdf ? await countPdfPages(file) : undefined;
      const token = localStorage.getItem("token");
      const metaRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: file.name, size: file.size, contentType }),
      });
      if (!metaRes.ok) throw new Error("Could not start the upload");
      const { uploadURL, objectPath } = await metaRes.json();
      setUploadPct(15);

      // Upload with progress via XHR (fetch has no upload progress).
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadURL);
        xhr.setRequestHeader("Content-Type", contentType);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadPct(15 + Math.round((ev.loaded / ev.total) * 75));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
        xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
        xhr.send(file);
      });
      setUploadPct(95);

      if (isPpt) setConverting(true);
      await apiPost(`/pickup-requests/display-media/${classId}/playlist`, {
        kind: "file",
        objectPath,
        contentType,
        fileName: file.name,
        ...(pdfPageCount ? { pdfPageCount } : {}),
      });
      setUploadPct(100);
      invalidate();
      toast({
        title: "Added to the TV list",
        description: `“${file.name}” is ready — press Play on it to show it on the TV.`,
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message || "Please try again." });
    } finally {
      setUploading(false);
      setConverting(false);
      setUploadPct(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const setPage = useMutation({
    mutationFn: (page: number | null) =>
      apiPut(`/pickup-requests/display-media/${classId}/page`, { page }),
    onSuccess: () => invalidate(),
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Could not change the slide", description: e.message }),
  });

  const busy = uploading || addYoutube.isPending || clearMedia.isPending;
  const isPdfActive = current?.kind === "file" && current.contentType === "application/pdf";
  const isBibleActive = current?.kind === "bible";

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
        <DialogContent className="w-[calc(100%-2rem)] max-w-[480px] sm:max-w-[480px] grid-cols-[minmax(0,1fr)] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border-none shadow-2xl">
          <DialogHeader className="min-w-0 pr-6 [overflow-wrap:anywhere]">
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }} className="text-xl">
              {className ? `${className} — TV Video` : "Classroom TV Video"}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-500 -mt-2">
            Build today's list below, then press Play on any item to show it on the classroom TV. Press Play on an
            earlier item to go back to it.
          </p>

          {/* Current media */}
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking what's on the TV…
            </div>
          ) : current ? (
            <div className="min-w-0 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex flex-1 items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-900 truncate" title={current.fileName || undefined}>
                    {current.kind === "youtube"
                      ? "YouTube video playing"
                      : current.kind === "bible"
                        ? `Bible passage (${current.bibleVersion ?? "Bible"})`
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
                Clear TV
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
              Nothing is set — the TV is showing the welcome screen.
            </div>
          )}

          {/* PDF slide clicker — use the phone as a remote for the TV slides */}
          {isPdfActive && (
            <div className="rounded-xl border p-4" style={{ borderColor: `${GOLD}66`, background: `${GOLD}0d` }}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm font-bold text-gray-800">Slide control</p>
                <p className="text-xs font-semibold text-gray-500 tabular-nums">
                  {current!.pdfPage === null
                    ? "Auto-playing"
                    : `Slide ${current!.pdfPage}${current!.pdfPageCount ? ` of ${current!.pdfPageCount}` : ""}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPage.mutate(Math.max(1, (current!.pdfPage ?? 1) - 1))}
                  disabled={setPage.isPending || (current!.pdfPage !== null && current!.pdfPage <= 1)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={() => setPage.mutate(current!.pdfPage === null ? 1 : current!.pdfPage + 1)}
                  disabled={
                    setPage.isPending ||
                    (current!.pdfPage !== null && current!.pdfPageCount !== null && current!.pdfPage >= current!.pdfPageCount)
                  }
                  className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-40"
                  style={{ background: NAVY, color: "white" }}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
                {current!.pdfPage !== null && (
                  <button
                    type="button"
                    onClick={() => setPage.mutate(null)}
                    disabled={setPage.isPending}
                    className="px-3 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40"
                    title="Resume auto-play"
                  >
                    <Play className="w-3.5 h-3.5" /> Auto
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                Tapping Next takes control of the TV; Auto lets slides advance on their own again.
              </p>
            </div>
          )}

          {/* Bible — remote for the passage on the TV, then the passage picker */}
          {isBibleActive && (
            <BibleRemote
              classId={classId}
              current={current!}
              onStop={() => clearMedia.mutate()}
              stopping={clearMedia.isPending}
            />
          )}
          <ClassTvPlaylist classId={classId} query={playlist} disabled={busy} />

          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 pt-1">Add to today's list</p>
          {listFull && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Today's list is full. Remove an item before adding another.
            </p>
          )}
          {open && <BiblePicker classId={classId} disabled={busy || listFull} />}

          {/* YouTube */}
          <div className="rounded-xl border border-gray-100 p-4">
            <p className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
              <Youtube className="w-4 h-4 text-red-600" /> Add a YouTube video
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
                onKeyDown={(e) => e.key === "Enter" && !busy && !listFull && ytInput.trim() && applyYouTube()}
                disabled={busy || listFull}
              />
              <button
                type="button"
                onClick={applyYouTube}
                disabled={busy || listFull || !ytInput.trim()}
                className="px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                style={{ background: GOLD, color: NAVY }}
              >
                {addYoutube.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
              </button>
            </div>
            {ytError && <p className="text-red-500 text-xs mt-2">{ytError}</p>}
          </div>

          {/* Upload */}
          <div className="rounded-xl border border-gray-100 p-4">
            <p className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
              <Upload className="w-4 h-4 text-blue-600" /> Add a video, image, document or slides
            </p>
            <p className="text-xs text-gray-400 mb-3">
              MP4, MOV, WebM, JPG, PNG, PDF or PowerPoint (PPTX) from this device. PDFs and PowerPoints play as
              slides you can control from here. Large videos may be slow on church Wi-Fi — YouTube links play faster.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="video/*,image/*,application/pdf,.pdf,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              className="hidden"
              onChange={handleFile}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy || listFull}
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {converting ? "Preparing slides for the TV…" : `Uploading… ${uploadPct}%`}
                </span>
              ) : (
                "Choose a file to add"
              )}
            </button>
            {uploading && (
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${uploadPct}%`, background: NAVY }} />
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
