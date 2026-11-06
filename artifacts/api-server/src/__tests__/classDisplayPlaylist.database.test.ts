import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import app from "../app";
import { generateToken } from "../middlewares/auth";
import { registerPendingObject } from "../lib/privateObjectAccess";
import { classDisplayPlaylistDependencies, MAX_PLAYLIST_ITEMS } from "../routes/classDisplayPlaylist";
import { KJV_ID, mockBibleApi, restoreBibleApi } from "./fixtures/bibleApi";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `tv-list-${Date.now()}`;
const dateIn = (offsetDays: number) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(Date.now() + offsetDays * 86_400_000));
const today = dateIn(0);
const yesterday = dateIn(-1);

databaseDescribe("classroom TV list", () => {
  let adminId = 0;
  let teacherUserId = 0;
  let otherTeacherUserId = 0;
  let parentId = 0;
  let teacherId = 0;
  let otherTeacherId = 0;
  let classId = 0;
  let otherClassId = 0;
  const objectPaths: string[] = [];
  const originalTitleLookup = classDisplayPlaylistDependencies.fetchYouTubeTitle;

  const token = (id: number, role: string) => `Bearer ${generateToken({
    userId: id, email: `${prefix}-${id}@test`, role: role as any, firstName: "List", lastName: "Test",
  })}`;
  const base = (cid = classId) => `/api/pickup-requests/display-media/${cid}/playlist`;
  const add = (auth: string, body: Record<string, unknown>, cid = classId) =>
    request(app).post(base(cid)).set("Authorization", auth).send(body);
  const list = (auth: string, cid = classId) => request(app).get(base(cid)).set("Authorization", auth);
  const play = (auth: string, itemId: number, cid = classId) =>
    request(app).post(`${base(cid)}/${itemId}/play`).set("Authorization", auth);
  const move = (auth: string, itemId: number, direction: string) =>
    request(app).put(`${base()}/${itemId}/move`).set("Authorization", auth).send({ direction });
  const remove = (auth: string, itemId: number, cid = classId) =>
    request(app).delete(`${base(cid)}/${itemId}`).set("Authorization", auth);
  const tvRow = async () => (await db.execute(sql`
    SELECT kind,youtube_video_id,object_path,content_type,file_name,pdf_page,pdf_page_count,
           bible_id,bible_chapter_id,bible_verse_start,bible_verse_end,bible_verse,bible_blanked
    FROM class_display_media WHERE class_id=${classId}
  `)).rows[0];
  const uploadedVideo = async (userId: number) => {
    const objectPath = `/objects/uploads/${prefix}-${objectPaths.length}`;
    objectPaths.push(objectPath);
    await registerPendingObject(objectPath, userId);
    return { kind: "file", objectPath, contentType: "video/mp4", fileName: "Memory verse song.mp4" };
  };
  const insertRaw = (serviceDate: string, position: number, label: string, cid = classId) => db.execute(sql`
    INSERT INTO class_display_playlist_items (class_id,service_date,position,kind,label,youtube_video_id,created_by)
    VALUES (${cid},${serviceDate},${position},'youtube',${label},'abcdefghijk',${adminId}) RETURNING id
  `);

  beforeAll(async () => {
    const users = await db.execute(sql`
      INSERT INTO users (email,password_hash,first_name,last_name,role,status,is_active,phone)
      VALUES
        (${`${prefix}-admin@test`},'x','List','Admin','admin','active',true,'08012000001'),
        (${`${prefix}-teacher@test`},'x','List','Teacher','teacher','active',true,'08012000002'),
        (${`${prefix}-other@test`},'x','Other','Teacher','teacher','active',true,'08012000003'),
        (${`${prefix}-parent@test`},'x','List','Parent','parent','active',true,'08012000004')
      RETURNING id
    `);
    [adminId, teacherUserId, otherTeacherUserId, parentId] = users.rows.map(r => Number(r.id));
    const classes = await db.execute(sql`
      INSERT INTO classes (name,age_min,age_max,capacity,room_location,service_slot)
      VALUES (${prefix},1,12,30,'Room','7am'), (${`${prefix}-b`},1,12,30,'Room B','7am') RETURNING id
    `);
    [classId, otherClassId] = classes.rows.map(r => Number(r.id));
    teacherId = Number((await db.execute(sql`INSERT INTO teachers (user_id) VALUES (${teacherUserId}) RETURNING id`)).rows[0].id);
    otherTeacherId = Number((await db.execute(sql`INSERT INTO teachers (user_id) VALUES (${otherTeacherUserId}) RETURNING id`)).rows[0].id);
    await db.execute(sql`
      INSERT INTO teacher_allocations (teacher_id,class_id,service_date,service_slot,status)
      VALUES (${teacherId},${classId},${today},'7am','scheduled'),
             (${otherTeacherId},${otherClassId},${today},'7am','scheduled')
    `);
  });

  beforeEach(async () => {
    mockBibleApi();
    classDisplayPlaylistDependencies.fetchYouTubeTitle = async () => "Jesus Loves Me (Kids Song)";
    await db.execute(sql`DELETE FROM class_display_media WHERE class_id IN (${classId},${otherClassId})`);
    await db.execute(sql`DELETE FROM class_display_playlist_items WHERE class_id IN (${classId},${otherClassId})`);
  });

  afterAll(async () => {
    restoreBibleApi();
    classDisplayPlaylistDependencies.fetchYouTubeTitle = originalTitleLookup;
    const userIds = sql.join([adminId, teacherUserId, otherTeacherUserId, parentId].map(id => sql`${id}`), sql`,`);
    for (const query of [
      sql`DELETE FROM class_display_media WHERE class_id IN (${classId},${otherClassId})`,
      sql`DELETE FROM class_display_playlist_items WHERE class_id IN (${classId},${otherClassId})`,
      sql`DELETE FROM teacher_allocations WHERE teacher_id IN (${teacherId},${otherTeacherId})`,
      sql`DELETE FROM teachers WHERE id IN (${teacherId},${otherTeacherId})`,
      sql`DELETE FROM classes WHERE id IN (${classId},${otherClassId})`,
      sql`DELETE FROM private_object_bindings WHERE uploader_id IN (${userIds})`,
      sql`DELETE FROM sse_tickets WHERE user_id IN (${userIds})`,
      sql`DELETE FROM audit_logs WHERE user_id IN (${userIds})`,
      sql`DELETE FROM users WHERE id IN (${userIds})`,
    ]) await db.execute(query);
  });

  it("adds videos, files and Bible passages to the list without changing the TV", async () => {
    const teacher = token(teacherUserId, "teacher");
    const yt = await add(teacher, { kind: "youtube", youtubeVideoId: "abcdefghijk" }).expect(201);
    expect(yt.body.item).toMatchObject({ kind: "youtube", label: "Jesus Loves Me (Kids Song)", onTv: false });
    await add(teacher, await uploadedVideo(teacherUserId)).expect(201);
    await add(teacher, { kind: "bible", bibleId: KJV_ID, chapterId: "JHN.3", verseStart: 1, verseEnd: 2 }).expect(201);
    // A second YouTube link whose title can't be looked up still gets a label.
    classDisplayPlaylistDependencies.fetchYouTubeTitle = async () => null;
    await add(teacher, { kind: "youtube", youtubeVideoId: "zyxwvutsrqp" }).expect(201);

    const { body } = await list(teacher).expect(200);
    expect(body.limit).toBe(MAX_PLAYLIST_ITEMS);
    expect(body.items.map((i: any) => [i.kind, i.label, i.onTv])).toEqual([
      ["youtube", "Jesus Loves Me (Kids Song)", false],
      ["file", "Memory verse song.mp4", false],
      ["bible", "John 3:1–2 (KJV)", false],
      ["youtube", "YouTube video", false],
    ]);
    // Internal storage paths never reach the phone.
    expect(body.items[1]).not.toHaveProperty("objectPath");
    expect(await tvRow()).toBeUndefined();
  });

  it("plays any item, and going back restarts an earlier item from the beginning", async () => {
    const teacher = token(teacherUserId, "teacher");
    const yt = (await add(teacher, { kind: "youtube", youtubeVideoId: "abcdefghijk" }).expect(201)).body.item.id;
    const verses = (await add(teacher, { kind: "bible", bibleId: KJV_ID, chapterId: "JHN.3", verseStart: 1, verseEnd: 2 })
      .expect(201)).body.item.id;
    const video = await uploadedVideo(teacherUserId);
    const file = (await add(teacher, video).expect(201)).body.item.id;

    await play(teacher, verses).expect(200, { success: true });
    expect(await tvRow()).toMatchObject({
      kind: "bible", bible_id: KJV_ID, bible_chapter_id: "JHN.3", bible_verse_start: 1, bible_verse_end: 2,
      bible_verse: 1, bible_blanked: false, youtube_video_id: null, object_path: null,
    });
    // The Bible remote moves on and blanks the screen…
    await request(app).put(`/api/pickup-requests/display-media/${classId}/bible`).set("Authorization", teacher)
      .send({ bibleId: KJV_ID, chapterId: "JHN.3", verse: 3, blanked: true }).expect(200);
    let items = (await list(teacher).expect(200)).body.items;
    expect(items.map((i: any) => i.onTv)).toEqual([false, true, false]);

    await play(teacher, file).expect(200);
    expect(await tvRow()).toMatchObject({
      kind: "file", object_path: video.objectPath, content_type: "video/mp4", file_name: "Memory verse song.mp4",
      pdf_page: null, bible_id: null, bible_verse: null, bible_blanked: false,
    });
    await play(teacher, yt).expect(200);
    expect(await tvRow()).toMatchObject({ kind: "youtube", youtube_video_id: "abcdefghijk", object_path: null });

    // …and returning to the passage starts again at its first verse, unblanked.
    await play(teacher, verses).expect(200);
    expect(await tvRow()).toMatchObject({ kind: "bible", bible_verse: 1, bible_blanked: false });
    items = (await list(teacher).expect(200)).body.items;
    expect(items.map((i: any) => i.onTv)).toEqual([false, true, false]);
  });

  it("reorders and removes items; removing never clears the TV", async () => {
    const teacher = token(teacherUserId, "teacher");
    const ids: number[] = [];
    for (const id of ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"]) {
      ids.push((await add(teacher, { kind: "youtube", youtubeVideoId: id }).expect(201)).body.item.id);
    }
    const order = async () => (await list(teacher).expect(200)).body.items.map((i: any) => i.id);

    await move(teacher, ids[2], "up").expect(200, { success: true, moved: true });
    expect(await order()).toEqual([ids[0], ids[2], ids[1]]);
    await move(teacher, ids[0], "down").expect(200, { success: true, moved: true });
    expect(await order()).toEqual([ids[2], ids[0], ids[1]]);
    await move(teacher, ids[2], "up").expect(200, { success: true, moved: false });
    await move(teacher, ids[1], "down").expect(200, { success: true, moved: false });
    await move(teacher, ids[1], "sideways").expect(400);

    await play(teacher, ids[0]).expect(200);
    await remove(teacher, ids[0]).expect(200, { success: true });
    expect(await order()).toEqual([ids[2], ids[1]]);
    expect(await tvRow()).toMatchObject({ kind: "youtube", youtube_video_id: "aaaaaaaaaaa" });
    await remove(teacher, ids[0]).expect(404);
    await play(teacher, ids[0]).expect(404);
    await move(teacher, ids[0], "up").expect(404);
  });

  it("rejects invalid or unverified items and enforces the list limit", async () => {
    const teacher = token(teacherUserId, "teacher");
    await add(teacher, { kind: "youtube", youtubeVideoId: "not a video" }).expect(400);
    await add(teacher, { kind: "slideshow" }).expect(400);
    await add(teacher, { kind: "bible", bibleId: KJV_ID, chapterId: "JHN.3", verseStart: 9 }).expect(400);
    await add(teacher, { kind: "file", objectPath: `/objects/uploads/${prefix}-never-uploaded`, contentType: "video/mp4" })
      .expect(400);
    // Another user's pending upload can't be claimed through the list.
    await add(teacher, await uploadedVideo(adminId)).expect(400);
    expect((await list(teacher).expect(200)).body.items).toEqual([]);

    for (let i = 1; i <= MAX_PLAYLIST_ITEMS; i++) await insertRaw(today, i, `Item ${i}`);
    const full = await add(teacher, { kind: "youtube", youtubeVideoId: "abcdefghijk" }).expect(409);
    expect(full.body.message).toContain(`${MAX_PLAYLIST_ITEMS} items`);
  });

  it("clears automatically each new day", async () => {
    const teacher = token(teacherUserId, "teacher");
    const oldId = Number((await insertRaw(yesterday, 1, "Last week's song")).rows[0].id);
    expect((await list(teacher).expect(200)).body.items).toEqual([]);
    await play(teacher, oldId).expect(404);
    expect(await tvRow()).toBeUndefined();

    await add(teacher, { kind: "youtube", youtubeVideoId: "abcdefghijk" }).expect(201);
    const remaining = await db.execute(sql`
      SELECT service_date::text AS d FROM class_display_playlist_items WHERE class_id=${classId}
    `);
    expect(remaining.rows.map(r => r.d)).toEqual([today]);
  });

  it("limits each list to staff who can access the class", async () => {
    const teacher = token(teacherUserId, "teacher");
    const otherTeacher = token(otherTeacherUserId, "teacher");
    const itemId = (await add(teacher, { kind: "youtube", youtubeVideoId: "abcdefghijk" }).expect(201)).body.item.id;

    await list(otherTeacher).expect(403);
    await add(otherTeacher, { kind: "youtube", youtubeVideoId: "abcdefghijk" }).expect(403);
    await play(otherTeacher, itemId).expect(403);
    await remove(otherTeacher, itemId).expect(403);
    await list(token(parentId, "parent")).expect(403);
    await request(app).get(base()).expect(401);

    // An item can't be played on, or removed through, another class.
    await play(otherTeacher, itemId, otherClassId).expect(404);
    await remove(otherTeacher, itemId, otherClassId).expect(404);
    const otherTv = await db.execute(sql`SELECT 1 FROM class_display_media WHERE class_id=${otherClassId}`);
    expect(otherTv.rows).toEqual([]);

    // Admins can manage any class's list.
    const admin = token(adminId, "admin");
    expect((await list(admin).expect(200)).body.items).toHaveLength(1);
    await play(admin, itemId).expect(200);
  });
});
