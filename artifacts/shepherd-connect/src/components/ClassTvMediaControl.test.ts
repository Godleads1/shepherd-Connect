import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./ClassTvMediaControl.tsx", import.meta.url), "utf8");

describe("TV media dialog layout safeguards", () => {
  it("bounds the dialog and lets its grid shrink below a long filename's intrinsic width", () => {
    expect(source).toContain("w-[calc(100%-2rem)]");
    expect(source).toContain("grid-cols-[minmax(0,1fr)]");
    expect(source).toContain("max-h-[calc(100dvh-2rem)] overflow-y-auto");
    expect(source).toContain("flex flex-1 items-center gap-2.5 min-w-0");
    expect(source).toContain('truncate" title={current.fileName || undefined}');
  });

  it("offers an explicit cancel action without bypassing the existing busy guard", () => {
    expect(source).toMatch(/onClick=\{\(\) => setOpen\(false\)\}\s+disabled=\{busy\}[\s\S]*?>\s+Cancel\s+<\/button>/);
  });
});