import {
  getPublicReleaseData,
  type PublicRelease,
} from "@/lib/releases/public-release-data";
import ReleasesList from "./ReleasesList";

export const dynamic = "force-dynamic";

type Release = PublicRelease;

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
  const {
    releaseGroups: groups,
    releases,
    legacyDigitalReleases: digitalReleases,
    hasError,
  } = await getPublicReleaseData();

  if (hasError) {
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

    const releaseCards = (groups ?? [])
    .map((group): ReleaseCard | null => {
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

    const digitalReleaseCards = (digitalReleases ?? [])
    .map((digitalRelease): ReleaseCard | null => {
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
