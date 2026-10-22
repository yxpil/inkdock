// Author: yxpil

import { NextResponse } from "next/server";
import { AppError, ConflictError } from "./mutations";

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError(400, "invalid_json", "请求内容不是有效的 JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError(400, "invalid_json", "请求内容格式不正确");
  }
  return body as Record<string, unknown>;
}

export function routeError(error: unknown): NextResponse {
  if (error instanceof ConflictError) {
    return NextResponse.json(
      {
        ok: false,
        code: error.code,
        error: error.message,
        current: error.current,
      },
      { status: error.status },
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json(
      { ok: false, code: error.code, error: error.message },
      { status: error.status },
    );
  }
  console.error("[api]", error instanceof Error ? error.message : "unknown error");
  return NextResponse.json(
    { ok: false, code: "internal", error: "服务器遇到问题，请稍后重试。" },
    { status: 500 },
  );
}
