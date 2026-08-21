import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import DiscoverCatalog from "./DiscoverCatalog";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const { data: songs, error } = await supabase
    .from("songs")
    .select("id,title,artist_credit,first_date,first_source,song_type,version_name,is_primary_version,discovery_category")
    .not("discovery_category", "is", null)
    .order("first_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
      <header className="border-b border-black/15 pb-10">
        <p className="section-label text-black/45">DISCOVER</p>
        <div className="mt-4 grid gap-6 md:grid-cols-[1fr_300px] md:items-end">
          <div>
            <h1 className="font-serif-jp text-3xl font-medium tracking-[0.03em] text-black sm:text-5xl">まだ知らない歌に出会う</h1>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-black/60">YouTube公式チャンネルから、コラボ先、CD・アルバム、ライブまで。普段の視聴だけでは辿り着きにくい歌唱を、発表された場所から紹介します。</p>
          </div>
          <p className="text-sm leading-7 text-black/45">曲名や条件から探したい場合は、<Link href="/songs" className="text-black/70 underline underline-offset-4 hover:text-black">楽曲目録の検索</Link>をご利用ください。</p>
        </div>
      </header>

      {error ? <p className="mt-8 border border-black/15 p-5 text-sm text-black/60">Discover情報の取得に失敗しました。</p> : <DiscoverCatalog songs={songs ?? []} />}
    </main>
  );
}
