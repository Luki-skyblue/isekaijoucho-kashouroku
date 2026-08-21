import Link from "next/link";
import { notFound } from "next/navigation";
import { createReleaseItem, deleteReleaseItem } from "@/app/%5Fmanage/actions";
import type { ManageSelectOption } from "@/app/%5Fmanage/options";
import { supabaseAdmin } from "@/lib/supabase/admin";
import InlineReleaseItemFieldEditor from "./InlineReleaseItemFieldEditor";
import SongIdInput from "./SongIdInput";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
};

type ReleaseItem = {
  id: number;
  disc_number: number | null;
  track_number: number | null;
  song_id: number | null;
  track_title: string | null;
  track_artist: string | null;
  title_override: string | null;
  notes: string | null;
  songs: {
    id: number;
    title: string | null;
    artist_credit: string | null;
    version_name: string | null;
    is_primary_version: boolean | null;
  } | null;
};

type SongOption = {
  id: number;
  title: string | null;
  artist_credit: string | null;
  version_name: string | null;
  is_primary_version: boolean | null;
};

function getItemTitle(item: ReleaseItem) {
  return item.title_override || item.songs?.title || item.track_title || "未設定のトラック";
}

function getItemArtist(item: ReleaseItem) {
  return item.track_artist || item.songs?.artist_credit || "-";
}

function getVersionLabel(song: ReleaseItem["songs"]) {
  if (!song) return null;
  return song.version_name || (song.is_primary_version === false ? "別バージョン" : null);
}

function TextInput({ name, label, defaultValue, type = "text", placeholder }: { name: string; label: string; defaultValue?: string | number | null; type?: string; placeholder?: string }) {
  return <label className="grid gap-1 text-xs tracking-[0.18em] text-neutral-500">{label}<input name={name} type={type} defaultValue={defaultValue ?? ""} placeholder={placeholder} className="border border-neutral-300 bg-[#f5f5f2] px-3 py-2 text-sm tracking-normal text-neutral-900 outline-none focus:border-neutral-900" /></label>;
}

function TextArea({ name, label }: { name: string; label: string }) {
  return <label className="grid gap-1 text-xs tracking-[0.18em] text-neutral-500">{label}<textarea name={name} rows={3} className="border border-neutral-300 bg-[#f5f5f2] px-3 py-2 text-sm tracking-normal text-neutral-900 outline-none focus:border-neutral-900" /></label>;
}

function ReleaseItemFields({ songs }: { songs: SongOption[] }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-[110px_110px_1fr]">
        <TextInput name="disc_number" label="DISC" type="number" />
        <TextInput name="track_number" label="TRACK" type="number" />
        <SongIdInput songs={songs} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput name="track_title" label="TRACK TITLE" placeholder="未登録曲の場合の曲名" />
        <TextInput name="track_artist" label="TRACK ARTIST" placeholder="未登録曲の場合のアーティスト" />
      </div>
      <TextInput name="title_override" label="TITLE OVERRIDE" placeholder="リリース上だけ表記が異なる場合" />
      <TextArea name="notes" label="NOTES" />
    </div>
  );
}

function ItemRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-2 border-b border-black/10 py-3 sm:grid-cols-[140px_1fr]"><dt className="text-xs text-black/45">{label}</dt><dd>{children}</dd></div>;
}

