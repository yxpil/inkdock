// Author: yxpil

import { getDb } from "./db";
import { hasWorkRole } from "./permissions";
import { dayKey, truncate } from "./utils";
import type {
  ChapterFull,
  ChapterIllustration,
  ChapterMeta,
  ChapterStatus,
  ContinueReading,
  EditorBundle,
  EditorWork,
  LibraryData,
  LibraryStats,
  ReaderChapter,
  ReaderWork,
  RevisionMeta,
  StoryEntity,
  StoryEntityType,
  User,
  VolumeSummary,
  VolumeWithChapters,
  WorkArchive,
  WorkArchiveChapter,
  WorkArchiveIllustration,
  WorkDetail,
  WorkMember,
  WorkRole,
  WorkStatus,
  WorkSummary,
} from "./types";

type Row = Record<string, unknown>;

function str(row: Row, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function num(row: Row, key: string): number {
  const value = row[key];
  return typeof value === "number" ? value : Number(value ?? 0);
}

function nullableStr(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

export function mapUser(row: Row): User {
  return {
    id: str(row, "id"),
    name: str(row, "name"),
    handle: str(row, "handle"),
    avatarColor: str(row, "avatar_color"),
    createdAt: str(row, "created_at"),
  };
}

function mapChapter(row: Row): ChapterMeta {
  return {
    id: str(row, "id"),
    workId: str(row, "work_id"),
    volumeId: str(row, "volume_id"),
    title: str(row, "title"),
    status: str(row, "status") as ChapterStatus,
    sort: num(row, "sort"),
    wordCount: num(row, "word_count"),
    createdAt: str(row, "created_at"),
    updatedAt: str(row, "updated_at"),
  };
}

function mapStoryEntity(row: Row): StoryEntity {
  return {
    id: str(row, "id"),
    workId: str(row, "work_id"),
    type: str(row, "type") as StoryEntityType,
    name: str(row, "name"),
    subtitle: str(row, "subtitle"),
    summary: str(row, "summary"),
    description: str(row, "description"),
    color: str(row, "color"),
    sort: num(row, "sort"),
    createdAt: str(row, "created_at"),
    updatedAt: str(row, "updated_at"),
  };
}

function mapIllustration(row: Row): ChapterIllustration {
  const id = str(row, "id");
  return {
    id,
    chapterId: str(row, "chapter_id"),
    paragraph: num(row, "paragraph"),
    caption: str(row, "caption"),
    width: num(row, "width"),
    height: num(row, "height"),
    imageUrl: `/api/illustrations/${id}/image`,
    createdAt: str(row, "created_at"),
    updatedAt: str(row, "updated_at"),
  };
}

const ILLUSTRATION_SELECT = `
  SELECT id, chapter_id, paragraph, caption, width, height, created_at, updated_at
  FROM chapter_illustrations
`;

function mapWork(row: Row): WorkSummary {
  return {
    id: str(row, "id"),
    title: str(row, "title"),
    subtitle: str(row, "subtitle"),
    description: str(row, "description"),
    genre: str(row, "genre"),
    status: str(row, "status") as WorkStatus,
    coverColor: str(row, "cover_color"),
    coverImage: nullableStr(row, "cover_image"),
    targetWords: num(row, "target_words"),
    createdAt: str(row, "created_at"),
    updatedAt: str(row, "updated_at"),
    authorName: str(row, "author_name"),
    totalWords: num(row, "total_words"),
    chapterCount: num(row, "chapter_count"),
    volumeCount: num(row, "volume_count"),
    lastChapterId: nullableStr(row, "last_chapter_id"),
    lastChapterTitle: nullableStr(row, "last_chapter_title"),
    lastChapterVolumeId: nullableStr(row, "last_chapter_volume_id"),
    role: str(row, "role") as WorkRole,
  };
}

const WORK_SELECT = `
  SELECT w.id, w.title, w.subtitle, w.description, w.genre, w.status, w.cover_color,
         w.cover_image, w.target_words, w.created_at, w.updated_at,
         u.name AS author_name, m.role AS role,
         (SELECT COALESCE(SUM(c.word_count), 0) FROM chapters c
           WHERE c.work_id = w.id AND c.deleted_at IS NULL) AS total_words,
         (SELECT COUNT(*) FROM chapters c
           WHERE c.work_id = w.id AND c.deleted_at IS NULL) AS chapter_count,
         (SELECT COUNT(*) FROM volumes v WHERE v.work_id = w.id) AS volume_count,
         (SELECT c.id FROM chapters c
           WHERE c.work_id = w.id AND c.deleted_at IS NULL
           ORDER BY c.updated_at DESC, c.sort DESC LIMIT 1) AS last_chapter_id,
         (SELECT c.title FROM chapters c
           WHERE c.work_id = w.id AND c.deleted_at IS NULL
           ORDER BY c.updated_at DESC, c.sort DESC LIMIT 1) AS last_chapter_title,
         (SELECT c.volume_id FROM chapters c
           WHERE c.work_id = w.id AND c.deleted_at IS NULL
           ORDER BY c.updated_at DESC, c.sort DESC LIMIT 1) AS last_chapter_volume_id
  FROM works w
  JOIN users u ON u.id = w.author_id
  JOIN work_members m ON m.work_id = w.id AND m.user_id = ?
`;

export function getUserById(userId: string): User | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as
    | Row
    | undefined;
  return row ? mapUser(row) : null;
}

export function getUserByHandle(handle: string): User | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM users WHERE handle = ?")
    .get(handle.trim().toLowerCase()) as Row | undefined;
  return row ? mapUser(row) : null;
}

