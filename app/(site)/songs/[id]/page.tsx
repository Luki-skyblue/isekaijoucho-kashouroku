import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
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

function StatusLabel({ status }: { status: string | null }) {
  if (!status || status === "confirmed") {
    return null;
  }

  const label =
    status === "uncertain"
      ? "不確定"
      : status === "unverified"
        ? "未確認"
        : status === "wanted"
          ? "情報募集中"
          : "要確認";

  return (
    <span className="inline-flex border border-black/25 px-3 py-1 text-xs font-medium tracking-[0.08em] text-black/60">
      {label}
    </span>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="grid border-b border-black/10 py-2.5 md:grid-cols-[150px_1fr] md:gap-4">
      <dt className="text-[11px] font-medium tracking-[0.12em] text-black/40">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-black/80 md:mt-0">
        {hasValue(value) ? value : <EmptyText />}
      </dd>
    </div>
  );
}

function CompactTextBlock({
  value,
}: {
  value: string | null | undefined;
}) {
  return (
    <div className="border-y border-black/10 py-3">
      <p className="whitespace-pre-wrap text-sm leading-6 text-black/80">
        {hasValue(value) ? value : <EmptyText />}
      </p>
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

function getLinkTypeLabel(type: string | null) {
  switch (type) {
    case "mv":
      return "MV";
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
    default:
      return "OTHER";
  }
}

export default async function SongDetailPage({ params }: PageProps) {
  const { id } = await params;

  const { data: song, error } = await supabase
    .from("songs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !song) {
    notFound();
  }

  const { data: links } = await supabase
    .from("links")
    .select("*")
    .eq("target_type", "song")
    .eq("target_id", song.id)
    .order("published_date", { ascending: true });

  const isOriginal = song.song_type === "original";
  const firstDisplay = formatFirstDisplay(song.first_source, song.first_date);
  const firstFullDisplay = formatFirstDisplay(
    song.first_full_source,
    song.first_full_date
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex flex-col gap-4 border-b border-black/10 pb-5 md:flex-row md:items-start md:justify-between">
        <Link
          href="/songs"
          className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
        >
          BACK TO SONGS
        </Link>

        <div className="flex flex-col gap-3 md:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <StatusLabel status={song.verification_status} />

            <Link
              href={`/songs/${song.id}/submit`}
              className="border border-black/25 px-3 py-1.5 text-xs font-medium tracking-[0.12em] text-black/60 transition hover:border-black hover:bg-black hover:text-[#f5f5f2]"
            >
              SUBMIT INFO
            </Link>
          </div>

          {song.verification_note && (
            <p className="max-w-xl whitespace-pre-wrap text-xs leading-6 text-black/50 md:text-right">
              {song.verification_note}
            </p>
          )}
        </div>
      </div>
      
      <section className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-5 border-b border-black/15 pb-10 sm:grid-cols-[9rem_minmax(0,1fr)] md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
        <div className="w-full self-start overflow-hidden border border-black/15 bg-black/[0.02]">
          {hasValue(song.hero_image_url) ? (
            <img
              src={song.hero_image_url}
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
              <DetailRow label="VOCAL" value={song.original_vocal} />
              <DetailRow label="LYRICIST" value={song.original_lyricist} />
              <DetailRow label="COMPOSER" value={song.original_composer} />
              <DetailRow label="ARRANGER" value={song.original_arranger} />
            </>
          ) : (
            <>
              <DetailRow label="ORIGINAL ARTIST" value={song.original_artist} />
              <DetailRow label="ORIGINAL VOCAL" value={song.original_vocal} />
              <DetailRow
                label="ORIGINAL LYRICIST"
                value={song.original_lyricist}
              />
              <DetailRow
                label="ORIGINAL COMPOSER"
                value={song.original_composer}
              />
              <DetailRow
                label="ORIGINAL ARRANGER"
                value={song.original_arranger}
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
          <DetailRow label="FIRST" value={firstDisplay} />
          <DetailRow label="FIRST FULL" value={firstFullDisplay} />
          <DetailRow label="TIE-UP" value={song.tie_up} />
        </dl>
      </section>

      <section className="mt-12 grid gap-8 md:grid-cols-[180px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">ALBUM</p>
          <h2 className="section-title-ja">収録情報</h2>
        </div>

        <CompactTextBlock value={song.album_text} />
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

        {links && links.length > 0 ? (
          <div className="border-y border-black/15">
            {links.map((link) => {
              const typeLabel = getLinkTypeLabel(link.link_type);
              const title = link.title || link.label || typeLabel;

              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group grid gap-3 border-b border-black/10 py-4 last:border-b-0 transition hover:bg-black/[0.03] md:grid-cols-[110px_1fr_70px]"
                >
                  <div>
                    <p className="section-label text-black/45">{typeLabel}</p>
                    {link.published_date && (
                      <p className="mt-2 text-xs text-black/35">
                        {link.published_date}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium leading-6 text-black group-hover:underline">
                      {title}
                    </p>

                    {link.site_name && (
                      <p className="mt-1 text-xs leading-6 text-black/45">
                        {link.site_name}
                      </p>
                    )}

                    {link.notes && (
                      <p className="mt-2 text-xs leading-6 text-black/45">
                        {link.notes}
                      </p>
                    )}
                  </div>

                  <p className="self-start text-left text-xs font-medium tracking-[0.1em] text-black/35 transition group-hover:text-black md:text-right">
                    OPEN
                  </p>
                </a>
              );
            })}
          </div>
        ) : (
          <EmptyBlock />
        )}
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