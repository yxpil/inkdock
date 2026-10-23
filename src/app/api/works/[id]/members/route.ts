// Author: yxpil

import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { readJson, routeError } from "@/lib/http";
import { addWorkMember } from "@/lib/mutations";
import { workRoleFor } from "@/lib/permissions";
import { listWorkMembers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    if (!workRoleFor(id, user.id)) {
      return NextResponse.json(
        { ok: false, code: "not_found", error: "作品不存在或无权访问" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, members: listWorkMembers(id) });
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
    const result = addWorkMember(id, body, user.id);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
