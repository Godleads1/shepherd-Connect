import type { Logger } from "pino";
import type { JwtPayload } from "../middlewares/auth";
import { ObjectStorageService } from "../lib/objectStorage";
import { bindObjectToResource, registerPendingObject } from "../lib/privateObjectAccess";
import { convertPptxToPdf, looksLikePowerPoint, PptxBusyError, PptxConversionError, MAX_PPTX_BYTES } from "../lib/pptxToPdf";
import {
  BIBLE_ID_RE,
  CHAPTER_ID_RE,
  BibleServiceError,
  getBibleChapter,
  getBibleVersion,
} from "./bibleText";

/**
 * Validation shared by "set what the TV shows" and "add to the class's TV
 * list": both accept the same YouTube / uploaded file / Bible passage input
 * and store the same columns.
 */

export const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export const BIBLE_NO_FIELDS = {
  bibleId: null,
  bibleVersion: null,
  bibleChapterId: null,
  bibleVerseStart: null,
  bibleVerseEnd: null,
  bibleVerse: null,
  bibleBlanked: false,
};

export interface DisplayMediaInputBody {
  kind?: string;
  youtubeVideoId?: string;
  objectPath?: string;
  contentType?: string;
  fileName?: string;
  pdfPageCount?: number;
  bibleId?: string;
  chapterId?: string;
  verseStart?: number;
  verseEnd?: number;
}

export interface DisplayMediaValues {
  kind: string;
  youtubeVideoId: string | null;
  objectPath: string | null;
  contentType: string | null;
  fileName: string | null;
  pdfPage: number | null;
  pdfPageCount: number | null;
  bibleId: string | null;
  bibleVersion: string | null;
  bibleChapterId: string | null;
  bibleVerseStart: number | null;
  bibleVerseEnd: number | null;
  bibleVerse: number | null;
  bibleBlanked: boolean;
}

export type DisplayMediaInputResult =
  | {
      ok: true;
      values: DisplayMediaValues;
      /** Teacher-facing name for lists, e.g. "John 3:16–18 (NKJV)". */
      label: string;
      /** True when a PowerPoint was converted to PDF during this call. */
      converted: boolean;
    }
  | { ok: false; status: number; body: { error: string; message: string } };

const objectStorage = new ObjectStorageService();

const fail = (status: number, error: string, message: string): DisplayMediaInputResult =>
  ({ ok: false, status, body: { error, message } });

export function bibleRangeLabel(reference: string, start: number, end: number, version: string): string {
  return `${reference}:${start}${end > start ? `–${end}` : ""} (${version})`;
}

