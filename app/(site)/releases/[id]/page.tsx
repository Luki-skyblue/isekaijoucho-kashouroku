import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ReleaseItem = {
  id: number;
  disc_number: number | null;
  track_number: number | null;
  title_override: string | null;
  track_title: string | null;
  track_artist: string | null;
  notes: string | null;
  songs: {
    id: number;
    title: string | null;
    artist_credit: string | null;
    song_type: string | null;
    version_name: string | null;
    is_primary_version: boolean | null;
  } | null;
};

type ReleaseGroup = {
  id: number;
  title: string | null;
  title_kana: string | null;
  sort_title: string | null;
  release_date: string | null;
  notes: string | null;
};

type ReleaseEdition = {
  id: number;
  title: string | null;
  edition_name: string | null;
  is_primary_edition: boolean | null;
  jacket_image_url: string | null;
  release_date: string | null;
};

function hasValue(value: string | null | undefined) {
  return Boolean(value && value.trim() && value.trim() !== "-");
}

function formatDate(date: string | null) {
  if (!date) {
    return "----.--.--";
  }

  return date.replaceAll("-", ".");
}

function formatReleaseType(type: string | null) {
  switch (type) {
    case "digital_single":
      return "DIGITAL SINGLE";
    case "single":
      return "SINGLE";
    case "ep":
      return "EP";
    case "album":
      return "ALBUM";
    case "cd":
      return "CD";
    case "compilation":
      return "COMPILATION";
    default:
      return type?.toUpperCase() ?? "RELEASE";
  }
}

function getTrackTitle(item: ReleaseItem) {
  if (hasValue(item.title_override)) {
    return item.title_override;
  }

  if (hasValue(item.songs?.title)) {
    return item.songs?.title;
  }

  if (hasValue(item.track_title)) {
    return item.track_title;
  }

  return "未設定のトラック";
}

function getTrackArtist(item: ReleaseItem) {
  if (hasValue(item.track_artist)) {
    return item.track_artist;
  }

  if (hasValue(item.songs?.artist_credit)) {
    return item.songs?.artist_credit;
  }

  return "-";
}

function getVersionDisplay(song: ReleaseItem["songs"]) {
  if (!song) {
    return null;
  }

  if (hasValue(song.version_name)) {
    return song.version_name;
  }

  if (song.is_primary_version === false) {
    return "別バージョン";
  }

  return null;
}

function getEditionLabel(edition: ReleaseEdition) {
  if (hasValue(edition.edition_name)) {
    return edition.edition_name;
  }

  if (hasValue(edition.title)) {
    return edition.title;
  }

  return `#${edition.id}`;
}

// function formatTrackPosition(item: ReleaseItem) {
//   const parts = [];

//   if (item.disc_number) {
//     parts.push(`DISC ${item.disc_number}`);
//   }

//   if (item.track_number) {
//     parts.push(`TRACK ${item.track_number}`);
//   }

//   return parts.join(" / ");
// }

function formatTrackNumber(item: ReleaseItem) {
  if (!item.track_number) {
    return "--";
  }

  return String(item.track_number).padStart(2, "0");
}

