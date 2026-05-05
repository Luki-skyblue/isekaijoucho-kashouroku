import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
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
};

function hasValue(value: string | null | undefined) {
  return Boolean(value && value.trim() && value.trim() !== "-");
}

function EmptyText() {
  return <span className="text-black/35">情報がありません。</span>;
}

function formatFirstDisplay(
  source: string | null | undefined,
  date: string | null | undefined
) {
  const hasSource = hasValue(source);
  const hasDate = hasValue(date);

  if (hasSource && hasDate) {
    return `${source}（${date}）`;
  }

  if (hasSource) {
    return source;
  }

  if (hasDate) {
    return date;
  }

  return null;
}

function FieldStatusNote({
  status,
}: {
  status: string | null | undefined;
}) {
  if (!status || status === "confirmed") {
    return null;
  }

  const message =
    status === "wanted"
      ? "この項目について、より正確な情報を探しています。"
      : "この項目は確認中です。";

  return (
    <p className="mt-1 text-xs leading-5 text-black/35">
      {message}
    </p>
  );
}

function DetailRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string | null | undefined;
  status?: string | null | undefined;
}) {
  const needsAttention = status && status !== "confirmed";

  return (
    <div className="grid border-b border-black/10 py-2.5 md:grid-cols-[150px_1fr] md:gap-4">
      <dt className="text-[11px] font-medium tracking-[0.12em] text-black/40">
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-6 text-black/80 md:mt-0">
        <span
          className={
            needsAttention
              ? "whitespace-pre-wrap underline decoration-black/25 decoration-dotted underline-offset-4"
              : "whitespace-pre-wrap"
          }
        >
          {hasValue(value) ? value : <EmptyText />}
        </span>
        <FieldStatusNote status={status} />
      </dd>
    </div>
  );
}

function CompactTextBlock({
  value,
  status,
}: {
  value: string | null | undefined;
  status?: string | null | undefined;
}) {
  const needsAttention = status && status !== "confirmed";

  return (
    <div className="border-y border-black/10 py-3">
      <p
        className={
          needsAttention
            ? "whitespace-pre-wrap text-sm leading-6 text-black/80 underline decoration-black/25 decoration-dotted underline-offset-4"
            : "whitespace-pre-wrap text-sm leading-6 text-black/80"
        }
      >
        {hasValue(value) ? value : <EmptyText />}
      </p>
      <FieldStatusNote status={status} />
    </div>
  );
}

function EmptyBlock() {
  return (
    <div className="border-y border-black/10 py-3">
      <p className="text-sm leading-6 text-black/35">情報がありません。</p>
    </div>
  );
}

function formatLinkType(type: string | null) {
  switch (type) {
    case "mv":
      return "MV";
    case "trailer":
      return "TRAILER";
    case "lyric_mv":
      return "LYRIC MV";
    case "live_mv":
      return "LIVE MV";
    case "original":
      return "ORIGINAL";
    case "streaming":
      return "STREAMING";
    case "lyrics":
      return "LYRICS";
    case "piapro":
      return "PIAPRO";
    case "x":
      return "X";
    case "announcement":
      return "ANNOUNCEMENT";
    case "album":
      return "ALBUM";
    case "other":
      return "OTHER";
    default:
      return type?.toUpperCase() ?? "LINK";
  }
}

function formatDate(date: string | null) {
  if (!date) {
    return null;
  }

  return date.replaceAll("-", ".");
}

function getLinkTypePriority(type: string | null) {
  switch (type) {
    case "mv":
      return 0;
    case "lyric_mv":
      return 1;
    case "live_mv":
      return 2;
    case "trailer":
      return 3;
    default:
      return 99;
  }
}

function getFallbackHeroImageUrl(links: SongLink[]) {
  const candidate = links
    .filter((link) => {
      return (
        link.thumbnail_url &&
        ["mv", "lyric_mv", "live_mv", "trailer"].includes(link.link_type ?? "")
      );
    })
    .sort((a, b) => {
      return getLinkTypePriority(a.link_type) - getLinkTypePriority(b.link_type);
    })[0];

  return candidate?.thumbnail_url ?? null;
}

