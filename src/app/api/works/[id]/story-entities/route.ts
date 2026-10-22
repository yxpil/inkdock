// Author: yxpil

import { NextResponse } from "next/server";
import { readJson, routeError } from "@/lib/http";
import { createStoryEntity } from "@/lib/mutations";
import { getStoryEntity, listStoryEntities } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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
    const { id } = await params;
    const body = await readJson(request);
    const { entityId } = createStoryEntity(id, body);
    return NextResponse.json(
      { ok: true, entity: getStoryEntity(entityId) },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
