import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api-call";
import { useToast } from "@/hooks/use-toast";
import { reportBibleView } from "@/lib/bible-fums";
import { adjacentVerse, isOutsideChosenRange, verseRangeLabel } from "@/lib/bible-navigation";
import { BookOpen, ChevronLeft, ChevronRight, EyeOff, Eye, Loader2, Square } from "lucide-react";

const NAVY = "#1e3a8a";
const GOLD = "#f59e0b";

export interface BibleMediaState {
  bibleId: string | null;
  bibleVersion: string | null;
  bibleChapterId: string | null;
  bibleVerseStart: number | null;
  bibleVerseEnd: number | null;
  bibleVerse: number | null;
  bibleBlanked: boolean;
}

interface BibleVersion { id: string; abbreviation: string; name: string }
interface BibleBook { id: string; name: string; chapters: Array<{ id: string; number: number }> }
interface BibleChapter {
  id: string;
  reference: string;
  version: string;
  verses: Array<{ number: number; text: string }>;
  copyright: string;
  fumsToken: string | null;
}

const selectClass =
  "w-full min-w-0 rounded-xl px-3 py-2.5 text-sm border border-gray-200 bg-white focus:outline-none focus:border-blue-500 disabled:opacity-50";

function useChapter(bibleId: string | null, chapterId: string | null) {
  return useQuery({
    queryKey: ["bible-chapter", bibleId, chapterId],
    queryFn: () => apiGet<BibleChapter>(`/bible/${bibleId}/chapters/${chapterId}`),
    enabled: Boolean(bibleId && chapterId),
    staleTime: 60 * 60 * 1000,
  });
}

/** Remote control for the passage currently on the TV: Previous / Next / Blank / Stop. */
export function BibleRemote({
  classId,
  current,
  onStop,
  stopping,
}: {
  classId: number;
  current: BibleMediaState;
  onStop: () => void;
  stopping: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const chapter = useChapter(current.bibleId, current.bibleChapterId);
  const verse = current.bibleVerse ?? current.bibleVerseStart ?? 1;
  const verseNumbers = useMemo(() => chapter.data?.verses.map(v => v.number) ?? [], [chapter.data]);
  const verseText = chapter.data?.verses.find(v => v.number === verse)?.text;

  // The preview on this phone is also a display of Scripture (Fair Use report).
  useEffect(() => {
    if (verseText) reportBibleView(chapter.data?.fumsToken);
  }, [verseText, chapter.data?.fumsToken]);

  const control = useMutation({
    mutationFn: (patch: { verse?: number; blanked?: boolean }) =>
      apiPut<{ success: true; verse: number; blanked: boolean }>(`/pickup-requests/display-media/${classId}/bible`, {
        bibleId: current.bibleId,
        chapterId: current.bibleChapterId,
        ...patch,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData<{ media: (BibleMediaState & Record<string, unknown>) | null }>(
        ["display-media", classId],
        old => (old?.media ? { media: { ...old.media, bibleVerse: result.verse, bibleBlanked: result.blanked } } : old),
      );
    },
    onError: (e: Error) => {
      void queryClient.invalidateQueries({ queryKey: ["display-media", classId] });
      toast({ variant: "destructive", title: "Could not update the TV", description: e.message });
    },
  });

  const prev = adjacentVerse(verseNumbers, verse, -1);
  const next = adjacentVerse(verseNumbers, verse, 1);
  const busy = control.isPending || stopping;
  const reference = chapter.data ? `${chapter.data.reference}:${verse}` : `Verse ${verse}`;
  const outside = isOutsideChosenRange(verse, current.bibleVerseStart, current.bibleVerseEnd);

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: `${GOLD}66`, background: `${GOLD}0d` }} data-testid="bible-remote">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <BookOpen className="w-4 h-4" style={{ color: NAVY }} /> {reference} · {current.bibleVersion}
        </p>
        <p className="text-xs font-semibold tabular-nums" style={{ color: current.bibleBlanked ? "#dc2626" : "#059669" }}>
          {current.bibleBlanked ? "TV blanked" : "On the TV"}
        </p>
      </div>
      {chapter.isLoading ? (
        <p className="text-xs text-gray-400 flex items-center gap-1.5 mb-3"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading verse…</p>
      ) : chapter.isError ? (
        <p className="text-xs text-red-500 mb-3">{(chapter.error as Error).message}</p>
      ) : verseText ? (
        <p className="text-sm text-gray-700 leading-relaxed mb-1 line-clamp-4" style={{ fontFamily: "Georgia, serif" }}>
          “{verseText}” <span className="font-semibold text-gray-500">{current.bibleVersion}</span>
        </p>
      ) : null}
      {current.bibleVerseStart !== null && chapter.data && (
        <p className="text-[11px] text-gray-400 mb-3">
          Chosen: {verseRangeLabel(chapter.data.reference, current.bibleVerseStart, current.bibleVerseEnd)}
          {outside ? " · now outside the chosen verses" : ""}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => prev !== null && control.mutate({ verse: prev })}
          disabled={busy || prev === null}
          className="py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <button
          type="button"
          onClick={() => next !== null && control.mutate({ verse: next })}
          disabled={busy || next === null}
          className="py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-40"
          style={{ background: NAVY, color: "white" }}
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => control.mutate({ blanked: !current.bibleBlanked })}
          disabled={busy}
          className="py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40"
        >
          {current.bibleBlanked ? <><Eye className="w-4 h-4" /> Show verse</> : <><EyeOff className="w-4 h-4" /> Blank screen</>}
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={busy}
          className="py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 border border-red-200 text-red-600 bg-white hover:bg-red-50 active:scale-95 transition-all disabled:opacity-40"
        >
          {stopping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />} Stop
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mt-2">
        Blank turns the TV black but keeps your place. Stop takes the verse off the TV.
      </p>
      {chapter.data?.copyright && <p className="text-[10px] text-gray-400 mt-2 leading-snug">{chapter.data.copyright}</p>}
    </div>
  );
}

