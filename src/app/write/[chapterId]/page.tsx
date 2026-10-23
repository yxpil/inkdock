// Author: yxpil

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAiConfig } from "@/lib/ai";
import { getSessionUser, requireUser } from "@/lib/auth";
import { getEditorBundle } from "@/lib/queries";
import { EditorWorkspace } from "@/components/editor/editor-workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}): Promise<Metadata> {
  const user = await getSessionUser();
  if (!user) return { title: "写作 · 墨坞" };
  const { chapterId } = await params;
  const bundle = getEditorBundle(chapterId, user.id);
  return {
    title: bundle
      ? `${bundle.chapter.title} · ${bundle.work.title}`
      : "写作 · 墨坞",
  };
}

export default async function WritePage({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}) {
  const user = await requireUser();
  const { chapterId } = await params;
  const bundle = getEditorBundle(chapterId, user.id);
  if (!bundle) notFound();

  const ai = getAiConfig();
  return <EditorWorkspace key={bundle.chapter.id} initial={bundle} ai={ai} />;
}
