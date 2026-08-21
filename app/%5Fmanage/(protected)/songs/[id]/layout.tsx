import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ManageSongHeader } from "../../ManageSongTabs";
import { getManageSongNavigation } from "../../songNavigation";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{
    id: string;
  }>;
};

export default async function ManageSongLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const songId = Number(id);

  if (!Number.isInteger(songId)) {
    notFound();
  }

  const [{ data: song, error }, navigation] = await Promise.all([
    supabaseAdmin.from("songs").select("id,title").eq("id", songId).single(),
    getManageSongNavigation(songId),
  ]);

  if (error || !song) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <ManageSongHeader
        songId={song.id}
        title={song.title}
        previousSong={navigation.previousSong}
        nextSong={navigation.nextSong}
      />
      {children}
    </main>
  );
}
