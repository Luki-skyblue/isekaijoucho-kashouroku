import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type PageProps = {
  searchParams: Promise<{
    songId?: string;
  }>;
};

export default async function SubmitThanksPage({ searchParams }: PageProps) {
  const { songId } = await searchParams;

  let song: { id: number; title: string } | null = null;

  if (songId) {
    const { data } = await supabase
      .from("songs")
      .select("id,title")
      .eq("id", songId)
      .single();

    song = data;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <section className="border-b border-black/15 pb-8">
        <p className="archive-label text-black/45">SUBMITTED</p>

        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
          送信ありがとうございました
        </h1>

        <p className="mt-5 text-sm leading-7 text-black/60">
          情報提供・修正提案を受け付けました。
          送信内容は管理者が確認し、内容が確認できた場合は反映します。
          確認には通常1日〜1週間程度かかる場合があります。
        </p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        {song && (
          <Link
            href={`/songs/${song.id}`}
            className="border border-black px-5 py-3 text-xs font-medium tracking-[0.12em] text-black transition hover:bg-black hover:text-[#f5f5f2]"
          >
            BACK TO SONG
          </Link>
        )}

        <Link
          href="/songs"
          className="border border-black/25 px-5 py-3 text-xs font-medium tracking-[0.12em] text-black/60 transition hover:border-black hover:text-black"
        >
          BACK TO SONGS
        </Link>

        <Link
          href="/"
          className="border border-black/25 px-5 py-3 text-xs font-medium tracking-[0.12em] text-black/60 transition hover:border-black hover:text-black"
        >
          BACK TO TOP
        </Link>
      </div>

      {song && (
        <p className="mt-6 text-xs leading-6 text-black/45">
          送信対象：{song.title}
        </p>
      )}
    </main>
  );
}