export function countRegisteredUsers(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE password_hash <> ''")
    .get() as { n: number };
  return Number(row.n);
}

export function listWorks(userId: string): WorkSummary[] {
  const db = getDb();
  const rows = db
    .prepare(`${WORK_SELECT} WHERE w.deleted_at IS NULL ORDER BY w.updated_at DESC`)
    .all(userId) as Row[];
  return rows.map(mapWork);
}

function getWorkSummaryById(id: string, userId: string): WorkSummary | null {
  const db = getDb();
  const row = db
    .prepare(`${WORK_SELECT} WHERE w.id = ? AND w.deleted_at IS NULL`)
    .get(userId, id) as Row | undefined;
  return row ? mapWork(row) : null;
}

export function listWorkMembers(workId: string): WorkMember[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT u.*, m.role AS role, m.created_at AS joined_at
       FROM work_members m JOIN users u ON u.id = m.user_id
       WHERE m.work_id = ?
       ORDER BY CASE m.role
         WHEN 'owner' THEN 0 WHEN 'editor' THEN 1
         WHEN 'commenter' THEN 2 ELSE 3 END,
         m.created_at ASC`,
    )
    .all(workId) as Row[];
  return rows.map((row) => ({
    user: mapUser(row),
    role: str(row, "role") as WorkRole,
    joinedAt: str(row, "joined_at"),
  }));
}

export function getWorkDetail(id: string, userId: string): WorkDetail | null {
  const db = getDb();
  const summary = getWorkSummaryById(id, userId);
  if (!summary) return null;

  const authorRow = db
    .prepare(
      `SELECT u.* FROM users u JOIN works w ON w.author_id = u.id WHERE w.id = ?`,
    )
    .get(id) as Row | undefined;
  if (!authorRow) return null;

  const volumeRows = db
    .prepare("SELECT * FROM volumes WHERE work_id = ? ORDER BY sort ASC, created_at ASC")
    .all(id) as Row[];
  const chapterRows = db
    .prepare(
      `SELECT * FROM chapters
       WHERE work_id = ? AND deleted_at IS NULL
       ORDER BY volume_id ASC, sort ASC, created_at ASC`,
    )
    .all(id) as Row[];

  const chapters = chapterRows.map(mapChapter);
  const volumes: VolumeWithChapters[] = volumeRows.map((row) => {
    const volumeId = str(row, "id");
    const volumeChapters = chapters.filter((chapter) => chapter.volumeId === volumeId);
    return {
      id: volumeId,
      workId: str(row, "work_id"),
      title: str(row, "title"),
      summary: str(row, "summary"),
      sort: num(row, "sort"),
      chapters: volumeChapters,
      totalWords: volumeChapters.reduce((total, chapter) => total + chapter.wordCount, 0),
    };
  });

  return {
    ...summary,
    author: mapUser(authorRow),
    volumes,
    members: listWorkMembers(id),
  };
}

export function getDailyWords(userId: string): number {
  const db = getDb();
  const row = db
    .prepare("SELECT words FROM daily_stats WHERE day = ? AND user_id = ?")
    .get(dayKey(), userId) as { words: number } | undefined;
  return row?.words ?? 0;
}

export function getLibraryData(user: User): LibraryData {
  const db = getDb();
  const works = listWorks(user.id);

  const totalWordsRow = db
    .prepare(
      `SELECT COALESCE(SUM(c.word_count), 0) AS total
       FROM chapters c
       JOIN works w ON w.id = c.work_id
       JOIN work_members m ON m.work_id = w.id AND m.user_id = ?
       WHERE c.deleted_at IS NULL AND w.deleted_at IS NULL`,
    )
    .get(user.id) as { total: number };
  const chapterCountRow = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM chapters c
       JOIN works w ON w.id = c.work_id
       JOIN work_members m ON m.work_id = w.id AND m.user_id = ?
       WHERE c.deleted_at IS NULL AND w.deleted_at IS NULL`,
    )
    .get(user.id) as { n: number };
  const activeRow = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM works w
       JOIN work_members m ON m.work_id = w.id AND m.user_id = ?
       WHERE w.deleted_at IS NULL AND w.status = 'serializing'`,
    )
    .get(user.id) as { n: number };

  const stats: LibraryStats = {
    todayWords: getDailyWords(user.id),
    totalWords: Number(totalWordsRow.total ?? 0),
    activeWorks: Number(activeRow.n ?? 0),
    chapterCount: Number(chapterCountRow.n ?? 0),
  };

  const recentRow = db
    .prepare(
      `SELECT c.id, c.title, c.content, c.updated_at, c.work_id, w.title AS work_title,
              v.title AS volume_title
       FROM chapters c
       JOIN works w ON w.id = c.work_id
       JOIN volumes v ON v.id = c.volume_id
       JOIN work_members m ON m.work_id = w.id AND m.user_id = ?
       WHERE c.deleted_at IS NULL AND w.deleted_at IS NULL
       ORDER BY c.updated_at DESC LIMIT 1`,
    )
    .get(user.id) as Row | undefined;

  const recent: ContinueReading | null = recentRow
    ? {
        chapterId: str(recentRow, "id"),
        chapterTitle: str(recentRow, "title"),
        workId: str(recentRow, "work_id"),
        workTitle: str(recentRow, "work_title"),
        volumeTitle: str(recentRow, "volume_title"),
        snippet: truncate(str(recentRow, "content"), 120),
        updatedAt: str(recentRow, "updated_at"),
      }
    : null;

  return { user, works, stats, recent };
}

export function getEditorBundle(chapterId: string, userId: string): EditorBundle | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT c.*, w.author_id, m.role AS member_role
       FROM chapters c
       JOIN works w ON w.id = c.work_id
       JOIN work_members m ON m.work_id = c.work_id AND m.user_id = ?
       WHERE c.id = ? AND c.deleted_at IS NULL AND w.deleted_at IS NULL`,
    )
    .get(userId, chapterId) as Row | undefined;
  if (!row) return null;
  if (!hasWorkRole(str(row, "member_role") as WorkRole, "editor")) return null;

  const workId = str(row, "work_id");
  const workRow = db
    .prepare(
      `SELECT w.*, u.name AS author_name,
        (SELECT COALESCE(SUM(c2.word_count), 0) FROM chapters c2
          WHERE c2.work_id = w.id AND c2.deleted_at IS NULL) AS total_words,
        (SELECT COUNT(*) FROM chapters c2
          WHERE c2.work_id = w.id AND c2.deleted_at IS NULL) AS chapter_count,
        (SELECT COUNT(*) FROM volumes v WHERE v.work_id = w.id) AS volume_count
       FROM works w JOIN users u ON u.id = w.author_id
       WHERE w.id = ?`,
    )
    .get(workId) as Row | undefined;
  if (!workRow) return null;

  const volumes = db
    .prepare("SELECT * FROM volumes WHERE work_id = ? ORDER BY sort ASC")
    .all(workId) as Row[];
  const chapterRows = db
    .prepare(
      `SELECT c.* FROM chapters c JOIN volumes v ON v.id = c.volume_id
       WHERE c.work_id = ? AND c.deleted_at IS NULL
       ORDER BY v.sort ASC, c.sort ASC`,
    )
    .all(workId) as Row[];

  const work: EditorWork = {
    id: workId,
    title: str(workRow, "title"),
    genre: str(workRow, "genre"),
    status: str(workRow, "status") as WorkStatus,
    coverColor: str(workRow, "cover_color"),
    coverImage: nullableStr(workRow, "cover_image"),
    targetWords: num(workRow, "target_words"),
    totalWords: num(workRow, "total_words"),
    chapterCount: num(workRow, "chapter_count"),
    volumeCount: num(workRow, "volume_count"),
    updatedAt: str(workRow, "updated_at"),
  };

  return {
    user: getUserById(userId) as User,
    work,
    volumes: volumes.map(
      (volume): VolumeSummary => ({
        id: str(volume, "id"),
        workId: str(volume, "work_id"),
        title: str(volume, "title"),
        summary: str(volume, "summary"),
        sort: num(volume, "sort"),
      }),
    ),
    chapters: chapterRows.map(mapChapter),
    chapter: {
      ...mapChapter(row),
      content: str(row, "content"),
    } satisfies ChapterFull,
    dailyWords: getDailyWords(userId),
    storyEntities: listStoryEntities(workId),
    illustrations: listChapterIllustrations(str(row, "id")),
  };
}

