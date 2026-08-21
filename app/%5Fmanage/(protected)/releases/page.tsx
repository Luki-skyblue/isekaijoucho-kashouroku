import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ManageRelease = {
  id: number;
  title: string | null;
  title_kana: string | null;
  sort_title: string | null;
  release_type: string | null;
  artist_credit: string | null;
  release_date: string | null;
  jacket_image_url: string | null;
  official_url: string | null;
  edition_name: string | null;
  release_groups: {
    id: number;
    title: string | null;
  } | null;
};

function formatDate(date: string | null) {
  if (!date) {
    return "-";
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
      return type?.toUpperCase() ?? "-";
  }
}

type PageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

type ReleaseGroup = {
  key: string;
  title: string;
  releases: ManageRelease[];
};

function ReleaseRow({ release }: { release: ManageRelease }) {
  return (
    <div className="grid gap-2 border-t border-black/10 py-4 md:grid-cols-[70px_110px_1fr_140px_170px] md:items-center md:gap-4">
      <p className="section-label text-black/45">#{release.id}</p>

      <p className="text-xs tabular-nums text-black/45">
        {formatDate(release.release_date)}
      </p>

      <div className="min-w-0">
        <Link
          href={`/_manage/releases/${release.id}`}
          className="truncate text-sm font-medium text-black underline-offset-4 transition hover:underline"
        >
          {release.title}
        </Link>

        {release.edition_name ? (
          <p className="mt-1 text-xs text-black/45">
            形態: {release.edition_name}
          </p>
        ) : null}

        {release.title_kana ? (
          <p className="mt-1 truncate text-xs text-black/35">
            {release.title_kana}
          </p>
        ) : null}

        {release.sort_title ? (
          <p className="mt-1 truncate text-xs text-black/35">
            sort: {release.sort_title}
          </p>
        ) : null}
      </div>

      <p className="text-xs uppercase tracking-[0.1em] text-black/45">
        {formatReleaseType(release.release_type)}
      </p>

      <p className="truncate text-xs text-black/45">
        {release.artist_credit ?? "-"}
      </p>

    </div>
  );
}

export default async function ManageReleasesPage({ searchParams }: PageProps) {
  const { q = "" } = await searchParams;
  const searchQuery = q.trim();

  const { data: releases, error } = await supabaseAdmin
    .from("releases")
    .select(
      "id,title,title_kana,sort_title,release_type,artist_credit,release_date,jacket_image_url,official_url,edition_name,release_groups(id,title)"
    )
    .order("release_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .returns<ManageRelease[]>();

  const filteredReleases = (releases ?? []).filter((release) => {
    if (!searchQuery) {
      return true;
    }

    const normalizedQuery = searchQuery.toLocaleLowerCase("ja-JP");

    return [
      release.release_groups?.title,
      release.title,
      release.title_kana,
      release.edition_name,
      release.artist_credit,
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase("ja-JP").includes(normalizedQuery));
  });

  const groupedReleases = filteredReleases.reduce<ReleaseGroup[]>(
    (groups, release) => {
      const groupId = release.release_groups?.id;
      const key = groupId ? `group-${groupId}` : `release-${release.id}`;
      const existingGroup = groups.find((group) => group.key === key);

      if (existingGroup) {
        existingGroup.releases.push(release);
        return groups;
      }

      groups.push({
        key,
        title: release.release_groups?.title ?? release.title ?? `#${release.id}`,
        releases: [release],
      });

      return groups;
    },
    []
  );

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <Link
          href="/_manage"
          className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
        >
          BACK TO MANAGE
        </Link>

        <section className="mt-8 border border-black/15 p-5">
          <p className="section-label text-black/45">ERROR</p>
          <p className="mt-3 text-sm leading-7 text-black/65">
            リリース情報の取得に失敗しました。
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <section className="border-b border-black/15 pb-8">
        <Link
          href="/_manage"
          className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
        >
          BACK TO MANAGE
        </Link>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif-jp text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
              リリース情報
            </h1>

            <p className="mt-4 text-sm leading-7 text-black/55">
              アルバム、EP、CD、配信シングルなどのリリース情報を確認します。
            </p>
          </div>

            <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <p className="text-sm text-black/45">
              {searchQuery ? `${filteredReleases.length} / ` : ""}
              {releases?.length ?? 0} RELEASES
            </p>

            <Link
                href="/_manage/releases/new"
                className="border border-black px-4 py-2 text-xs font-medium tracking-[0.12em] text-black transition hover:bg-black hover:text-[#f5f5f2]"
            >
                ADD RELEASE
            </Link>
            </div>
        </div>
      </section>

      <section className="mt-8">
        <form className="border-y border-black/15 py-5" method="get">
          <label className="block">
            <span className="section-label text-black/45">リリースを探す</span>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                name="q"
                defaultValue={searchQuery}
                placeholder="作品名・読み仮名・アーティストで検索"
                className="min-w-0 flex-1 border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition placeholder:text-black/35 focus:border-black"
              />
              <button
                type="submit"
                className="border border-black px-4 py-2 text-xs font-medium tracking-[0.12em] text-black transition hover:bg-black hover:text-[#f5f5f2]"
              >
                検索
              </button>
              {searchQuery ? (
                <Link
                  href="/_manage/releases"
                  className="border border-black/20 px-4 py-2 text-center text-xs text-black/55 transition hover:border-black hover:text-black"
                >
                  クリア
                </Link>
              ) : null}
            </div>
          </label>
        </form>

        <div className="divide-y divide-black/10 border-b border-black/15">
          {groupedReleases.map((group) => (
            <details key={group.key} open={Boolean(searchQuery)} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 marker:hidden">
                <span className="min-w-0">
                  <span className="block truncate font-serif-jp text-xl text-black/80">
                    {group.title}
                  </span>
                  <span className="mt-1 block text-xs text-black/40">
                    {group.releases.length} 形態
                  </span>
                </span>
                <span className="shrink-0 border border-black/20 px-3 py-1 text-xs text-black/50 group-open:bg-black group-open:text-[#f5f5f2]">
                  開く
                </span>
              </summary>

              <div className="pb-4 md:pl-5">
                <div className="hidden border-t border-black/15 py-3 text-xs font-medium tracking-[0.12em] text-black/45 md:grid md:grid-cols-[70px_110px_1fr_140px_170px] md:gap-4">
                  <p>ID</p>
                  <p>DATE</p>
                  <p>EDITION</p>
                  <p>TYPE</p>
                  <p>ARTIST</p>
                </div>
                {group.releases.map((release) => (
                  <ReleaseRow key={release.id} release={release} />
                ))}
              </div>
            </details>
          ))}

          {groupedReleases.length === 0 && (
            <p className="py-10 text-sm text-black/45">
              {searchQuery
                ? "検索条件に一致するリリースがありません。"
                : "リリース情報がありません。"}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
