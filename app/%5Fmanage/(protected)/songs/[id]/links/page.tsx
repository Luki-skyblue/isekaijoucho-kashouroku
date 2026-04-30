import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createSongLink,
  deleteSongLink,
  updateSongLink,
} from "@/app/%5Fmanage/actions";
import { supabaseAdmin } from "@/lib/supabase/admin";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    saved?: string;
  }>;
};

type Song = {
  id: number;
  title: string | null;
  artist_credit: string | null;
};

type SongLink = {
  id: number;
  link_type: string | null;
  label: string | null;
  title: string | null;
  site_name: string | null;
  url: string | null;
  published_date: string | null;
  notes: string | null;
  thumbnail_url: string | null;
  created_at: string | null;
};

const LINK_TYPE_OPTIONS = [
  "mv",
  "lyric_mv",
  "live_mv",
  "original",
  "streaming",
  "lyrics",
  "piapro",
  "x",
  "announcement",
  "album",
  "other",
];

function TextInput({
  name,
  label,
  defaultValue,
  required = false,
  type = "text",
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-xs tracking-[0.18em] text-neutral-500">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
        className="border border-neutral-300 bg-[#f5f5f2] px-3 py-2 text-sm tracking-normal text-neutral-900 outline-none focus:border-neutral-900"
      />
    </label>
  );
}

function TextArea({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-xs tracking-[0.18em] text-neutral-500">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        rows={3}
        className="border border-neutral-300 bg-[#f5f5f2] px-3 py-2 text-sm tracking-normal text-neutral-900 outline-none focus:border-neutral-900"
      />
    </label>
  );
}

