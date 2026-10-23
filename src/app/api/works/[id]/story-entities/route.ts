// Author: yxpil

import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { readJson, routeError } from "@/lib/http";
import { AppError, createStoryEntity } from "@/lib/mutations";
import { getStoryEntity, listStoryEntities } from "@/lib/queries";
import { workRoleFor } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    if (!workRoleFor(id, user.id)) {
      throw new AppError(404, "not_found", "作品不存在或无权访问");
    }
    return NextResponse.json({ ok: true, entities: listStoryEntities(id) });
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
    const { entityId } = createStoryEntity(id, body, user.id);
    return NextResponse.json(
      { ok: true, entity: getStoryEntity(entityId, user.id) },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
