// Author: yxpil

import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { readJson, routeError } from "@/lib/http";
import { createIllustration } from "@/lib/mutations";
import { getIllustration } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = await readJson(request);
    const { illustrationId } = createIllustration(id, body, user.id);
    return NextResponse.json(
      { ok: true, illustration: getIllustration(illustrationId, user.id) },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