export function listChapterIllustrations(chapterId: string): ChapterIllustration[] {
  const db = getDb();
  const rows = db
    .prepare(
      `${ILLUSTRATION_SELECT}
       WHERE chapter_id = ?
       ORDER BY paragraph ASC, created_at ASC`,
    )
    .all(chapterId) as Row[];
  return rows.map(mapIllustration);
}

export function getIllustration(
  illustrationId: string,
  userId: string,
): ChapterIllustration | null {
  const db = getDb();
  const row = db
    .prepare(
      `${ILLUSTRATION_SELECT}
       WHERE i.id = ?
         AND EXISTS (
           SELECT 1 FROM chapters c
           JOIN works w ON w.id = c.work_id
           JOIN work_members m ON m.work_id = w.id AND m.user_id = ?
           WHERE c.id = i.chapter_id AND c.deleted_at IS NULL AND w.deleted_at IS NULL
         )`,
    )
    .get(illustrationId, userId) as Row | undefined;
  return row ? mapIllustration(row) : null;
}

export function getIllustrationImage(
  illustrationId: string,
  userId: string,
): { mime: string; data: Uint8Array<ArrayBuffer> } | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT i.image_mime, i.image_data
       FROM chapter_illustrations i
       JOIN chapters c ON c.id = i.chapter_id
       JOIN works w ON w.id = c.work_id
       JOIN work_members m ON m.work_id = w.id AND m.user_id = ?
       WHERE i.id = ? AND c.deleted_at IS NULL AND w.deleted_at IS NULL`,
    )
    .get(userId, illustrationId) as
    | { image_mime: string; image_data: Uint8Array }
    | undefined;
  if (!row) return null;
  const data = new Uint8Array(row.image_data.byteLength);
  data.set(row.image_data);
  return { mime: `image/${row.image_mime}`, data };
}

export function listStoryEntities(workId: string): StoryEntity[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM story_entities
       WHERE work_id = ?
       ORDER BY sort ASC, created_at ASC`,
    )
    .all(workId) as Row[];
  return rows.map(mapStoryEntity);
}

