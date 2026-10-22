// Author: yxpil

import { NextResponse } from "next/server";
import { routeError } from "@/lib/http";
import { getWorkForExport } from "@/lib/queries";
import { safeFileName } from "@/lib/utils";

export const dynamic = "force-dynamic";

function buildTxt(work: NonNullable<ReturnType<typeof getWorkForExport>>): string {
  const lines: string[] = [];
  lines.push(`《${work.title}》`);
  if (work.subtitle) lines.push(work.subtitle);
  lines.push(`作者：${work.authorName}`);
  lines.push(`题材：${work.genre}`);
  if (work.description) {
    lines.push("", "简介", work.description);
  }

  for (const volume of work.volumes) {
    lines.push("", "", `== ${volume.title} ==`);
    for (const chapter of volume.chapters) {
      lines.push("", chapter.title, "");
      lines.push(chapter.content);
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

function buildMarkdown(work: NonNullable<ReturnType<typeof getWorkForExport>>): string {
  const lines: string[] = [];
  lines.push(`# ${work.title}`);
  if (work.subtitle) lines.push("", `> ${work.subtitle}`);
  lines.push("", `作者：${work.authorName}`, `题材：${work.genre}`);
  if (work.description) {
    lines.push("", "## 简介", "", work.description);
  }

  for (const volume of work.volumes) {
    lines.push("", `## ${volume.title}`);
    for (const chapter of volume.chapters) {
      lines.push("", `### ${chapter.title}`, "", chapter.content);
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const work = getWorkForExport(id);
    if (!work) {
      return NextResponse.json(
        { ok: false, code: "not_found", error: "作品不存在" },
        { status: 404 },
      );
    }

    const url = new URL(request.url);
    const format = url.searchParams.get("format") === "md" ? "md" : "txt";
    const body = format === "md" ? buildMarkdown(work) : buildTxt(work);
    const fileName = `${safeFileName(work.title)}.${format}`;
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");

    return new NextResponse(body, {
      headers: {
        "Content-Type": format === "md" ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