/** Choose version, book, chapter and verses, then put the first verse on the TV. */
export function BiblePicker({ classId, disabled }: { classId: number; disabled: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bibleId, setBibleId] = useState("");
  const [bookId, setBookId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(0);

  const versions = useQuery({
    queryKey: ["bible-versions"],
    queryFn: () => apiGet<{ configured: boolean; versions: BibleVersion[] }>("/bible/versions"),
    staleTime: 60 * 60 * 1000,
  });
  const versionList = versions.data?.versions ?? [];
  useEffect(() => {
    if (!bibleId && versionList.length) setBibleId(versionList[0].id);
  }, [bibleId, versionList]);

  const books = useQuery({
    queryKey: ["bible-books", bibleId],
    queryFn: () => apiGet<{ books: BibleBook[] }>(`/bible/${bibleId}/books`),
    enabled: Boolean(bibleId),
    staleTime: 60 * 60 * 1000,
  });
  const book = books.data?.books.find(b => b.id === bookId);
  const chapter = useChapter(bibleId || null, chapterId || null);
  const verseNumbers = chapter.data?.verses.map(v => v.number) ?? [];

  // Book and chapter IDs are shared across versions, so switching version keeps
  // the selection; picking a new book starts at its first chapter.
  useEffect(() => { setChapterId(book?.chapters[0]?.id ?? ""); }, [bookId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const first = chapter.data?.verses[0]?.number ?? 0;
    setFrom(first);
    setTo(first);
  }, [chapter.data]);

  const show = useMutation({
    mutationFn: () =>
      apiPut(`/pickup-requests/display-media/${classId}`, {
        kind: "bible",
        bibleId,
        chapterId,
        verseStart: from,
        verseEnd: Math.max(from, to),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["display-media", classId] });
      toast({ title: "Verse on the TV", description: "Use Previous and Next here to move through the passage." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not show the verse", description: e.message }),
  });

  const header = (
    <>
      <p className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
        <BookOpen className="w-4 h-4" style={{ color: NAVY }} /> Show a Bible passage
      </p>
      <p className="text-xs text-gray-400 mb-3">The TV shows one verse at a time in large type.</p>
    </>
  );

  if (versions.isLoading) {
    return (
      <div className="rounded-xl border border-gray-100 p-4">
        {header}
        <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading Bible versions…</p>
      </div>
    );
  }
  if (versions.isError || !versions.data?.configured || versionList.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 p-4">
        {header}
        <p className="text-xs text-gray-500">
          {versions.isError
            ? (versions.error as Error).message
            : "Bible projection isn't set up yet — an admin needs to add the API.Bible key."}
        </p>
      </div>
    );
  }

  const busy = disabled || show.isPending;
  return (
    <div className="rounded-xl border border-gray-100 p-4" data-testid="bible-picker">
      {header}
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Bible version" className={selectClass} value={bibleId} onChange={e => setBibleId(e.target.value)} disabled={busy}>
          {versionList.map(v => <option key={v.id} value={v.id}>{v.abbreviation}</option>)}
        </select>
        <select aria-label="Book" className={selectClass} value={bookId} onChange={e => setBookId(e.target.value)} disabled={busy || !books.data}>
          <option value="">{books.isLoading ? "Loading…" : "Book"}</option>
          {books.data?.books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select aria-label="Chapter" className={selectClass} value={chapterId} onChange={e => setChapterId(e.target.value)} disabled={busy || !book}>
          {!book && <option value="">Chapter</option>}
          {book?.chapters.map(c => <option key={c.id} value={c.id}>Chapter {c.number}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2 min-w-0">
          <select
            aria-label="From verse"
            className={selectClass}
            value={from || ""}
            onChange={e => { const v = Number(e.target.value); setFrom(v); if (to < v) setTo(v); }}
            disabled={busy || verseNumbers.length === 0}
          >
            {verseNumbers.length === 0 && <option value="">From</option>}
            {verseNumbers.map(n => <option key={n} value={n}>v{n}</option>)}
          </select>
          <select
            aria-label="To verse"
            className={selectClass}
            value={to || ""}
            onChange={e => setTo(Number(e.target.value))}
            disabled={busy || verseNumbers.length === 0}
          >
            {verseNumbers.length === 0 && <option value="">To</option>}
            {verseNumbers.filter(n => n >= from).map(n => <option key={n} value={n}>v{n}</option>)}
          </select>
        </div>
      </div>
      {chapter.isError && <p className="text-xs text-red-500 mt-2">{(chapter.error as Error).message}</p>}
      <button
        type="button"
        onClick={() => show.mutate()}
        disabled={busy || !chapterId || !from || chapter.isLoading}
        className="w-full mt-3 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
        style={{ background: GOLD, color: NAVY }}
      >
        {show.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
        {chapter.data && from ? `Show ${verseRangeLabel(chapter.data.reference, from, Math.max(from, to))} on TV` : "Show on TV"}
      </button>
      {chapter.data?.copyright && <p className="text-[10px] text-gray-400 mt-2 leading-snug">{chapter.data.copyright}</p>}
    </div>
  );
}
