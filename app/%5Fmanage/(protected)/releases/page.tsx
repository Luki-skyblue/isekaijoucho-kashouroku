import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

export default async function ManageReleasesPage() {
  const { data: releases, error } = await supabaseAdmin
    .from("releases")
    .select(
      "id,title,title_kana,sort_title,release_type,artist_credit,release_date,jacket_image_url,official_url"
    )
    .order("release_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });

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
        <div className="hidden border-y border-black/15 py-3 text-xs font-medium tracking-[0.12em] text-black/45 md:grid md:grid-cols-[70px_110px_1fr_140px_170px_160px]">
          <p>ID</p>
          <p>DATE</p>
          <p>TITLE</p>
          <p>TYPE</p>
          <p>ARTIST</p>
          <p>ACTIONS</p>
        </div>

        <div className="divide-y divide-black/10 border-b border-black/15">
          {releases?.map((release) => (
            <div
              key={release.id}
              className="grid gap-2 py-4 md:grid-cols-[70px_110px_1fr_140px_170px_160px] md:items-center md:gap-4"
            >
              <p className="section-label text-black/45">#{release.id}</p>

              <p className="text-xs tabular-nums text-black/45">
                {formatDate(release.release_date)}
              </p>

              <div className="min-w-0">
                <Link
                  href={`/releases/${release.id}`}
                  target="_blank"
                  className="truncate text-sm font-medium text-black underline-offset-4 transition hover:underline"
                >
                  {release.title}
                </Link>

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

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/_manage/releases/${release.id}/edit`}
                  className="border border-black/20 px-2 py-0.5 text-[11px] tracking-[0.08em] text-black/50 transition hover:border-black hover:text-black"
                >
                  EDIT
                </Link>

                <Link
                  href={`/_manage/releases/${release.id}/items`}
                  className="border border-black/20 px-2 py-0.5 text-[11px] tracking-[0.08em] text-black/50 transition hover:border-black hover:text-black"
                >
                  ITEMS
                </Link>

                <Link
                  href={`/releases/${release.id}`}
                  target="_blank"
                  className="border border-black/20 px-2 py-0.5 text-[11px] tracking-[0.08em] text-black/50 transition hover:border-black hover:text-black"
                >
                  VIEW
                </Link>
              </div>
            </div>
          ))}

          {(!releases || releases.length === 0) && (
            <p className="py-10 text-sm text-black/45">
              リリース情報がありません。
            </p>
          )}
        </div>
      </section>
    </main>
  );
}