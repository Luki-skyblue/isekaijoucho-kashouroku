import Link from "next/link";
import { createRelease } from "../../../actions";

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

function TextArea({
  name,
  label,
  defaultValue = "",
  rows = 4,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="section-label text-black/45">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        className="mt-2 w-full border border-black/20 bg-transparent px-3 py-3 text-sm leading-7 text-black outline-none transition focus:border-black"
      />
    </label>
  );
}

function ReleaseTypeSelect() {
  return (
    <label className="block">
      <span className="section-label text-black/45">RELEASE TYPE</span>
      <select
        name="release_type"
        defaultValue="album"
        className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition focus:border-black"
      >
        <option value="digital_single">digital_single / 配信シングル</option>
        <option value="single">single / シングル</option>
        <option value="ep">ep / EP</option>
        <option value="album">album / アルバム</option>
        <option value="cd">cd / CD</option>
        <option value="compilation">compilation / コンピレーション</option>
        <option value="other">other / その他</option>
      </select>
    </label>
  );
}

export default function ManageReleaseNewPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <section className="border-b border-black/15 pb-8">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/_manage/releases"
            className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
          >
            BACK TO RELEASES
          </Link>
        </div>

        <p className="section-label mt-8 text-black/45">ADD RELEASE</p>

        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
          リリースを追加
        </h1>

        <p className="mt-4 text-sm leading-7 text-black/55">
          アルバム、EP、CD、配信シングルなどのリリース情報を作成します。
          作成後、編集画面で詳細を追記できます。
        </p>
      </section>

      <form action={createRelease} className="mt-8 space-y-10">
        <section>
          <p className="section-label text-black/45">BASIC</p>

          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <TextInput name="title" label="TITLE" required />
            <TextInput name="title_kana" label="TITLE KANA" />
            <TextInput name="sort_title" label="SORT TITLE" />
            <ReleaseTypeSelect />
            <TextInput name="artist_credit" label="ARTIST CREDIT" />
            <TextInput name="release_date" label="RELEASE DATE" type="date" />
          </div>
        </section>

        <section>
          <p className="section-label text-black/45">IMAGES / LINKS</p>

          <div className="mt-4 grid gap-5">
            <TextInput name="jacket_image_url" label="JACKET IMAGE URL" />
            <TextInput name="official_url" label="OFFICIAL URL" />
          </div>
        </section>

        <section>
          <p className="section-label text-black/45">TEXT</p>

          <div className="mt-4">
            <TextArea name="notes" label="NOTES" rows={5} />
          </div>
        </section>

        <div className="border-t border-black/15 pt-6">
          <button
            type="submit"
            className="border border-black px-5 py-3 text-xs font-medium tracking-[0.12em] text-black transition hover:bg-black hover:text-[#f5f5f2]"
          >
            CREATE RELEASE
          </button>
        </div>
      </form>
    </main>
  );
}