import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  deleteRelease,
  duplicateRelease,
  updateRelease,
} from "../../../../actions";

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
  required = false,
}: {
  name: string;
  label: string;
  defaultValue: string | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="section-label text-black/45">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
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

function ReleaseTypeSelect({
  defaultValue,
}: {
  defaultValue?: string | null;
}) {
  return (
    <label className="block">
      <span className="section-label text-black/45">RELEASE TYPE</span>
      <select
        name="release_type"
        defaultValue={defaultValue ?? "other"}
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

export default async function ManageReleaseEditPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { saved } = await searchParams;

  const releaseId = Number(id);

  if (!Number.isFinite(releaseId)) {
    notFound();
  }

  const { data: release, error } = await supabaseAdmin
    .from("releases")
    .select(
      "id,title,title_kana,sort_title,release_type,artist_credit,release_date,jacket_image_url,official_url,notes"
    )
    .eq("id", releaseId)
    .single();

  if (error || !release) {
    notFound();
  }

  async function submitForm(formData: FormData) {
    "use server";

    await updateRelease(releaseId, formData);
  }

    async function duplicateAction() {
    "use server";

    await duplicateRelease(releaseId);
    }


    async function deleteAction() {
    "use server";

    await deleteRelease(releaseId);
    }

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

          <Link
            href={`/_manage/releases/${release.id}/items`}
            className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
          >
            EDIT ITEMS
          </Link>

            <form action={duplicateAction}>
            <button
                type="submit"
                className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
            >
                DUPLICATE
            </button>
            </form>

          <Link
            href={`/releases/${release.id}`}
            target="_blank"
            className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
          >
            VIEW PUBLIC
          </Link>
        </div>

        <p className="section-label mt-8 text-black/45">EDIT RELEASE</p>

        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
          {release.title}
        </h1>

        <p className="mt-4 text-sm leading-7 text-black/55">
          リリース情報を編集します。収録曲は EDIT ITEMS から管理します。
        </p>

        {saved ? (
          <p className="mt-5 border border-black/25 bg-black/[0.03] p-3 text-sm text-black/70">
            保存しました。現在表示されているリリース情報はデータベースに反映済みです。
          </p>
        ) : null}
      </section>

      <form action={submitForm} className="mt-8 space-y-10">
        <section>
          <p className="section-label text-black/45">BASIC</p>

          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <TextInput
              name="title"
              label="TITLE"
              defaultValue={release.title}
              required
            />
            <TextInput
              name="title_kana"
              label="TITLE KANA"
              defaultValue={release.title_kana}
            />
            <TextInput
              name="sort_title"
              label="SORT TITLE"
              defaultValue={release.sort_title}
            />
            <ReleaseTypeSelect defaultValue={release.release_type} />
            <TextInput
              name="artist_credit"
              label="ARTIST CREDIT"
              defaultValue={release.artist_credit}
            />
            <TextInput
              name="release_date"
              label="RELEASE DATE"
              type="date"
              defaultValue={release.release_date}
            />
          </div>
        </section>

        <section>
          <p className="section-label text-black/45">IMAGES / LINKS</p>

          <div className="mt-4 grid gap-5">
            <TextInput
              name="jacket_image_url"
              label="JACKET IMAGE URL"
              defaultValue={release.jacket_image_url}
            />
            <TextInput
              name="official_url"
              label="OFFICIAL URL"
              defaultValue={release.official_url}
            />
          </div>
        </section>

        <section>
          <p className="section-label text-black/45">TEXT</p>

          <div className="mt-4">
            <TextArea
              name="notes"
              label="NOTES"
              defaultValue={release.notes}
              rows={5}
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

        <section className="border-t border-red-900/20 pt-6">
            <p className="section-label text-red-900/50">DANGER</p>
            <p className="mt-2 text-sm leading-6 text-black/45">
                このリリース情報を削除します。収録曲情報も同時に削除されます。
            </p>

            <form action={deleteAction} className="mt-4">
                <button
                type="submit"
                className="border border-red-900/30 px-5 py-3 text-xs font-medium tracking-[0.12em] text-red-900/70 transition hover:border-red-900 hover:bg-red-900 hover:text-[#f5f5f2]"
                >
                DELETE RELEASE
                </button>
            </form>
        </section>
    </main>
  );
}