import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createReleaseItem,
  deleteReleaseItem,
  updateReleaseItem,
} from "../../../../actions";
import SongIdInput from "./SongIdInput";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    saved?: string;
  }>;
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

function formatDate(date: string | null) {
  if (!date) {
    return "-";
  }

  return date.replaceAll("-", ".");
}

function getSongOptionLabel(song: SongOption) {
  const version =
    song.version_name ||
    (song.is_primary_version === false ? "別バージョン" : null);

  return `#${song.id} ${song.title ?? "無題"}${
    version ? ` (${version})` : ""
  } / ${song.artist_credit ?? "-"}`;
}

function getItemTitle(item: ReleaseItem) {
  if (item.title_override) {
    return item.title_override;
  }

  if (item.songs?.title) {
    return item.songs.title;
  }

  if (item.track_title) {
    return item.track_title;
  }

  return "未設定のトラック";
}

function getItemArtist(item: ReleaseItem) {
  if (item.track_artist) {
    return item.track_artist;
  }

  if (item.songs?.artist_credit) {
    return item.songs.artist_credit;
  }

  return "-";
}

function getVersionLabel(song: ReleaseItem["songs"]) {
  if (!song) {
    return null;
  }

  if (song.version_name) {
    return song.version_name;
  }

  if (song.is_primary_version === false) {
    return "別バージョン";
  }

  return null;
}

function TextInput({
  name,
  label,
  defaultValue,
  type = "text",
  list,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  type?: string;
  list?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-xs tracking-[0.18em] text-neutral-500">
      {label}
      <input
        name={name}
        type={type}
        list={list}
        defaultValue={defaultValue ?? ""}
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
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
}) {
  return (
    <label className="grid gap-1 text-xs tracking-[0.18em] text-neutral-500">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={3}
        className="border border-neutral-300 bg-[#f5f5f2] px-3 py-2 text-sm tracking-normal text-neutral-900 outline-none focus:border-neutral-900"
      />
    </label>
  );
}

function ReleaseItemFields({
  item,
  songs,
}: {
  item?: ReleaseItem;
  songs: SongOption[];
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-[110px_110px_1fr]">
        <TextInput
          name="disc_number"
          label="DISC"
          type="number"
          defaultValue={item?.disc_number}
        />
        <TextInput
          name="track_number"
          label="TRACK"
          type="number"
          defaultValue={item?.track_number}
        />
        <SongIdInput songs={songs} defaultValue={item?.song_id} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          name="track_title"
          label="TRACK TITLE"
          defaultValue={item?.track_title}
          placeholder="song_id がない場合の曲名"
        />
        <TextInput
          name="track_artist"
          label="TRACK ARTIST"
          defaultValue={item?.track_artist}
          placeholder="song_id がない場合のアーティスト"
        />
      </div>

      <TextInput
        name="title_override"
        label="TITLE OVERRIDE"
        defaultValue={item?.title_override}
        placeholder="リリース上の表記が songs.title と違う場合"
      />

      <TextArea name="notes" label="NOTES" defaultValue={item?.notes} />
    </div>
  );
}

