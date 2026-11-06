import { vi } from "vitest";
import { bibleDependencies, clearBibleCache } from "../../services/bibleText";

export const KJV_ID = "aaaa1111-01";
export const NKJV_ID = "bbbb2222-01";

export const versionsBody = {
  data: [
    { id: KJV_ID, abbreviation: "engKJV", abbreviationLocal: "KJV", name: "King James (Authorised) Version" },
    { id: NKJV_ID, abbreviation: "NKJV", abbreviationLocal: "NKJV", name: "New King James Version" },
    { id: "cccc3333-01", abbreviation: "WEB", abbreviationLocal: "WEB", name: "World English Bible" },
  ],
};

export const booksBody = {
  data: [
    {
      id: "JHN",
      name: "John",
      chapters: [
        { id: "JHN.intro", number: "intro" },
        { id: "JHN.3", number: "3" },
      ],
    },
  ],
};

const verseMarker = (n: number) => ({
  name: "verse", type: "tag", attrs: { number: String(n), style: "v", sid: `JHN 3:${n}` },
  items: [{ text: String(n), type: "text" }],
});
const verseText = (n: number, text: string) => ({
  text, type: "text", attrs: { verseId: `JHN.3.${n}`, verseOrgIds: [`JHN.3.${n}`] },
});

export const chapterBody = {
  data: {
    id: "JHN.3",
    reference: "John 3",
    copyright: "Scripture taken from the Test Version. Used by permission.",
    content: [
      {
        name: "para", type: "tag", attrs: { style: "p" }, items: [
          verseMarker(1), verseText(1, "First verse text. "),
          { name: "char", type: "tag", attrs: { style: "wj" }, items: [verseText(1, "Words in red.")] },
          verseMarker(2), verseText(2, "Second verse."),
        ],
      },
      { name: "para", type: "tag", attrs: { style: "p" }, items: [verseMarker(3), verseText(3, "Third verse.")] },
    ],
  },
  meta: { fumsToken: "fums-token-jhn3" },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Routes API.Bible requests to the fixtures above; returns the fetch spy. */
export function mockBibleApi() {
  clearBibleCache();
  const spy = vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/bibles")) return json(versionsBody);
    if (/\/books$/.test(path)) return json(booksBody);
    if (path.endsWith("/chapters/JHN.3")) return json(chapterBody);
    return json({ message: "Not found" }, 404);
  });
  bibleDependencies.fetch = spy as any;
  bibleDependencies.apiKey = () => "test-api-bible-key";
  return spy;
}

const originalFetch = bibleDependencies.fetch;
const originalKey = bibleDependencies.apiKey;
export function restoreBibleApi() {
  bibleDependencies.fetch = originalFetch;
  bibleDependencies.apiKey = originalKey;
  clearBibleCache();
}
