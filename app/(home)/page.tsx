import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import HomeThemeMotif from "./HomeThemeMotif";

export const dynamic = "force-dynamic";

const FIELD_STATUS_KEYS = [
  "first_status",
  "first_full_status",
  "tie_up_status",
  "album_text_status",
  "original_artist_status",
  "original_vocal_status",
  "original_lyricist_status",
  "original_composer_status",
  "original_arranger_status",
] as const;

const HOME_THEME = {
  accent: "#b99a52",
  accentDeep: "#665638",
  accentSoft: "#efe5cb",
  motif: "triangle",
} as const;

type LatestSong = {
  verification_status: string | null;
  first_status: string | null;
  first_full_status: string | null;
  tie_up_status: string | null;
  album_text_status: string | null;
  original_artist_status: string | null;
  original_vocal_status: string | null;
  original_lyricist_status: string | null;
  original_composer_status: string | null;
  original_arranger_status: string | null;
};

type HomeReleaseGroup = {
  id: number;
  title: string | null;
  release_date: string | null;
};

type HomeRelease = {
  id: number;
  title: string | null;
  release_group_id: number | null;
  release_type: string | null;
  artist_credit: string | null;
  release_date: string | null;
  jacket_image_url: string | null;
  is_primary_edition: boolean | null;
};

type HomeDigitalRelease = {
  id: number;
  song_id: number;
  title: string | null;
  release_date: string | null;
  jacket_image_url: string | null;
  songs: {
    id: number;
    title: string | null;
    artist_credit: string | null;
  } | null;
};

type HomeReleaseCard = {
  key: string;
  title: string;
  releaseDate: string | null;
  href: string;
  jacketImageUrl: string | null;
  artistCredit: string | null;
  kind: "release" | "digital_single";
};

