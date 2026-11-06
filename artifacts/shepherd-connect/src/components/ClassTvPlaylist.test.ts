import { describe, expect, it } from "vitest";
import { describeItem } from "./ClassTvPlaylist";

const item = (overrides: Partial<Parameters<typeof describeItem>[0]>) => ({
  kind: "file" as const,
  contentType: null,
  fileName: null,
  pdfPageCount: null,
  ...overrides,
});

describe("TV list item descriptions", () => {
  it("names each kind of item in plain language", () => {
    expect(describeItem(item({ kind: "youtube" })).type).toBe("YouTube video");
    expect(describeItem(item({ kind: "bible" })).type).toBe("Bible passage");
    expect(describeItem(item({ contentType: "video/mp4", fileName: "song.mp4" })).type).toBe("Video");
    expect(describeItem(item({ contentType: "image/png", fileName: "poster.png" })).type).toBe("Image");
  });

  it("calls converted PowerPoints slides and other PDFs documents, with page counts when known", () => {
    expect(describeItem(item({ contentType: "application/pdf", fileName: "Lesson.pptx", pdfPageCount: 12 })).type)
      .toBe("Slides · 12 pages");
    expect(describeItem(item({ contentType: "application/pdf", fileName: "Handout.pdf", pdfPageCount: 3 })).type)
      .toBe("Document · 3 pages");
    expect(describeItem(item({ contentType: "application/pdf", fileName: "Handout.pdf" })).type).toBe("Document");
  });
});
