// Author: yxpil

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthView } from "@/components/auth/auth-view";
import { getSessionUser } from "@/lib/auth";
import { countRegisteredUsers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "登录",
};

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/library");

  return <AuthView hasAccounts={countRegisteredUsers() > 0} />;
}
