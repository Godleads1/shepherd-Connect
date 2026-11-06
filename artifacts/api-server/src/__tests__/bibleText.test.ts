import { afterEach, describe, expect, it } from "vitest";
import {
  BibleServiceError,
  bibleDependencies,
  clearBibleCache,
  getBibleChapter,
  isBibleConfigured,
  listBibleBooks,
  listBibleVersions,
  normaliseAbbreviation,
  parseChapterVerses,
} from "../services/bibleText";
import { chapterBody, KJV_ID, mockBibleApi, NKJV_ID, restoreBibleApi } from "./fixtures/bibleApi";

afterEach(() => {
  restoreBibleApi();
  delete process.env.BIBLE_VERSIONS;
});

describe("API.Bible text service", () => {
  it("splits chapter JSON into verses, skipping verse-number markers", () => {
    expect(parseChapterVerses(chapterBody.data.content)).toEqual([
      { number: 1, text: "First verse text. Words in red." },
      { number: 2, text: "Second verse." },
      { number: 3, text: "Third verse." },
    ]);
  });

  it("falls back to the latest verse marker when text has no verseId", () => {
    const content = [{
      type: "tag", name: "para", items: [
        { type: "tag", name: "verse", attrs: { number: "4-5" }, items: [{ type: "text", text: "4-5" }] },
        { type: "text", text: "Bridged verse." },
      ],
    }];
    expect(parseChapterVerses(content)).toEqual([{ number: 4, text: "Bridged verse." }]);
  });

  it("drops the KJV's leading paragraph mark", () => {
    const content = [{ type: "text", text: "¶ For God so loved the world.", attrs: { verseId: "JHN.3.16" } }];
    expect(parseChapterVerses(content)).toEqual([{ number: 16, text: "For God so loved the world." }]);
  });

  it("normalises version abbreviations", () => {
    expect(normaliseAbbreviation("engKJV")).toBe("KJV");
    expect(normaliseAbbreviation("NIV11")).toBe("NIV");
    expect(normaliseAbbreviation("N.K.J.V.")).toBe("NKJV");
  });

  it("lists only preferred versions, in preferred order", async () => {
    mockBibleApi();
    expect(await listBibleVersions()).toEqual([
      { id: NKJV_ID, abbreviation: "NKJV", name: "New King James Version" },
      { id: KJV_ID, abbreviation: "KJV", name: "King James (Authorised) Version" },
    ]);
  });

  it("falls back to all English versions when none of the preferred ones are on the key", async () => {
    mockBibleApi();
    process.env.BIBLE_VERSIONS = "ESV";
    expect((await listBibleVersions()).map(v => v.abbreviation)).toEqual(["KJV", "NKJV", "WEB"]);
  });

  it("excludes book introductions from chapter lists", async () => {
    mockBibleApi();
    expect(await listBibleBooks(KJV_ID)).toEqual([{ id: "JHN", name: "John", chapters: [{ id: "JHN.3", number: 3 }] }]);
  });

  it("caches chapters and keeps the copyright line and FUMS token", async () => {
    const spy = mockBibleApi();
    const first = await getBibleChapter(KJV_ID, "JHN.3");
    const second = await getBibleChapter(KJV_ID, "JHN.3");
    expect(second).toBe(first);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({
      reference: "John 3",
      copyright: "Scripture taken from the Test Version. Used by permission.",
      fumsToken: "fums-token-jhn3",
    });
    const url = new URL(spy.mock.calls[0][0] as string);
    expect(url.searchParams.get("content-type")).toBe("json");
    expect(url.searchParams.get("include-notes")).toBe("false");
  });

  it("sends the key only to API.Bible, as a header", async () => {
    const spy = mockBibleApi();
    await listBibleVersions();
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).host).toBe("rest.api.bible");
    expect(url).not.toContain("test-api-bible-key");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("test-api-bible-key");
  });

  it("rejects malformed ids without calling the API", async () => {
    const spy = mockBibleApi();
    await expect(getBibleChapter("../etc", "JHN.3")).rejects.toMatchObject({ statusCode: 400 });
    await expect(getBibleChapter(KJV_ID, "JHN.intro")).rejects.toMatchObject({ statusCode: 400 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("reports a missing key as not configured", async () => {
    clearBibleCache();
    bibleDependencies.apiKey = () => undefined;
    expect(isBibleConfigured()).toBe(false);
    await expect(listBibleVersions()).rejects.toMatchObject({ statusCode: 503 });
  });

  it("maps API failures to clear errors and does not cache them", async () => {
    mockBibleApi();
    bibleDependencies.fetch = (async () => new Response("{}", { status: 401 })) as any;
    await expect(listBibleVersions()).rejects.toBeInstanceOf(BibleServiceError);
    await expect(listBibleVersions()).rejects.toMatchObject({ statusCode: 503 });
    bibleDependencies.fetch = (async () => { throw new Error("offline"); }) as any;
    await expect(listBibleVersions()).rejects.toMatchObject({ statusCode: 502 });
    mockBibleApi();
    expect(await listBibleVersions()).toHaveLength(2);
  });
});
