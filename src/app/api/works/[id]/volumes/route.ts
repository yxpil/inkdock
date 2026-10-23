// Author: yxpil

import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { readJson, routeError } from "@/lib/http";
import { createVolume } from "@/lib/mutations";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = await readJson(request);
    const result = createVolume(id, body, user.id);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
