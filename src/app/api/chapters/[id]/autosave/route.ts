// Author: yxpil

import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { readJson, routeError } from "@/lib/http";
import { updateChapter } from "@/lib/mutations";

export const dynamic = "force-dynamic";

/**
 * Emergency save target for navigator.sendBeacon. It deliberately skips the
 * optimistic lock: the local draft only uses it when the page is going away.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = await readJson(request);
    const result = updateChapter(
      id,
      {
        title: body.title,
        content: body.content,
        status: body.status,
      },
      user.id,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return routeError(error);
  }
}
