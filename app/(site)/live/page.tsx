import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

type LiveArchivePerformance = {
  id: number;
  title: string;
  artist_credit: string | null;
  performance_date: string | null;
  format_label: string | null;
  image_url: string | null;
};

type SetlistPerformanceReference = {
  live_performance_id: number;
};

function groupLivesByYear(lives: LiveArchivePerformance[]) {
  const groups = new Map<string, LiveArchivePerformance[]>();

  for (const live of lives) {
    const year = live.performance_date?.slice(0, 4) ?? "DATE TBD";
    const current = groups.get(year) ?? [];
    current.push(live);
    groups.set(year, current);
  }

  return [...groups.entries()];
}

function getMonthDay(date: string | null) {
  if (!date) {
    return "--.--";
  }

  return date.slice(5).replace("-", ".");
}

export default async function LivePage() {
  const { data, error } = await supabase
    .from("live_performances")
    .select("id,title,artist_credit,performance_date,format_label,image_url")
    .not("published_at", "is", null)
    .eq("is_listed", true)
    .order("performance_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .returns<LiveArchivePerformance[]>();

  const lives = data ?? [];
  let setlistCounts = new Map<number, number>();
  let setlistError = null;

  if (!error && lives.length > 0) {
    const result = await supabase
      .from("live_setlist_entries")
      .select("live_performance_id")
      .in(
        "live_performance_id",
        lives.map((live) => live.id),
      )
      .eq("entry_type", "song")
      .returns<SetlistPerformanceReference[]>();

    setlistError = result.error;
    setlistCounts = (result.data ?? []).reduce((counts, entry) => {
      counts.set(
        entry.live_performance_id,
        (counts.get(entry.live_performance_id) ?? 0) + 1,
      );
      return counts;
    }, new Map<number, number>());
  }

  if (error || setlistError) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="archive-label text-black/45">LIVE ARCHIVE</p>
        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black">
          ライブ・イベント
        </h1>
        <p className="mt-6 border border-black/15 p-5 text-sm text-black/60">
          ライブデータの取得に失敗しました。
        </p>
      </main>
    );
  }

  const yearGroups = groupLivesByYear(lives);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <section className="border-b border-black/15 pb-8">
        <p className="archive-label text-black/45">LIVE ARCHIVE</p>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif-jp text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
              ライブ・イベント
            </h1>
            <p className="mt-4 text-sm leading-7 text-black/55">
              公演ごとのセットリストと歌唱記録を辿るアーカイブです。
            </p>
          </div>

          <p className="text-sm text-black/45">{lives.length} PERFORMANCES</p>
        </div>
      </section>

      <div className="mt-10 grid gap-14">
        {yearGroups.map(([year, yearLives]) => (
          <section
            key={year}
            className="grid gap-5 md:grid-cols-[120px_minmax(0,1fr)] md:gap-8"
          >
            <div>
              <p className="section-label text-black/35">YEAR</p>
              <h2 className="font-serif-jp mt-2 text-3xl font-medium tracking-[0.04em] text-black md:text-4xl">
                {year}
              </h2>
            </div>

            <div className="divide-y divide-black/10 border-y border-black/15">
              {yearLives.map((live) => (
                <Link
                  key={live.id}
                  href={`/live/${live.id}`}
                  className="group grid gap-4 py-5 transition hover:bg-black/[0.025] sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-start sm:gap-5"
                >
                  <time
                    dateTime={live.performance_date ?? undefined}
                    className="font-mono text-sm tabular-nums tracking-[0.08em] text-black/45"
                  >
                    {getMonthDay(live.performance_date)}
                  </time>

                  <div
                    className={
                      live.image_url
                        ? "grid min-w-0 gap-4 sm:grid-cols-[96px_minmax(0,1fr)]"
                        : "min-w-0"
                    }
                  >
                    {live.image_url ? (
                      <div className="aspect-[4/3] overflow-hidden border border-black/10 bg-black/[0.02]">
                        <img
                          src={live.image_url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                        />
                      </div>
                    ) : null}

                    <div className="min-w-0">
                      <h3 className="font-serif-jp break-words text-lg font-medium leading-8 tracking-[0.02em] text-black underline-offset-4 group-hover:underline sm:text-xl">
                        {live.title}
                      </h3>

                      {live.artist_credit || live.format_label ? (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-black/45">
                          {live.artist_credit ? <span>{live.artist_credit}</span> : null}
                          {live.format_label ? (
                            <span className="font-mono text-[10px] tracking-[0.1em] text-black/35">
                              {live.format_label}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                    <p className="font-mono text-[10px] tracking-[0.1em] text-black/30">
                      {setlistCounts.get(live.id) ?? 0} SONGS
                    </p>
                    <span className="mt-2 hidden text-sm text-black/30 transition group-hover:translate-x-1 group-hover:text-black sm:block">
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
