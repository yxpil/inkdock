// Author: yxpil

import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { readJson, routeError } from "@/lib/http";
import { AI_ACTIONS, getAiConfig, requestAiSuggestion, type AiAction } from "@/lib/ai";
import { AppError } from "@/lib/mutations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireApiUser();
    return NextResponse.json({ ok: true, ...getAiConfig() });
  } catch (error) {
    return routeError(error);
  }
}

function isAction(value: unknown): value is AiAction {
  return AI_ACTIONS.some((action) => action.id === value);
}

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const body = await readJson(request);
    if (!isAction(body.action)) {
      throw new AppError(400, "invalid", "未知的 AI 动作");
    }
    const workTitle = typeof body.workTitle === "string" ? body.workTitle.slice(0, 120) : "";
    const genre = typeof body.genre === "string" ? body.genre.slice(0, 20) : "其他";
    const chapterTitle = typeof body.chapterTitle === "string" ? body.chapterTitle.slice(0, 120) : "";
    const content = typeof body.content === "string" ? body.content.slice(0, 2_000_000) : "";
    const instruction =
      typeof body.instruction === "string" ? body.instruction.slice(0, 500) : undefined;

    const text = await requestAiSuggestion({
      action: body.action,
      instruction,
      workTitle,
      genre,
      chapterTitle,
      content,
    });

    return NextResponse.json({ ok: true, text, model: getAiConfig().model });
  } catch (error) {
    return routeError(error);
  }
}
