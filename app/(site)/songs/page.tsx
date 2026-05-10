import { supabase } from "@/lib/supabase/client";
import SongsList from "./SongsList";

export const dynamic = "force-dynamic";

const FIELD_STATUS_KEYS = [
  "first_status",
  "first_full_status",
  "tie_up_status",
  "album_text_status",
  "original_artist_status",
  "original_vocal_status",
  "original_lyricist_status",
  "original_composer_status",
  "original_arranger_status",
] as const;

export default async function SongsPage() {
  const { data: songs, error } = await supabase
    .from("songs")
    .select(
      "id,title,title_kana,sort_title,first_date,first_source,artist_credit,song_type,verification_status,first_status,first_full_status,tie_up_status,album_text_status,original_artist_status,original_vocal_status,original_lyricist_status,original_composer_status,original_arranger_status,version_name,version_type,is_primary_version"
    )
    .order("first_date", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="archive-label text-black/45">SONGS</p>
        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black">
          楽曲一覧
        </h1>
        <p className="mt-6 border border-black/15 p-5 text-sm text-black/60">
          楽曲データの取得に失敗しました。
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <section className="border-b border-black/15 pb-8">
        <p className="archive-label text-black/45">SONGS</p>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif-jp text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
              楽曲目録
            </h1>
            <p className="mt-4 text-sm leading-7 text-black/55">
              歌唱録に登録されている楽曲を、検索・絞り込みできる目録です。
            </p>
          </div>

          <p className="text-sm text-black/45">{songs?.length ?? 0} SONGS</p>
        </div>
      </section>

      <SongsList songs={songs ?? []} />
    </main>
  );
}