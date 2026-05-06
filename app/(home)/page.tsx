import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

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

type LatestSong = {
  verification_status: string | null;
  first_status: string | null;
  first_full_status: string | null;
  tie_up_status: string | null;
  album_text_status: string | null;
  original_artist_status: string | null;
  original_vocal_status: string | null;
  original_lyricist_status: string | null;
  original_composer_status: string | null;
  original_arranger_status: string | null;
};

function isAttentionStatus(status: string | null | undefined) {
  return Boolean(status && status !== "confirmed");
}

function hasAttentionStatus(song: LatestSong) {
  if (isAttentionStatus(song.verification_status)) {
    return true;
  }

  return FIELD_STATUS_KEYS.some((key) => isAttentionStatus(song[key]));
}

export default async function HomePage() {
  const { count } = await supabase
    .from("songs")
    .select("*", { count: "exact", head: true });

  const { data: latestSongs } = await supabase
    .from("songs")
    .select(
      "id,title,first_date,first_source,artist_credit,song_type,verification_status,first_status,first_full_status,tie_up_status,album_text_status,original_artist_status,original_vocal_status,original_lyricist_status,original_composer_status,original_arranger_status"
    )
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
            確認中の項目がある場合は、各楽曲ページ上でその旨を記載しています。
            誤りや追加情報などがあれば、各楽曲ページまたは共通の情報提供フォームからお知らせいただけると助かります。
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

              <div className="min-w-0">
                <p
                  className="truncate text-sm font-medium text-black"
                  title={
                    hasAttentionStatus(song)
                      ? `確認中の項目があります / ${song.title}`
                      : song.title
                  }
                >
                  {hasAttentionStatus(song) ? (
                    <span
                      className="mr-1.5 font-mono text-[11px] font-normal text-black/40"
                      aria-label="確認中の項目があります"
                    >
                      ?
                    </span>
                  ) : null}
                  {song.title}
                </p>

                <p className="mt-1 truncate text-xs text-black/45">
                  {song.artist_credit ? `${song.artist_credit} / ` : ""}
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
          <h2 className="section-title-ja">整備状況</h2>
        </div>

        <div className="space-y-5">
          <div className="border border-black/15 p-5">
            <p className="link-label text-black">現在整備している項目</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-black/60">
              <li>関連リンク・サムネイル情報の追加</li>
              <li>初出・原曲情報・制作クレジットの確認</li>
              <li>不確定な項目の整理と情報提供の反映</li>
            </ul>
          </div>

          <div className="border border-black/15 p-5">
            <p className="link-label text-black">今後追加・調整したい項目</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-black/60">
              <li>ライブ・セトリ情報</li>
              <li>関連バージョン同士の導線</li>
              <li>スマートフォン表示の微調整</li>
            </ul>
          </div>
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
            確認中の項目は、各楽曲ページ上で個別に示されることがあります。
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