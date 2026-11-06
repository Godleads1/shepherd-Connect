import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import app from "../app";
import { generateToken } from "../middlewares/auth";
import { getClientDisplayMedia } from "../routes/pickupRequests";
import { bibleDependencies, clearBibleCache } from "../services/bibleText";
import { KJV_ID, mockBibleApi, restoreBibleApi } from "./fixtures/bibleApi";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `bible-tv-${Date.now()}`;
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

databaseDescribe("classroom TV Bible projection", () => {
  let adminId = 0;
  let teacherUserId = 0;
  let otherTeacherUserId = 0;
  let parentId = 0;
  let teacherId = 0;
  let otherTeacherId = 0;
  let classId = 0;

  const token = (id: number, role: string) => `Bearer ${generateToken({
    userId: id, email: `${prefix}-${id}@test`, role: role as any, firstName: "Bible", lastName: "Test",
  })}`;
  const showJohn3 = (auth: string, body: Record<string, unknown> = {}) =>
    request(app).put(`/api/pickup-requests/display-media/${classId}`).set("Authorization", auth)
      .send({ kind: "bible", bibleId: KJV_ID, chapterId: "JHN.3", verseStart: 1, verseEnd: 2, ...body });
  const control = (auth: string, body: Record<string, unknown>) =>
    request(app).put(`/api/pickup-requests/display-media/${classId}/bible`).set("Authorization", auth)
      .send({ bibleId: KJV_ID, chapterId: "JHN.3", ...body });
  const row = async () => (await db.execute(sql`
    SELECT kind,bible_id,bible_version,bible_chapter_id,bible_verse_start,bible_verse_end,bible_verse,bible_blanked,youtube_video_id
    FROM class_display_media WHERE class_id=${classId}
  `)).rows[0];

  beforeAll(async () => {
    const users = await db.execute(sql`
      INSERT INTO users (email,password_hash,first_name,last_name,role,status,is_active,phone)
      VALUES
        (${`${prefix}-admin@test`},'x','Bible','Admin','admin','active',true,'08011000001'),
        (${`${prefix}-teacher@test`},'x','Bible','Teacher','teacher','active',true,'08011000002'),
        (${`${prefix}-other@test`},'x','Other','Teacher','teacher','active',true,'08011000003'),
        (${`${prefix}-parent@test`},'x','Bible','Parent','parent','active',true,'08011000004')
      RETURNING id
    `);
    [adminId, teacherUserId, otherTeacherUserId, parentId] = users.rows.map(r => Number(r.id));
    classId = Number((await db.execute(sql`
      INSERT INTO classes (name,age_min,age_max,capacity,room_location,service_slot)
      VALUES (${prefix},1,12,30,'Room','7am') RETURNING id
    `)).rows[0].id);
    teacherId = Number((await db.execute(sql`INSERT INTO teachers (user_id) VALUES (${teacherUserId}) RETURNING id`)).rows[0].id);
    otherTeacherId = Number((await db.execute(sql`INSERT INTO teachers (user_id) VALUES (${otherTeacherUserId}) RETURNING id`)).rows[0].id);
    await db.execute(sql`
      INSERT INTO teacher_allocations (teacher_id,class_id,service_date,service_slot,status)
      VALUES (${teacherId},${classId},${today},'7am','scheduled')
    `);
  });

  beforeEach(async () => {
    mockBibleApi();
    await db.execute(sql`DELETE FROM class_display_media WHERE class_id=${classId}`);
  });

  afterAll(async () => {
    restoreBibleApi();
    const userIds = [adminId, teacherUserId, otherTeacherUserId, parentId];
    for (const query of [
      sql`DELETE FROM class_display_media WHERE class_id=${classId}`,
      sql`DELETE FROM teacher_allocations WHERE teacher_id IN (${teacherId},${otherTeacherId})`,
      sql`DELETE FROM teachers WHERE id IN (${teacherId},${otherTeacherId})`,
      sql`DELETE FROM classes WHERE id=${classId}`,
      sql`DELETE FROM sse_tickets WHERE user_id IN (${sql.join(userIds.map(id => sql`${id}`), sql`,`)})`,
      sql`DELETE FROM audit_logs WHERE user_id IN (${sql.join(userIds.map(id => sql`${id}`), sql`,`)})`,
      sql`DELETE FROM users WHERE id IN (${sql.join(userIds.map(id => sql`${id}`), sql`,`)})`,
    ]) await db.execute(query);
  });

  it("lets the class's teacher browse versions, books and chapters; parents cannot", async () => {
    const teacher = token(teacherUserId, "teacher");
    const versions = await request(app).get("/api/bible/versions").set("Authorization", teacher).expect(200);
    expect(versions.body).toEqual({
      configured: true,
      versions: [expect.objectContaining({ abbreviation: "NKJV" }), { id: KJV_ID, abbreviation: "KJV", name: "King James (Authorised) Version" }],
    });
    await request(app).get(`/api/bible/${KJV_ID}/books`).set("Authorization", teacher).expect(200);
    const chapter = await request(app).get(`/api/bible/${KJV_ID}/chapters/JHN.3`).set("Authorization", teacher).expect(200);
    expect(chapter.body).toMatchObject({ reference: "John 3", version: "KJV", verses: [{ number: 1 }, { number: 2 }, { number: 3 }] });
    await request(app).get("/api/bible/versions").set("Authorization", token(parentId, "parent")).expect(403);
    await request(app).get("/api/bible/versions").expect(401);
    // Versions outside the allow-list can't be browsed through the proxy.
    await request(app).get("/api/bible/cccc3333-01/books").set("Authorization", teacher).expect(404);
  });

  it("reports an unconfigured key without calling API.Bible", async () => {
    clearBibleCache();
    bibleDependencies.apiKey = () => undefined;
    await request(app).get("/api/bible/versions").set("Authorization", token(adminId, "admin"))
      .expect(200, { configured: false, versions: [] });
    await showJohn3(token(adminId, "admin")).expect(503);
    expect(await row()).toBeUndefined();
  });

  it("puts a passage on the TV, navigates past the chosen range, blanks and stops", async () => {
    const teacher = token(teacherUserId, "teacher");
    await showJohn3(teacher).expect(200, { success: true });
    expect(await row()).toMatchObject({
      kind: "bible", bible_id: KJV_ID, bible_version: "KJV", bible_chapter_id: "JHN.3",
      bible_verse_start: 1, bible_verse_end: 2, bible_verse: 1, bible_blanked: false,
    });
    expect(await getClientDisplayMedia(classId)).toEqual({
      kind: "bible", version: "KJV", reference: "John 3:1", text: "First verse text. Words in red.",
      verse: 1, verseCount: 3, blanked: false,
      copyright: "Scripture taken from the Test Version. Used by permission.", fumsToken: "fums-token-jhn3",
    });

    // Next past the chosen range (1–2) is allowed within the chapter.
    await control(teacher, { verse: 3 }).expect(200, { success: true, verse: 3, blanked: false });
    await control(teacher, { verse: 4 }).expect(400);
    await control(teacher, { blanked: true }).expect(200, { success: true, verse: 3, blanked: true });
    expect(await getClientDisplayMedia(classId)).toMatchObject({ reference: "John 3:3", blanked: true });
    const phoneView = await request(app).get(`/api/pickup-requests/display-media/${classId}`)
      .set("Authorization", teacher).expect(200);
    expect(phoneView.body.media).toMatchObject({ kind: "bible", bibleVerse: 3, bibleBlanked: true, bibleVerseEnd: 2 });

    await request(app).delete(`/api/pickup-requests/display-media/${classId}`).set("Authorization", teacher).expect(200);
    expect(await row()).toBeUndefined();
    await control(teacher, { verse: 2 }).expect(409);
  });

  it("clears Bible fields when other media replaces the passage, and refuses stale controls", async () => {
    const admin = token(adminId, "admin");
    await showJohn3(admin).expect(200);
    await control(admin, { blanked: true }).expect(200);
    await request(app).put(`/api/pickup-requests/display-media/${classId}`).set("Authorization", admin)
      .send({ kind: "youtube", youtubeVideoId: "abcdefghijk" }).expect(200);
    expect(await row()).toMatchObject({
      kind: "youtube", youtube_video_id: "abcdefghijk",
      bible_id: null, bible_chapter_id: null, bible_verse: null, bible_blanked: false,
    });
    await control(admin, { verse: 2 }).expect(409);
  });

  it("keeps class access rules: unassigned teachers and parents are refused", async () => {
    await showJohn3(token(otherTeacherUserId, "teacher")).expect(403);
    await showJohn3(token(parentId, "parent")).expect(403);
    await showJohn3(token(adminId, "admin")).expect(200);
    await control(token(otherTeacherUserId, "teacher"), { verse: 2 }).expect(403);
    expect(await row()).toMatchObject({ bible_verse: 1 });
  });

  it("validates the passage", async () => {
    const admin = token(adminId, "admin");
    await showJohn3(admin, { verseStart: 9, verseEnd: 9 }).expect(400);
    await showJohn3(admin, { verseStart: 2, verseEnd: 1 }).expect(400);
    await showJohn3(admin, { chapterId: "JHN.intro" }).expect(400);
    await showJohn3(admin, { bibleId: "cccc3333-01" }).expect(400);
    await showJohn3(admin, { verseEnd: 99 }).expect(200);
    expect(await row()).toMatchObject({ bible_verse_end: 3 });
    await control(admin, {}).expect(400);
    await control(admin, { blanked: "yes" }).expect(400);
  });

  it("degrades to an on-screen error instead of breaking the TV refresh when API.Bible is down", async () => {
    await showJohn3(token(adminId, "admin")).expect(200);
    clearBibleCache();
    bibleDependencies.fetch = (async () => { throw new Error("offline"); }) as any;
    const media = await getClientDisplayMedia(classId);
    expect(media).toMatchObject({ kind: "bible", text: null, version: "KJV", verse: 1, fumsToken: null });
    expect((media as { error?: string }).error).toMatch(/Couldn't reach the Bible service/);
  });
});
