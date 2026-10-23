// Author: yxpil

import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeError } from "@/lib/http";
import { AppError, importWork } from "@/lib/mutations";

export const dynamic = "force-dynamic";

const MAX_IMPORT_CHARS = 120_000_000;

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const raw = await request.text();
    if (!raw.trim()) {
      throw new AppError(400, "invalid_archive", "备份文件是空的");
    }
    if (raw.length > MAX_IMPORT_CHARS) {
      throw new AppError(413, "archive_too_large", "备份文件超过 120 MB，请拆分后再导入");
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AppError(400, "invalid_json", "备份文件不是有效的 JSON");
    }
    const result = importWork(body, user.id);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
