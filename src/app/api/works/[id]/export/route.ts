// Author: yxpil

import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { buildWebPage } from "@/lib/export-html";
import { routeError } from "@/lib/http";
import { getWorkArchive, getWorkForExport, type WorkExport } from "@/lib/queries";
import { safeFileName } from "@/lib/utils";

export const dynamic = "force-dynamic";

function buildTxt(work: WorkExport): string {
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

function buildMarkdown(work: WorkExport): string {
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
    const user = await requireApiUser();
    const { id } = await params;
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "txt";

    if (format === "json") {
      const archive = getWorkArchive(id, user.id);
      if (!archive) {
        return NextResponse.json(
          { ok: false, code: "not_found", error: "作品不存在" },
          { status: 404 },
        );
      }
      const body = JSON.stringify(archive, null, 2);
      const fileName = `${safeFileName(archive.work.title)}.inkdock.json`;
      const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");
      return new NextResponse(body, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          "Cache-Control": "no-store",
        },
      });
    }

    const work = getWorkForExport(id, user.id);
    if (!work) {
      return NextResponse.json(
        { ok: false, code: "not_found", error: "作品不存在" },
        { status: 404 },
      );
    }

    if (format === "html") {
      const archive = getWorkArchive(id, user.id);
      if (!archive) {
        return NextResponse.json(
          { ok: false, code: "not_found", error: "作品不存在" },
          { status: 404 },
        );
      }
      const fileName = `${safeFileName(archive.work.title)}.html`;
      const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");
      return new NextResponse(buildWebPage(archive), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          "Cache-Control": "no-store",
          "Content-Security-Policy":
            "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const exportFormat = format === "md" ? "md" : "txt";
    const body = exportFormat === "md" ? buildMarkdown(work) : buildTxt(work);
    const fileName = `${safeFileName(work.title)}.${exportFormat}`;
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");

    return new NextResponse(body, {
      headers: {
        "Content-Type":
          exportFormat === "md"
            ? "text/markdown; charset=utf-8"
            : "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
