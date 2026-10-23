// Author: yxpil

import { NextResponse } from "next/server";
import { createSession, registerUser, setSessionCookie } from "@/lib/auth";
import { readJson, routeError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const user = registerUser(body);
    const session = createSession(user.id);
    await setSessionCookie(session.token, session.expiresAt);
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
