import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

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
  value: string | null;
}) {
  return (
    <div className="grid border-b border-black/10 py-4 md:grid-cols-[180px_1fr]">
      <dt className="text-xs font-medium tracking-[0.12em] text-black/45">
        {label}
      </dt>
      <dd className="mt-2 whitespace-pre-wrap text-sm leading-7 text-black md:mt-0">
        {value || "-"}
      </dd>
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
    case "x":
      return "X";
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="border-b border-black/15 pb-8">
        <Link
          href="/songs"
          className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
        >
          BACK TO SONGS
        </Link>

        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <p className="archive-label text-black/45">SONG DETAIL</p>

            <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
              {song.title}
            </h1>

            {song.title_kana && (
              <p className="mt-3 text-sm text-black/45">{song.title_kana}</p>
            )}
          </div>

           <div className="flex flex-col items-start gap-3 md:items-end">
            <StatusLabel status={song.verification_status} />

            <Link
                href={`/songs/${song.id}/submit`}
                className="border border-black px-4 py-2 text-xs font-medium tracking-[0.12em] text-black transition hover:bg-black hover:text-[#f5f5f2]"
            >
                SUBMIT INFO
            </Link>
          </div>
            
        </div>
      </div>

      {song.verification_note && (
        <section className="mt-8 border border-black/15 p-5">
          <p className="archive-label text-black/45">VERIFICATION NOTE</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-black/65">
            {song.verification_note}
          </p>
        </section>
      )}

      <section className="mt-10 grid gap-10 md:grid-cols-[220px_1fr]">
        <div>
          <h2 className="archive-label text-black">BASIC</h2>
          <p className="mt-2 text-xs text-black/45">基本情報</p>
        </div>

        <dl>
          <DetailRow label="FIRST DATE" value={song.first_date} />
          <DetailRow label="FIRST SOURCE" value={song.first_source} />
          <DetailRow label="ARTIST CREDIT" value={song.artist_credit} />
          <DetailRow label="TYPE" value={song.song_type} />
        </dl>
      </section>

      <section className="mt-12 grid gap-10 md:grid-cols-[220px_1fr]">
        <div>
          <h2 className="archive-label text-black">ORIGINAL</h2>
          <p className="mt-2 text-xs text-black/45">原曲情報</p>
        </div>

        <dl>
          <DetailRow label="ARTIST" value={song.original_artist} />
          <DetailRow label="VOCAL" value={song.original_vocal} />
          <DetailRow label="LYRICIST" value={song.original_lyricist} />
          <DetailRow label="COMPOSER" value={song.original_composer} />
          <DetailRow label="ARRANGER" value={song.original_arranger} />
        </dl>
      </section>

      {links && links.length > 0 && (
        <section className="mt-12 grid gap-10 md:grid-cols-[220px_1fr]">
            <div>
            <h2 className="archive-label text-black">LINKS</h2>
            <p className="mt-2 text-xs text-black/45">関連リンク</p>
            </div>

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
                    className="group grid gap-4 border-b border-black/10 py-5 last:border-b-0 transition hover:bg-black/[0.03] md:grid-cols-[110px_1fr_70px]"
                >
                    <div>
                    <p className="section-label text-black">{typeLabel}</p>
                    {link.published_date && (
                        <p className="mt-2 text-xs text-black/40">
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

                    <p className="self-start text-right text-xs font-medium tracking-[0.1em] text-black/35 transition group-hover:text-black">
                    OPEN
                    </p>
                </a>
                );
            })}
            </div>
        </section>
        )}

      {song.notes && (
        <section className="mt-12 grid gap-10 md:grid-cols-[220px_1fr]">
          <div>
            <h2 className="archive-label text-black">NOTES</h2>
            <p className="mt-2 text-xs text-black/45">備考</p>
          </div>

          <div className="border-y border-black/15 py-5">
            <p className="whitespace-pre-wrap text-sm leading-7 text-black/70">
              {song.notes}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}