export default async function ManageReleaseItemsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { saved } = await searchParams;
  const releaseId = Number(id);

  if (!Number.isInteger(releaseId)) {
    notFound();
  }

  const { data: release, error } = await supabaseAdmin
    .from("releases")
    .select("id,release_group_id,release_groups(id,title)")
    .eq("id", releaseId)
    .single();

  if (error || !release) {
    notFound();
  }

  let itemsQuery = supabaseAdmin.from("release_items").select(`
    id, disc_number, track_number, song_id, track_title, track_artist,
    title_override, notes,
    songs (id, title, artist_credit, version_name, is_primary_version)
  `);
  itemsQuery = release.release_group_id
    ? itemsQuery.eq("release_group_id", release.release_group_id)
    : itemsQuery.eq("release_id", release.id);

  const [{ data: items, error: itemsError }, { data: songs, error: songsError }] = await Promise.all([
    itemsQuery.order("disc_number", { ascending: true, nullsFirst: false }).order("track_number", { ascending: true, nullsFirst: false }).order("id").returns<ReleaseItem[]>(),
    supabaseAdmin.from("songs").select("id,title,artist_credit,version_name,is_primary_version").order("title_kana", { ascending: true, nullsFirst: false }).order("id").returns<SongOption[]>(),
  ]);

  if (itemsError) throw new Error("収録曲の取得に失敗しました。");
  if (songsError) throw new Error("楽曲候補の取得に失敗しました。");

  const songOptions: ManageSelectOption[] = (songs ?? []).map((song) => ({
    value: String(song.id),
    label: `#${song.id} ${song.title ?? "無題"}${song.version_name ? ` / ${song.version_name}` : song.is_primary_version === false ? " / 別バージョン" : ""}`,
  }));
  const createAction = createReleaseItem.bind(null, releaseId);

  return (
    <>
      {saved ? <p className="mt-5 border border-black/15 p-3 text-sm text-black/60">保存しました。</p> : null}

      {release.release_group_id ? (
        <p className="mt-8 border border-black/15 bg-black/[0.02] p-4 text-xs leading-6 text-black/55">
          収録曲は作品グループ #{release.release_group_id} の全形態で共有されます。
        </p>
      ) : null}

      <details className="group mt-8">
        <summary className="inline-flex cursor-pointer list-none items-center gap-2 border border-black px-4 py-2 text-sm text-black transition marker:hidden hover:bg-black hover:text-white"><span className="group-open:hidden">収録曲を追加 ＋</span><span className="hidden group-open:inline">追加フォームを閉じる −</span></summary>
        <section className="mt-5 grid gap-4 border border-black/15 p-5">
          <div><p className="section-label text-black/45">ADD ITEM</p><h2 className="font-serif-jp mt-2 text-xl text-black/80">収録曲を追加</h2><p className="mt-2 text-xs leading-6 text-black/45">登録済みの楽曲は一覧から選択します。未登録曲は楽曲を空欄にして、曲名とアーティストを入力します。</p></div>
          <form action={createAction} className="grid gap-5"><ReleaseItemFields songs={songs ?? []} /><div><button type="submit" className="border border-black bg-black px-5 py-2 text-sm text-white hover:bg-black/80">追加する</button></div></form>
        </section>
      </details>

      <section className="mt-8 grid gap-4">
        <div><p className="section-label text-black/45">CURRENT ITEMS</p><h2 className="font-serif-jp mt-2 text-2xl text-black/80">登録済み収録曲：{items?.length ?? 0}曲</h2></div>

        {(items ?? []).map((item) => {
          const deleteAction = deleteReleaseItem.bind(null, releaseId, item.id);
          const versionLabel = getVersionLabel(item.songs);
          return (
            <details key={item.id} className="group border border-black/15">
              <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 p-5 marker:hidden">
                <div className="min-w-0"><p className="text-xs tabular-nums text-black/40">DISC {item.disc_number ?? "-"} / TRACK {item.track_number ?? "-"}</p><p className="mt-1 font-serif-jp text-lg text-black/80">{getItemTitle(item)}{versionLabel ? <span className="ml-2 text-[10px] text-black/35">{versionLabel}</span> : null}</p><p className="mt-1 text-xs text-black/45">{getItemArtist(item)}</p></div>
                <span className="border border-black/20 px-3 py-2 text-xs text-black/45 group-open:bg-black group-open:text-white">鉛筆で編集</span>
              </summary>

              <div className="border-t border-black/10 p-5">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  {item.song_id ? <Link href={`/_manage/songs/${item.song_id}`} className="text-xs text-black/50 underline underline-offset-4 hover:text-black">楽曲管理を見る →</Link> : null}
                </div>
                <dl className="border-t border-black/10">
                  <ItemRow label="ディスク番号"><InlineReleaseItemFieldEditor releaseId={releaseId} itemId={item.id} field="disc_number" value={item.disc_number} inputType="number" /></ItemRow>
                  <ItemRow label="トラック番号"><InlineReleaseItemFieldEditor releaseId={releaseId} itemId={item.id} field="track_number" value={item.track_number} inputType="number" /></ItemRow>
                  <ItemRow label="登録楽曲"><InlineReleaseItemFieldEditor releaseId={releaseId} itemId={item.id} field="song_id" value={item.song_id} options={songOptions} /></ItemRow>
                  <ItemRow label="未登録曲名"><InlineReleaseItemFieldEditor releaseId={releaseId} itemId={item.id} field="track_title" value={item.track_title} /></ItemRow>
                  <ItemRow label="未登録曲アーティスト"><InlineReleaseItemFieldEditor releaseId={releaseId} itemId={item.id} field="track_artist" value={item.track_artist} /></ItemRow>
                  <ItemRow label="リリース上の表記"><InlineReleaseItemFieldEditor releaseId={releaseId} itemId={item.id} field="title_override" value={item.title_override} /></ItemRow>
                  <ItemRow label="メモ"><InlineReleaseItemFieldEditor releaseId={releaseId} itemId={item.id} field="notes" value={item.notes} multiline /></ItemRow>
                </dl>
                <details className="mt-5"><summary className="cursor-pointer text-xs text-red-900/60 marker:hidden">削除</summary><form action={deleteAction} className="mt-3"><p className="text-xs text-black/50">この収録曲情報を削除します。</p><button type="submit" className="mt-3 border border-red-900/30 px-3 py-2 text-xs text-red-900/70 hover:bg-red-900 hover:text-white">削除を実行</button></form></details>
              </div>
            </details>
          );
        })}

        {(!items || items.length === 0) ? <p className="border-y border-black/10 py-8 text-sm text-black/40">収録曲はまだ登録されていません。</p> : null}
      </section>
    </>
  );
}