function SongLinksSection({ links }: { links: SongLink[] }) {
  const visibleLinks = links.filter((link) => link.url);

  if (visibleLinks.length === 0) {
    return <EmptyBlock />;
  }

  return (
    <div className="grid gap-3">
      {visibleLinks.map((link) => {
        const mainTitle = link.label || link.title || link.url || "LINK";
        const subTitle =
          link.title && link.title !== mainTitle ? link.title : null;
        const dateText = formatDate(link.published_date);
        const hasThumbnail = hasValue(link.thumbnail_url);

        return (
          <a
            key={link.id}
            href={link.url ?? ""}
            target="_blank"
            rel="noreferrer"
            className={
              hasThumbnail
                ? "group grid grid-cols-[88px_minmax(0,1fr)] gap-4 border-y border-black/10 py-3 transition hover:border-black/40 sm:grid-cols-[120px_minmax(0,1fr)]"
                : "group grid gap-2 border-y border-black/10 py-3 transition hover:border-black/40"
            }
          >
            {hasThumbnail ? (
              <div className="aspect-video overflow-hidden border border-black/10 bg-black/[0.02]">
                <img
                  src={link.thumbnail_url ?? ""}
                  alt=""
                  className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                />
              </div>
            ) : null}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="border border-black/20 px-2 py-1 font-mono text-[10px] tracking-[0.18em] text-black/45">
                  {formatLinkType(link.link_type)}
                </span>

                {link.site_name ? (
                  <span className="font-mono text-[10px] tracking-[0.18em] text-black/40">
                    {link.site_name}
                  </span>
                ) : null}

                {dateText ? (
                  <span className="font-mono text-[10px] tracking-[0.18em] text-black/35">
                    {dateText}
                  </span>
                ) : null}
              </div>

              <p className="mt-2 break-words text-sm font-medium leading-6 text-black/80 underline-offset-4 group-hover:underline">
                {mainTitle}
              </p>

              {subTitle ? (
                <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-black/45">
                  {subTitle}
                </p>
              ) : null}
            </div>
          </a>
        );
      })}
    </div>
  );
}

