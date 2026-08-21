import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateSong } from "../../../../actions";
import ReleaseFields from "./ReleaseFields";
import { ManagedEditForm, ManagedSaveArea } from "./UnsavedChangesGuard";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    saved?: string;
  }>;
};

type SongNavItem = {
  id: number;
  title: string | null;
  first_date: string | null;
};

type RelatedVersion = {
  id: number;
  title: string | null;
  version_name: string | null;
  is_primary_version: boolean | null;
};

function TextInput({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue: string | null;
  type?: string;
}) {
  return (
    <label data-managed-field className="block rounded-sm p-1 transition-colors">
      <span className="section-label text-black/45">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition focus:border-black"
      />
    </label>
  );
}

function TextArea({
  name,
  label,
  defaultValue,
  rows = 4,
}: {
  name: string;
  label: string;
  defaultValue: string | null;
  rows?: number;
}) {
  return (
    <label data-managed-field className="block rounded-sm p-1 transition-colors">
      <span className="section-label text-black/45">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={rows}
        className="mt-2 w-full border border-black/20 bg-transparent px-3 py-3 text-sm leading-7 text-black outline-none transition focus:border-black"
      />
    </label>
  );
}

function FieldStatusSelect({
  name,
  label = "STATUS",
  defaultValue,
}: {
  name: string;
  label?: string;
  defaultValue?: string | null;
}) {
  return (
    <label data-managed-field className="grid gap-1 rounded-sm p-1 text-[10px] tracking-[0.16em] text-neutral-400 transition-colors">
      {label}
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="border border-neutral-200 bg-transparent px-2 py-1.5 text-xs tracking-normal text-neutral-600 outline-none focus:border-neutral-500"
      >
        <option value="">未設定</option>
        <option value="confirmed">確認済み</option>
        <option value="uncertain">要確認</option>
        <option value="unverified">未確認</option>
        <option value="wanted">情報募集中</option>
      </select>
    </label>
  );
}

function VerificationStatusSelect({
  defaultValue,
}: {
  defaultValue?: string | null;
}) {
  return (
    <label data-managed-field className="block rounded-sm p-1 transition-colors">
      <span className="section-label text-black/45">
        VERIFICATION STATUS
      </span>
      <select
        name="verification_status"
        defaultValue={defaultValue ?? ""}
        className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition focus:border-black"
      >
        <option value="">未設定</option>
        <option value="confirmed">confirmed / 確認済み</option>
        <option value="uncertain">uncertain / 要確認</option>
        <option value="unverified">unverified / 未確認</option>
        <option value="wanted">wanted / 情報募集中</option>
      </select>
    </label>
  );
}

function SectionSaveButton({ section }: { section: string }) {
  return (
    <div className="mt-6 border-t border-black/10 pt-4">
      <button
        type="submit"
        name="save_section"
        value={section}
        data-section-save
        hidden
        className="border border-black/60 px-4 py-2 text-xs font-medium tracking-[0.12em] text-black/70 transition hover:border-black hover:bg-black hover:text-[#f5f5f2]"
      >
        この項目を保存
      </button>
    </div>
  );
}

