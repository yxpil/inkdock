// Author: yxpil

import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { readJson, routeError } from "@/lib/http";
import { createWork } from "@/lib/mutations";
import { listWorks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json({ ok: true, works: listWorks(user.id) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJson(request);
    const result = createWork(body, user.id);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
