import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  FileText,
  Image as ImageIcon,
  ListVideo,
  Loader2,
  Play,
  Presentation,
  RotateCcw,
  Trash2,
  Video,
  Youtube,
} from "lucide-react";
import { apiDelete, apiPost, apiPut } from "@/lib/api-call";
import { useToast } from "@/hooks/use-toast";

const NAVY = "#1e3a8a";
const GOLD = "#f59e0b";

export interface PlaylistItem {
  id: number;
  kind: "youtube" | "file" | "bible";
  label: string;
  youtubeVideoId: string | null;
  fileName: string | null;
  contentType: string | null;
  pdfPageCount: number | null;
  bibleVersion: string | null;
  onTv: boolean;
}

export interface PlaylistResponse {
  items: PlaylistItem[];
  limit: number;
}

/** Icon and plain-language type shown under each item's name. */
export function describeItem(item: Pick<PlaylistItem, "kind" | "contentType" | "fileName" | "pdfPageCount">): { icon: typeof Video; type: string } {
  if (item.kind === "youtube") return { icon: Youtube, type: "YouTube video" };
  if (item.kind === "bible") return { icon: BookOpen, type: "Bible passage" };
  const contentType = item.contentType ?? "";
  if (contentType === "application/pdf") {
    const pages = item.pdfPageCount ? ` · ${item.pdfPageCount} pages` : "";
    return /\.pptx?$/i.test(item.fileName ?? "")
      ? { icon: Presentation, type: `Slides${pages}` }
      : { icon: FileText, type: `Document${pages}` };
  }
  if (contentType.startsWith("image/")) return { icon: ImageIcon, type: "Image" };
  return { icon: Video, type: "Video" };
}

/**
 * Today's TV list for a class: Play puts an item on the TV (from the start);
 * pressing Play on an earlier item goes back to it. Removing or reordering
 * never changes what the TV is showing.
 */
export function ClassTvPlaylist({
  classId,
  query,
  disabled,
}: {
  classId: number;
  query: UseQueryResult<PlaylistResponse>;
  disabled: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const base = `/pickup-requests/display-media/${classId}/playlist`;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["display-media", classId] });

  const play = useMutation({
    mutationFn: (item: PlaylistItem) => apiPost(`${base}/${item.id}/play`),
    onSuccess: (_data, item) => {
      void invalidate();
      toast({ title: "Now on the TV", description: item.label });
    },
    onError: (e: Error) => {
      void invalidate();
      toast({ variant: "destructive", title: "Could not play this item", description: e.message });
    },
  });
  const move = useMutation({
    mutationFn: ({ id, direction }: { id: number; direction: "up" | "down" }) =>
      apiPut(`${base}/${id}/move`, { direction }),
    onSettled: () => void invalidate(),
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not move this item", description: e.message }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => apiDelete(`${base}/${id}`),
    onSettled: () => void invalidate(),
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not remove this item", description: e.message }),
  });

  const items = query.data?.items ?? [];
  const working = disabled || play.isPending || move.isPending || remove.isPending;

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: `${NAVY}26` }} data-testid="tv-playlist">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <ListVideo className="w-4 h-4" style={{ color: NAVY }} /> Today's TV list
        </p>
        {query.data && (
          <span className="text-xs font-semibold text-gray-400 tabular-nums">
            {items.length} / {query.data.limit}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Adding an item doesn't change the TV. The list clears automatically each new day.
      </p>

      {query.isLoading ? (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading today's list…
        </p>
      ) : query.isError ? (
        <p className="text-xs text-red-500">{(query.error as Error).message}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 rounded-xl bg-gray-50 px-3 py-3">
          Nothing added yet. Add videos, slides, documents or Bible passages below, then press Play.
        </p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, index) => {
            const { icon: Icon, type } = describeItem(item);
            const playing = play.isPending && play.variables?.id === item.id;
            return (
              <li
                key={item.id}
                className="min-w-0 flex items-center gap-2 rounded-xl border px-2.5 py-2"
                style={item.onTv ? { borderColor: "#10b98166", background: "#ecfdf5" } : { borderColor: "#f3f4f6" }}
                data-testid={`tv-playlist-item-${item.id}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0 text-gray-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate" title={item.label}>{item.label}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {item.onTv ? <span className="font-bold text-emerald-700">On TV · </span> : null}
                    {type}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    aria-label={`Move ${item.label} up`}
                    onClick={() => move.mutate({ id: item.id, direction: "up" })}
                    disabled={working || index === 0}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${item.label} down`}
                    onClick={() => move.mutate({ id: item.id, direction: "down" })}
                    disabled={working || index === items.length - 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${item.label} from the list`}
                    onClick={() => remove.mutate(item.id)}
                    disabled={working}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => play.mutate(item)}
                    disabled={working}
                    className="ml-1 px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
                    style={{ background: GOLD, color: NAVY }}
                    title={item.onTv ? "Start this item again from the beginning" : "Show this on the TV"}
                    data-testid={`tv-playlist-play-${item.id}`}
                  >
                    {playing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : item.onTv ? (
                      <RotateCcw className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {item.onTv ? "Restart" : "Play"}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
