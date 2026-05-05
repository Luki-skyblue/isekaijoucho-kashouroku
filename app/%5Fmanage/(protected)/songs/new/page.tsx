import Link from "next/link";
import { createSong } from "../../../actions";

function TextInput({
  name,
  label,
  defaultValue = "",
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="section-label text-black/45">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition focus:border-black"
      />
    </label>
  );
}

function SongTypeSelect() {
  return (
    <label className="block">
      <span className="section-label text-black/45">SONG TYPE</span>
      <select
        name="song_type"
        defaultValue="cover"
        className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition focus:border-black"
      >
        <option value="original">original</option>
        <option value="cover">cover</option>
        <option value="collaboration">collaboration</option>
        <option value="other">other</option>
      </select>
    </label>
  );
}

export default function ManageSongNewPage() {
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
        </div>

        <p className="section-label mt-8 text-black/45">ADD SONG</p>

        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
          楽曲を追加
        </h1>

        <p className="mt-4 text-sm leading-7 text-black/55">
          最小限の情報で楽曲ページを作成します。作成後、編集画面で詳細を追記できます。
        </p>

        <p className="mt-3 text-xs leading-6 text-black/45">
          新規追加した楽曲の主要項目は、初期状態では「未確認」として扱われます。
        </p>
      </section>

      <form action={createSong} className="mt-8 space-y-10">
        <section>
          <p className="section-label text-black/45">BASIC</p>

          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <TextInput name="title" label="TITLE" required />
            <TextInput name="title_kana" label="TITLE KANA" />
            <TextInput name="sort_title" label="SORT TITLE" />

            <SongTypeSelect />

            <TextInput
              name="artist_credit"
              label="ARTIST CREDIT"
              defaultValue="ヰ世界情緒"
            />
          </div>
        </section>

        <section>
          <p className="section-label text-black/45">RELEASE</p>

          <div className="mt-4 grid gap-5 md:grid-cols-[180px_1fr]">
            <TextInput name="first_date" label="FIRST DATE" type="date" />
            <TextInput name="first_source" label="FIRST SOURCE" />
          </div>
        </section>

        <div className="border-t border-black/15 pt-6">
          <button
            type="submit"
            className="border border-black px-5 py-3 text-xs font-medium tracking-[0.12em] text-black transition hover:bg-black hover:text-[#f5f5f2]"
          >
            CREATE SONG
          </button>
        </div>
      </form>
    </main>
  );
}