export default async function ManageSongEditPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { saved } = await searchParams;

  const songId = Number(id);

  if (!Number.isFinite(songId)) {
    notFound();
  }

  const { data: song, error } = await supabaseAdmin
    .from("songs")
    .select("*")
    .eq("id", songId)
    .single();

  if (error || !song) {
    notFound();
  }

  const { data: relatedVersions, error: relatedVersionsError } = song.song_group_id
    ? await supabaseAdmin
        .from("songs")
        .select("id,title,version_name,is_primary_version")
        .eq("song_group_id", song.song_group_id)
        .neq("id", song.id)
        .order("is_primary_version", { ascending: false })
        .order("id", { ascending: true })
        .returns<RelatedVersion[]>()
    : { data: [], error: null };

  if (relatedVersionsError) {
    throw new Error("関連バージョン情報の取得に失敗しました。");
  }

    const { data: navSongs, error: navSongsError } = await supabaseAdmin
        .from("songs")
        .select("id, title, first_date")
        .order("first_date", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .returns<SongNavItem[]>();

        if (navSongsError) {
        throw new Error("前後の楽曲データの取得に失敗しました。");
        }

    const currentSongIndex = navSongs.findIndex((item) => item.id === song.id);

    const previousSong =
    currentSongIndex > 0 ? navSongs[currentSongIndex - 1] : null;

    const nextSong =
    currentSongIndex >= 0 && currentSongIndex < navSongs.length - 1
        ? navSongs[currentSongIndex + 1]
        : null;

  async function submitForm(formData: FormData) {
    "use server";

    await updateSong(songId, formData);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
    <section className="border-b border-black/15 pb-8">
        <div className="flex flex-wrap items-center gap-4">
        <Link
            href="/_manage/songs"
            className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
        >
            BACK TO SONGS
        </Link>

        <Link
            href={`/songs/${song.id}?from=manage`}
            target="_blank"
            className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
        >
            VIEW PUBLIC
        </Link>
        </div>

        <div className="mt-4 grid gap-3 border-t border-black/10 pt-4 md:grid-cols-2">
        {previousSong ? (
            <Link
            href={`/_manage/songs/${previousSong.id}/edit`}
            className="group border border-black/15 px-3 py-2 transition hover:border-black/40"
            >
            <span className="block text-[10px] tracking-[0.18em] text-black/35">
                PREV SONG
            </span>
            <span className="mt-1 block truncate text-sm text-black/70 group-hover:text-black">
                {previousSong.title ?? `#${previousSong.id}`}
            </span>
            </Link>
        ) : (
            <div className="border border-black/10 px-3 py-2 text-black/25">
            <span className="block text-[10px] tracking-[0.18em]">PREV SONG</span>
            <span className="mt-1 block text-sm">なし</span>
            </div>
        )}

        {nextSong ? (
            <Link
            href={`/_manage/songs/${nextSong.id}/edit`}
            className="group border border-black/15 px-3 py-2 transition hover:border-black/40"
            >
            <span className="block text-[10px] tracking-[0.18em] text-black/35">
                NEXT SONG
            </span>
            <span className="mt-1 block truncate text-sm text-black/70 group-hover:text-black">
                {nextSong.title ?? `#${nextSong.id}`}
            </span>
            </Link>
        ) : (
            <div className="border border-black/10 px-3 py-2 text-black/25">
            <span className="block text-[10px] tracking-[0.18em]">NEXT SONG</span>
            <span className="mt-1 block text-sm">なし</span>
            </div>
        )}
        </div>

        <p className="section-label mt-8 text-black/45">楽曲本体を編集</p>

        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
        {song.title}
        </h1>

        <p className="mt-4 text-sm leading-7 text-black/55">
        楽曲データを編集します。空欄で保存した項目は未入力として扱われます。
        </p>

        <div className="mt-6 grid gap-px border border-black/15 bg-black/15 sm:grid-cols-3">
          <div className="bg-[#eeeee9] p-4">
            <p className="section-label text-black/40">現在編集中</p>
            <p className="mt-2 text-sm text-black/75">楽曲本体</p>
          </div>
          <Link
            href={`/_manage/songs/${song.id}/links`}
            className="bg-[#f5f5f2] p-4 transition hover:bg-white"
          >
            <p className="section-label text-black/40">関連情報</p>
            <p className="mt-2 text-sm text-black/65">関連リンクを編集 →</p>
          </Link>
          <Link
            href={`/_manage/songs/${song.id}/digital-releases`}
            className="bg-[#f5f5f2] p-4 transition hover:bg-white"
          >
            <p className="section-label text-black/40">関連情報</p>
            <p className="mt-2 text-sm text-black/65">配信リリースを編集 →</p>
          </Link>
        </div>

        {saved && (
        <p className="mt-5 border border-black/15 p-3 text-sm text-black/60">
            保存しました。
        </p>
        )}
    </section>

    <ManagedEditForm action={submitForm}>
        <details open data-edit-section className="group border-y border-black/10">
        <summary className="cursor-pointer list-none py-4 text-sm font-medium text-black/65 marker:hidden">
          BASIC / 基本情報
        </summary>

        <div className="grid gap-5 pb-6 md:grid-cols-2">
            <TextInput name="title" label="TITLE" defaultValue={song.title} />
            <TextInput
            name="title_kana"
            label="TITLE KANA"
            defaultValue={song.title_kana}
            />
            <TextInput
            name="sort_title"
            label="SORT TITLE"
            defaultValue={song.sort_title}
            />
            <TextInput
            name="song_type"
            label="SONG TYPE"
            defaultValue={song.song_type}
            />
            <TextInput
            name="artist_credit"
            label="ARTIST CREDIT"
            defaultValue={song.artist_credit}
            />
            <TextInput
            name="hero_image_url"
            label="HERO IMAGE URL"
            defaultValue={song.hero_image_url}
            />
        </div>
          <SectionSaveButton section="basic" />
        </details>

        <details data-edit-section className="group border-b border-black/10">
        <summary className="cursor-pointer list-none py-4 text-sm font-medium text-black/65 marker:hidden">
          VERSION / GROUP / バージョン・グループ
        </summary>

        <div className="grid gap-5 pb-6 md:grid-cols-[160px_1fr_180px_140px]">
            <TextInput
            name="song_group_id"
            label="GROUP ID"
            defaultValue={
                song.song_group_id !== null && song.song_group_id !== undefined
                ? String(song.song_group_id)
                : ""
            }
            />

            <TextInput
            name="version_name"
            label="VERSION NAME"
            defaultValue={song.version_name}
            />

            <TextInput
            name="version_type"
            label="VERSION TYPE"
            defaultValue={song.version_type ?? "standard"}
            />

            <label className="self-end border border-black/10 px-3 py-2">
            <span className="section-label text-black/45">PRIMARY</span>
            <span className="mt-2 flex items-center gap-2 text-sm text-black/65">
                <input
                type="checkbox"
                name="is_primary_version"
                defaultChecked={song.is_primary_version ?? true}
                className="h-4 w-4 accent-black"
                />
                代表版
            </span>
            </label>
        </div>

        <p className="mt-3 text-xs leading-6 text-black/45">
            同じ元曲としてまとめたいバージョンには、同じGROUP IDを設定します。
        </p>
        {song.song_group_id ? (
          <div className="mt-5 border border-black/15 bg-black/[0.02] p-4">
            <p className="text-sm font-medium text-black/70">
              このグループに属する別バージョン: {relatedVersions.length}件
            </p>
            <p className="mt-2 text-xs leading-6 text-black/50">
              GROUP ID を変更すると、同じ元曲としてまとめる対象が変わります。
            </p>
            {relatedVersions.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-black/55">
                {relatedVersions.map((version) => (
                  <li key={version.id}>
                    #{version.id} {version.title ?? "無題"}
                    {version.version_name ? ` / ${version.version_name}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-5 border border-black/15 bg-black/[0.02] p-4 text-xs leading-6 text-black/50">
            現在、別バージョンのグループには所属していません。
          </p>
        )}
        <SectionSaveButton section="version" />
        </details>

        <ReleaseFields
        firstDate={song.first_date}
        firstSource={song.first_source}
        firstStatus={song.first_status}
        firstFullDate={song.first_full_date}
        firstFullSource={song.first_full_source}
        firstFullStatus={song.first_full_status}
        tieUp={song.tie_up}
        tieUpStatus={song.tie_up_status}
        />

        <details data-edit-section className="group border-b border-black/10">
        <summary className="cursor-pointer list-none py-4 text-sm font-medium text-black/65 marker:hidden">
          CREDITS / ORIGINAL / 原曲・制作者
        </summary>

        <div className="space-y-5 pb-6">
            <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <TextInput
                name="original_artist"
                label="ORIGINAL ARTIST"
                defaultValue={song.original_artist}
            />
            <div className="self-end">
                <FieldStatusSelect
                name="original_artist_status"
                defaultValue={song.original_artist_status}
                />
            </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <TextInput
                name="original_vocal"
                label="ORIGINAL VOCAL"
                defaultValue={song.original_vocal}
            />
            <div className="self-end">
                <FieldStatusSelect
                name="original_vocal_status"
                defaultValue={song.original_vocal_status}
                />
            </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <TextInput
                name="original_lyricist"
                label="ORIGINAL LYRICIST"
                defaultValue={song.original_lyricist}
            />
            <div className="self-end">
                <FieldStatusSelect
                name="original_lyricist_status"
                defaultValue={song.original_lyricist_status}
                />
            </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <TextInput
                name="original_composer"
                label="ORIGINAL COMPOSER"
                defaultValue={song.original_composer}
            />
            <div className="self-end">
                <FieldStatusSelect
                name="original_composer_status"
                defaultValue={song.original_composer_status}
                />
            </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <TextInput
                name="original_arranger"
                label="ORIGINAL ARRANGER"
                defaultValue={song.original_arranger}
            />
            <div className="self-end">
                <FieldStatusSelect
                name="original_arranger_status"
                defaultValue={song.original_arranger_status}
                />
            </div>
            </div>
        </div>
        <SectionSaveButton section="credits" />
        </details>

        <details data-edit-section className="group border-b border-black/10">
        <summary className="cursor-pointer list-none py-4 text-sm font-medium text-black/65 marker:hidden">
          TEXT / 文章・メモ
        </summary>

        <div className="space-y-5 pb-6">
            <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <TextArea
                name="album_text"
                label="ALBUM TEXT"
                defaultValue={song.album_text}
                rows={4}
            />
            <div className="self-end">
                <FieldStatusSelect
                name="album_text_status"
                defaultValue={song.album_text_status}
                />
            </div>
            </div>

            <TextArea
            name="notes"
            label="NOTES"
            defaultValue={song.notes}
            rows={5}
            />
        </div>
        <SectionSaveButton section="text" />
        </details>

        <details data-edit-section className="group border-b border-black/10">
        <summary className="cursor-pointer list-none py-4 text-sm font-medium text-black/65 marker:hidden">
          VERIFICATION / 確認状態
        </summary>

        <div className="grid gap-5 pb-6 md:grid-cols-2">
            <VerificationStatusSelect defaultValue={song.verification_status} />
            <TextArea
            name="verification_note"
            label="VERIFICATION NOTE"
            defaultValue={song.verification_note}
            rows={4}
            />
        </div>
        <SectionSaveButton section="verification" />
        </details>
        
        <ManagedSaveArea />

    </ManagedEditForm>

    </main>
  );
}
