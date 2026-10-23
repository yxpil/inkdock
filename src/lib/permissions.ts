// Author: yxpil

import { getDb } from "./db";
import type { WorkRole } from "./types";

const ROLE_RANK: Record<WorkRole, number> = {
  owner: 3,
  editor: 2,
  commenter: 1,
  reader: 0,
};

export function hasWorkRole(role: WorkRole, minimum: WorkRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function workRoleFor(workId: string, userId: string): WorkRole | null {
  const row = getDb()
    .prepare(
      `SELECT m.role
       FROM work_members m JOIN works w ON w.id = m.work_id
       WHERE m.work_id = ? AND m.user_id = ? AND w.deleted_at IS NULL`,
    )
    .get(workId, userId) as { role: string } | undefined;
  return row ? (row.role as WorkRole) : null;
}

export function chapterWorkRole(
  chapterId: string,
  userId: string,
): { workId: string; role: WorkRole } | null {
  const row = getDb()
    .prepare(
      `SELECT c.work_id, m.role
       FROM chapters c
       JOIN works w ON w.id = c.work_id
       JOIN work_members m ON m.work_id = c.work_id AND m.user_id = ?
       WHERE c.id = ? AND c.deleted_at IS NULL AND w.deleted_at IS NULL`,
    )
    .get(userId, chapterId) as { work_id: string; role: string } | undefined;
  return row ? { workId: row.work_id, role: row.role as WorkRole } : null;
}
