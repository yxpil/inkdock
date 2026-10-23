// Author: yxpil

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { AVATAR_COLORS } from "./constants";
import { getDb, LOCAL_USER_ID } from "./db";
import { AppError } from "./mutations";
import { countRegisteredUsers, getUserByHandle, mapUser } from "./queries";
import type { User } from "./types";

const SESSION_COOKIE = "ink_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SCRYPT_KEY_LENGTH = 64;
const HANDLE_PATTERN = /^[a-z0-9_]{3,24}$/;

type Row = Record<string, unknown>;

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

export function normalizeHandle(value: unknown): string {
  const raw =
    typeof value === "string"
      ? value.trim().replace(/^@/, "").toLowerCase()
      : "";
  if (!HANDLE_PATTERN.test(raw)) {
    throw new AppError(400, "invalid_handle", "账号需为 3-24 位小写字母、数字或下划线");
  }
  return raw;
}

export function normalizePassword(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  if (raw.length < 8) {
    throw new AppError(400, "invalid_password", "密码至少需要 8 位");
  }
  if (raw.length > 128) {
    throw new AppError(400, "invalid_password", "密码不能超过 128 位");
  }
  return raw;
}

function normalizeName(value: unknown, handle: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const name = raw || handle;
  if (name.length > 24) {
    throw new AppError(400, "invalid_name", "笔名不能超过 24 个字符");
  }
  return name;
}

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return { hash, salt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!hash || !salt) return false;
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== SCRYPT_KEY_LENGTH) return false;
  const actual = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return timingSafeEqual(expected, actual);
}

function avatarColorFor(handle: string): string {
  let hash = 0;
  for (let index = 0; index < handle.length; index += 1) {
    hash = (hash * 31 + handle.charCodeAt(index)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(userId: string): {
  token: string;
  expiresAt: string;
} {
  const db = getDb();
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now.toISOString());
  db.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  ).run(hashSessionToken(token), userId, now.toISOString(), expiresAt);
  return { token, expiresAt };
}

export function destroySession(token: string): void {
  getDb()
    .prepare("DELETE FROM sessions WHERE id = ?")
    .run(hashSessionToken(token));
}

export async function setSessionCookie(
  token: string,
  expiresAt: string,
): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export const getSessionUser = cache(async (): Promise<User | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .get(hashSessionToken(token), new Date().toISOString()) as Row | undefined;
  return row ? mapUser(row) : null;
});

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireApiUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    throw new AppError(401, "unauthorized", "登录已过期，请重新登录");
  }
  return user;
}

export function registerUser(input: {
  handle?: unknown;
  password?: unknown;
  name?: unknown;
}): User {
  const handle = normalizeHandle(input.handle);
  const password = normalizePassword(input.password);
  const name = normalizeName(input.name, handle);
  const db = getDb();
  if (getUserByHandle(handle)) {
    throw new AppError(409, "handle_taken", "这个账号已被使用");
  }

  const now = new Date().toISOString();
  const user: User = {
    id: crypto.randomUUID(),
    name,
    handle,
    avatarColor: avatarColorFor(handle),
    createdAt: now,
  };
  const { hash, salt } = hashPassword(password);
  const firstAccount = countRegisteredUsers() === 0;
  const legacyRow = db
    .prepare("SELECT id FROM users WHERE id = ?")
    .get(LOCAL_USER_ID);

  transaction(() => {
    db.prepare(
      `INSERT INTO users
        (id, name, handle, avatar_color, password_hash, password_salt, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(user.id, user.name, user.handle, user.avatarColor, hash, salt, now);

    // The demo workspace is seeded without a password; the first real account claims it.
    if (firstAccount && legacyRow) {
      db.prepare("UPDATE works SET author_id = ? WHERE author_id = ?").run(
        user.id,
        LOCAL_USER_ID,
      );
      db.prepare("UPDATE work_members SET user_id = ? WHERE user_id = ?").run(
        user.id,
        LOCAL_USER_ID,
      );
      db.prepare("UPDATE daily_stats SET user_id = ? WHERE user_id = ?").run(
        user.id,
        LOCAL_USER_ID,
      );
      db.prepare("DELETE FROM users WHERE id = ?").run(LOCAL_USER_ID);
    }
  });

  return user;
}

export function changePassword(
  userId: string,
  sessionToken: string | null,
  input: { currentPassword?: unknown; newPassword?: unknown },
): void {
  const currentPassword =
    typeof input.currentPassword === "string" ? input.currentPassword : "";
  if (!currentPassword) {
    throw new AppError(400, "invalid_password", "请输入当前密码");
  }
  const nextPassword = normalizePassword(input.newPassword);
  if (currentPassword === nextPassword) {
    throw new AppError(400, "invalid_password", "新密码不能与当前密码相同");
  }

  const db = getDb();
  const row = db
    .prepare("SELECT password_hash, password_salt FROM users WHERE id = ?")
    .get(userId) as
    | { password_hash: string | null; password_salt: string | null }
    | undefined;
  if (
    !row ||
    !verifyPassword(
      currentPassword,
      String(row.password_hash ?? ""),
      String(row.password_salt ?? ""),
    )
  ) {
    throw new AppError(400, "invalid_password", "当前密码不正确");
  }

  const { hash, salt } = hashPassword(nextPassword);
  const keepSessionId = sessionToken ? hashSessionToken(sessionToken) : "";
  transaction(() => {
    db.prepare(
      "UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?",
    ).run(hash, salt, userId);
    // Other browsers must re-authenticate after a password change.
    if (keepSessionId) {
      db.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").run(
        userId,
        keepSessionId,
      );
    } else {
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    }
  });
}

export function authenticateUser(input: {
  handle?: unknown;
  password?: unknown;
}): User {
  const handle =
    typeof input.handle === "string"
      ? input.handle.trim().replace(/^@/, "").toLowerCase()
      : "";
  const password = typeof input.password === "string" ? input.password : "";
  const row = getDb()
    .prepare("SELECT * FROM users WHERE handle = ?")
    .get(handle) as Row | undefined;
  if (
    !row ||
    !verifyPassword(
      password,
      String(row.password_hash ?? ""),
      String(row.password_salt ?? ""),
    )
  ) {
    throw new AppError(401, "invalid_credentials", "账号或密码不正确");
  }
  return mapUser(row);
}