export async function resolveDisplayMediaInput({
  classId,
  user,
  body,
  log,
  beforeConversion,
}: {
  classId: number;
  user: Pick<JwtPayload, "userId" | "role">;
  body: DisplayMediaInputBody;
  log: Pick<Logger, "error">;
  /** Called just before a (slow) PowerPoint conversion starts. */
  beforeConversion?: () => Promise<void>;
}): Promise<DisplayMediaInputResult> {
  if (body.kind === "youtube") {
    if (typeof body.youtubeVideoId !== "string" || !YOUTUBE_ID_RE.test(body.youtubeVideoId)) {
      return fail(400, "Bad request", "A valid YouTube video ID is required");
    }
    return {
      ok: true,
      converted: false,
      label: "YouTube video",
      values: {
        kind: "youtube",
        youtubeVideoId: body.youtubeVideoId,
        objectPath: null,
        contentType: null,
        fileName: null,
        pdfPage: null,
        pdfPageCount: null,
        ...BIBLE_NO_FIELDS,
      },
    };
  }

  if (body.kind === "bible") {
    const bibleId = typeof body.bibleId === "string" ? body.bibleId : "";
    const chapterId = typeof body.chapterId === "string" ? body.chapterId : "";
    const verseStart = body.verseStart;
    const verseEnd = body.verseEnd ?? body.verseStart;
    if (
      !BIBLE_ID_RE.test(bibleId) || !CHAPTER_ID_RE.test(chapterId)
      || !Number.isInteger(verseStart) || !Number.isInteger(verseEnd)
      || verseStart! < 1 || verseEnd! < verseStart!
    ) {
      return fail(400, "Bad request", "Choose a Bible version, chapter and verse range");
    }
    let version;
    let chapter;
    try {
      version = await getBibleVersion(bibleId);
      if (!version) return fail(400, "Bad request", "That Bible version isn't available");
      chapter = await getBibleChapter(bibleId, chapterId);
    } catch (error) {
      if (error instanceof BibleServiceError) return fail(error.statusCode, "Bible service", error.message);
      throw error;
    }
    const numbers = new Set(chapter.verses.map(v => v.number));
    const lastVerse = chapter.verses[chapter.verses.length - 1].number;
    if (!numbers.has(verseStart!)) {
      return fail(400, "Bad request", `${chapter.reference} has no verse ${verseStart}`);
    }
    const end = Math.min(verseEnd!, lastVerse);
    return {
      ok: true,
      converted: false,
      label: bibleRangeLabel(chapter.reference, verseStart!, end, version.abbreviation),
      values: {
        kind: "bible",
        youtubeVideoId: null,
        objectPath: null,
        contentType: null,
        fileName: null,
        pdfPage: null,
        pdfPageCount: null,
        bibleId,
        bibleVersion: version.abbreviation,
        bibleChapterId: chapterId,
        bibleVerseStart: verseStart!,
        bibleVerseEnd: end,
        bibleVerse: verseStart!,
        bibleBlanked: false,
      },
    };
  }

  if (body.kind === "file") {
    let objectPath = body.objectPath;
    let contentType = body.contentType ?? "";
    const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : "media";
    if (typeof objectPath !== "string" || !objectPath.startsWith("/objects/")) {
      return fail(400, "Bad request", "A valid uploaded file is required");
    }
    let isPdf = contentType === "application/pdf";
    const isPpt = !isPdf && looksLikePowerPoint(contentType, fileName);
    if (!contentType.startsWith("video/") && !contentType.startsWith("image/") && !isPdf && !isPpt) {
      return fail(400, "Bad request", "Only video, image, PDF, or PowerPoint files can be shown on the TV");
    }
    const bound = await bindObjectToResource(objectPath, "class_display", classId, user);
    if (!bound) {
      return fail(400, "Bad request", "The uploaded file could not be verified. Please upload it again.");
    }
    let pageCount =
      isPdf && Number.isInteger(body.pdfPageCount) && body.pdfPageCount! >= 1 && body.pdfPageCount! <= 5000
        ? body.pdfPageCount!
        : null;

    if (isPpt) {
      // PowerPoint can't be rendered by the TV directly — convert it to PDF
      // here, store the PDF, and from this point on it behaves exactly like an
      // uploaded PDF (slideshow + phone clicker).
      try {
        await beforeConversion?.();
        const file = await objectStorage.getObjectEntityFile(objectPath);
        const [meta] = await file.getMetadata();
        if (Number(meta.size ?? 0) > MAX_PPTX_BYTES) {
          return fail(400, "Bad request", "That PowerPoint is too large (max 50 MB). Export it as PDF and upload that instead.");
        }
        const [pptxBytes] = await file.download();
        const { pdf, pageCount: convertedPages } = await convertPptxToPdf(pptxBytes);
        const pdfPath = await objectStorage.uploadObjectEntityFromBuffer(pdf, "application/pdf");
        // Register + bind the server-generated PDF the same way a normal
        // upload would be, so staff access checks keep working for it.
        await registerPendingObject(pdfPath, user.userId);
        if (!(await bindObjectToResource(pdfPath, "class_display", classId, user))) {
          throw new Error("Could not bind the converted PDF to the class display");
        }
        objectPath = pdfPath;
        contentType = "application/pdf";
        isPdf = true;
        pageCount = convertedPages;
      } catch (error) {
        if (error instanceof PptxBusyError) {
          return fail(503, "Busy", "Other slides are being prepared right now — please try again in a minute.");
        }
        log.error({ err: error, classId }, "PowerPoint → PDF conversion failed");
        return fail(
          error instanceof PptxConversionError ? 400 : 500,
          "Conversion failed",
          "We couldn't convert this PowerPoint. Try exporting it as PDF (File → Save As → PDF) and uploading that instead.",
        );
      }
    }

    return {
      ok: true,
      converted: isPpt,
      label: fileName,
      values: {
        kind: "file",
        youtubeVideoId: null,
        objectPath,
        contentType,
        fileName,
        pdfPage: null, // new PDFs start in auto-play; the phone clicker can pin a page
        pdfPageCount: pageCount,
        ...BIBLE_NO_FIELDS,
      },
    };
  }

  return fail(400, "Bad request", "kind must be 'youtube', 'file' or 'bible'");
}
