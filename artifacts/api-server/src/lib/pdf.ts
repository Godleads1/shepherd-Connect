import PDFDocument from "pdfkit";
import type { Response } from "express";
import { SERVICE_TIME_ZONE, formatServiceDateTime } from "./serviceTime";

const BRAND_BLUE = "#1e3a8a";
const BRAND_GOLD = "#f59e0b";
const LIGHT_GRAY = "#f3f4f6";
const MID_GRAY = "#6b7280";
const DARK = "#111827";

export interface PdfColumn {
  label: string;
  width: number;
}

export interface PdfReport {
  title: string;
  subtitle: string;
  columns: PdfColumn[];
  rows: (string | null | undefined)[][];
  summaryStats?: { label: string; value: string }[];
}

export function streamPdf(res: Response, filename: string, build: (doc: PDFKit.PDFDocument) => void): void {
  const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);
  build(doc);
  doc.end();
}

export function renderReportPdf(doc: PDFKit.PDFDocument, report: PdfReport): void {
  const pageWidth = doc.page.width - 80; // margins 40 each side

  // ── Header band ──────────────────────────────────────────────────────────
  doc.rect(40, 40, pageWidth, 56).fill(BRAND_BLUE);

  doc.fillColor("white")
    .font("Helvetica-Bold").fontSize(16)
    .text(report.title, 52, 52, { width: pageWidth - 20 });

  doc.font("Helvetica").fontSize(9).fillColor("#bfdbfe")
    .text(report.subtitle, 52, 74, { width: pageWidth - 20 });

  // Gold accent bar
  doc.rect(40, 96, pageWidth, 2).fill(BRAND_GOLD);

  let y = 108;

  // ── Summary stats row ────────────────────────────────────────────────────
  if (report.summaryStats && report.summaryStats.length > 0) {
    const stats = report.summaryStats.slice(0, 5);
    const boxW = Math.floor(pageWidth / stats.length) - 4;
    stats.forEach((s, i) => {
      const x = 40 + i * (boxW + 4);
      doc.rect(x, y, boxW, 40).fillAndStroke(LIGHT_GRAY, "#e5e7eb");
      doc.fillColor(BRAND_BLUE).font("Helvetica-Bold").fontSize(13)
        .text(s.value, x + 4, y + 6, { width: boxW - 8, align: "center" });
      doc.fillColor(MID_GRAY).font("Helvetica").fontSize(7.5)
        .text(s.label, x + 4, y + 24, { width: boxW - 8, align: "center" });
    });
    y += 50;
  }

  // ── Table header ─────────────────────────────────────────────────────────
  doc.rect(40, y, pageWidth, 20).fill(BRAND_BLUE);
  let x = 40;
  report.columns.forEach(col => {
    doc.fillColor("white").font("Helvetica-Bold").fontSize(8)
      .text(col.label, x + 4, y + 6, { width: col.width - 8, ellipsis: true });
    x += col.width;
  });
  y += 20;

  // ── Table rows ───────────────────────────────────────────────────────────
  report.rows.forEach((row, ri) => {
    const rowH = 18;
    if (y + rowH > doc.page.height - 60) {
      doc.addPage();
      y = 50;
      // Repeat column headers on new page
      doc.rect(40, y, pageWidth, 18).fill(BRAND_BLUE);
      let hx = 40;
      report.columns.forEach(col => {
        doc.fillColor("white").font("Helvetica-Bold").fontSize(8)
          .text(col.label, hx + 4, y + 5, { width: col.width - 8, ellipsis: true });
        hx += col.width;
      });
      y += 18;
    }

    if (ri % 2 === 0) {
      doc.rect(40, y, pageWidth, rowH).fill(LIGHT_GRAY);
    }
    doc.strokeColor("#e5e7eb").lineWidth(0.3)
      .moveTo(40, y + rowH).lineTo(40 + pageWidth, y + rowH).stroke();

    let cx = 40;
    report.columns.forEach((col, ci) => {
      const cell = String(row[ci] ?? "");
      doc.fillColor(DARK).font("Helvetica").fontSize(8)
        .text(cell, cx + 4, y + 5, { width: col.width - 8, ellipsis: true, lineBreak: false });
      cx += col.width;
    });
    y += rowH;
  });

  // ── Footer ───────────────────────────────────────────────────────────────
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const footerY = doc.page.height - 36;
    doc.rect(40, footerY, pageWidth, 1).fill("#e5e7eb");
    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8)
      .text(
        `Generated ${formatServiceDateTime(new Date())} (${SERVICE_TIME_ZONE}) · Shepherd Connect — RCCG City of David · Page ${i + 1} of ${pages.count}`,
        40, footerY + 6, { width: pageWidth, align: "center" }
      );
  }
}