export default async function SongDetailPage({ params }: PageProps) {
  const { id } = await params;

  const songId = Number(id);

  if (!Number.isInteger(songId)) {
    notFound();
  }

  const { data: song, error } = await supabase
    .from("songs")
    .select("*")
    .eq("id", songId)
    .single();

  if (error || !song) {
    notFound();
  }

  const { data: links, error: linksError } = await supabase
    .from("links")
    .select(
      "id, link_type, label, title, site_name, url, published_date, notes, thumbnail_url"
    )
    .eq("target_type", "song")
    .eq("target_id", songId)
    .order("published_date", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .returns<SongLink[]>();

  if (linksError) {
    throw new Error("関連リンクの取得に失敗しました。");
  }

  const isOriginal = song.song_type === "original";
  const firstDisplay = formatFirstDisplay(song.first_source, song.first_date);
  const firstFullDisplay = formatFirstDisplay(
    song.first_full_source,
    song.first_full_date
  );
  const fallbackHeroImageUrl = getFallbackHeroImageUrl(links ?? []);
  const heroImageUrl = hasValue(song.hero_image_url)
    ? song.hero_image_url
    : fallbackHeroImageUrl;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex flex-col gap-4 border-b border-black/10 pb-5 md:flex-row md:items-start md:justify-between">
        <Link
          href="/songs"
          className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
        >
          BACK TO SONGS
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/songs/${song.id}/submit`}
            className="border border-black/25 px-3 py-1.5 text-xs font-medium tracking-[0.12em] text-black/60 transition hover:border-black hover:bg-black hover:text-[#f5f5f2]"
          >
            SUBMIT INFO
          </Link>
        </div>
      </div>
      
      <section className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-5 border-b border-black/15 pb-10 sm:grid-cols-[9rem_minmax(0,1fr)] md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
        <div className="w-full self-start overflow-hidden border border-black/15 bg-black/[0.02]">
        {hasValue(heroImageUrl) ? (
          <img
            src={heroImageUrl}
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
            {song.song_type ?? "UNKNOWN"}
          </p>

          <h1 className="font-serif-jp mt-3 break-words text-2xl font-medium tracking-[0.02em] text-black sm:text-3xl md:text-5xl">
            {song.title}
          </h1>

          {hasValue(song.title_kana) && (
            <p className="mt-2 text-xs tracking-[0.04em] text-black/45 sm:text-sm">
              {song.title_kana}
            </p>
          )}

          <p className="mt-4 text-sm text-black/70 sm:text-base md:text-lg">
            {hasValue(song.artist_credit) ? song.artist_credit : <EmptyText />}
          </p>
        </div>
      </section>

      <section className="mt-12 grid gap-8 md:grid-cols-[180px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">
            {isOriginal ? "CREDITS" : "ORIGINAL"}
          </p>
          <h2 className="section-title-ja">
            {isOriginal ? "制作情報" : "原曲情報"}
          </h2>
        </div>

        <dl>
          {isOriginal ? (
            <>
              <DetailRow
                label="VOCAL"
                value={song.original_vocal}
                status={song.original_vocal_status}
              />
              <DetailRow
                label="LYRICIST"
                value={song.original_lyricist}
                status={song.original_lyricist_status}
              />
              <DetailRow
                label="COMPOSER"
                value={song.original_composer}
                status={song.original_composer_status}
              />
              <DetailRow
                label="ARRANGER"
                value={song.original_arranger}
                status={song.original_arranger_status}
              />
            </>
          ) : (
            <>
              <DetailRow
                label="ORIGINAL ARTIST"
                value={song.original_artist}
                status={song.original_artist_status}
              />
              <DetailRow
                label="ORIGINAL VOCAL"
                value={song.original_vocal}
                status={song.original_vocal_status}
              />
              <DetailRow
                label="ORIGINAL LYRICIST"
                value={song.original_lyricist}
                status={song.original_lyricist_status}
              />
              <DetailRow
                label="ORIGINAL COMPOSER"
                value={song.original_composer}
                status={song.original_composer_status}
              />
              <DetailRow
                label="ORIGINAL ARRANGER"
                value={song.original_arranger}
                status={song.original_arranger_status}
              />
            </>
          )}
        </dl>
      </section>

      <section className="mt-10 grid gap-8 md:grid-cols-[180px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">RELEASE</p>
          <h2 className="section-title-ja">公開情報</h2>
        </div>

        <dl>
          <DetailRow
            label="FIRST"
            value={firstDisplay}
            status={song.first_status}
          />
          <DetailRow
            label="FIRST FULL"
            value={firstFullDisplay}
            status={song.first_full_status}
          />
          <DetailRow
            label="TIE-UP"
            value={song.tie_up}
            status={song.tie_up_status}
          />
        </dl>
      </section>

      <section className="mt-12 grid gap-8 md:grid-cols-[180px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">ALBUM</p>
          <h2 className="section-title-ja">収録情報</h2>
        </div>

        <CompactTextBlock
          value={song.album_text}
          status={song.album_text_status}
        />
      </section>

      <section className="mt-12 grid gap-8 md:grid-cols-[180px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">RELATED</p>
          <h2 className="section-title-ja">関連バージョン</h2>
        </div>

        <EmptyBlock />
      </section>

      <section className="mt-12 grid gap-8 md:grid-cols-[180px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">LIVE HISTORY</p>
          <h2 className="section-title-ja">ライブ披露歴</h2>
        </div>

        <EmptyBlock />
      </section>

      <section className="mt-12 grid gap-8 md:grid-cols-[180px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">LINKS</p>
          <h2 className="section-title-ja">関連リンク</h2>
        </div>

        <SongLinksSection links={links ?? []} />
      </section>

      <section className="mt-12 grid gap-8 md:grid-cols-[180px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">NOTES</p>
          <h2 className="section-title-ja">備考</h2>
        </div>

        <CompactTextBlock value={song.notes} />
      </section>
    </main>
  );
}