function pickPrimaryRelease(releases: HomeRelease[]) {
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

function isAttentionStatus(status: string | null | undefined) {
  return Boolean(status && status !== "confirmed");
}

function hasAttentionStatus(song: LatestSong) {
  if (isAttentionStatus(song.verification_status)) {
    return true;
  }

  return FIELD_STATUS_KEYS.some((key) => isAttentionStatus(song[key]));
}

export default async function HomePage() {
  const { data: latestSongs } = await supabase
    .from("songs")
    .select(
      "id,title,first_date,first_source,artist_credit,song_type,verification_status,first_status,first_full_status,tie_up_status,album_text_status,original_artist_status,original_vocal_status,original_lyricist_status,original_composer_status,original_arranger_status"
    )
    .order("first_date", { ascending: false })
    .limit(5);

  const { data: releaseGroups } = await supabase
    .from("release_groups")
    .select("id,title,release_date")
    .returns<HomeReleaseGroup[]>();

  const { data: releases } = await supabase
    .from("releases")
    .select(
      "id,title,release_group_id,release_type,artist_credit,release_date,jacket_image_url,is_primary_edition"
    )
    .returns<HomeRelease[]>();

  const { data: digitalReleases } = await supabase
    .from("song_digital_releases")
    .select(
      `
        id,
        song_id,
        title,
        release_date,
        jacket_image_url,
        songs (
          id,
          title,
          artist_credit
        )
      `
    )
    .returns<HomeDigitalRelease[]>();

  const releasesByGroupId = new Map<number, HomeRelease[]>();

  for (const release of releases ?? []) {
    if (release.release_group_id === null) {
      continue;
    }

    const current = releasesByGroupId.get(release.release_group_id) ?? [];

    current.push(release);
    releasesByGroupId.set(release.release_group_id, current);
  }

  const groupReleaseCards = (releaseGroups ?? [])
    .map((group): HomeReleaseCard | null => {
      const groupReleases = releasesByGroupId.get(group.id) ?? [];
      const primaryRelease = pickPrimaryRelease(groupReleases);

      if (!primaryRelease) {
        return null;
      }

      return {
        key: `release-${group.id}`,
        title: group.title ?? primaryRelease.title ?? `#${group.id}`,
        releaseDate: group.release_date ?? primaryRelease.release_date,
        href: `/releases/${primaryRelease.id}`,
        jacketImageUrl: primaryRelease.jacket_image_url,
        artistCredit: primaryRelease.artist_credit,
        kind: "release",
      };
    })
    .filter((card): card is HomeReleaseCard => card !== null);

  const digitalReleaseCards = (digitalReleases ?? [])
    .map((digitalRelease): HomeReleaseCard | null => {
      const song = digitalRelease.songs;

      if (!song) {
        return null;
      }

      return {
        key: `digital-${digitalRelease.id}`,
        title:
          digitalRelease.title ??
          song.title ??
          `#${digitalRelease.id}`,
        releaseDate: digitalRelease.release_date,
        href: `/songs/${song.id}`,
        jacketImageUrl: digitalRelease.jacket_image_url,
        artistCredit: song.artist_credit,
        kind: "digital_single",
      };
    })
    .filter((card): card is HomeReleaseCard => card !== null);

  const recentReleases = [
    ...groupReleaseCards,
    ...digitalReleaseCards,
  ]
    .sort((a, b) => {
      const aDate = a.releaseDate ?? "0000-00-00";
      const bDate = b.releaseDate ?? "0000-00-00";

      return bDate.localeCompare(aDate);
    })
    .slice(0, 3);

  return (
    <div className="overflow-x-clip">

    {/* ページ全体に固定されるサンフラワー背景 */}
    <div
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background: `
          linear-gradient(
            180deg,
            rgba(252,249,239,1) 0%,
            rgba(249,244,226,0.82) 48%,
            rgba(252,250,243,1) 100%
          )
        `,
      }}
    >
      <HomeThemeMotif
        shape={HOME_THEME.motif}
        className="h-full w-full text-[#b99a52] opacity-[0.8]"
      />
    </div>

      <section className="relative z-10 overflow-hidden border-b border-black/15">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-[70%_center]"
        style={{
          backgroundImage: "url('/home-themes/sunflower/hero.webp')",
        }}
      />

        {/*
          文字保護用の「白い霧」。
          スマホでは文字周辺をかなり白く、
          PCでは右へ行くほど透明にする。
        */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(
                ellipse at 18% 38%,
                rgba(245,245,242,1) 0%,
                rgba(245,245,242,0.98) 24%,
                rgba(245,245,242,0.88) 42%,
                rgba(245,245,242,0.42) 60%,
                transparent 78%
              )
            `,
          }}
        />

        {/* 内容 */}
        <div className="relative z-10 mx-auto min-h-[650px] max-w-6xl px-6 py-14 sm:min-h-[620px] sm:py-16 lg:min-h-[600px] lg:py-20">
          <div className="max-w-xl">
            <p className="text-xs tracking-[0.14em] text-black/40">
              非公式データベース
            </p>

            <h1 className="font-serif-jp mt-5 text-4xl font-medium leading-[1.25] tracking-[0.02em] text-black sm:text-5xl lg:text-6xl">
              ヰ世界情緒
              <br />
              歌唱録
            </h1>

            <div
              className="mt-6 h-px w-24"
              style={{ backgroundColor: HOME_THEME.accent }}
            />

            <p className="mt-7 max-w-lg text-sm leading-8 text-black/60">
              ヰ世界情緒さんの歌唱楽曲・関連リンク・ライブセトリなどを整理する、
              <br className="hidden sm:block" />
              ファンによる非公式データベースです。
            </p>

            <p className="mt-3 max-w-lg text-xs leading-6 text-black/40">
              KAMITSUBAKI STUDIO、ヰ世界情緒さん本人、
              および関係各社とは関係ありません。
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/songs"
                className="inline-flex items-center gap-3 px-5 py-3 text-sm font-medium text-white transition hover:opacity-85"
                style={{ backgroundColor: HOME_THEME.accentDeep }}
              >
                楽曲一覧を見る
                <span aria-hidden="true">→</span>
              </Link>

              <Link
                href="/releases"
                className="inline-flex items-center gap-3 border px-5 py-3 text-sm font-medium transition hover:bg-black/[0.04]"
                style={{
                  borderColor: `${HOME_THEME.accent}80`,
                  color: HOME_THEME.accentDeep,
                }}
              >
                リリース一覧を見る
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-black/45">
              <Link
                href="/submit"
                className="transition hover:text-black"
              >
                情報を提供する
              </Link>

              <Link
                href="/about"
                className="transition hover:text-black"
              >
                このサイトについて
              </Link>
            </div>
          </div>
        </div>
      </section>

    <div className="relative z-10">

      <main className="relative z-10 mx-auto max-w-6xl px-6">
        <section className="border-b border-black/15 py-14 md:py-16">
          <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">

            {/* 最近の歌唱記録 */}
            <div
              className="relative overflow-hidden border border-black/10 px-6 py-6 sm:px-7 sm:py-7"
              style={{
                background: "rgba(255, 253, 247, 0.88)",
              }}
            >
              
              <div
                className="absolute inset-x-0 top-0 h-[2px]"
                style={{
                  background: `linear-gradient(90deg, ${HOME_THEME.accentDeep} 0%, ${HOME_THEME.accent} 45%, transparent 100%)`,
                }}
              />

              <div className="relative">
                <div className="flex items-end justify-between gap-5">
                  <div>
                    <p
                      className="text-xs tracking-[0.12em]"
                      style={{ color: HOME_THEME.accentDeep }}
                    >
                      最近の記録
                    </p>

                    <h2 className="font-serif-jp mt-2 text-2xl font-medium tracking-[0.03em] text-black">
                      最近の歌唱記録
                    </h2>

                    <div
                      className="mt-3 h-px w-14"
                      style={{ backgroundColor: `${HOME_THEME.accentDeep}55` }}
                    />
                  </div>

                  <Link
                    href="/songs"
                    className="hidden text-xs text-black/40 transition hover:text-black sm:inline-flex"
                  >
                    楽曲一覧へ →
                  </Link>
                </div>

                <div className="mt-7 divide-y divide-black/10 border-y border-black/10">
                  {latestSongs?.map((song) => (
                    <Link
                      key={song.id}
                      href={`/songs/${song.id}`}
                      className="grid gap-2 py-4 transition hover:bg-black/[0.02] sm:grid-cols-[96px_minmax(0,1fr)]"
                    >
                      <time className="text-xs tabular-nums text-black/40">
                        {song.first_date ?? "----.--.--"}
                      </time>

                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-medium text-black"
                          title={
                            hasAttentionStatus(song)
                              ? `確認中の項目があります / ${song.title}`
                              : song.title
                          }
                        >
                          {hasAttentionStatus(song) ? (
                            <span
                              className="mr-1.5 font-mono text-[11px] font-normal text-black/40"
                              aria-label="確認中の項目があります"
                            >
                              ?
                            </span>
                          ) : null}
                          {song.title}
                        </p>

                        <p className="mt-1 truncate text-xs text-black/40">
                          {song.artist_credit ? `${song.artist_credit} / ` : ""}
                          {song.first_source ?? "-"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>

                <Link
                  href="/songs"
                  className="mt-5 inline-flex text-xs text-black/45 transition hover:text-black sm:hidden"
                >
                  楽曲一覧へ →
                </Link>
              </div>
            </div>

            {/* 最近のリリース */}
            <div
              className="relative overflow-hidden border border-black/10 px-6 py-6 sm:px-7 sm:py-7"
              style={{
                background: "rgba(255, 253, 247, 0.88)",
              }}
            >

              <div
                className="absolute inset-x-0 top-0 h-[2px]"
                style={{
                  background: `linear-gradient(90deg, ${HOME_THEME.accentDeep} 0%, ${HOME_THEME.accent} 52%, transparent 100%)`,
                }}
              />

              <div className="relative">
                <div className="flex items-end justify-between gap-5">
                  <div>
                    <p
                      className="text-xs tracking-[0.12em]"
                      style={{ color: HOME_THEME.accentDeep }}
                    >
                      新着作品
                    </p>

                    <h2 className="font-serif-jp mt-2 text-2xl font-medium tracking-[0.03em] text-black">
                      最近のリリース
                    </h2>

                    <div
                      className="mt-3 h-px w-14"
                      style={{ backgroundColor: `${HOME_THEME.accentDeep}55` }}
                    />
                  </div>

                  <Link
                    href="/releases"
                    className="hidden text-xs text-black/40 transition hover:text-black sm:inline-flex"
                  >
                    リリース一覧へ →
                  </Link>
                </div>

                <div className="mt-7 divide-y divide-black/10 border-y border-black/10">
                  {recentReleases.map((release) => (
                    <Link
                      key={release.key}
                      href={release.href}
                      className="grid grid-cols-[84px_minmax(0,1fr)] gap-4 py-4 transition hover:bg-black/[0.02]"
                    >
                      <div className="flex aspect-square items-center justify-center overflow-hidden border border-black/10 bg-white/70">
                        {release.jacketImageUrl ? (
                          <img
                            src={release.jacketImageUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-[10px] tracking-[0.1em] text-black/25">
                            NO IMAGE
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 self-center">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p
                            className="text-[10px] tracking-[0.08em]"
                            style={{ color: HOME_THEME.accentDeep }}
                          >
                            {release.kind === "digital_single"
                              ? "配信シングル"
                              : "リリース"}
                          </p>

                          {release.releaseDate ? (
                            <time className="text-[10px] tabular-nums text-black/35">
                              {release.releaseDate}
                            </time>
                          ) : null}
                        </div>

                        <p className="mt-1 truncate text-sm font-medium text-black">
                          {release.title}
                        </p>

                        {release.artistCredit ? (
                          <p className="mt-1 truncate text-xs text-black/40">
                            {release.artistCredit}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  ))}

                  {recentReleases.length === 0 ? (
                    <p className="py-5 text-sm text-black/45">
                      表示できるリリースがありません。
                    </p>
                  ) : null}
                </div>

                <Link
                  href="/releases"
                  className="mt-5 inline-flex text-xs text-black/45 transition hover:text-black sm:hidden"
                >
                  リリース一覧へ →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ご協力のお願い */}
        <section className="border-b border-black/15 py-14 md:py-16">
          <div
            className="relative overflow-hidden border px-6 py-9 sm:px-10 sm:py-10"
            style={{
              borderColor: `${HOME_THEME.accent}55`,
              background: "rgba(255, 253, 247, 0.82)",
            }}
          >

            <div className="relative max-w-2xl">
              <p
                className="text-xs tracking-[0.12em]"
                style={{ color: HOME_THEME.accentDeep }}
              >
                情報提供
              </p>

              <h2 className="font-serif-jp mt-2 text-2xl font-medium tracking-[0.03em] text-black">
                ご協力のお願い
              </h2>

              <p className="mt-5 text-sm leading-8 text-black/60">
                掲載情報の誤りや不足している情報などがありましたら、
                情報提供フォームからお知らせいただけると助かります。
              </p>

              <div className="mt-7">
                <Link
                  href="/submit"
                  className="inline-flex items-center gap-3 px-5 py-3 text-sm font-medium text-white transition hover:opacity-85"
                  style={{ backgroundColor: HOME_THEME.accentDeep }}
                >
                  情報提供フォームへ
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 試験公開 */}
        <section className="py-10">
          <div className="grid gap-5 md:grid-cols-[180px_1fr]">
            <div>
              <p className="text-xs tracking-[0.12em] text-black/35">
                試験公開について
              </p>
            </div>

            <div className="max-w-3xl space-y-3 text-xs leading-6 text-black/45">
              <p>
                現在、本サイトは身内向けの試験公開段階です。
                掲載情報には未確認・不完全なもの、表記ゆれ、記載漏れなどが含まれる場合があります。
              </p>

              <p>
                本サイトはファンによる非公式データベースです。
                KAMITSUBAKI STUDIO、ヰ世界情緒さん本人、および関係各社とは関係ありません。
              </p>

              <Link
                href="/about"
                className="inline-flex pt-1 text-black/55 underline decoration-black/20 transition hover:text-black"
              >
                このサイトについて詳しく見る
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
    {/* /sunflower background */}
  </div>
  );
}