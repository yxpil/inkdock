// Author: yxpil

import { NextResponse } from "next/server";
import { readJson, routeError } from "@/lib/http";
import { updateUser } from "@/lib/mutations";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const body = await readJson(request);
    updateUser(body.name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
