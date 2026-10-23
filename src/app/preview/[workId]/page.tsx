// Author: yxpil

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser, requireUser } from "@/lib/auth";
import { getReaderWork } from "@/lib/queries";
import { getPlatform } from "@/lib/platforms";
import { ReaderStudio } from "@/components/reader/reader-studio";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workId: string }>;
}): Promise<Metadata> {
  const user = await getSessionUser();
  if (!user) return { title: "手机预览 · 墨坞" };
  const { workId } = await params;
  const work = getReaderWork(workId, user.id);
  return { title: work ? `手机预览 · ${work.title}` : "手机预览 · 墨坞" };
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ workId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { workId } = await params;
  const query = await searchParams;
  const work = getReaderWork(workId, user.id);
  if (!work) notFound();

  const platform = getPlatform(
    typeof query.platform === "string" ? query.platform : null,
  );
  const requestedChapter =
    typeof query.chapter === "string" ? query.chapter : null;
  const chapter =
    work.chapters.find((item) => item.id === requestedChapter) ?? work.chapters[0];

  return (
    <ReaderStudio
      work={work}
      initialChapterId={chapter?.id ?? ""}
      initialPlatformId={platform.id}
    />
  );
}
