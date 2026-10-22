// Author: yxpil

import { NextResponse } from "next/server";
import { readJson, routeError } from "@/lib/http";
import { createWork } from "@/lib/mutations";
import { listWorks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, works: listWorks() });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const result = createWork(body);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