export default async function ReleasePage({ params }: PageProps) {
  const { id } = await params;
  const releaseId = Number(id);

  if (!Number.isFinite(releaseId)) {
    notFound();
  }

  const { data: release, error } = await supabase
    .from("releases")
    .select(
      "id, title, title_kana, sort_title, release_type, artist_credit, release_date, jacket_image_url, official_url, notes, release_group_id, edition_name, is_primary_edition"
    )
    .eq("id", releaseId)
    .single();

  if (error || !release) {
    notFound();
  }

  let releaseGroup: ReleaseGroup | null = null;
  let editions: ReleaseEdition[] = [];

  if (release.release_group_id) {
    const { data: groupData, error: groupError } = await supabase
      .from("release_groups")
      .select("id, title, title_kana, sort_title, release_date, notes")
      .eq("id", release.release_group_id)
      .single()
      .returns<ReleaseGroup>();

    if (groupError) {
      throw new Error("作品グループの取得に失敗しました。");
    }

    releaseGroup = groupData;

    const { data: editionData, error: editionsError } = await supabase
      .from("releases")
      .select(
        "id, title, edition_name, is_primary_edition, jacket_image_url, release_date"
      )
      .eq("release_group_id", release.release_group_id)
      .order("is_primary_edition", { ascending: false })
      .order("release_date", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .returns<ReleaseEdition[]>();

    if (editionsError) {
      throw new Error("形態違いの取得に失敗しました。");
    }

    editions = editionData ?? [];
  }

  let itemsQuery = supabase
    .from("release_items")
    .select(
      `
      id,
      disc_number,
      track_number,
      title_override,
      track_title,
      track_artist,
      notes,
      songs (
        id,
        title,
        artist_credit,
        song_type,
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">

      <div className="mb-8 flex flex-col gap-4 border-b border-black/10 pb-5 md:flex-row md:items-start md:justify-between">
        <Link
          href="/songs"
          className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
        >
          BACK TO SONGS
        </Link>

        {hasValue(release.official_url) ? (
          <a
            href={release.official_url ?? ""}
            target="_blank"
            rel="noreferrer"
            className="border border-black/25 px-3 py-1.5 text-xs font-medium tracking-[0.12em] text-black/60 transition hover:border-black hover:bg-black hover:text-[#f5f5f2]"
          >
            OFFICIAL
          </a>
        ) : null}
      </div>

      {releaseGroup ? (
        <section className="mb-8 border-b border-black/15 pb-8">
          <p className="section-label text-black/45">RELEASE</p>

          <h1 className="font-serif-jp mt-3 break-words text-4xl font-medium tracking-[0.02em] text-black md:text-6xl">
            {hasValue(releaseGroup.title) ? releaseGroup.title : release.title}
          </h1>

          {hasValue(releaseGroup.title_kana) ? (
            <p className="mt-2 text-sm tracking-[0.04em] text-black/45">
              {releaseGroup.title_kana}
            </p>
          ) : null}

          {editions.length > 1 ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {editions.map((edition) => {
                const isCurrent = edition.id === release.id;

                return (
                  <Link
                    key={edition.id}
                    href={`/releases/${edition.id}`}
                    className={
                      isCurrent
                        ? "border border-black bg-black px-4 py-2 text-xs font-medium tracking-[0.12em] text-[#f5f5f2]"
                        : "border border-black/25 px-4 py-2 text-xs font-medium tracking-[0.12em] text-black/55 transition hover:border-black hover:text-black"
                    }
                  >
                    {getEditionLabel(edition)}
                  </Link>
                );
              })}
            </div>
          ) : null}

          {hasValue(releaseGroup.notes) ? (
            <p className="mt-5 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-black/55">
              {releaseGroup.notes}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-5 border-b border-black/15 pb-10 sm:grid-cols-[9rem_minmax(0,1fr)] md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
        <div className="w-full self-start overflow-hidden border border-black/15 bg-black/[0.02]">
          {hasValue(release.jacket_image_url) ? (
            <img
              src={release.jacket_image_url ?? ""}
              alt=""
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="aspect-square w-full p-3 sm:p-5">
              <p className="section-label text-black/35">IMAGE</p>
              <p className="mt-2 text-xs leading-5 text-black/35 sm:text-sm">
                情報がありません。
              </p>
            </div>
          )}
        </div>

        <div className="min-w-0 self-center md:self-start">
          <p className="section-label text-black/45">
            {releaseGroup
              ? `EDITION / ${formatReleaseType(release.release_type)}`
              : formatReleaseType(release.release_type)}
          </p>

          <h1 className="font-serif-jp mt-3 break-words text-2xl font-medium tracking-[0.02em] text-black sm:text-3xl md:text-5xl">
            {release.title}
          </h1>

          {hasValue(release.edition_name) ? (
            <p className="mt-2 text-xs tracking-[0.12em] text-black/40">
              EDITION: {release.edition_name}
            </p>
          ) : null}          

          {hasValue(release.title_kana) ? (
            <p className="mt-2 text-xs tracking-[0.04em] text-black/45 sm:text-sm">
              {release.title_kana}
            </p>
          ) : null}

          <p className="mt-4 text-sm text-black/70 sm:text-base md:text-lg">
            {hasValue(release.artist_credit) ? release.artist_credit : "-"}
          </p>

          <p className="mt-3 text-xs tracking-[0.12em] text-black/40">
            {formatDate(release.release_date)}
          </p>
        </div>
      </section>

      <section className="mt-12 grid gap-8 md:grid-cols-[180px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">TRACKLIST</p>
          <h2 className="section-title-ja">収録曲</h2>
        </div>

        <div className="divide-y divide-black/10 border-y border-black/10">
        {(items ?? []).map((item) => {
            const title = getTrackTitle(item);
            const artist = getTrackArtist(item);
            const versionDisplay = getVersionDisplay(item.songs);
            const trackNumber = formatTrackNumber(item);
            const isLinkedSong = Boolean(item.songs?.id);

            const titleText = versionDisplay
            ? `${title} (${versionDisplay})`
            : title;

            const rowContent = (
            <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 py-3">
                <p className="text-xs tabular-nums text-black/35">
                {trackNumber}.
                </p>

                <div className="min-w-0">
                <p
                    className={
                    isLinkedSong
                        ? "text-sm leading-6 text-black underline-offset-4 group-hover:underline"
                        : "text-sm leading-6 text-black/55"
                    }
                >
                    <span className="font-medium">{titleText}</span>
                    <span className="text-black/35"> / </span>
                    <span className="text-black/55">{artist}</span>
                </p>

                {item.notes ? (
                    <p className="mt-1 text-xs leading-5 text-black/35">
                    {item.notes}
                    </p>
                ) : null}
                </div>
            </div>
            );

            if (isLinkedSong) {
            return (
                <Link
                key={item.id}
                href={`/songs/${item.songs?.id}`}
                className="group block transition hover:bg-black/[0.03]"
                >
                {rowContent}
                </Link>
            );
            }

            return (
            <div key={item.id} className="block">
                {rowContent}
            </div>
            );
        })}

        {(!items || items.length === 0) && (
            <p className="py-4 text-sm text-black/35">
            収録曲情報がありません。
            </p>
        )}
        </div>
      </section>

      <section className="mt-12 grid gap-8 md:grid-cols-[180px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">NOTES</p>
          <h2 className="section-title-ja">備考</h2>
        </div>

        <div className="border-y border-black/10 py-3">
        {hasValue(release.notes) ? (
            <p className="whitespace-pre-wrap text-sm leading-6 text-black/80">
            {release.notes}
            </p>
        ) : (
            <p className="text-sm leading-6 text-black/35">
            情報がありません。
            </p>
        )}
        </div>
      </section>
    </main>
  );
}