export function getStoryEntity(entityId: string, userId: string): StoryEntity | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT e.* FROM story_entities e
       JOIN works w ON w.id = e.work_id
       JOIN work_members m ON m.work_id = w.id AND m.user_id = ?
       WHERE e.id = ? AND w.deleted_at IS NULL`,
    )
    .get(userId, entityId) as Row | undefined;
  return row ? mapStoryEntity(row) : null;
}

export function getReaderWork(workId: string, userId: string): ReaderWork | null {
  const db = getDb();
  const workRow = db
    .prepare(
      `SELECT w.*, u.name AS author_name,
        (SELECT COALESCE(SUM(c.word_count), 0) FROM chapters c
          WHERE c.work_id = w.id AND c.deleted_at IS NULL) AS total_words
       FROM works w
       JOIN users u ON u.id = w.author_id
       JOIN work_members m ON m.work_id = w.id AND m.user_id = ?
       WHERE w.id = ? AND w.deleted_at IS NULL`,
    )
    .get(userId, workId) as Row | undefined;
  if (!workRow) return null;

  const chapterRows = db
    .prepare(
      `SELECT c.*, v.title AS volume_title, v.sort AS volume_sort
       FROM chapters c JOIN volumes v ON v.id = c.volume_id
       WHERE c.work_id = ? AND c.deleted_at IS NULL
       ORDER BY v.sort ASC, c.sort ASC`,
    )
    .all(workId) as Row[];

  const illustrationRows = db
    .prepare(
      `SELECT i.id, i.chapter_id, i.paragraph, i.caption, i.width, i.height,
              i.created_at, i.updated_at
       FROM chapter_illustrations i
       JOIN chapters c ON c.id = i.chapter_id
       WHERE c.work_id = ? AND c.deleted_at IS NULL
       ORDER BY i.paragraph ASC, i.created_at ASC`,
    )
    .all(workId) as Row[];
  const illustrationsByChapter = new Map<string, ChapterIllustration[]>();
  for (const row of illustrationRows) {
    const chapterId = str(row, "chapter_id");
    const list = illustrationsByChapter.get(chapterId) ?? [];
    list.push(mapIllustration(row));
    illustrationsByChapter.set(chapterId, list);
  }

  const chapters: ReaderChapter[] = chapterRows.map((row) => ({
    id: str(row, "id"),
    workId: str(row, "work_id"),
    volumeId: str(row, "volume_id"),
    title: str(row, "title"),
    content: str(row, "content"),
    wordCount: num(row, "word_count"),
    sort: num(row, "sort"),
    volumeTitle: str(row, "volume_title"),
    illustrations: illustrationsByChapter.get(str(row, "id")) ?? [],
  }));

  return {
    id: str(workRow, "id"),
    title: str(workRow, "title"),
    subtitle: str(workRow, "subtitle"),
    genre: str(workRow, "genre"),
    status: str(workRow, "status") as WorkStatus,
    authorName: str(workRow, "author_name"),
    totalWords: num(workRow, "total_words"),
    chapters,
  };
}

export function listRevisions(
  chapterId: string,
  userId: string,
  limit = 30,
): RevisionMeta[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT r.id, r.chapter_id, r.word_count, r.reason, r.created_at, r.content
       FROM revisions r
       JOIN chapters c ON c.id = r.chapter_id
       JOIN works w ON w.id = c.work_id
       JOIN work_members m ON m.work_id = w.id AND m.user_id = ?
       WHERE r.chapter_id = ? AND c.deleted_at IS NULL AND w.deleted_at IS NULL
         AND m.role IN ('owner', 'editor')
       ORDER BY r.created_at DESC LIMIT ?`,
    )
    .all(userId, chapterId, limit) as Row[];
  return rows.map((row) => ({
    id: str(row, "id"),
    chapterId: str(row, "chapter_id"),
    wordCount: num(row, "word_count"),
    reason: str(row, "reason"),
    createdAt: str(row, "created_at"),
    preview: truncate(str(row, "content"), 80),
  }));
}

