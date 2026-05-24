import { supabase } from "@/lib/supabase/client";
import ReleasesList from "./ReleasesList";

export const dynamic = "force-dynamic";

type ReleaseGroup = {
  id: number;
  title: string | null;
  title_kana: string | null;
  sort_title: string | null;
  release_date: string | null;
  tagline: string | null;
  notes: string | null;
};

type Release = {
  id: number;
  title: string | null;
  release_group_id: number | null;
  release_type: string | null;
  artist_credit: string | null;
  release_date: string | null;
  jacket_image_url: string | null;
  edition_name: string | null;
  is_primary_edition: boolean | null;
};

type SongDigitalRelease = {
  id: number;
  song_id: number;
  title: string | null;
  release_date: string | null;
  jacket_image_url: string | null;
  official_url: string | null;
  notes: string | null;
  songs: {
    id: number;
    title: string | null;
    title_kana: string | null;
    sort_title: string | null;
    artist_credit: string | null;
  } | null;
};

export type ReleaseCard = {
  sourceType: "release" | "digital_single";
  groupId: number;
  title: string;
  titleKana: string | null;
  sortTitle: string | null;
  tagline: string | null;
  releaseDate: string | null;
  href: string;
  jacketImageUrl: string | null;
  releaseType: string | null;
  artistCredit: string | null;
  editions: string[];
};

function pickPrimaryRelease(releases: Release[]) {
  return [...releases].sort((a, b) => {
    if (a.is_primary_edition !== b.is_primary_edition) {
      return a.is_primary_edition ? -1 : 1;
    }

    const aDate = a.release_date ?? "9999-99-99";
    const bDate = b.release_date ?? "9999-99-99";
    const dateCompare = aDate.localeCompare(bDate);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return a.id - b.id;
  })[0];
}

function getEditionLabel(release: Release) {
  if (release.edition_name && release.edition_name.trim()) {
    return release.edition_name;
  }

  if (release.title && release.title.trim()) {
    return release.title;
  }

  return `#${release.id}`;
}

export default async function ReleasesPage() {
  const { data: groups, error: groupsError } = await supabase
    .from("release_groups")
    .select("id,title,title_kana,sort_title,release_date,tagline,notes")
    .order("release_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .returns<ReleaseGroup[]>();

  const { data: releases, error: releasesError } = await supabase
    .from("releases")
    .select(
      "id,title,release_group_id,release_type,artist_credit,release_date,jacket_image_url,edition_name,is_primary_edition"
    )
    .order("release_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .returns<Release[]>();

  const { data: digitalReleases, error: digitalReleasesError } = await supabase
    .from("song_digital_releases")
    .select(
      `
      id,
      song_id,
      title,
      release_date,
      jacket_image_url,
      official_url,
      notes,
      songs (
        id,
        title,
        title_kana,
        sort_title,
        artist_credit
      )
    `
    )
    .order("release_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .returns<SongDigitalRelease[]>();

  if (groupsError || releasesError || digitalReleasesError) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="archive-label text-black/45">RELEASES</p>
        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black">
          収録作品目録
        </h1>
        <p className="mt-6 border border-black/15 p-5 text-sm text-black/60">
          リリースデータの取得に失敗しました。
        </p>
      </main>
    );
  }

  const releasesByGroupId = new Map<number, Release[]>();

  for (const release of releases ?? []) {
    if (!release.release_group_id) {
      continue;
    }

    const current = releasesByGroupId.get(release.release_group_id) ?? [];
    current.push(release);
    releasesByGroupId.set(release.release_group_id, current);
  }

  const releaseCards: ReleaseCard[] = (groups ?? [])
    .map((group) => {
      const groupReleases = releasesByGroupId.get(group.id) ?? [];
      const primaryRelease = pickPrimaryRelease(groupReleases);

      if (!primaryRelease) {
        return null;
      }

      const editions = [...groupReleases]
        .sort((a, b) => {
          if (a.is_primary_edition !== b.is_primary_edition) {
            return a.is_primary_edition ? -1 : 1;
          }

          return a.id - b.id;
        })
        .map(getEditionLabel)
        .filter((label, index, array) => array.indexOf(label) === index);

      return {
        sourceType: "release" as const,
        groupId: group.id,
        title: group.title ?? primaryRelease.title ?? `#${group.id}`,
        titleKana: group.title_kana,
        sortTitle: group.sort_title,
        tagline: group.tagline,
        releaseDate: group.release_date ?? primaryRelease.release_date,
        href: `/releases/${primaryRelease.id}`,
        jacketImageUrl: primaryRelease.jacket_image_url,
        releaseType: primaryRelease.release_type,
        artistCredit: primaryRelease.artist_credit,
        editions,
      };
    })
    .filter((card): card is ReleaseCard => card !== null);

  const digitalReleaseCards: ReleaseCard[] = (digitalReleases ?? [])
    .map((digitalRelease) => {
      const song = digitalRelease.songs;

      if (!song) {
        return null;
      }

      return {
        sourceType: "digital_single" as const,
        groupId: -digitalRelease.id,
        title: digitalRelease.title ?? song.title ?? `#${digitalRelease.id}`,
        titleKana: song.title_kana,
        sortTitle: song.sort_title,
        tagline: null,
        releaseDate: digitalRelease.release_date,
        href: `/songs/${song.id}`,
        jacketImageUrl: digitalRelease.jacket_image_url,
        releaseType: "digital_single",
        artistCredit: song.artist_credit,
        editions: [],
      };
    })
    .filter((card): card is ReleaseCard => card !== null);

  const cards = [...releaseCards, ...digitalReleaseCards].sort((a, b) => {
    const aDate = a.releaseDate ?? "0000-00-00";
    const bDate = b.releaseDate ?? "0000-00-00";
    const dateCompare = bDate.localeCompare(aDate);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return a.title.localeCompare(b.title, "ja");
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <section className="border-b border-black/15 pb-8">
        <p className="archive-label text-black/45">RELEASES</p>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif-jp text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
              収録作品目録
            </h1>
            <p className="mt-4 text-sm leading-7 text-black/55">
              アルバム、シングル、EP、CD、配信シングルなどの作品をまとめた目録です。
            </p>
          </div>

          <p className="text-sm text-black/45">{cards.length} RELEASES</p>
        </div>
      </section>

      <ReleasesList releases={cards} />
    </main>
  );
}