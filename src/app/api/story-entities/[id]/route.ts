// Author: yxpil

import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { readJson, routeError } from "@/lib/http";
import { deleteStoryEntity, updateStoryEntity } from "@/lib/mutations";
import { getStoryEntity } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = await readJson(request);
    updateStoryEntity(id, body, user.id);
    return NextResponse.json({ ok: true, entity: getStoryEntity(id, user.id) });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    deleteStoryEntity(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
