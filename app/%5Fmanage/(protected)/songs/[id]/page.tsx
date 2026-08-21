import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { InlineFieldCopyButton, InlineFieldEditor, InlineGroupSelectEditor, InlineStatusEditor } from "../../InlineFieldEditor";
import { DISCOVERY_CATEGORY_OPTIONS, SONG_TYPE_OPTIONS } from "../../../options";

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
  first_full_source: string | null;
  tie_up: string | null;
  album_text: string | null;
  notes: string | null;
  original_vocal: string | null;
  original_artist: string | null;
  original_composer: string | null;
  original_lyricist: string | null;
  original_arranger: string | null;
  first_status: string | null;
  first_full_status: string | null;
  tie_up_status: string | null;
  album_text_status: string | null;
  original_vocal_status: string | null;
  original_artist_status: string | null;
  original_lyricist_status: string | null;
  original_composer_status: string | null;
  original_arranger_status: string | null;
  verification_status: string | null;
  song_group_id: number | null;
  version_name: string | null;
  version_type: string | null;
  is_primary_version: boolean | null;
  discovery_category: string | null;
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
  songId,
  field,
  options,
  displayValue,
  inputType,
  copyFrom,
  statusField,
}: {
  label: string;
  value: string | null;
  status?: string | null;
  songId?: number;
  field?: string;
  options?: typeof SONG_TYPE_OPTIONS;
  displayValue?: string | null;
  inputType?: "text" | "date";
  copyFrom?: { value: string | null; label: string };
  statusField?: string;
}) {
  return (
    <div className="grid gap-2 border-b border-black/10 py-4 sm:grid-cols-[150px_1fr_auto] sm:items-center sm:gap-5">
      <dt className="text-xs text-black/45">{label}</dt>
      <dd className={value ? "text-sm text-black/75" : "text-sm text-black/35"}>
        {formatValue(displayValue === undefined ? value : displayValue)} {songId && field ? <InlineFieldEditor songId={songId} field={field} value={value} options={options} inputType={inputType} /> : null}
        {songId && field && copyFrom ? <InlineFieldCopyButton songId={songId} field={field} value={copyFrom.value} label={copyFrom.label} /> : null}
      </dd>
      {status !== undefined ? songId && field ? <InlineStatusEditor songId={songId} field={statusField ?? `${field}_status`} value={status} /> : <StatusMark status={status} /> : null}
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
      "id,title,title_kana,artist_credit,song_type,first_date,first_source,first_full_date,first_full_source,tie_up,album_text,notes,original_artist,original_vocal,original_composer,original_lyricist,original_arranger,verification_status,first_status,first_full_status,tie_up_status,album_text_status,original_artist_status,original_vocal_status,original_lyricist_status,original_composer_status,original_arranger_status,song_group_id,version_name,is_primary_version,discovery_category"
    )
    .eq("id", songId)
    .single<SongOverview>();

  if (error || !song) {
    notFound();
  }

  const [{ count: groupSongCount }, { data: songGroups }] = await Promise.all([
    song.song_group_id
      ? supabaseAdmin.from("songs").select("id", { count: "exact", head: true }).eq("song_group_id", song.song_group_id)
      : Promise.resolve({ count: 0 }),
    supabaseAdmin.from("song_groups").select("id,title").order("title"),
  ]);

  return (
    <>
      <section className="mt-10">
        <div className="flex items-baseline justify-between border-b border-black/15 pb-4">
          <div>
            <p className="section-label text-black/45">OVERVIEW</p>
            <h2 className="font-serif-jp mt-2 text-2xl text-black/80">登録内容</h2>
          </div>
          <p className="text-xs text-black/35">ID #{song.id}</p>
        </div>

        <dl className="mt-2">
          <InfoRow label="アーティスト表記" value={song.artist_credit} songId={song.id} field="artist_credit" />
          <InfoRow label="楽曲種別" value={song.song_type} songId={song.id} field="song_type" options={SONG_TYPE_OPTIONS} />
          <InfoRow label="Discover分類" value={song.discovery_category} displayValue={DISCOVERY_CATEGORY_OPTIONS.find((option) => option.value === song.discovery_category)?.label ?? song.discovery_category} songId={song.id} field="discovery_category" options={DISCOVERY_CATEGORY_OPTIONS} />
          <div className="grid gap-2 border-b border-black/10 py-4 sm:grid-cols-[150px_1fr_auto] sm:items-center sm:gap-5"><dt className="text-xs text-black/45">楽曲全体の確認状態</dt><dd></dd><InlineStatusEditor songId={song.id} field="verification_status" value={song.verification_status} /></div>
          <InfoRow label="タイトル" value={song.title} songId={song.id} field="title" />
          <InfoRow label="タイトル（読み）" value={song.title_kana} songId={song.id} field="title_kana" />
          <InfoRow label="初歌唱日" value={song.first_date} songId={song.id} field="first_date" inputType="date" status={song.first_status} statusField="first_status" />
          <InfoRow label="フル初歌唱日" value={song.first_full_date} songId={song.id} field="first_full_date" inputType="date" status={song.first_full_status} statusField="first_full_status" copyFrom={{ value: song.first_date, label: "初歌唱日をコピー" }} />
          <InfoRow label="初出情報" value={song.first_source} songId={song.id} field="first_source" />
          <InfoRow label="フル初出情報" value={song.first_full_source} songId={song.id} field="first_full_source" copyFrom={{ value: song.first_source, label: "初出情報をコピー" }} />
          <InfoRow label="タイアップ" value={song.tie_up} songId={song.id} field="tie_up" status={song.tie_up_status} />
          <InfoRow label="アルバム記載" value={song.album_text} songId={song.id} field="album_text" status={song.album_text_status} />
          <InfoRow label="原曲アーティスト" value={song.original_artist} songId={song.id} field="original_artist" status={song.original_artist_status} />
          <InfoRow label="原曲ボーカル" value={song.original_vocal} songId={song.id} field="original_vocal" status={song.original_vocal_status} />
          <InfoRow label="作曲者" value={song.original_composer} songId={song.id} field="original_composer" status={song.original_composer_status} />
          <InfoRow label="作詞者" value={song.original_lyricist} songId={song.id} field="original_lyricist" status={song.original_lyricist_status} />
          <InfoRow label="編曲者" value={song.original_arranger} songId={song.id} field="original_arranger" status={song.original_arranger_status} />
          <InfoRow label="管理メモ" value={song.notes} songId={song.id} field="notes" />
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
          <div className="mt-3"><InlineGroupSelectEditor songId={song.id} currentGroupId={song.song_group_id} groups={songGroups ?? []} /></div>
          <p className="mt-2 text-xs leading-6 text-black/50">
            バージョンやグループの所属を変更すると、関連表示にも影響します。
          </p>
          {song.song_group_id && (groupSongCount ?? 0) > 1 ? <Link href={`/_manage/song-groups/${song.song_group_id}`} className="mt-4 inline-block text-xs text-black/55 underline underline-offset-4 hover:text-black">複数バージョンのグループを確認する →</Link> : <p className="mt-4 text-xs text-black/45">この楽曲だけのグループです。</p>}
        </div>
      </section>
    </>
  );
}
