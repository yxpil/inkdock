// Author: yxpil

import type { Metadata } from "next";
import { StudioShell } from "@/components/studio-shell";
import { SettingsView } from "@/components/settings/settings-view";
import { getAiConfig } from "@/lib/ai";
import { getUser } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "设置",
};

export default function SettingsPage() {
  const user = getUser();
  const ai = getAiConfig();

  return (
    <StudioShell user={user}>
      <SettingsView user={user} ai={ai} />
    </StudioShell>
  );
}
