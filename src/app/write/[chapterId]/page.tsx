// Author: yxpil

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAiConfig } from "@/lib/ai";
import { getEditorBundle } from "@/lib/queries";
import { EditorWorkspace } from "@/components/editor/editor-workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}): Promise<Metadata> {
  const { chapterId } = await params;
  const bundle = getEditorBundle(chapterId);
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
  const { chapterId } = await params;
  const bundle = getEditorBundle(chapterId);
  if (!bundle) notFound();

  const ai = getAiConfig();
  return <EditorWorkspace key={bundle.chapter.id} initial={bundle} ai={ai} />;
}
