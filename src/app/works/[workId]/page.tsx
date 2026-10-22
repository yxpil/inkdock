import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudioShell } from "@/components/studio-shell";
import { WorkView } from "@/components/work/work-view";
import { getWorkDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workId: string }>;
}): Promise<Metadata> {
  const { workId } = await params;
  const work = getWorkDetail(workId);
  return { title: work ? work.title : "作品" };
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ workId: string }>;
}) {
  const { workId } = await params;
  const work = getWorkDetail(workId);
  if (!work) notFound();

  return (
    <StudioShell user={work.author}>
      <WorkView work={work} />
    </StudioShell>
  );
}
