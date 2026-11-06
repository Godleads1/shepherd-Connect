import { pgTable, serial, integer, text, timestamp, date, index } from "drizzle-orm/pg-core";
import { classesTable } from "./classes";
import { usersTable } from "./users";

/**
 * A class's list of TV items for one service day. Teachers add YouTube links,
 * uploaded files and Bible passages here, then press Play on any of them to
 * copy it into class_display_media (what the TV is showing now). Items from
 * earlier service days are treated as gone and are purged lazily.
 */
export const classDisplayPlaylistItemsTable = pgTable("class_display_playlist_items", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull().references(() => classesTable.id, { onDelete: "cascade" }),
  serviceDate: date("service_date", { mode: "string" }).notNull(),
  position: integer("position").notNull(),
  /** "youtube" | "file" | "bible" — same meaning as class_display_media.kind. */
  kind: text("kind").notNull(),
  /** Teacher-facing name, e.g. a file name or "John 3:16–18 (NKJV)". */
  label: text("label").notNull(),
  youtubeVideoId: text("youtube_video_id"),
  objectPath: text("object_path"),
  contentType: text("content_type"),
  fileName: text("file_name"),
  pdfPageCount: integer("pdf_page_count"),
  bibleId: text("bible_id"),
  bibleVersion: text("bible_version"),
  bibleChapterId: text("bible_chapter_id"),
  bibleVerseStart: integer("bible_verse_start"),
  bibleVerseEnd: integer("bible_verse_end"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_class_display_playlist_class_date").on(t.classId, t.serviceDate, t.position),
]);

export type ClassDisplayPlaylistItem = typeof classDisplayPlaylistItemsTable.$inferSelect;
