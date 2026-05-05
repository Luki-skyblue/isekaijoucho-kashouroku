import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateSong } from "../../../../actions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    saved?: string;
  }>;
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
    <label className="grid gap-1 text-xs tracking-[0.18em] text-neutral-500">
      {label}
      <select
        name={name}
        defaultValue={defaultValue ?? "confirmed"}
        className="border border-neutral-300 bg-[#f5f5f2] px-3 py-2 text-sm tracking-normal text-neutral-900 outline-none focus:border-neutral-900"
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
            href={`/songs/${song.id}`}
            target="_blank"
            className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
          >
            VIEW PUBLIC
          </Link>
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

      <form action={submitForm} className="mt-8 space-y-10">
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

        <section>
          <p className="section-label text-black/45">RELEASE</p>

          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <TextInput
              name="first_date"
              label="FIRST DATE"
              defaultValue={song.first_date}
              type="date"
            />
            <TextInput
              name="first_source"
              label="FIRST SOURCE"
              defaultValue={song.first_source}
            />
            <FieldStatusSelect
            name="first_status"
            defaultValue={song.first_status}
            />
            <TextInput
              name="first_full_date"
              label="FIRST FULL DATE"
              defaultValue={song.first_full_date}
              type="date"
            />
            <TextInput
              name="first_full_source"
              label="FIRST FULL SOURCE"
              defaultValue={song.first_full_source}
            />
            <FieldStatusSelect
              name="first_full_status"
              defaultValue={song.first_full_status}
            />
          </div>

          <div className="mt-5">
            <TextArea
              name="tie_up"
              label="TIE-UP"
              defaultValue={song.tie_up}
              rows={3}
            />
          </div>
          <FieldStatusSelect
            name="tie_up_status"
            defaultValue={song.tie_up_status}
            />
        </section>

        <section>
          <p className="section-label text-black/45">CREDITS / ORIGINAL</p>

          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <TextInput
              name="original_artist"
              label="ORIGINAL ARTIST"
              defaultValue={song.original_artist}
            />
            <TextInput
              name="original_vocal"
              label="ORIGINAL VOCAL"
              defaultValue={song.original_vocal}
            />
            <TextInput
              name="original_lyricist"
              label="ORIGINAL LYRICIST"
              defaultValue={song.original_lyricist}
            />
            <TextInput
              name="original_composer"
              label="ORIGINAL COMPOSER"
              defaultValue={song.original_composer}
            />
            <TextInput
              name="original_arranger"
              label="ORIGINAL ARRANGER"
              defaultValue={song.original_arranger}
            />
            <FieldStatusSelect
            name="original_artist_status"
            defaultValue={song.original_artist_status}
            />

            <FieldStatusSelect
            name="original_vocal_status"
            defaultValue={song.original_vocal_status}
            />

            <FieldStatusSelect
            name="original_lyricist_status"
            defaultValue={song.original_lyricist_status}
            />

            <FieldStatusSelect
            name="original_composer_status"
            defaultValue={song.original_composer_status}
            />

            <FieldStatusSelect
            name="original_arranger_status"
            defaultValue={song.original_arranger_status}
            />
          </div>
        </section>

        <section>
          <p className="section-label text-black/45">TEXT</p>

          <div className="mt-4 space-y-5">
            <TextArea
              name="album_text"
              label="ALBUM TEXT"
              defaultValue={song.album_text}
              rows={4}
            />
            <FieldStatusSelect
                name="album_text_status"
                defaultValue={song.album_text_status}
            />
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
            <TextInput
              name="verification_status"
              label="VERIFICATION STATUS"
              defaultValue={song.verification_status}
            />
            <TextArea
              name="verification_note"
              label="VERIFICATION NOTE"
              defaultValue={song.verification_note}
              rows={4}
            />
          </div>
        </section>

        <div className="border-t border-black/15 pt-6">
          <button
            type="submit"
            className="border border-black px-5 py-3 text-xs font-medium tracking-[0.12em] text-black transition hover:bg-black hover:text-[#f5f5f2]"
          >
            SAVE
          </button>
        </div>
      </form>
    </main>
  );
}