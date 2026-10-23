import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudioShell } from "@/components/studio-shell";
import { WorkView } from "@/components/work/work-view";
import { getSessionUser, requireUser } from "@/lib/auth";
import { getWorkDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workId: string }>;
}): Promise<Metadata> {
  const user = await getSessionUser();
  if (!user) return { title: "作品" };
  const { workId } = await params;
  const work = getWorkDetail(workId, user.id);
  return { title: work ? work.title : "作品" };
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ workId: string }>;
}) {
  const user = await requireUser();
  const { workId } = await params;
  const work = getWorkDetail(workId, user.id);
  if (!work) notFound();

  return (
    <StudioShell user={user}>
      <WorkView work={work} />
    </StudioShell>
  );
}
