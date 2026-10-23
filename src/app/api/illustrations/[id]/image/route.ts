// Author: yxpil

import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { routeError } from "@/lib/http";
import { getIllustrationImage } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const image = getIllustrationImage(id, user.id);
    if (!image) {
      return NextResponse.json(
        { ok: false, code: "not_found", error: "插画不存在或已删除" },
        { status: 404 },
      );
    }
    return new NextResponse(new Blob([image.data], { type: image.mime }), {
      headers: {
        "Content-Type": image.mime,
        "Content-Length": String(image.data.byteLength),
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
