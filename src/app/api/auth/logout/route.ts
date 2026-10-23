// Author: yxpil

import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  destroySession,
  getSessionToken,
} from "@/lib/auth";
import { routeError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const token = await getSessionToken();
    if (token) destroySession(token);
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
