// Author: yxpil

import { getDb, LOCAL_USER_ID } from "./db";
import {
  CHAPTER_STATUSES,
  COVER_COLORS,
  DEFAULT_COVER_COLOR,
  DEFAULT_STORY_ENTITY_COLOR,
  GENRES,
  STORY_ENTITY_TYPES,
  WORK_STATUSES,
} from "./constants";
import { countWords } from "./words";
import { dayKey } from "./utils";
import type {
  ChapterStatus,
  SaveChapterResult,
  StoryEntityType,
  WorkStatus,
} from "./types";

type Row = Record<string, unknown>;

const MAX_CONTENT_LENGTH = 2_000_000;
const REVISION_INTERVAL_MS = 15 * 60 * 1000;

export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export class ConflictError extends AppError {
  current: { updatedAt: string; wordCount: number };

  constructor(current: { updatedAt: string; wordCount: number }) {
    super(409, "conflict", "章节已在别处更新，请选择保留哪一版。");
    this.name = "ConflictError";
    this.current = current;
  }
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function cleanTitle(value: unknown, max: number, fallback: string): string {
  const raw = str(value);
  if (raw === null) return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, max);
}

function requireTitle(value: unknown, field: string, max: number): string {
  const raw = str(value);
  if (!raw || !raw.trim()) {
    throw new AppError(400, "invalid", `${field}不能为空`);
  }
  return raw.trim().slice(0, max);
}

function normalizeStatus(value: unknown): WorkStatus | null {
  return typeof value === "string" && WORK_STATUSES.includes(value as WorkStatus)
    ? (value as WorkStatus)
    : null;
}

function normalizeChapterStatus(value: unknown): ChapterStatus | null {
  return typeof value === "string" && CHAPTER_STATUSES.includes(value as ChapterStatus)
    ? (value as ChapterStatus)
    : null;
}

