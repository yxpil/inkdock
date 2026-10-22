// Author: yxpil

import { NextResponse } from "next/server";
import { routeError } from "@/lib/http";
import { readJson } from "@/lib/http";
import { deleteVolume, updateVolume } from "@/lib/mutations";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await readJson(request);
    updateVolume(id, body);
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
    deleteVolume(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
