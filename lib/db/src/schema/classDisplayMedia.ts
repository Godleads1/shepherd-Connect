import { pgTable, serial, integer, text, timestamp, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { classesTable } from "./classes";
import { usersTable } from "./users";

/**
 * Media shown on a classroom TV display, set remotely from a teacher's or
 * admin's own device (phone/laptop) instead of being typed on the TV.
 * One row per class — the latest selection always wins.
 */
export const classDisplayMediaTable = pgTable("class_display_media", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull().references(() => classesTable.id, { onDelete: "cascade" }),
  /** "youtube" | "file" | "bible" */
  kind: text("kind").notNull(),
  youtubeVideoId: text("youtube_video_id"),
  /** Private object path ("/objects/…") for an uploaded video/image. */
  objectPath: text("object_path"),
  contentType: text("content_type"),
  fileName: text("file_name"),
  /** For PDFs: current page a phone "clicker" pinned; null = auto-play pages. */
  pdfPage: integer("pdf_page"),
  /** For PDFs: total pages, counted on the uploader's device (best effort). */
  pdfPageCount: integer("pdf_page_count"),
  /** kind "bible": API.Bible version id, e.g. "de4e12af7f28f599-02". */
  bibleId: text("bible_id"),
  /** kind "bible": version abbreviation shown with the text, e.g. "NKJV". */
  bibleVersion: text("bible_version"),
  /** kind "bible": API.Bible chapter id, e.g. "JHN.3". */
  bibleChapterId: text("bible_chapter_id"),
  /** kind "bible": the range the teacher chose (navigation may go beyond it within the chapter). */
  bibleVerseStart: integer("bible_verse_start"),
  bibleVerseEnd: integer("bible_verse_end"),
  /** kind "bible": the verse currently on the TV. */
  bibleVerse: integer("bible_verse"),
  /** kind "bible": TV shows a black screen but keeps the passage. */
  bibleBlanked: boolean("bible_blanked").notNull().default(false),
  updatedBy: integer("updated_by").notNull().references(() => usersTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uq_class_display_media_class").on(t.classId),
]);

export const insertClassDisplayMediaSchema = createInsertSchema(classDisplayMediaTable).omit({
  id: true,
  updatedAt: true,
});

export type InsertClassDisplayMedia = z.infer<typeof insertClassDisplayMediaSchema>;
export type ClassDisplayMedia = typeof classDisplayMediaTable.$inferSelect;
