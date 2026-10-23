// Author: yxpil

import type { Metadata } from "next";
import { StudioShell } from "@/components/studio-shell";
import { SettingsView } from "@/components/settings/settings-view";
import { getAiConfig } from "@/lib/ai";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "设置",
};

export default async function SettingsPage() {
  const user = await requireUser();
  const ai = getAiConfig();

  return (
    <StudioShell user={user}>
      <SettingsView user={user} ai={ai} />
    </StudioShell>
  );
}
