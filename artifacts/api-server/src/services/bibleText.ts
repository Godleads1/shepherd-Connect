/**
 * Licensed Bible text for classroom TV projection, via API.Bible
 * (American Bible Society). The API key never leaves the server.
 *
 * Licence rules this module is built around (API.Bible Starter plan,
 * non-commercial):
 *  - Scripture text is shown unaltered, with the version abbreviation and the
 *    publisher's copyright line next to it.
 *  - Cached text must be refreshed at least every 30 days — we cache for 24h.
 *  - Every display of the text is reported to FUMS with the response's
 *    `fumsToken` (done by the browser that shows it — see bible-fums.ts).
 *
 * This module never touches the database, so importing it from app.ts is safe
 * under the smoke test's mocked `@workspace/db`.
 */

const API_BASE = "https://rest.api.bible/v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 400;
const REQUEST_TIMEOUT_MS = 8_000;

export const BIBLE_ID_RE = /^[A-Za-z0-9-]{4,64}$/;
/** e.g. "JHN.3", "1CO.13" — book intros ("GEN.intro") are not projectable. */
export const CHAPTER_ID_RE = /^[1-4A-Z]{3}\.\d{1,3}$/;

/** Versions shown to teachers, in this order, when the API key has them. */
const DEFAULT_PREFERRED_VERSIONS = ["NIV", "NKJV", "NLT", "AMP", "KJV"];

export class BibleServiceError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface BibleVersion {
  id: string;
  abbreviation: string;
  name: string;
}

export interface BibleBook {
  id: string;
  name: string;
  chapters: Array<{ id: string; number: number }>;
}

export interface BibleChapter {
  id: string;
  bibleId: string;
  /** e.g. "John 3" */
  reference: string;
  verses: Array<{ number: number; text: string }>;
  copyright: string;
  fumsToken: string | null;
}

/** Test seam: replaced by unit/database tests so no real API calls are made. */
export const bibleDependencies = {
  fetch: (url: string, init: RequestInit): Promise<Response> => fetch(url, init),
  apiKey: (): string | undefined => process.env.API_BIBLE_KEY?.trim() || undefined,
};

export function isBibleConfigured(): boolean {
  return Boolean(bibleDependencies.apiKey());
}

// ── Cache (in-memory, 24h, bounded) ──────────────────────────────────────────
const cache = new Map<string, { expires: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export function clearBibleCache() {
  cache.clear();
  inflight.clear();
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  if (hit) cache.delete(key);
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const promise = load().then(value => {
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
    return value;
  }).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

async function apiGet(path: string): Promise<any> {
  const key = bibleDependencies.apiKey();
  if (!key) throw new BibleServiceError(503, "Bible projection isn't set up yet — an admin needs to add the API.Bible key.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await bibleDependencies.fetch(`${API_BASE}${path}`, {
      headers: { "api-key": key, accept: "application/json" },
      signal: controller.signal,
    });
  } catch {
    throw new BibleServiceError(502, "Couldn't reach the Bible service. Check the internet connection and try again.");
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 401 || response.status === 403) {
    throw new BibleServiceError(503, "The Bible service rejected the request — the API key may be wrong, or this version isn't on the church's plan.");
  }
  if (response.status === 404 || response.status === 400) {
    throw new BibleServiceError(404, "That Bible passage wasn't found.");
  }
  if (!response.ok) {
    throw new BibleServiceError(502, "The Bible service is having trouble right now. Please try again shortly.");
  }
  try {
    return await response.json();
  } catch {
    throw new BibleServiceError(502, "The Bible service sent an unreadable response.");
  }
}

function preferredVersions(): string[] {
  const configured = process.env.BIBLE_VERSIONS?.split(",").map(v => v.trim().toUpperCase()).filter(Boolean);
  return configured?.length ? configured : DEFAULT_PREFERRED_VERSIONS;
}

/** "engKJV" → "KJV", "NIV11" → "NIV", "N.K.J.V." → "NKJV" */
export function normaliseAbbreviation(raw: string): string {
  return raw.replace(/^eng/i, "").replace(/[^A-Za-z0-9]/g, "").replace(/\d+$/, "").toUpperCase();
}

const stripTags = (value: unknown) =>
  typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";

// ── Public API ────────────────────────────────────────────────────────────────

