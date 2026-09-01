import { supabase } from "@/lib/supabase/client";

export type PublicReleaseGroup = {
  id: number;
  title: string | null;
  title_kana: string | null;
  sort_title: string | null;
  release_date: string | null;
  tagline: string | null;
  notes: string | null;
};

export type PublicRelease = {
  id: number;
  title: string | null;
  release_group_id: number | null;
  release_type: string | null;
  artist_credit: string | null;
  release_date: string | null;
  jacket_image_url: string | null;
  official_url: string | null;
  edition_name: string | null;
  is_primary_edition: boolean | null;
};

export type PublicLegacyDigitalRelease = {
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

type PublicReleaseItemIdentity = {
  song_id: number | null;
  release_id: number;
  release_components: {
    medium: string | null;
  } | null;
};

function normalizeUrl(value: string | null) {
  return value?.trim().replace(/\/+$/, "") ?? null;
}

function normalizeTitle(value: string | null) {
  return value?.trim().toLocaleLowerCase() ?? null;
}

function hasUnifiedDigitalRelease(
  legacy: PublicLegacyDigitalRelease,
  releasesById: Map<number, PublicRelease>,
  releaseItems: PublicReleaseItemIdentity[]
) {
  const legacyUrl = normalizeUrl(legacy.official_url);
  const legacyTitle = normalizeTitle(legacy.title ?? legacy.songs?.title ?? null);

  return releaseItems.some((item) => {
    if (item.song_id !== legacy.song_id) {
      return false;
    }

    const release = releasesById.get(item.release_id);
    const isDigital =
      item.release_components?.medium === "digital" ||
      release?.release_type === "digital_single";

    if (!release || !isDigital) {
      return false;
    }

    const unifiedUrl = normalizeUrl(release.official_url);
    if (legacyUrl && unifiedUrl && legacyUrl === unifiedUrl) {
      return true;
    }

    return (
      legacyTitle !== null &&
      legacyTitle === normalizeTitle(release.title) &&
      legacy.release_date === release.release_date
    );
  });
}

export async function getPublicReleaseData() {
  const [groupsResult, releasesResult, digitalResult, releaseItemsResult] =
    await Promise.all([
      supabase
        .from("release_groups")
        .select("id,title,title_kana,sort_title,release_date,tagline,notes")
        .order("release_date", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .returns<PublicReleaseGroup[]>(),
      supabase
        .from("releases")
        .select(
          "id,title,release_group_id,release_type,artist_credit,release_date,jacket_image_url,official_url,edition_name,is_primary_edition"
        )
        .order("release_date", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .returns<PublicRelease[]>(),
      supabase
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
        .returns<PublicLegacyDigitalRelease[]>(),
      supabase
        .from("release_items")
        .select(
          `
          song_id,
          release_id,
          release_components (
            medium
          )
        `
        )
        .returns<PublicReleaseItemIdentity[]>(),
    ]);

  const hasError = Boolean(
    groupsResult.error ||
      releasesResult.error ||
      digitalResult.error ||
      releaseItemsResult.error
  );
  const releaseGroups = groupsResult.data ?? [];
  const releases = releasesResult.data ?? [];
  const releasesById = new Map(releases.map((release) => [release.id, release]));
  const releaseItems = releaseItemsResult.data ?? [];
  const legacyDigitalReleases = (digitalResult.data ?? []).filter(
    (legacy) => !hasUnifiedDigitalRelease(legacy, releasesById, releaseItems)
  );

  return { releaseGroups, releases, legacyDigitalReleases, hasError };
}
