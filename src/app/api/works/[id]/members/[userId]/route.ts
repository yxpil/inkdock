// Author: yxpil

import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { readJson, routeError } from "@/lib/http";
import { removeWorkMember, updateWorkMemberRole } from "@/lib/mutations";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id, userId } = await params;
    const body = await readJson(request);
    updateWorkMemberRole(id, userId, body.role, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id, userId } = await params;
    removeWorkMember(id, userId, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