function normalizeColor(value: unknown): string {
  const raw = str(value);
  if (raw && /^#[0-9A-Fa-f]{6}$/.test(raw)) return raw.toUpperCase();
  return DEFAULT_COVER_COLOR;
}

const COVER_DATA_URL_PREFIX = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_COVER_DATA_URL = 1_100_000;
const MAX_COVER_BYTES = 700_000;

function hasCoverSignature(mime: string, buffer: Buffer): boolean {
  if (mime === "jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === "png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  return (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function normalizeCoverImage(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const raw = str(value);
  if (!raw) {
    throw new AppError(400, "invalid_cover", "封面数据格式不正确");
  }
  if (raw.length > MAX_COVER_DATA_URL) {
    throw new AppError(413, "cover_too_large", "封面文件过大，请选择更小的图片");
  }
  const match = COVER_DATA_URL_PREFIX.exec(raw);
  if (!match) {
    throw new AppError(400, "invalid_cover", "封面只支持 JPG、PNG 或 WebP 图片");
  }
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > MAX_COVER_BYTES) {
    throw new AppError(413, "cover_too_large", "封面文件需小于 700 KB");
  }
  if (!hasCoverSignature(mime, buffer)) {
    throw new AppError(400, "invalid_cover", "封面文件内容与格式不符");
  }
  return raw;
}

function normalizeGenre(value: unknown): string {
  const raw = str(value)?.trim();
  if (!raw) return "其他";
  if (!GENRES.includes(raw as (typeof GENRES)[number])) {
    throw new AppError(400, "invalid", "题材不在可选范围内");
  }
  return raw;
}

function normalizeTargetWords(value: unknown, fallback = 0): number {
  const parsed = num(value);
  if (parsed === null) return fallback;
  return Math.max(0, Math.min(10_000_000, Math.round(parsed)));
}

function normalizeContent(value: unknown): string {
  const raw = str(value);
  if (raw === null) {
    throw new AppError(400, "invalid", "正文格式不正确");
  }
  if (raw.length > MAX_CONTENT_LENGTH) {
    throw new AppError(413, "too_large", "单章正文超过 200 万字上限");
  }
  return raw;
}

function transaction<T>(work: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // The transaction may already be closed by SQLite.
    }
    throw error;
  }
}

interface ChapterRow extends Row {
  id: string;
  work_id: string;
  volume_id: string;
  title: string;
  content: string;
  status: ChapterStatus;
  sort: number;
  word_count: number;
  updated_at: string;
  author_id: string;
}

function getChapterRow(chapterId: string): ChapterRow {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT c.*, w.author_id
       FROM chapters c JOIN works w ON w.id = c.work_id
       WHERE c.id = ? AND c.deleted_at IS NULL AND w.deleted_at IS NULL`,
    )
    .get(chapterId) as ChapterRow | undefined;
  if (!row) {
    throw new AppError(404, "not_found", "章节不存在或已删除");
  }
  return row;
}

function insertDailyDelta(authorId: string, delta: number, now: string): void {
  if (delta <= 0) return;
  const db = getDb();
  db.prepare(
    `INSERT INTO daily_stats (day, user_id, words, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(day, user_id)
     DO UPDATE SET words = daily_stats.words + excluded.words, updated_at = excluded.updated_at`,
  ).run(dayKey(), authorId, delta, now);
}

function snapshotChapter(
  chapterId: string,
  content: string,
  wordCount: number,
  reason: "auto" | "manual" | "before_restore",
  now: string,
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO revisions (id, chapter_id, content, word_count, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), chapterId, content, wordCount, reason, now);
}

function shouldAutoSnapshot(chapterId: string, now: Date): boolean {
  const db = getDb();
  const latest = db
    .prepare(
      "SELECT created_at FROM revisions WHERE chapter_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(chapterId) as { created_at: string } | undefined;
  if (!latest) return true;
  return now.getTime() - new Date(latest.created_at).getTime() > REVISION_INTERVAL_MS;
}

export interface CreateWorkInput {
  title?: unknown;
  subtitle?: unknown;
  description?: unknown;
  genre?: unknown;
  targetWords?: unknown;
  coverColor?: unknown;
  coverImage?: unknown;
}

export function createWork(input: CreateWorkInput): {
  workId: string;
  volumeId: string;
  chapterId: string;
} {
  const title = requireTitle(input.title, "书名", 60);
  const subtitle = str(input.subtitle)?.trim().slice(0, 120) ?? "";
  const description = str(input.description)?.trim().slice(0, 2000) ?? "";
  const genre = normalizeGenre(input.genre);
  const coverColor = normalizeColor(input.coverColor);
  const coverImage = normalizeCoverImage(input.coverImage);
  const targetWords = normalizeTargetWords(input.targetWords, 100_000);

  const workId = crypto.randomUUID();
  const volumeId = crypto.randomUUID();
  const chapterId = crypto.randomUUID();
  const now = new Date().toISOString();

  transaction(() => {
    const db = getDb();
    db.prepare(
      `INSERT INTO works
        (id, author_id, title, subtitle, description, genre, tags, status,
         cover_color, cover_image, target_words, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '[]', 'serializing', ?, ?, ?, ?, ?)`,
    ).run(
      workId,
      LOCAL_USER_ID,
      title,
      subtitle,
      description,
      genre,
      coverColor,
      coverImage,
      targetWords,
      now,
      now,
    );
    db.prepare(
      `INSERT INTO work_members (id, work_id, user_id, role, created_at)
       VALUES (?, ?, ?, 'owner', ?)`,
    ).run(crypto.randomUUID(), workId, LOCAL_USER_ID, now);
    db.prepare(
      `INSERT INTO volumes (id, work_id, title, summary, sort, created_at, updated_at)
       VALUES (?, ?, '第一卷', '', 1000, ?, ?)`,
    ).run(volumeId, workId, now, now);
    db.prepare(
      `INSERT INTO chapters
        (id, work_id, volume_id, title, content, status, sort, word_count, created_at, updated_at)
       VALUES (?, ?, ?, '第一章', '', 'draft', 1000, 0, ?, ?)`,
    ).run(chapterId, workId, volumeId, now, now);
  });

  return { workId, volumeId, chapterId };
}

export interface UpdateWorkInput {
  title?: unknown;
  subtitle?: unknown;
  description?: unknown;
  genre?: unknown;
  status?: unknown;
  targetWords?: unknown;
  coverColor?: unknown;
  coverImage?: unknown;
}

export function updateWork(workId: string, input: UpdateWorkInput): void {
  const db = getDb();
  const current = db
    .prepare("SELECT * FROM works WHERE id = ? AND deleted_at IS NULL")
    .get(workId) as Row | undefined;
  if (!current) {
    throw new AppError(404, "not_found", "作品不存在");
  }

  const title =
    input.title === undefined ? String(current.title) : requireTitle(input.title, "书名", 60);
  const subtitle =
    input.subtitle === undefined
      ? String(current.subtitle)
      : (str(input.subtitle)?.trim().slice(0, 120) ?? "");
  const description =
    input.description === undefined
      ? String(current.description)
      : (str(input.description)?.trim().slice(0, 2000) ?? "");
  const genre = input.genre === undefined ? String(current.genre) : normalizeGenre(input.genre);
  const status =
    input.status === undefined ? (current.status as WorkStatus) : normalizeStatus(input.status);
  if (!status) {
    throw new AppError(400, "invalid", "作品状态不正确");
  }
  const coverColor =
    input.coverColor === undefined
      ? String(current.cover_color)
      : normalizeColor(input.coverColor);
  const coverImage =
    input.coverImage === undefined
      ? str(current.cover_image)
      : normalizeCoverImage(input.coverImage);
  const targetWords =
    input.targetWords === undefined
      ? Number(current.target_words)
      : normalizeTargetWords(input.targetWords, Number(current.target_words));

  db.prepare(
    `UPDATE works
     SET title = ?, subtitle = ?, description = ?, genre = ?, status = ?,
         cover_color = ?, cover_image = ?, target_words = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    title,
    subtitle,
    description,
    genre,
    status,
    coverColor,
    coverImage,
    targetWords,
    new Date().toISOString(),
    workId,
  );
}

export function archiveWork(workId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare("UPDATE works SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
    .run(now, now, workId);
  if (Number(result.changes) === 0) {
    throw new AppError(404, "not_found", "作品不存在");
  }
}

export interface CreateVolumeInput {
  title?: unknown;
  summary?: unknown;
}

export function createVolume(
  workId: string,
  input: CreateVolumeInput,
): { volumeId: string } {
  const title = requireTitle(input.title, "卷名", 60);
  const summary = str(input.summary)?.trim().slice(0, 500) ?? "";
  const db = getDb();
  const work = db
    .prepare("SELECT id FROM works WHERE id = ? AND deleted_at IS NULL")
    .get(workId);
  if (!work) throw new AppError(404, "not_found", "作品不存在");

  const maxRow = db
    .prepare("SELECT COALESCE(MAX(sort), 0) AS max_sort FROM volumes WHERE work_id = ?")
    .get(workId) as { max_sort: number };
  const volumeId = crypto.randomUUID();
  const now = new Date().toISOString();

  transaction(() => {
    db.prepare(
      `INSERT INTO volumes (id, work_id, title, summary, sort, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(volumeId, workId, title, summary, Number(maxRow.max_sort) + 1000, now, now);
    db.prepare("UPDATE works SET updated_at = ? WHERE id = ?").run(now, workId);
  });

  return { volumeId };
}

export interface UpdateVolumeInput {
  title?: unknown;
  summary?: unknown;
}

export function updateVolume(volumeId: string, input: UpdateVolumeInput): void {
  const db = getDb();
  const current = db.prepare("SELECT * FROM volumes WHERE id = ?").get(volumeId) as
    | Row
    | undefined;
  if (!current) throw new AppError(404, "not_found", "卷不存在");

  const title =
    input.title === undefined ? String(current.title) : requireTitle(input.title, "卷名", 60);
  const summary =
    input.summary === undefined
      ? String(current.summary)
      : (str(input.summary)?.trim().slice(0, 500) ?? "");
  const now = new Date().toISOString();

  transaction(() => {
    db.prepare("UPDATE volumes SET title = ?, summary = ?, updated_at = ? WHERE id = ?").run(
      title,
      summary,
      now,
      volumeId,
    );
    db.prepare("UPDATE works SET updated_at = ? WHERE id = ?").run(
      now,
      String(current.work_id),
    );
  });
}

export function deleteVolume(volumeId: string): void {
  const db = getDb();
  const volume = db.prepare("SELECT * FROM volumes WHERE id = ?").get(volumeId) as
    | Row
    | undefined;
  if (!volume) throw new AppError(404, "not_found", "卷不存在");

  const chapterCount = db
    .prepare("SELECT COUNT(*) AS n FROM chapters WHERE volume_id = ? AND deleted_at IS NULL")
    .get(volumeId) as { n: number };
  if (Number(chapterCount.n) > 0) {
    throw new AppError(400, "not_empty", "卷内仍有章节，请先移走或删除章节");
  }

  const volumeCount = db
    .prepare("SELECT COUNT(*) AS n FROM volumes WHERE work_id = ?")
    .get(String(volume.work_id)) as { n: number };
  if (Number(volumeCount.n) <= 1) {
    throw new AppError(400, "last_volume", "作品至少需要保留一卷");
  }

  const now = new Date().toISOString();
  transaction(() => {
    db.prepare("DELETE FROM volumes WHERE id = ?").run(volumeId);
    db.prepare("UPDATE works SET updated_at = ? WHERE id = ?").run(
      now,
      String(volume.work_id),
    );
  });
}

export interface CreateChapterInput {
  volumeId?: unknown;
  title?: unknown;
}

export function createChapter(
  workId: string,
  input: CreateChapterInput,
): { chapterId: string } {
  const volumeId = str(input.volumeId);
  if (!volumeId) {
    throw new AppError(400, "invalid", "请选择所属卷");
  }
  const db = getDb();
  const volume = db
    .prepare("SELECT id FROM volumes WHERE id = ? AND work_id = ?")
    .get(volumeId, workId);
  if (!volume) {
    throw new AppError(400, "invalid", "卷不属于该作品");
  }

  const title = cleanTitle(input.title, 120, "新章节");
  const sortRow = db
    .prepare("SELECT COALESCE(MAX(sort), 0) AS max_sort FROM chapters WHERE volume_id = ?")
    .get(volumeId) as { max_sort: number };
  const chapterId = crypto.randomUUID();
  const now = new Date().toISOString();

  transaction(() => {
    db.prepare(
      `INSERT INTO chapters
        (id, work_id, volume_id, title, content, status, sort, word_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, '', 'draft', ?, 0, ?, ?)`,
    ).run(chapterId, workId, volumeId, title, Number(sortRow.max_sort) + 1000, now, now);
    db.prepare("UPDATE works SET updated_at = ? WHERE id = ?").run(now, workId);
  });

  return { chapterId };
}

export interface UpdateChapterInput {
  baseUpdatedAt?: unknown;
  title?: unknown;
  content?: unknown;
  status?: unknown;
  volumeId?: unknown;
  manualSnapshot?: unknown;
}

export function updateChapter(
  chapterId: string,
  input: UpdateChapterInput,
): SaveChapterResult {
  const current = getChapterRow(chapterId);

  const nextTitle =
    input.title === undefined
      ? current.title
      : cleanTitle(input.title, 120, current.title.trim() || "未命名章节");
  const nextContent =
    input.content === undefined ? current.content : normalizeContent(input.content);
  const nextStatus =
    input.status === undefined ? current.status : normalizeChapterStatus(input.status);
  if (!nextStatus) {
    throw new AppError(400, "invalid", "章节状态不正确");
  }

  const baseUpdatedAt = str(input.baseUpdatedAt);
  if (baseUpdatedAt && baseUpdatedAt !== current.updated_at) {
    // A retried or reload-racing save can arrive after its twin; identical content is safe to acknowledge.
    const sameFields =
      nextTitle === current.title &&
      nextContent === current.content &&
      nextStatus === current.status;
    const sameVolume =
      input.volumeId === undefined || str(input.volumeId) === current.volume_id;
    if (sameFields && sameVolume) {
      return {
        chapter: {
          id: chapterId,
          updatedAt: current.updated_at,
          wordCount: Number(current.word_count),
        },
        revisionCreated: false,
      };
    }
    throw new ConflictError({
      updatedAt: current.updated_at,
      wordCount: Number(current.word_count),
    });
  }

  let nextVolumeId = current.volume_id;
  let nextSort = Number(current.sort ?? 0);
  if (input.volumeId !== undefined) {
    const volumeId = str(input.volumeId);
    if (!volumeId) throw new AppError(400, "invalid", "所属卷不正确");
    const volume = getDb()
      .prepare("SELECT id FROM volumes WHERE id = ? AND work_id = ?")
      .get(volumeId, current.work_id);
    if (!volume) throw new AppError(400, "invalid", "卷不属于该作品");
    if (volumeId !== current.volume_id) {
      const sortRow = getDb()
        .prepare("SELECT COALESCE(MAX(sort), 0) AS max_sort FROM chapters WHERE volume_id = ?")
        .get(volumeId) as { max_sort: number };
      nextVolumeId = volumeId;
      nextSort = Number(sortRow.max_sort) + 1000;
    }
  }

  const contentChanged = nextContent !== current.content;
  const titleChanged = nextTitle !== current.title;
  const statusChanged = nextStatus !== current.status;
  const moved = nextVolumeId !== current.volume_id;

  if (!contentChanged && !titleChanged && !statusChanged && !moved) {
    return {
      chapter: {
        id: chapterId,
        updatedAt: current.updated_at,
        wordCount: Number(current.word_count),
      },
      revisionCreated: false,
    };
  }

  const nextWordCount = contentChanged ? countWords(nextContent) : Number(current.word_count);
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const delta = contentChanged ? Math.max(0, nextWordCount - Number(current.word_count)) : 0;
  const manualSnapshot = input.manualSnapshot === true;
  let revisionCreated = false;

  transaction(() => {
    const db = getDb();
    db.prepare(
      `UPDATE chapters
       SET title = ?, content = ?, status = ?, volume_id = ?, sort = ?, word_count = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      nextTitle,
      nextContent,
      nextStatus,
      nextVolumeId,
      nextSort,
      nextWordCount,
      now,
      chapterId,
    );
    db.prepare("UPDATE works SET updated_at = ? WHERE id = ?").run(now, current.work_id);
    insertDailyDelta(current.author_id, delta, now);

    if (contentChanged && (manualSnapshot || shouldAutoSnapshot(chapterId, nowDate))) {
      snapshotChapter(chapterId, nextContent, nextWordCount, manualSnapshot ? "manual" : "auto", now);
      revisionCreated = true;
    }
  });

  return {
    chapter: { id: chapterId, updatedAt: now, wordCount: nextWordCount },
    revisionCreated,
  };
}

export function deleteChapter(chapterId: string): { workId: string } {
  const current = getChapterRow(chapterId);
  const now = new Date().toISOString();
  const db = getDb();
  transaction(() => {
    db.prepare("UPDATE chapters SET deleted_at = ?, updated_at = ? WHERE id = ?").run(
      now,
      now,
      chapterId,
    );
    db.prepare("UPDATE works SET updated_at = ? WHERE id = ?").run(now, current.work_id);
  });
  return { workId: current.work_id };
}

export function createManualSnapshot(chapterId: string): { createdAt: string } {
  const chapter = getChapterRow(chapterId);
  const now = new Date().toISOString();
  transaction(() => {
    snapshotChapter(
      chapterId,
      chapter.content,
      Number(chapter.word_count),
      "manual",
      now,
    );
  });
  return { createdAt: now };
}

export function restoreRevision(chapterId: string, revisionId: string): SaveChapterResult {
  const db = getDb();
  const chapter = getChapterRow(chapterId);
  const revision = db
    .prepare("SELECT * FROM revisions WHERE id = ? AND chapter_id = ?")
    .get(revisionId, chapterId) as Row | undefined;
  if (!revision) {
    throw new AppError(404, "not_found", "版本不存在");
  }

  const content = String(revision.content);
  const wordCount = countWords(content);
  const delta = Math.max(0, wordCount - Number(chapter.word_count));
  const now = new Date().toISOString();

  transaction(() => {
    snapshotChapter(
      chapterId,
      chapter.content,
      Number(chapter.word_count),
      "before_restore",
      now,
    );
    db.prepare(
      "UPDATE chapters SET content = ?, word_count = ?, updated_at = ? WHERE id = ?",
    ).run(content, wordCount, now, chapterId);
    db.prepare("UPDATE works SET updated_at = ? WHERE id = ?").run(now, chapter.work_id);
    insertDailyDelta(chapter.author_id, delta, now);
  });

  return {
    chapter: { id: chapterId, updatedAt: now, wordCount },
    revisionCreated: true,
  };
}

function normalizeStoryColor(value: unknown, fallback: string): string {
  const raw = str(value);
  if (!raw) return fallback;
  if (!/^#[0-9A-Fa-f]{6}$/.test(raw)) {
    throw new AppError(400, "invalid", "设定识别色不正确");
  }
  return raw.toUpperCase();
}

function normalizeStoryType(value: unknown): StoryEntityType | null {
  return typeof value === "string" && STORY_ENTITY_TYPES.includes(value as StoryEntityType)
    ? (value as StoryEntityType)
    : null;
}

export interface StoryEntityInput {
  type?: unknown;
  name?: unknown;
  subtitle?: unknown;
  summary?: unknown;
  description?: unknown;
  color?: unknown;
}

interface StoryEntityRow extends Row {
  id: string;
  work_id: string;
  type: StoryEntityType;
}

function getStoryEntityRow(entityId: string): StoryEntityRow {
  const row = getDb()
    .prepare(
      `SELECT e.* FROM story_entities e
       JOIN works w ON w.id = e.work_id
       WHERE e.id = ? AND w.deleted_at IS NULL`,
    )
    .get(entityId) as StoryEntityRow | undefined;
  if (!row) throw new AppError(404, "not_found", "这条设定不存在或已删除");
  return row;
}

function requireActiveWork(workId: string): void {
  const work = getDb()
    .prepare("SELECT id FROM works WHERE id = ? AND deleted_at IS NULL")
    .get(workId);
  if (!work) throw new AppError(404, "not_found", "作品不存在");
}

export function createStoryEntity(
  workId: string,
  input: StoryEntityInput,
): { entityId: string } {
  requireActiveWork(workId);
  const type = normalizeStoryType(input.type);
  if (!type) throw new AppError(400, "invalid", "设定类型不正确");
  const name = requireTitle(input.name, "设定名称", 60);
  const subtitle = str(input.subtitle)?.trim().slice(0, 80) ?? "";
  const summary = str(input.summary)?.trim().slice(0, 300) ?? "";
  const description = str(input.description)?.trim().slice(0, 6000) ?? "";
  const color = normalizeStoryColor(input.color, DEFAULT_STORY_ENTITY_COLOR);
  const db = getDb();
  const sortRow = db
    .prepare("SELECT COALESCE(MAX(sort), 0) AS max_sort FROM story_entities WHERE work_id = ?")
    .get(workId) as { max_sort: number };
  const entityId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO story_entities
      (id, work_id, type, name, subtitle, summary, description, color, sort, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entityId,
    workId,
    type,
    name,
    subtitle,
    summary,
    description,
    color,
    Number(sortRow.max_sort) + 1000,
    now,
    now,
  );

  return { entityId };
}

export function updateStoryEntity(entityId: string, input: StoryEntityInput): { workId: string } {
  const current = getStoryEntityRow(entityId);
  const type =
    input.type === undefined ? current.type : normalizeStoryType(input.type);
  if (!type) throw new AppError(400, "invalid", "设定类型不正确");
  const name =
    input.name === undefined
      ? String(current.name)
      : requireTitle(input.name, "设定名称", 60);
  const subtitle =
    input.subtitle === undefined
      ? String(current.subtitle)
      : (str(input.subtitle)?.trim().slice(0, 80) ?? "");
  const summary =
    input.summary === undefined
      ? String(current.summary)
      : (str(input.summary)?.trim().slice(0, 300) ?? "");
  const description =
    input.description === undefined
      ? String(current.description)
      : (str(input.description)?.trim().slice(0, 6000) ?? "");
  const color = normalizeStoryColor(input.color, String(current.color));
  const now = new Date().toISOString();

  getDb()
    .prepare(
      `UPDATE story_entities
       SET type = ?, name = ?, subtitle = ?, summary = ?, description = ?,
           color = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(type, name, subtitle, summary, description, color, now, entityId);

  return { workId: current.work_id };
}

export function deleteStoryEntity(entityId: string): { workId: string } {
  const current = getStoryEntityRow(entityId);
  getDb().prepare("DELETE FROM story_entities WHERE id = ?").run(entityId);
  return { workId: current.work_id };
}

export function updateUser(name: unknown): void {
  const raw = str(name);
  if (!raw || !raw.trim()) {
    throw new AppError(400, "invalid", "笔名不能为空");
  }
  const trimmed = raw.trim().slice(0, 24);
  getDb()
    .prepare("UPDATE users SET name = ? WHERE id = ?")
    .run(trimmed, LOCAL_USER_ID);
}

export const COVER_COLOR_VALUES = COVER_COLORS.map((color) => color.value);
