import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { PDFDocument } from "pdf-lib";

/** Content types we accept as PowerPoint uploads. Some phones (notably older
 *  Android browsers) report a generic type, so callers may also match on the
 *  file extension. */
export const POWERPOINT_CONTENT_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.ms-powerpoint", // .ppt
]);

export function looksLikePowerPoint(contentType: string, fileName: string | undefined): boolean {
  if (POWERPOINT_CONTENT_TYPES.has(contentType)) return true;
  const generic = !contentType || contentType === "application/octet-stream";
  return generic && /\.pptx?$/i.test(fileName ?? "");
}

/** Max PowerPoint size we'll convert (bytes) — protects server memory since the
 *  deck is downloaded and converted in one go. */
export const MAX_PPTX_BYTES = 50 * 1024 * 1024;

const CONVERT_TIMEOUT_MS = 120_000;

/** LibreOffice is CPU/RAM hungry — cap simultaneous conversions so a burst of
 *  uploads can't starve the API server during a live service. */
const MAX_CONCURRENT_CONVERSIONS = 2;
let conversionsInFlight = 0;

/** Decks that convert to absurd page counts are almost certainly not slides. */
const MAX_CONVERTED_PAGES = 2000;

export class PptxConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PptxConversionError";
  }
}

export class PptxBusyError extends Error {
  constructor() {
    super("Too many PowerPoint conversions are running right now");
    this.name = "PptxBusyError";
  }
}

/** Cheap signature check before handing bytes to LibreOffice: .pptx is a ZIP
 *  ("PK…"), legacy .ppt is an OLE compound file. Anything else is garbage. */
function hasPowerPointSignature(bytes: Buffer): boolean {
  if (bytes.length < 8) return false;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return true; // ZIP (pptx)
  return (
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1
  ); // OLE (ppt)
}

/**
 * Converts PowerPoint bytes to PDF using headless LibreOffice.
 *
 * Each run gets its own temp dir AND its own LibreOffice user profile —
 * concurrent soffice processes sharing a profile fail with a lock error, and
 * two teachers can easily upload decks at the same time on a Sunday morning.
 */
export async function convertPptxToPdf(pptxBytes: Buffer): Promise<{ pdf: Buffer; pageCount: number }> {
  if (!hasPowerPointSignature(pptxBytes)) {
    throw new PptxConversionError("The file does not look like a PowerPoint presentation");
  }
  if (conversionsInFlight >= MAX_CONCURRENT_CONVERSIONS) {
    throw new PptxBusyError();
  }
  conversionsInFlight++;
  const workDir = await mkdtemp(join(tmpdir(), "pptx-convert-"));
  try {
    const inputPath = join(workDir, "input.pptx");
    await writeFile(inputPath, pptxBytes);

    await new Promise<void>((resolve, reject) => {
      execFile(
        "soffice",
        [
          "--headless",
          `-env:UserInstallation=file://${workDir}/lo-profile`,
          "--convert-to",
          "pdf",
          "--outdir",
          workDir,
          inputPath,
        ],
        { timeout: CONVERT_TIMEOUT_MS },
        (error, _stdout, stderr) => {
          if (error) {
            reject(new PptxConversionError(
              error.killed
                ? "Converting the PowerPoint took too long"
                : `LibreOffice conversion failed: ${stderr?.slice(0, 500) || error.message}`,
            ));
          } else {
            resolve();
          }
        },
      );
    });

    let pdf: Buffer;
    try {
      pdf = await readFile(join(workDir, "input.pdf"));
    } catch {
      // soffice sometimes exits 0 without producing output (e.g. corrupt file)
      throw new PptxConversionError("LibreOffice did not produce a PDF — the file may be corrupt");
    }

    const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
    const pageCount = doc.getPageCount();
    if (pageCount < 1) {
      throw new PptxConversionError("The converted PDF has no pages");
    }
    if (pageCount > MAX_CONVERTED_PAGES) {
      throw new PptxConversionError("The presentation has too many slides to show on the TV");
    }
    return { pdf, pageCount };
  } finally {
    conversionsInFlight--;
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
