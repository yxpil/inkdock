// Author: yxpil

import { getDb, LOCAL_USER_ID } from "./db";
import { dayKey, truncate } from "./utils";
import type {
  ChapterFull,
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
  WorkDetail,
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

function mapUser(row: Row): User {
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
  };
}

const WORK_SELECT = `
  SELECT w.id, w.title, w.subtitle, w.description, w.genre, w.status, w.cover_color,
         w.cover_image, w.target_words, w.created_at, w.updated_at,
         u.name AS author_name,
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
`;

export function getUser(): User {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(LOCAL_USER_ID) as
    | Row
    | undefined;
  if (!row) {
    throw new Error("Local user is missing");
  }
  return mapUser(row);
}

export function listWorks(): WorkSummary[] {
  const db = getDb();
  const rows = db
    .prepare(`${WORK_SELECT} WHERE w.deleted_at IS NULL ORDER BY w.updated_at DESC`)
    .all() as Row[];
  return rows.map(mapWork);
}

function getWorkSummaryById(id: string): WorkSummary | null {
  const db = getDb();
  const row = db
    .prepare(`${WORK_SELECT} WHERE w.id = ? AND w.deleted_at IS NULL`)
    .get(id) as Row | undefined;
  return row ? mapWork(row) : null;
}

export function getWorkDetail(id: string): WorkDetail | null {
  const db = getDb();
  const summary = getWorkSummaryById(id);
  if (!summary) return null;

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
    author: getUser(),
    volumes,
  };
}

export function getDailyWords(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT words FROM daily_stats WHERE day = ? AND user_id = ?")
    .get(dayKey(), LOCAL_USER_ID) as { words: number } | undefined;
  return row?.words ?? 0;
}

export function getLibraryData(): LibraryData {
  const db = getDb();
  const user = getUser();
  const works = listWorks();

  const totalWordsRow = db
    .prepare(
      `SELECT COALESCE(SUM(c.word_count), 0) AS total
       FROM chapters c JOIN works w ON w.id = c.work_id
       WHERE c.deleted_at IS NULL AND w.deleted_at IS NULL`,
    )
    .get() as { total: number };
  const chapterCountRow = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM chapters c JOIN works w ON w.id = c.work_id
       WHERE c.deleted_at IS NULL AND w.deleted_at IS NULL`,
    )
    .get() as { n: number };
  const activeRow = db
    .prepare(
      "SELECT COUNT(*) AS n FROM works WHERE deleted_at IS NULL AND status = 'serializing'",
    )
    .get() as { n: number };

  const stats: LibraryStats = {
    todayWords: getDailyWords(),
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
       WHERE c.deleted_at IS NULL AND w.deleted_at IS NULL
       ORDER BY c.updated_at DESC LIMIT 1`,
    )
    .get() as Row | undefined;

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

export function getEditorBundle(chapterId: string): EditorBundle | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT c.*, w.author_id
       FROM chapters c JOIN works w ON w.id = c.work_id
       WHERE c.id = ? AND c.deleted_at IS NULL AND w.deleted_at IS NULL`,
    )
    .get(chapterId) as Row | undefined;
  if (!row) return null;

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
    user: getUser(),
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
    dailyWords: getDailyWords(),
    storyEntities: listStoryEntities(workId),
  };
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

export function getStoryEntity(entityId: string): StoryEntity | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM story_entities WHERE id = ?")
    .get(entityId) as Row | undefined;
  return row ? mapStoryEntity(row) : null;
}

export function getReaderWork(workId: string): ReaderWork | null {
  const db = getDb();
  const workRow = db
    .prepare(
      `SELECT w.*, u.name AS author_name,
        (SELECT COALESCE(SUM(c.word_count), 0) FROM chapters c
          WHERE c.work_id = w.id AND c.deleted_at IS NULL) AS total_words
       FROM works w JOIN users u ON u.id = w.author_id
       WHERE w.id = ? AND w.deleted_at IS NULL`,
    )
    .get(workId) as Row | undefined;
  if (!workRow) return null;

  const chapterRows = db
    .prepare(
      `SELECT c.*, v.title AS volume_title, v.sort AS volume_sort
       FROM chapters c JOIN volumes v ON v.id = c.volume_id
       WHERE c.work_id = ? AND c.deleted_at IS NULL
       ORDER BY v.sort ASC, c.sort ASC`,
    )
    .all(workId) as Row[];

  const chapters: ReaderChapter[] = chapterRows.map((row) => ({
    id: str(row, "id"),
    workId: str(row, "work_id"),
    volumeId: str(row, "volume_id"),
    title: str(row, "title"),
    content: str(row, "content"),
    wordCount: num(row, "word_count"),
    sort: num(row, "sort"),
    volumeTitle: str(row, "volume_title"),
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

export function listRevisions(chapterId: string, limit = 30): RevisionMeta[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, chapter_id, word_count, reason, created_at, content
       FROM revisions WHERE chapter_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(chapterId, limit) as Row[];
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

export function getWorkForExport(workId: string): WorkExport | null {
  const detail = getWorkDetail(workId);
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
