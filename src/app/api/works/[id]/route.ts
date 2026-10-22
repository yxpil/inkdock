// Author: yxpil

import { NextResponse } from "next/server";
import { readJson, routeError } from "@/lib/http";
import { archiveWork, updateWork } from "@/lib/mutations";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await readJson(request);
    updateWork(id, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    archiveWork(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