/** The preferred versions this API key can actually use (falls back to every English Bible). */
export function listBibleVersions(): Promise<BibleVersion[]> {
  return cached("versions", async () => {
    const body = await apiGet("/bibles?language=eng");
    const all: BibleVersion[] = (Array.isArray(body?.data) ? body.data : [])
      .filter((b: any) => typeof b?.id === "string" && BIBLE_ID_RE.test(b.id))
      .map((b: any) => ({
        id: b.id,
        abbreviation: String(b.abbreviationLocal || b.abbreviation || "").trim() || b.id,
        name: String(b.nameLocal || b.name || "").trim() || b.id,
      }));
    const preferred = preferredVersions();
    const picked = new Map<string, BibleVersion>();
    for (const version of all) {
      const abbr = normaliseAbbreviation(version.abbreviation);
      if (preferred.includes(abbr) && !picked.has(abbr)) picked.set(abbr, { ...version, abbreviation: abbr });
    }
    if (picked.size === 0) return all;
    return preferred.flatMap(abbr => (picked.has(abbr) ? [picked.get(abbr)!] : []));
  });
}

export async function getBibleVersion(bibleId: string): Promise<BibleVersion | null> {
  if (!BIBLE_ID_RE.test(bibleId)) return null;
  return (await listBibleVersions()).find(v => v.id === bibleId) ?? null;
}

export function listBibleBooks(bibleId: string): Promise<BibleBook[]> {
  return cached(`books:${bibleId}`, async () => {
    const body = await apiGet(`/bibles/${encodeURIComponent(bibleId)}/books?include-chapters=true`);
    return (Array.isArray(body?.data) ? body.data : []).map((book: any) => ({
      id: String(book.id),
      name: String(book.name || book.nameLong || book.id),
      chapters: (Array.isArray(book.chapters) ? book.chapters : [])
        .filter((c: any) => typeof c?.id === "string" && CHAPTER_ID_RE.test(c.id))
        .map((c: any) => ({ id: c.id, number: Number(c.number) }))
        .filter((c: { number: number }) => Number.isInteger(c.number) && c.number > 0),
    })).filter((book: BibleBook) => book.chapters.length > 0);
  });
}

/**
 * Splits API.Bible's JSON chapter content into individual verses. Text nodes
 * carry `attrs.verseId` ("JHN.3.16"); verse-number markers are skipped so the
 * TV shows only Scripture text. If a text node lacks a verseId, it belongs to
 * the most recent verse marker.
 */
export function parseChapterVerses(content: unknown): Array<{ number: number; text: string }> {
  const parts = new Map<number, string[]>();
  let current: number | null = null;
  const verseNumber = (value: unknown): number | null => {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const match = String(value).match(/(\d+)(?:-[A-Z0-9.]*)?$/);
    const n = match ? Number(match[1]) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  const walk = (node: any) => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== "object") return;
    if (node.type === "tag" && node.name === "verse") {
      const n = verseNumber(node.attrs?.number);
      if (n) current = n;
      return; // the marker's own text is just the number
    }
    if (node.type === "tag" && node.name === "note") return;
    if (node.type === "text" && typeof node.text === "string") {
      const fromId = typeof node.attrs?.verseId === "string"
        ? verseNumber(node.attrs.verseId.split("-")[0])
        : null;
      const n = fromId ?? current;
      if (n) {
        if (!parts.has(n)) parts.set(n, []);
        parts.get(n)!.push(node.text);
      }
      return;
    }
    if (Array.isArray(node.items)) walk(node.items);
  };
  walk(content);
  return [...parts.entries()]
    .sort((a, b) => a[0] - b[0])
    // A leading "¶" is the KJV's printed paragraph mark, not part of the verse.
    .map(([number, texts]) => ({ number, text: texts.join("").replace(/\s+/g, " ").trim().replace(/^¶\s*/, "") }))
    .filter(verse => verse.text.length > 0);
}

export function getBibleChapter(bibleId: string, chapterId: string): Promise<BibleChapter> {
  if (!BIBLE_ID_RE.test(bibleId) || !CHAPTER_ID_RE.test(chapterId)) {
    return Promise.reject(new BibleServiceError(400, "Invalid Bible chapter"));
  }
  return cached(`chapter:${bibleId}:${chapterId}`, async () => {
    const params = new URLSearchParams({
      "content-type": "json",
      "include-notes": "false",
      "include-titles": "false",
      "include-chapter-numbers": "false",
      "include-verse-numbers": "true",
      "include-verse-spans": "false",
    });
    const body = await apiGet(
      `/bibles/${encodeURIComponent(bibleId)}/chapters/${encodeURIComponent(chapterId)}?${params}`,
    );
    const data = body?.data ?? {};
    const verses = parseChapterVerses(data.content);
    if (verses.length === 0) throw new BibleServiceError(404, "That chapter has no verses in this version.");
    return {
      id: chapterId,
      bibleId,
      reference: stripTags(data.reference) || chapterId,
      verses,
      copyright: stripTags(data.copyright),
      fumsToken: typeof body?.meta?.fumsToken === "string" ? body.meta.fumsToken : null,
    };
  });
}