export function workExists(id: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT id FROM works WHERE id = ? AND deleted_at IS NULL")
    .get(id) as { id: string } | undefined;
  return Boolean(row);
}

export interface ExportChapter {
  title: string;
  content: string;
  wordCount: number;
}

export interface ExportVolume {
  title: string;
  chapters: ExportChapter[];
}

export interface WorkExport {
  title: string;
  subtitle: string;
  authorName: string;
  genre: string;
  description: string;
  volumes: ExportVolume[];
}

export function getWorkForExport(
  workId: string,
  userId: string,
): WorkExport | null {
  const detail = getWorkDetail(workId, userId);
  if (!detail) return null;

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.id, c.title, c.content, c.word_count, c.volume_id
       FROM chapters c JOIN volumes v ON v.id = c.volume_id
       WHERE c.work_id = ? AND c.deleted_at IS NULL
       ORDER BY v.sort ASC, c.sort ASC`,
    )
    .all(workId) as Row[];

  const byVolume = new Map<string, ExportChapter[]>();
  for (const row of rows) {
    const volumeId = str(row, "volume_id");
    const list = byVolume.get(volumeId) ?? [];
    list.push({
      title: str(row, "title"),
      content: str(row, "content"),
      wordCount: num(row, "word_count"),
    });
    byVolume.set(volumeId, list);
  }

  return {
    title: detail.title,
    subtitle: detail.subtitle,
    authorName: detail.authorName,
    genre: detail.genre,
    description: detail.description,
    volumes: detail.volumes.map((volume) => ({
      title: volume.title,
      chapters: byVolume.get(volume.id) ?? [],
    })),
  };
}

export function getWorkArchive(workId: string, userId: string): WorkArchive | null {
  const detail = getWorkDetail(workId, userId);
  if (!detail) return null;

  const db = getDb();
  const chapterRows = db
    .prepare(
      `SELECT c.id, c.volume_id, c.title, c.status, c.content
       FROM chapters c JOIN volumes v ON v.id = c.volume_id
       WHERE c.work_id = ? AND c.deleted_at IS NULL
       ORDER BY v.sort ASC, c.sort ASC`,
    )
    .all(workId) as Row[];

  const illustrationRows = db
    .prepare(
      `SELECT i.chapter_id, i.paragraph, i.caption, i.image_mime, i.image_data,
              i.width, i.height
       FROM chapter_illustrations i
       JOIN chapters c ON c.id = i.chapter_id
       WHERE c.work_id = ? AND c.deleted_at IS NULL
       ORDER BY i.paragraph ASC, i.created_at ASC`,
    )
    .all(workId) as Row[];

  const illustrationsByChapter = new Map<string, WorkArchiveIllustration[]>();
  for (const row of illustrationRows) {
    const chapterId = str(row, "chapter_id");
    const list = illustrationsByChapter.get(chapterId) ?? [];
    list.push({
      paragraph: num(row, "paragraph"),
      caption: str(row, "caption"),
      mime: str(row, "image_mime") as WorkArchiveIllustration["mime"],
      width: num(row, "width"),
      height: num(row, "height"),
      data: Buffer.from(row.image_data as Uint8Array).toString("base64"),
    });
    illustrationsByChapter.set(chapterId, list);
  }

  const chaptersByVolume = new Map<string, WorkArchiveChapter[]>();
  for (const row of chapterRows) {
    const volumeId = str(row, "volume_id");
    const list = chaptersByVolume.get(volumeId) ?? [];
    list.push({
      title: str(row, "title"),
      status: str(row, "status") as ChapterStatus,
      content: str(row, "content"),
      illustrations: illustrationsByChapter.get(str(row, "id")) ?? [],
    });
    chaptersByVolume.set(volumeId, list);
  }

  return {
    app: "inkdock",
    version: 1,
    exportedAt: new Date().toISOString(),
    work: {
      title: detail.title,
      subtitle: detail.subtitle,
      description: detail.description,
      genre: detail.genre,
      status: detail.status,
      coverColor: detail.coverColor,
      coverImage: detail.coverImage,
      targetWords: detail.targetWords,
      authorName: detail.authorName,
    },
    storyEntities: listStoryEntities(workId).map((entity) => ({
      type: entity.type,
      name: entity.name,
      subtitle: entity.subtitle,
      summary: entity.summary,
      description: entity.description,
      color: entity.color,
    })),
    volumes: detail.volumes.map((volume) => ({
      title: volume.title,
      summary: volume.summary,
      chapters: chaptersByVolume.get(volume.id) ?? [],
    })),
  };
}
