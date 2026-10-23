// Author: yxpil

import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { readJson, routeError } from "@/lib/http";
import { AppError, createManualSnapshot, restoreRevision } from "@/lib/mutations";
import { listRevisions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    return NextResponse.json({
      ok: true,
      revisions: listRevisions(id, user.id),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = await readJson(request);
    const action = body.action;

    if (action === "restore") {
      const revisionId = typeof body.revisionId === "string" ? body.revisionId : "";
      if (!revisionId) {
        throw new AppError(400, "invalid", "缺少要恢复的版本");
      }
      const result = restoreRevision(id, revisionId, user.id);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "snapshot" || action === undefined) {
      const result = createManualSnapshot(id, user.id);
      return NextResponse.json({ ok: true, ...result }, { status: 201 });
    }

    throw new AppError(400, "invalid", "未知的版本操作");
  } catch (error) {
    return routeError(error);
  }
}
