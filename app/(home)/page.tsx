import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default async function HomePage() {
  const { count } = await supabase
    .from("songs")
    .select("*", { count: "exact", head: true });

  const { data: latestSongs } = await supabase
    .from("songs")
    .select("id,title,first_date,first_source,song_type")
    .order("first_date", { ascending: false })
    .limit(5);

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <section className="border-b border-black/15 pb-12">
        <p className="section-label text-black/45">UNOFFICIAL DATABASE</p>

        <h1 className="font-serif-jp mt-4 text-4xl font-medium tracking-[0.02em] text-black md:text-6xl">
          ヰ世界情緒 歌唱録
        </h1>

        <p className="mt-6 max-w-3xl text-sm leading-7 text-black/60">
          ヰ世界情緒さんの歌唱楽曲・関連リンク・ライブセトリなどを整理する、ファンによる非公式データベースです。
          <br />
          KAMITSUBAKI STUDIO、ヰ世界情緒さん本人、および関係各社とは関係ありません。
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/songs"
            className="border border-black px-5 py-3 text-xs font-medium tracking-[0.12em] text-black transition hover:bg-black hover:text-[#f5f5f2]"
          >
            VIEW SONGS
          </Link>

          <Link href="/submit" className="action-button">
            SUBMIT INFO
          </Link>

          <Link href="/about" className="action-button">
            ABOUT
          </Link>
        </div>
      </section>

      <section className="grid border-b border-black/15 py-8 md:grid-cols-[220px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">TRIAL</p>
          <h2 className="section-title-ja">試験公開中</h2>
        </div>

        <div className="space-y-4 text-sm leading-7 text-black/65">
          <p>
            現在、本サイトは身内向けの試験公開段階です。
            掲載情報には未確認・不完全なもの、表記ゆれ、記載漏れが含まれる場合があります。
          </p>

          <p>
            誤りや追加情報を見つけた場合は、各楽曲ページの情報提供フォーム、または共通の情報提供ページから送信できます。
          </p>
        </div>
      </section>

      <section className="grid border-b border-black/15 py-8 md:grid-cols-[220px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">SONGS</p>
          <h2 className="section-title-ja">登録楽曲</h2>
        </div>

        <div>
          <p className="font-serif-jp text-5xl font-medium tracking-tight text-black">
            {count ?? 0}
          </p>
          <p className="mt-2 text-sm text-black/45">登録楽曲数</p>

          <div className="mt-6">
            <Link
              href="/songs"
              className="inline-flex border border-black px-5 py-3 text-xs font-medium tracking-[0.12em] text-black transition hover:bg-black hover:text-[#f5f5f2]"
            >
              VIEW SONGS
            </Link>
          </div>
        </div>
      </section>

      <section className="grid border-b border-black/15 py-8 md:grid-cols-[220px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">RECENT</p>
          <h2 className="section-title-ja">最新の5曲</h2>
        </div>

        <div className="divide-y divide-black/10 border-y border-black/15">
          {latestSongs?.map((song) => (
            <Link
              key={song.id}
              href={`/songs/${song.id}`}
              className="grid gap-2 py-4 transition hover:bg-black/[0.03] md:grid-cols-[120px_1fr_120px]"
            >
              <time className="text-xs text-black/45">
                {song.first_date ?? "----.--.--"}
              </time>

              <div>
                <p className="text-sm font-medium text-black">{song.title}</p>
                <p className="mt-1 text-xs text-black/45">
                  {song.first_source ?? "-"}
                </p>
              </div>

              <p className="text-xs uppercase tracking-[0.12em] text-black/45">
                {song.song_type ?? "-"}
              </p>
            </Link>
          ))}

          {(!latestSongs || latestSongs.length === 0) && (
            <p className="py-4 text-sm text-black/45">
              表示できる楽曲がありません。
            </p>
          )}
        </div>
      </section>

      <section className="grid border-b border-black/15 py-8 md:grid-cols-[220px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">STATUS</p>
          <h2 className="section-title-ja">整備予定</h2>
        </div>

        <div className="border border-black/15 p-5">
          <p className="link-label text-black">今後追加・調整したい項目</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-black/60">
            <li>関連リンクの拡充</li>
            <li>ライブ・セトリ情報</li>
            <li>原曲情報・名義情報の整理</li>
            <li>スマートフォン表示の調整</li>
          </ul>
        </div>
      </section>

      <section className="grid py-8 md:grid-cols-[220px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">NOTICE</p>
          <h2 className="section-title-ja">注意事項</h2>
        </div>

        <div className="space-y-4 text-xs leading-6 text-black/55">
          <p>
            本サイトはファンによる非公式データベースです。
            KAMITSUBAKI STUDIO、ヰ世界情緒さん本人、および関係各社とは関係ありません。
          </p>

          <p>
            掲載情報には未確認・不完全なものが含まれる場合があります。
            誤りや追加情報がある場合は、情報提供フォームから送信できます。
          </p>

          <p>
            サイトの設計・実装・データ整理の一部にChatGPTを利用しています。
            掲載内容の確認・編集・公開判断は管理者が行います。
          </p>
        </div>
      </section>
    </main>
  );
}