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
    <label className="block">
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
    <label className="block">
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
    <label className="grid gap-1 text-[10px] tracking-[0.16em] text-neutral-400">
      {label}
      <select
        name={name}
        defaultValue={defaultValue ?? "confirmed"}
        className="border border-neutral-200 bg-transparent px-2 py-1.5 text-xs tracking-normal text-neutral-600 outline-none focus:border-neutral-500"
      >
        <option value="confirmed">確認済み</option>
        <option value="uncertain">不確定</option>
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
    <label className="block">
      <span className="section-label text-black/45">
        VERIFICATION STATUS
      </span>
      <select
        name="verification_status"
        defaultValue={defaultValue ?? "confirmed"}
        className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition focus:border-black"
      >
        <option value="confirmed">confirmed / 確認済み</option>
        <option value="uncertain">uncertain / 不確定</option>
        <option value="unverified">unverified / 未確認</option>
        <option value="wanted">wanted / 情報募集中</option>
      </select>
    </label>
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
        href={`/_manage/songs/${song.id}/links`}
        className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
        >
        EDIT LINKS
        </Link>

        <Link
            href={`/songs/${song.id}`}
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

        <p className="section-label mt-8 text-black/45">EDIT SONG</p>

        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
        {song.title}
        </h1>

        <p className="mt-4 text-sm leading-7 text-black/55">
        楽曲データを編集します。空欄で保存した項目は未入力として扱われます。
        </p>

        {saved && (
        <p className="mt-5 border border-black/15 p-3 text-sm text-black/60">
            保存しました。
        </p>
        )}
    </section>

    <ManagedEditForm action={submitForm}>
        <section>
        <p className="section-label text-black/45">BASIC</p>

        <div className="mt-4 grid gap-5 md:grid-cols-2">
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
        </section>

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

        <section>
        <p className="section-label text-black/45">CREDITS / ORIGINAL</p>

        <div className="mt-4 space-y-5">
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
        </section>

        <section>
        <p className="section-label text-black/45">TEXT</p>

        <div className="mt-4 space-y-5">
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
        </section>

        <section>
        <p className="section-label text-black/45">VERIFICATION</p>

        <div className="mt-4 grid gap-5 md:grid-cols-2">
            <VerificationStatusSelect defaultValue={song.verification_status} />
            <TextArea
            name="verification_note"
            label="VERIFICATION NOTE"
            defaultValue={song.verification_note}
            rows={4}
            />
        </div>
        </section>
        
        <ManagedSaveArea />
        
    </ManagedEditForm>
    </main>
  );
}