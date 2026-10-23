// Author: yxpil

import { NextResponse } from "next/server";
import { authenticateUser, createSession, setSessionCookie } from "@/lib/auth";
import { readJson, routeError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const user = authenticateUser(body);
    const session = createSession(user.id);
    await setSessionCookie(session.token, session.expiresAt);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return routeError(error);
  }
}
