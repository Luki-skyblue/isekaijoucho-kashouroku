import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type SongOverview = {
  id: number;
  title: string | null;
  title_kana: string | null;
  artist_credit: string | null;
  song_type: string | null;
  first_date: string | null;
  first_source: string | null;
  first_full_date: string | null;
  original_artist: string | null;
  original_composer: string | null;
  original_lyricist: string | null;
  original_arranger: string | null;
  verification_status: string | null;
  song_group_id: number | null;
  version_name: string | null;
  is_primary_version: boolean | null;
};

const statusLabels: Record<string, string> = {
  confirmed: "確認済み",
  uncertain: "要確認",
  unverified: "未確認",
  wanted: "情報募集中",
};

function formatValue(value: string | null) {
  return value?.trim() || "未入力";
}

function StatusMark({ status }: { status: string | null }) {
  const label = status ? statusLabels[status] ?? status : "未設定";

  return (
    <span className="inline-flex items-center gap-2 text-xs text-black/50">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          status === "confirmed" ? "bg-black/60" : "border border-black/35"
        }`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function InfoRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string | null;
  status?: string | null;
}) {
  return (
    <div className="grid gap-2 border-b border-black/10 py-4 sm:grid-cols-[150px_1fr_auto] sm:items-center sm:gap-5">
      <dt className="text-xs text-black/45">{label}</dt>
      <dd className={value ? "text-sm text-black/75" : "text-sm text-black/35"}>
        {formatValue(value)}
      </dd>
      {status !== undefined ? <StatusMark status={status} /> : null}
    </div>
  );
}

export default async function ManageSongOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const songId = Number(id);

  if (!Number.isInteger(songId)) {
    notFound();
  }

  const { data: song, error } = await supabaseAdmin
    .from("songs")
    .select(
      "id,title,title_kana,artist_credit,song_type,first_date,first_source,first_full_date,original_artist,original_composer,original_lyricist,original_arranger,verification_status,song_group_id,version_name,is_primary_version"
    )
    .eq("id", songId)
    .single<SongOverview>();

  if (error || !song) {
    notFound();
  }

  const [{ count: linkCount }, { count: digitalReleaseCount }] = await Promise.all([
    supabaseAdmin
      .from("links")
      .select("id", { count: "exact", head: true })
      .eq("target_type", "song")
      .eq("target_id", songId),
    supabaseAdmin
      .from("song_digital_releases")
      .select("id", { count: "exact", head: true })
      .eq("song_id", songId),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="border-b border-black/15 pb-8">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/_manage/songs" className="text-xs text-black/45 transition hover:text-black">
            楽曲一覧へ戻る
          </Link>
          <Link href={`/songs/${song.id}?from=manage`} target="_blank" className="text-xs text-black/45 transition hover:text-black">
            公開ページを見る ↗
          </Link>
        </div>
        <p className="section-label mt-8 text-black/45">SONG / OVERVIEW</p>
        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
          {song.title ?? `#${song.id}`}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-black/50">
          <span>{formatValue(song.artist_credit)}</span>
          <span>{formatValue(song.song_type)}</span>
          <StatusMark status={song.verification_status} />
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link href={`/_manage/songs/${song.id}/edit`} className="border border-black/20 p-5 transition hover:border-black/50 hover:bg-black/[0.02]">
          <p className="section-label text-black/40">楽曲本体</p>
          <p className="mt-3 text-sm text-black/70">基本情報を編集 →</p>
        </Link>
        <Link href={`/_manage/songs/${song.id}/links`} className="border border-black/20 p-5 transition hover:border-black/50 hover:bg-black/[0.02]">
          <p className="section-label text-black/40">関連リンク</p>
          <p className="mt-3 text-sm text-black/70">{linkCount ?? 0}件を確認・編集 →</p>
        </Link>
        <Link href={`/_manage/songs/${song.id}/digital-releases`} className="border border-black/20 p-5 transition hover:border-black/50 hover:bg-black/[0.02]">
          <p className="section-label text-black/40">配信リリース</p>
          <p className="mt-3 text-sm text-black/70">{digitalReleaseCount ?? 0}件を確認・編集 →</p>
        </Link>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between border-b border-black/15 pb-4">
          <div>
            <p className="section-label text-black/45">OVERVIEW</p>
            <h2 className="font-serif-jp mt-2 text-2xl text-black/80">登録内容</h2>
          </div>
          <p className="text-xs text-black/35">ID #{song.id}</p>
        </div>

        <dl className="mt-2">
          <InfoRow label="タイトル（読み）" value={song.title_kana} />
          <InfoRow label="初歌唱日" value={song.first_date} />
          <InfoRow label="フル初歌唱日" value={song.first_full_date} />
          <InfoRow label="初出情報" value={song.first_source} />
          <InfoRow label="原曲アーティスト" value={song.original_artist} />
          <InfoRow label="作曲者" value={song.original_composer} />
          <InfoRow label="作詞者" value={song.original_lyricist} />
          <InfoRow label="編曲者" value={song.original_arranger} />
        </dl>
      </section>

      <section className="mt-10 border-t border-black/15 pt-8">
        <p className="section-label text-black/45">VERSION / GROUP</p>
        <div className="mt-4 border border-black/15 bg-black/[0.02] p-5">
          <p className="text-sm text-black/70">
            {song.song_group_id ? `グループ #${song.song_group_id}` : "グループ未設定"}
            {song.version_name ? ` / ${song.version_name}` : ""}
            {song.is_primary_version === false ? " / 別バージョン" : ""}
          </p>
          <p className="mt-2 text-xs leading-6 text-black/50">
            バージョンやグループの所属を変更すると、関連表示にも影響します。
          </p>
          <Link href={`/_manage/songs/${song.id}/edit`} className="mt-4 inline-block text-xs text-black/55 underline underline-offset-4 hover:text-black">
            グループ情報を編集する
          </Link>
        </div>
      </section>
    </main>
  );
}
