// Author: yxpil

import { NextResponse } from "next/server";
import {
  changePassword,
  getSessionToken,
  requireApiUser,
} from "@/lib/auth";
import { readJson, routeError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJson(request);
    const token = await getSessionToken();
    changePassword(user.id, token, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
