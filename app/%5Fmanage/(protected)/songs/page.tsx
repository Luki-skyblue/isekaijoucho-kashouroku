import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function ManageSongsPage() {
  const { data: songs, error } = await supabaseAdmin
    .from("songs")
    .select(
      "id,title,title_kana,sort_title,song_type,artist_credit,first_date,first_source,verification_status"
    )
    .order("first_date", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <Link
          href="/_manage"
          className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
        >
          BACK TO MANAGE
        </Link>

        <section className="mt-8 border border-black/15 p-5">
          <p className="section-label text-black/45">ERROR</p>
          <p className="mt-3 text-sm leading-7 text-black/65">
            楽曲データの取得に失敗しました。
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <section className="border-b border-black/15 pb-8">
        <Link
          href="/_manage"
          className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
        >
          BACK TO MANAGE
        </Link>

        <p className="section-label mt-8 text-black/45">SONGS</p>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif-jp text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
              楽曲データ
            </h1>

            <p className="mt-4 text-sm leading-7 text-black/55">
              登録されている楽曲データを確認します。編集機能は次の段階で追加します。
            </p>
          </div>

          <p className="text-sm text-black/45">{songs?.length ?? 0} SONGS</p>
        </div>
      </section>

      <section className="mt-8">
        <div className="hidden border-y border-black/15 py-3 text-xs font-medium tracking-[0.12em] text-black/45 md:grid md:grid-cols-[70px_110px_1fr_170px_100px_100px]">
          <p>ID</p>
          <p>DATE</p>
          <p>TITLE</p>
          <p>CREDIT</p>
          <p>TYPE</p>
          <p>STATUS</p>
        </div>

        <div className="divide-y divide-black/10 border-b border-black/15">
          {songs?.map((song) => (
            <div
              key={song.id}
              className="grid gap-2 py-4 md:grid-cols-[70px_110px_1fr_170px_100px_100px] md:items-center md:gap-4"
            >
              <p className="section-label text-black/45">#{song.id}</p>

              <p className="text-xs tabular-nums text-black/45">
                {song.first_date ?? "-"}
              </p>

              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                  <Link
                    href={`/songs/${song.id}`}
                    target="_blank"
                    className="truncate text-sm font-medium text-black underline-offset-4 transition hover:underline"
                  >
                    {song.title}
                  </Link>

                  <Link
                    href={`/_manage/songs/${song.id}/edit`}
                    className="border border-black/20 px-2 py-0.5 text-[11px] tracking-[0.08em] text-black/50 transition hover:border-black hover:text-black"
                  >
                    EDIT
                  </Link>
                </div>

                {song.title_kana && (
                  <p className="mt-1 truncate text-xs text-black/35">
                    {song.title_kana}
                  </p>
                )}

                {song.sort_title && (
                  <p className="mt-1 truncate text-xs text-black/35">
                    sort: {song.sort_title}
                  </p>
                )}
              </div>

              <p className="truncate text-xs text-black/45">
                {song.artist_credit ?? "-"}
              </p>

              <p className="text-xs uppercase tracking-[0.1em] text-black/45">
                {song.song_type ?? "-"}
              </p>

              <p className="text-xs text-black/45">
                {song.verification_status ?? "-"}
              </p>
            </div>
          ))}

          {(!songs || songs.length === 0) && (
            <p className="py-10 text-sm text-black/45">
              楽曲データがありません。
            </p>
          )}
        </div>
      </section>
    </main>
  );
}