function LinkTypeSelect({
  defaultValue,
}: {
  defaultValue?: string | null;
}) {
  return (
    <label className="grid gap-1 text-xs tracking-[0.18em] text-neutral-500">
      LINK TYPE
      <select
        name="link_type"
        defaultValue={defaultValue ?? "other"}
        required
        className="border border-neutral-300 bg-[#f5f5f2] px-3 py-2 text-sm tracking-normal text-neutral-900 outline-none focus:border-neutral-900"
      >
        {LINK_TYPE_OPTIONS.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
    </label>
  );
}

function LinkFields({
  link,
}: {
  link?: SongLink;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <LinkTypeSelect defaultValue={link?.link_type} />
        <TextInput name="label" label="LABEL" defaultValue={link?.label} />
        <TextInput
          name="published_date"
          label="PUBLISHED DATE"
          type="date"
          defaultValue={link?.published_date}
        />
      </div>

      <TextInput
        name="url"
        label="URL"
        defaultValue={link?.url}
        required
        placeholder="https://..."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          name="title"
          label="TITLE"
          defaultValue={link?.title}
          placeholder="表示用タイトル"
        />
        <TextInput
          name="site_name"
          label="SITE NAME"
          defaultValue={link?.site_name}
          placeholder="YouTube / X / piapro など"
        />
      </div>

      <TextInput
        name="thumbnail_url"
        label="THUMBNAIL URL"
        defaultValue={link?.thumbnail_url}
        placeholder="https://..."
      />

      <TextArea
        name="notes"
        label="NOTES"
        defaultValue={link?.notes}
        placeholder="補足メモ"
      />
    </div>
  );
}

export default async function ManageSongLinksPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const songId = Number(id);

  if (!Number.isInteger(songId)) {
    notFound();
  }

  const { data: song, error: songError } = await supabaseAdmin
    .from("songs")
    .select("id, title, artist_credit")
    .eq("id", songId)
    .single<Song>();

  if (songError || !song) {
    notFound();
  }

  const { data: links, error: linksError } = await supabaseAdmin
    .from("links")
    .select(
      "id, link_type, label, title, site_name, url, published_date, notes, thumbnail_url, created_at"
    )
    .eq("target_type", "song")
    .eq("target_id", songId)
    .order("published_date", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .returns<SongLink[]>();

  if (linksError) {
    throw new Error("関連リンクの取得に失敗しました。");
  }

  const createAction = createSongLink.bind(null, songId);

  return (
    <main className="min-h-screen bg-[#f5f5f2] px-5 py-8 text-neutral-950">
      <div className="mx-auto grid max-w-5xl gap-8">
        <header className="grid gap-4 border-b border-neutral-300 pb-6">
          <div className="flex flex-wrap gap-3 text-xs tracking-[0.18em]">
            <Link
              href="/_manage"
              className="border border-neutral-300 px-3 py-2 hover:border-neutral-900"
            >
              MANAGE TOP
            </Link>
            <Link
              href="/_manage/songs"
              className="border border-neutral-300 px-3 py-2 hover:border-neutral-900"
            >
              SONGS
            </Link>
            <Link
              href={`/_manage/songs/${song.id}/edit`}
              className="border border-neutral-300 px-3 py-2 hover:border-neutral-900"
            >
              EDIT SONG
            </Link>
            <Link
              href={`/songs/${song.id}`}
              className="border border-neutral-300 px-3 py-2 hover:border-neutral-900"
            >
              PUBLIC PAGE
            </Link>
          </div>

          <div>
            <p className="font-mono text-xs tracking-[0.28em] text-neutral-500">
              MANAGE SONG LINKS
            </p>
            <h1 className="mt-2 font-serif text-3xl">
              {song.title ?? "Untitled"}
            </h1>
            {song.artist_credit ? (
              <p className="mt-2 text-sm text-neutral-600">
                {song.artist_credit}
              </p>
            ) : null}
          </div>

          {resolvedSearchParams.saved ? (
            <p className="border border-neutral-300 px-3 py-2 text-sm">
              保存しました。
            </p>
          ) : null}
        </header>

        <section className="grid gap-4 border border-neutral-300 p-5">
          <div>
            <p className="font-mono text-xs tracking-[0.28em] text-neutral-500">
              ADD LINK
            </p>
            <h2 className="mt-1 font-serif text-xl">関連リンクを追加</h2>
          </div>

          <form action={createAction} className="grid gap-5">
            <LinkFields />

            <div>
              <button
                type="submit"
                className="border border-neutral-900 bg-neutral-950 px-5 py-2 text-sm tracking-[0.18em] text-[#f5f5f2] hover:bg-neutral-800"
              >
                ADD LINK
              </button>
            </div>
          </form>
        </section>

        <section className="grid gap-4">
          <div>
            <p className="font-mono text-xs tracking-[0.28em] text-neutral-500">
              CURRENT LINKS
            </p>
            <h2 className="mt-1 font-serif text-xl">
              登録済みリンク：{links.length}件
            </h2>
          </div>

          {links.length === 0 ? (
            <p className="border border-neutral-300 p-5 text-sm text-neutral-600">
              まだ関連リンクは登録されていません。
            </p>
          ) : (
            <div className="grid gap-5">
              {links.map((link) => {
                const updateAction = updateSongLink.bind(null, link.id, songId);
                const deleteAction = deleteSongLink.bind(null, link.id, songId);

                return (
                  <article
                    key={link.id}
                    className="grid gap-5 border border-neutral-300 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-4">
                      <div>
                        <p className="font-mono text-xs tracking-[0.24em] text-neutral-500">
                          {link.link_type ?? "other"}
                        </p>
                        <h3 className="mt-1 font-serif text-lg">
                          {link.title || link.label || link.url || "Untitled"}
                        </h3>
                        {link.url ? (
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block break-all text-xs text-neutral-500 underline underline-offset-4"
                          >
                            {link.url}
                          </a>
                        ) : null}
                      </div>

                      <form action={deleteAction}>
                        <button
                          type="submit"
                          className="border border-red-300 px-3 py-2 text-xs tracking-[0.18em] text-red-700 hover:border-red-700"
                        >
                          DELETE
                        </button>
                      </form>
                    </div>

                    <form action={updateAction} className="grid gap-5">
                      <LinkFields link={link} />

                      <div>
                        <button
                          type="submit"
                          className="border border-neutral-900 px-5 py-2 text-sm tracking-[0.18em] hover:bg-neutral-950 hover:text-[#f5f5f2]"
                        >
                          UPDATE
                        </button>
                      </div>
                    </form>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}