export default async function ManageReleaseItemsPage({
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
    "id,title,release_type,artist_credit,release_date,release_group_id,release_groups(id,title)"
    )
    .eq("id", releaseId)
    .single();

  if (error || !release) {
    notFound();
  }

    let itemsQuery = supabaseAdmin
    .from("release_items")
    .select(
        `
        id,
        disc_number,
        track_number,
        song_id,
        track_title,
        track_artist,
        title_override,
        notes,
        songs (
        id,
        title,
        artist_credit,
        version_name,
        is_primary_version
        )
    `
    );

    if (release.release_group_id) {
    itemsQuery = itemsQuery.eq("release_group_id", release.release_group_id);
    } else {
    itemsQuery = itemsQuery.eq("release_id", release.id);
    }

    const { data: items, error: itemsError } = await itemsQuery
    .order("disc_number", { ascending: true, nullsFirst: false })
    .order("track_number", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .returns<ReleaseItem[]>();

  if (itemsError) {
    throw new Error("収録曲の取得に失敗しました。");
  }

  const { data: songs, error: songsError } = await supabaseAdmin
    .from("songs")
    .select("id,title,artist_credit,version_name,is_primary_version")
    .order("title_kana", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .returns<SongOption[]>();

  if (songsError) {
    throw new Error("楽曲候補の取得に失敗しました。");
  }

  async function createAction(formData: FormData) {
    "use server";

    await createReleaseItem(releaseId, formData);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <section className="border-b border-black/15 pb-8">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/_manage/releases"
            className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
          >
            BACK TO RELEASES
          </Link>

          <Link
            href={`/_manage/releases/${release.id}/edit`}
            className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
          >
            EDIT RELEASE
          </Link>

          <Link
            href={`/releases/${release.id}`}
            target="_blank"
            className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
          >
            VIEW PUBLIC
          </Link>
        </div>

        <p className="section-label mt-8 text-black/45">RELEASE ITEMS</p>

        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
          {release.title}
        </h1>

        <p className="mt-4 text-sm leading-7 text-black/55">
          {release.artist_credit ?? "-"} / {formatDate(release.release_date)}
        </p>

        {release.release_group_id ? (
        <p className="mt-4 border border-black/15 bg-black/[0.03] p-3 text-sm leading-6 text-black/60">
            このリリースは release_group_id: {release.release_group_id} に属しています。
            収録曲は同じグループの形態違いと共通で管理されます。
        </p>
        ) : null}

        {saved ? (
          <p className="mt-5 border border-black/25 bg-black/[0.03] p-3 text-sm text-black/70">
            保存しました。現在表示されている収録曲情報はデータベースに反映済みです。
          </p>
        ) : null}
      </section>

      <section className="mt-8 grid gap-4 border border-neutral-300 p-5">
        <div>
          <p className="font-mono text-xs tracking-[0.28em] text-neutral-500">
            ADD ITEM
          </p>
          <h2 className="mt-1 font-serif text-xl">収録曲を追加</h2>
          <p className="mt-2 text-xs leading-6 text-neutral-500">
            歌唱録に登録済みの曲は SONG ID を指定します。未登録曲は SONG ID を空欄にして、TRACK TITLE / TRACK ARTIST を入力します。
          </p>
        </div>

        <form action={createAction} className="grid gap-5">
          <ReleaseItemFields songs={songs ?? []} />

          <div>
            <button
              type="submit"
              className="border border-neutral-900 bg-neutral-950 px-5 py-2 text-sm tracking-[0.18em] text-[#f5f5f2] hover:bg-neutral-800"
            >
              ADD ITEM
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 grid gap-5">
        <div>
          <p className="font-mono text-xs tracking-[0.28em] text-neutral-500">
            CURRENT ITEMS
          </p>
          <h2 className="mt-1 font-serif text-xl">登録済み収録曲</h2>
        </div>

        <div className="grid gap-5">
          {(items ?? []).map((item) => {
            const title = getItemTitle(item);
            const artist = getItemArtist(item);
            const versionLabel = getVersionLabel(item.songs);

            async function updateAction(formData: FormData) {
              "use server";

              await updateReleaseItem(releaseId, item.id, formData);
            }

            async function deleteAction() {
              "use server";

              await deleteReleaseItem(releaseId, item.id);
            }

            return (
              <article
                key={item.id}
                className="grid gap-5 border border-neutral-300 p-5"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs tabular-nums text-black/35">
                      {item.track_number
                        ? String(item.track_number).padStart(2, "0")
                        : "--"}
                      .
                    </p>
                    <p className="mt-1 text-sm font-medium text-black">
                      {title}
                      {versionLabel ? (
                        <span className="ml-2 text-[10px] tracking-[0.12em] text-black/35">
                          {versionLabel}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-black/45">{artist}</p>
                    <p className="mt-1 text-xs text-black/35">
                      {item.song_id ? `song_id: ${item.song_id}` : "song_id なし"}
                    </p>
                  </div>

                  {item.songs?.id ? (
                    <Link
                      href={`/songs/${item.songs.id}`}
                      target="_blank"
                      className="text-xs tracking-[0.12em] text-black/45 underline-offset-4 hover:underline"
                    >
                      VIEW SONG
                    </Link>
                  ) : null}
                </div>

                <form action={updateAction} className="grid gap-5">
                  <ReleaseItemFields item={item} songs={songs ?? []} />

                  <div>
                    <button
                      type="submit"
                      className="border border-neutral-900 px-5 py-2 text-sm tracking-[0.18em] hover:bg-neutral-950 hover:text-[#f5f5f2]"
                    >
                      UPDATE
                    </button>
                  </div>
                </form>

                <form action={deleteAction}>
                  <button
                    type="submit"
                    className="text-xs tracking-[0.12em] text-red-700/70 underline-offset-4 hover:underline"
                  >
                    DELETE ITEM
                  </button>
                </form>
              </article>
            );
          })}

          {(!items || items.length === 0) && (
            <p className="border-y border-black/10 py-4 text-sm text-black/35">
              情報がありません。
            </p>
          )}
        </div>
      </section>
    </main>
  );
}