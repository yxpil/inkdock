// Author: yxpil

import { getDb } from "./db";
import {
  ASSIGNABLE_WORK_ROLES,
  CHAPTER_STATUSES,
  COVER_COLORS,
  DEFAULT_COVER_COLOR,
  DEFAULT_STORY_ENTITY_COLOR,
  GENRES,
  STORY_ENTITY_TYPES,
  WORK_STATUSES,
} from "./constants";
import { chapterWorkRole, hasWorkRole, workRoleFor } from "./permissions";
import { countWords } from "./words";
import { dayKey } from "./utils";
import type {
  ChapterStatus,
  SaveChapterResult,
  StoryEntityType,
  WorkRole,
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

function hasImageSignature(mime: string, buffer: Buffer): boolean {
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
  if (!hasImageSignature(mime, buffer)) {
    throw new AppError(400, "invalid_cover", "封面文件内容与格式不符");
  }
  return raw;
}

const ILLUSTRATION_DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_ILLUSTRATION_DATA_URL = 1_600_000;
const MAX_ILLUSTRATION_BYTES = 1_150_000;
const MAX_ILLUSTRATION_CAPTION = 120;

function normalizeIllustrationParagraph(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = num(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed < 0 || parsed > 10_000) {
    throw new AppError(400, "invalid", "插画位置不正确");
  }
  return parsed;
}

function normalizeIllustrationCaption(value: unknown, fallback = ""): string {
  const raw = str(value);
  if (raw === null) return fallback;
  return raw.trim().slice(0, MAX_ILLUSTRATION_CAPTION);
}

function normalizeIllustrationImage(value: unknown): { mime: string; data: Buffer } {
  const raw = str(value);
  if (!raw) {
    throw new AppError(400, "invalid_illustration", "请选择要插入的图片");
  }
  if (raw.length > MAX_ILLUSTRATION_DATA_URL) {
    throw new AppError(413, "illustration_too_large", "插画文件过大，请选择更小的图片");
  }
  const match = ILLUSTRATION_DATA_URL.exec(raw);
  if (!match) {
    throw new AppError(400, "invalid_illustration", "插画只支持 JPG、PNG 或 WebP 图片");
  }
  const data = Buffer.from(match[2], "base64");
  if (data.length === 0 || data.length > MAX_ILLUSTRATION_BYTES) {
    throw new AppError(413, "illustration_too_large", "插画文件需小于 1.1 MB");
  }
  if (!hasImageSignature(match[1], data)) {
    throw new AppError(400, "invalid_illustration", "插画文件内容与格式不符");
  }
  return { mime: match[1], data };
}

function normalizeIllustrationSize(value: unknown): number {
  const parsed = num(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed < 1 || parsed > 10_000) {
    throw new AppError(400, "invalid_illustration", "插画尺寸信息不正确");
  }
  return parsed;
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

export function requireWorkRole(
  workId: string,
  actorId: string,
  minimum: WorkRole,
): WorkRole {
  const role = workRoleFor(workId, actorId);
  if (!role) {
    throw new AppError(404, "not_found", "作品不存在或无权访问");
  }
  if (!hasWorkRole(role, minimum)) {
    throw new AppError(403, "forbidden", "当前角色没有这项操作权限");
  }
  return role;
}

function requireChapterEditor(chapterId: string, actorId: string): void {
  const access = chapterWorkRole(chapterId, actorId);
  if (!access) {
    throw new AppError(404, "not_found", "章节不存在或无权访问");
  }
  if (!hasWorkRole(access.role, "editor")) {
    throw new AppError(403, "forbidden", "当前角色没有写作权限");
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

function getChapterRow(chapterId: string, actorId: string): ChapterRow {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT c.*, w.author_id
       FROM chapters c
       JOIN works w ON w.id = c.work_id
       JOIN work_members m ON m.work_id = c.work_id AND m.user_id = ?
       WHERE c.id = ? AND c.deleted_at IS NULL AND w.deleted_at IS NULL
         AND m.role IN ('owner', 'editor')`,
    )
    .get(actorId, chapterId) as ChapterRow | undefined;
  if (!row) {
    throw new AppError(404, "not_found", "章节不存在或无权编辑");
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

export function createWork(
  input: CreateWorkInput,
  actorId: string,
): {
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
      actorId,
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
    ).run(crypto.randomUUID(), workId, actorId, now);
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

export function updateWork(
  workId: string,
  input: UpdateWorkInput,
  actorId: string,
): void {
  requireWorkRole(workId, actorId, "editor");
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

export function archiveWork(workId: string, actorId: string): void {
  requireWorkRole(workId, actorId, "owner");
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
  actorId: string,
): { volumeId: string } {
  requireWorkRole(workId, actorId, "editor");
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

export function updateVolume(
  volumeId: string,
  input: UpdateVolumeInput,
  actorId: string,
): void {
  const db = getDb();
  const current = db.prepare("SELECT * FROM volumes WHERE id = ?").get(volumeId) as
    | Row
    | undefined;
  if (!current) throw new AppError(404, "not_found", "卷不存在");
  requireWorkRole(String(current.work_id), actorId, "editor");

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

export function deleteVolume(volumeId: string, actorId: string): void {
  const db = getDb();
  const volume = db.prepare("SELECT * FROM volumes WHERE id = ?").get(volumeId) as
    | Row
    | undefined;
  if (!volume) throw new AppError(404, "not_found", "卷不存在");
  requireWorkRole(String(volume.work_id), actorId, "editor");

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
  actorId: string,
): { chapterId: string } {
  requireWorkRole(workId, actorId, "editor");
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
  actorId: string,
): SaveChapterResult {
  const current = getChapterRow(chapterId, actorId);

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
    insertDailyDelta(actorId, delta, now);

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

export function deleteChapter(
  chapterId: string,
  actorId: string,
): { workId: string } {
  const current = getChapterRow(chapterId, actorId);
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

export function createManualSnapshot(
  chapterId: string,
  actorId: string,
): { createdAt: string } {
  const chapter = getChapterRow(chapterId, actorId);
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

export function restoreRevision(
  chapterId: string,
  revisionId: string,
  actorId: string,
): SaveChapterResult {
  const db = getDb();
  const chapter = getChapterRow(chapterId, actorId);
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
    insertDailyDelta(actorId, delta, now);
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

function getStoryEntityRow(entityId: string, actorId: string): StoryEntityRow {
  const row = getDb()
    .prepare(
      `SELECT e.* FROM story_entities e
       JOIN works w ON w.id = e.work_id
       JOIN work_members m ON m.work_id = w.id AND m.user_id = ?
       WHERE e.id = ? AND w.deleted_at IS NULL
         AND m.role IN ('owner', 'editor')`,
    )
    .get(actorId, entityId) as StoryEntityRow | undefined;
  if (!row) throw new AppError(404, "not_found", "这条设定不存在或无权编辑");
  return row;
}

export function createStoryEntity(
  workId: string,
  input: StoryEntityInput,
  actorId: string,
): { entityId: string } {
  requireWorkRole(workId, actorId, "editor");
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

export function updateStoryEntity(
  entityId: string,
  input: StoryEntityInput,
  actorId: string,
): { workId: string } {
  const current = getStoryEntityRow(entityId, actorId);
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

export function deleteStoryEntity(
  entityId: string,
  actorId: string,
): { workId: string } {
  const current = getStoryEntityRow(entityId, actorId);
  getDb().prepare("DELETE FROM story_entities WHERE id = ?").run(entityId);
  return { workId: current.work_id };
}

export interface IllustrationInput {
  paragraph?: unknown;
  caption?: unknown;
  image?: unknown;
  width?: unknown;
  height?: unknown;
}

interface IllustrationRow extends Row {
  id: string;
  chapter_id: string;
  paragraph: number;
  caption: string;
}

function getIllustrationRow(
  illustrationId: string,
  actorId: string,
): IllustrationRow {
  const row = getDb()
    .prepare(
      `SELECT i.id, i.chapter_id, i.paragraph, i.caption
       FROM chapter_illustrations i
       JOIN chapters c ON c.id = i.chapter_id
       JOIN works w ON w.id = c.work_id
       JOIN work_members m ON m.work_id = w.id AND m.user_id = ?
       WHERE i.id = ? AND c.deleted_at IS NULL AND w.deleted_at IS NULL
         AND m.role IN ('owner', 'editor')`,
    )
    .get(actorId, illustrationId) as IllustrationRow | undefined;
  if (!row) throw new AppError(404, "not_found", "插画不存在或无权编辑");
  return row;
}

export function createIllustration(
  chapterId: string,
  input: IllustrationInput,
  actorId: string,
): { illustrationId: string } {
  getChapterRow(chapterId, actorId);
  const paragraph = normalizeIllustrationParagraph(input.paragraph);
  const caption = normalizeIllustrationCaption(input.caption);
  const image = normalizeIllustrationImage(input.image);
  const width = normalizeIllustrationSize(input.width);
  const height = normalizeIllustrationSize(input.height);
  const illustrationId = crypto.randomUUID();
  const now = new Date().toISOString();

  getDb()
    .prepare(
      `INSERT INTO chapter_illustrations
        (id, chapter_id, paragraph, caption, image_mime, image_data, width, height, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      illustrationId,
      chapterId,
      paragraph,
      caption,
      image.mime,
      image.data,
      width,
      height,
      now,
      now,
    );

  return { illustrationId };
}

export function updateIllustration(
  illustrationId: string,
  input: IllustrationInput,
  actorId: string,
): { chapterId: string } {
  const current = getIllustrationRow(illustrationId, actorId);
  const paragraph =
    input.paragraph === undefined
      ? Number(current.paragraph)
      : normalizeIllustrationParagraph(input.paragraph);
  const caption =
    input.caption === undefined
      ? String(current.caption)
      : normalizeIllustrationCaption(input.caption);

  getDb()
    .prepare(
      "UPDATE chapter_illustrations SET paragraph = ?, caption = ?, updated_at = ? WHERE id = ?",
    )
    .run(paragraph, caption, new Date().toISOString(), illustrationId);

  return { chapterId: current.chapter_id };
}

export function deleteIllustration(
  illustrationId: string,
  actorId: string,
): { chapterId: string } {
  const current = getIllustrationRow(illustrationId, actorId);
  getDb().prepare("DELETE FROM chapter_illustrations WHERE id = ?").run(illustrationId);
  return { chapterId: current.chapter_id };
}

export function updateUser(actorId: string, name: unknown): void {
  const raw = str(name);
  if (!raw || !raw.trim()) {
    throw new AppError(400, "invalid", "笔名不能为空");
  }
  const trimmed = raw.trim().slice(0, 24);
  getDb()
    .prepare("UPDATE users SET name = ? WHERE id = ?")
    .run(trimmed, actorId);
}

function normalizeMemberRole(value: unknown): WorkRole {
  const raw = typeof value === "string" ? value : "";
  if (!ASSIGNABLE_WORK_ROLES.includes(raw as WorkRole)) {
    throw new AppError(400, "invalid_role", "成员角色不正确");
  }
  return raw as WorkRole;
}

function requireWorkAuthor(workId: string): string {
  const work = getDb()
    .prepare("SELECT author_id FROM works WHERE id = ? AND deleted_at IS NULL")
    .get(workId) as { author_id: string } | undefined;
  if (!work) throw new AppError(404, "not_found", "作品不存在");
  return work.author_id;
}

export interface WorkMemberInput {
  handle?: unknown;
  role?: unknown;
}

export function addWorkMember(
  workId: string,
  input: WorkMemberInput,
  actorId: string,
): { userId: string } {
  requireWorkRole(workId, actorId, "owner");
  const handle =
    typeof input.handle === "string"
      ? input.handle.trim().replace(/^@/, "").toLowerCase()
      : "";
  if (!handle) {
    throw new AppError(400, "invalid_handle", "请输入对方的账号");
  }
  const role = normalizeMemberRole(input.role);
  const authorId = requireWorkAuthor(workId);
  const db = getDb();
  const userRow = db
    .prepare("SELECT id FROM users WHERE handle = ?")
    .get(handle) as { id: string } | undefined;
  if (!userRow) {
    throw new AppError(404, "user_not_found", "找不到这个账号，请确认对方已注册");
  }
  if (userRow.id === authorId) {
    throw new AppError(400, "already_owner", "作者已经是所有者");
  }
  const existing = db
    .prepare("SELECT id FROM work_members WHERE work_id = ? AND user_id = ?")
    .get(workId, userRow.id);
  if (existing) {
    throw new AppError(409, "already_member", "该账号已在协作成员中");
  }
  db.prepare(
    `INSERT INTO work_members (id, work_id, user_id, role, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), workId, userRow.id, role, new Date().toISOString());
  return { userId: userRow.id };
}

export function updateWorkMemberRole(
  workId: string,
  targetUserId: string,
  roleInput: unknown,
  actorId: string,
): void {
  requireWorkRole(workId, actorId, "owner");
  const role = normalizeMemberRole(roleInput);
  const authorId = requireWorkAuthor(workId);
  if (targetUserId === authorId) {
    throw new AppError(400, "owner_locked", "作者的所有者角色不能修改");
  }
  const result = getDb()
    .prepare("UPDATE work_members SET role = ? WHERE work_id = ? AND user_id = ?")
    .run(role, workId, targetUserId);
  if (Number(result.changes) === 0) {
    throw new AppError(404, "not_found", "该成员不在协作列表中");
  }
}

export function removeWorkMember(
  workId: string,
  targetUserId: string,
  actorId: string,
): void {
  requireWorkRole(workId, actorId, "owner");
  const authorId = requireWorkAuthor(workId);
  if (targetUserId === authorId) {
    throw new AppError(400, "owner_locked", "不能移除作品作者");
  }
  const result = getDb()
    .prepare("DELETE FROM work_members WHERE work_id = ? AND user_id = ?")
    .run(workId, targetUserId);
  if (Number(result.changes) === 0) {
    throw new AppError(404, "not_found", "该成员不在协作列表中");
  }
}

const MAX_ARCHIVE_VOLUMES = 200;
const MAX_ARCHIVE_CHAPTERS = 5000;
const MAX_ARCHIVE_ILLUSTRATIONS = 600;
const MAX_ARCHIVE_ENTITIES = 2000;

interface ImportedIllustration {
  paragraph: number;
  caption: string;
  mime: string;
  data: Buffer;
  width: number;
  height: number;
}

interface ImportedChapter {
  title: string;
  status: ChapterStatus;
  content: string;
  illustrations: ImportedIllustration[];
}

interface ImportedVolume {
  title: string;
  summary: string;
  chapters: ImportedChapter[];
}

interface ImportedEntity {
  type: StoryEntityType;
  name: string;
  subtitle: string;
  summary: string;
  description: string;
  color: string;
}

interface ImportedWork {
  title: string;
  subtitle: string;
  description: string;
  genre: string;
  status: WorkStatus;
  coverColor: string;
  coverImage: string | null;
  targetWords: number;
}

function archiveRecord(value: unknown, message: string): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(400, "invalid_archive", message);
  }
  return value as Row;
}

function archiveList(value: unknown, message: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new AppError(400, "invalid_archive", message);
  }
  return value;
}

function parseArchiveIllustration(value: unknown): ImportedIllustration {
  const record = archiveRecord(value, "插画数据格式不正确");
  const mime = str(record.mime);
  if (mime !== "jpeg" && mime !== "png" && mime !== "webp") {
    throw new AppError(400, "invalid_archive", "插画格式只支持 JPG、PNG 或 WebP");
  }
  const data = str(record.data);
  if (!data) {
    throw new AppError(400, "invalid_archive", "插画缺少图片数据");
  }
  const image = normalizeIllustrationImage(`data:image/${mime};base64,${data}`);
  return {
    paragraph: normalizeIllustrationParagraph(record.paragraph),
    caption: normalizeIllustrationCaption(record.caption),
    mime: image.mime,
    data: image.data,
    width: normalizeIllustrationSize(record.width),
    height: normalizeIllustrationSize(record.height),
  };
}

export function importWork(input: unknown, actorId: string): {
  workId: string;
  chapterCount: number;
  illustrationCount: number;
} {
  const archive = archiveRecord(input, "备份文件格式不正确");
  if (archive.app !== "inkdock" || archive.version !== 1) {
    throw new AppError(400, "invalid_archive", "这不是墨坞支持的整书备份文件");
  }
  const workRecord = archiveRecord(archive.work, "备份缺少作品信息");
  const status = normalizeStatus(workRecord.status);
  if (!status) {
    throw new AppError(400, "invalid_archive", "作品状态不正确");
  }
  const work: ImportedWork = {
    title: requireTitle(workRecord.title, "书名", 60),
    subtitle: str(workRecord.subtitle)?.trim().slice(0, 120) ?? "",
    description: str(workRecord.description)?.trim().slice(0, 2000) ?? "",
    genre: normalizeGenre(workRecord.genre),
    status,
    coverColor: normalizeColor(workRecord.coverColor),
    coverImage: normalizeCoverImage(workRecord.coverImage),
    targetWords: normalizeTargetWords(workRecord.targetWords, 0),
  };

  const volumeRecords = archiveList(archive.volumes, "备份缺少卷列表");
  if (volumeRecords.length > MAX_ARCHIVE_VOLUMES) {
    throw new AppError(413, "archive_too_large", "单次最多导入 200 卷");
  }

  let chapterCount = 0;
  let illustrationCount = 0;
  const volumes: ImportedVolume[] = volumeRecords.map((value, volumeIndex) => {
    const record = archiveRecord(value, `第 ${volumeIndex + 1} 卷格式不正确`);
    const chapterRecords = archiveList(
      record.chapters,
      `第 ${volumeIndex + 1} 卷的章节列表不正确`,
    );
    chapterCount += chapterRecords.length;
    const chapters = chapterRecords.map((chapterValue, chapterIndex) => {
      const chapter = archiveRecord(
        chapterValue,
        `第 ${volumeIndex + 1} 卷第 ${chapterIndex + 1} 章格式不正确`,
      );
      const status = normalizeChapterStatus(chapter.status);
      if (!status) {
        throw new AppError(
          400,
          "invalid_archive",
          `第 ${volumeIndex + 1} 卷第 ${chapterIndex + 1} 章状态不正确`,
        );
      }
      const illustrationRecords = Array.isArray(chapter.illustrations)
        ? chapter.illustrations
        : [];
      illustrationCount += illustrationRecords.length;
      return {
        title: requireTitle(
          chapter.title,
          `第 ${volumeIndex + 1} 卷第 ${chapterIndex + 1} 章标题`,
          120,
        ),
        status,
        content: normalizeContent(chapter.content ?? ""),
        illustrations: illustrationRecords.map(parseArchiveIllustration),
      };
    });
    return {
      title: requireTitle(record.title, `第 ${volumeIndex + 1} 卷卷名`, 60),
      summary: str(record.summary)?.trim().slice(0, 500) ?? "",
      chapters,
    };
  });

  if (chapterCount > MAX_ARCHIVE_CHAPTERS) {
    throw new AppError(413, "archive_too_large", "单次最多导入 5000 章");
  }
  if (illustrationCount > MAX_ARCHIVE_ILLUSTRATIONS) {
    throw new AppError(413, "archive_too_large", "单次最多导入 600 张插画");
  }

  const entityRecords = Array.isArray(archive.storyEntities)
    ? archive.storyEntities
    : [];
  if (entityRecords.length > MAX_ARCHIVE_ENTITIES) {
    throw new AppError(413, "archive_too_large", "单次最多导入 2000 条故事设定");
  }
  const entities: ImportedEntity[] = entityRecords.map((value) => {
    const record = archiveRecord(value, "故事设定格式不正确");
    const type = normalizeStoryType(record.type);
    if (!type) throw new AppError(400, "invalid_archive", "故事设定类型不正确");
    return {
      type,
      name: requireTitle(record.name, "设定名称", 60),
      subtitle: str(record.subtitle)?.trim().slice(0, 80) ?? "",
      summary: str(record.summary)?.trim().slice(0, 300) ?? "",
      description: str(record.description)?.trim().slice(0, 6000) ?? "",
      color: normalizeStoryColor(record.color, DEFAULT_STORY_ENTITY_COLOR),
    };
  });

  if (volumes.length === 0) {
    volumes.push({ title: "第一卷", summary: "", chapters: [] });
  }
  if (chapterCount === 0) {
    volumes[0].chapters.push({
      title: "第一章",
      status: "draft",
      content: "",
      illustrations: [],
    });
    chapterCount = 1;
  }

  const workId = crypto.randomUUID();
  const now = new Date().toISOString();

  transaction(() => {
    const db = getDb();
    db.prepare(
      `INSERT INTO works
        (id, author_id, title, subtitle, description, genre, tags, status,
         cover_color, cover_image, target_words, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?)`,
    ).run(
      workId,
      actorId,
      work.title,
      work.subtitle,
      work.description,
      work.genre,
      work.status,
      work.coverColor,
      work.coverImage,
      work.targetWords,
      now,
      now,
    );
    db.prepare(
      `INSERT INTO work_members (id, work_id, user_id, role, created_at)
       VALUES (?, ?, ?, 'owner', ?)`,
    ).run(crypto.randomUUID(), workId, actorId, now);

    const insertVolume = db.prepare(
      `INSERT INTO volumes (id, work_id, title, summary, sort, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertChapter = db.prepare(
      `INSERT INTO chapters
        (id, work_id, volume_id, title, content, status, sort, word_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertIllustration = db.prepare(
      `INSERT INTO chapter_illustrations
        (id, chapter_id, paragraph, caption, image_mime, image_data, width, height, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertEntity = db.prepare(
      `INSERT INTO story_entities
        (id, work_id, type, name, subtitle, summary, description, color, sort, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    volumes.forEach((volume, volumeIndex) => {
      const volumeId = crypto.randomUUID();
      insertVolume.run(
        volumeId,
        workId,
        volume.title,
        volume.summary,
        (volumeIndex + 1) * 1000,
        now,
        now,
      );
      volume.chapters.forEach((chapter, chapterIndex) => {
        const chapterId = crypto.randomUUID();
        insertChapter.run(
          chapterId,
          workId,
          volumeId,
          chapter.title,
          chapter.content,
          chapter.status,
          (chapterIndex + 1) * 1000,
          countWords(chapter.content),
          now,
          now,
        );
        for (const illustration of chapter.illustrations) {
          insertIllustration.run(
            crypto.randomUUID(),
            chapterId,
            illustration.paragraph,
            illustration.caption,
            illustration.mime,
            illustration.data,
            illustration.width,
            illustration.height,
            now,
            now,
          );
        }
      });
    });

    entities.forEach((entity, index) => {
      insertEntity.run(
        crypto.randomUUID(),
        workId,
        entity.type,
        entity.name,
        entity.subtitle,
        entity.summary,
        entity.description,
        entity.color,
        (index + 1) * 1000,
        now,
        now,
      );
    });
  });

  return { workId, chapterCount, illustrationCount };
}

export const COVER_COLOR_VALUES = COVER_COLORS.map((color) => color.value);
