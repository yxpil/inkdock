import type { Metadata } from "next";
import { StudioShell } from "@/components/studio-shell";
import { LibraryView } from "@/components/library/library-view";
import { requireUser } from "@/lib/auth";
import { getLibraryData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "书架",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const user = await requireUser();
  const data = getLibraryData(user);
  const params = await searchParams;

  return (
    <StudioShell user={user}>
      <LibraryView data={data} openNewInitially={params.new === "1"} />
    </StudioShell>
  );
}
