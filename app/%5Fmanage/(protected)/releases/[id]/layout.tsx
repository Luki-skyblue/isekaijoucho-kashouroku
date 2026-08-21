import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ManageReleaseHeader } from "../../ManageReleaseTabs";
import { getManageReleaseNavigation } from "../../releaseNavigation";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export default async function ManageReleaseLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const releaseId = Number(id);

  if (!Number.isInteger(releaseId)) {
    notFound();
  }

  const [{ data: release, error }, navigation] = await Promise.all([
    supabaseAdmin.from("releases").select("id,title").eq("id", releaseId).single(),
    getManageReleaseNavigation(releaseId),
  ]);

  if (error || !release) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <ManageReleaseHeader
        releaseId={release.id}
        title={release.title}
        previousRelease={navigation.previousRelease}
        nextRelease={navigation.nextRelease}
      />
      {children}
    </main>
  );
}
