import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { supabase } from "@/lib/supabase/client";
import LiveSetlist, {
  type LiveSetlistEntry,
  type LiveSetlistTable,
} from "../LiveSetlist";

export const dynamic = "force-dynamic";

type LiveDetailPageProps = {
  params: Promise<{ id: string }>;
};

type LivePerformance = {
  id: number;
  live_event_group_id: number | null;
  group_sort_order: number | null;
  title: string;
  artist_credit: string | null;
  performance_date: string | null;
  format_label: string | null;
  image_url: string | null;
  venue: string | null;
  streaming_platforms: string[];
};

type LiveSetlistEntryRow = {
  id: number;
  entry_type: "song" | "marker";
  setlist_no_raw: string | null;
  song_id: number | null;
  song_title_raw: string | null;
  artist_credit_raw: string | null;
  note_raw: string | null;
  marker_label: string | null;
};

type LiveSetlistEntrySongRow = {
  live_setlist_entry_id: number;
  song_id: number;
  sort_order: number;
};

type SongTitleRow = {
  id: number;
  title: string;
};

type LivePerformanceLink = {
  id: number;
  link_type: string;
  label: string | null;
  url: string;
};

type EventGroupRow = {
  id: number;
  title: string;
};

type RelatedPerformanceRow = {
  id: number;
  title: string;
  performance_date: string | null;
  group_sort_order: number | null;
};

type SeriesRow = {
  id: number;
  title: string;
};

type SeriesMemberRow = {
  id: number;
  live_series_id: number;
  live_performance_id: number;
  sort_order: number | null;
};

type RelationItem = {
  id: number;
  title: string;
  date: string | null;
  label: string;
};

type Relation = {
  id: number;
  eyebrow: string;
  title: string;
  items: RelationItem[];
};

function parsePerformanceId(value: string) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function formatLiveDate(date: string | null) {
  return date ? date.replaceAll("-", ".") : "";
}

const getPublishedPerformance = cache(async (performanceId: number) =>
  supabase
    .from("live_performances")
    .select(
      "id,live_event_group_id,group_sort_order,title,artist_credit,performance_date,format_label,image_url,venue,streaming_platforms",
    )
    .eq("id", performanceId)
    .not("published_at", "is", null)
    .single()
    .returns<LivePerformance>(),
);

async function getEventGroupRelation(
  liveEventGroupId: number | null,
): Promise<Relation | null> {
  if (liveEventGroupId === null) {
    return null;
  }

  const [groupResult, performancesResult] = await Promise.all([
    supabase
      .from("live_event_groups")
      .select("id,title")
      .eq("id", liveEventGroupId)
      .single()
      .returns<EventGroupRow>(),
    supabase
      .from("live_performances")
      .select("id,title,performance_date,group_sort_order")
      .eq("live_event_group_id", liveEventGroupId)
      .not("published_at", "is", null)
      .order("group_sort_order", { ascending: true, nullsFirst: false })
      .order("performance_date", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .returns<RelatedPerformanceRow[]>(),
  ]);

  if (groupResult.error || !groupResult.data || performancesResult.error) {
    throw new Error("関連公演の取得に失敗しました。");
  }

  return {
    id: groupResult.data.id,
    eyebrow: "EVENT GROUP",
    title: groupResult.data.title,
    items: (performancesResult.data ?? []).map((performance) => ({
      id: performance.id,
      title: performance.title,
      date: performance.performance_date,
      label:
        performance.group_sort_order === null
          ? formatLiveDate(performance.performance_date)
          : `DAY ${performance.group_sort_order}`,
    })),
  };
}

async function getSeriesRelations(performanceId: number): Promise<Relation[]> {
  const { data: currentMemberships, error: currentMembershipsError } = await supabase
    .from("live_series_members")
    .select("id,live_series_id,live_performance_id,sort_order")
    .eq("live_performance_id", performanceId)
    .returns<SeriesMemberRow[]>();

  if (currentMembershipsError) {
    throw new Error("シリーズ情報の取得に失敗しました。");
  }

  const seriesIds = (currentMemberships ?? []).map(
    (membership) => membership.live_series_id,
  );

  if (seriesIds.length === 0) {
    return [];
  }

  const [seriesResult, membersResult] = await Promise.all([
    supabase
      .from("live_series")
      .select("id,title")
      .in("id", seriesIds)
      .returns<SeriesRow[]>(),
    supabase
      .from("live_series_members")
      .select("id,live_series_id,live_performance_id,sort_order")
      .in("live_series_id", seriesIds)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .returns<SeriesMemberRow[]>(),
  ]);

  if (seriesResult.error || membersResult.error) {
    throw new Error("シリーズ情報の取得に失敗しました。");
  }

  const performanceIds = Array.from(
    new Set(
      (membersResult.data ?? []).map((membership) => membership.live_performance_id),
    ),
  );
  const { data: performances, error: performancesError } = await supabase
    .from("live_performances")
    .select("id,title,performance_date,group_sort_order")
    .in("id", performanceIds)
    .not("published_at", "is", null)
    .returns<RelatedPerformanceRow[]>();

  if (performancesError) {
    throw new Error("シリーズ公演の取得に失敗しました。");
  }

  const performanceById = new Map(
    (performances ?? []).map((performance) => [performance.id, performance]),
  );
  const membersBySeriesId = new Map<number, SeriesMemberRow[]>();

  for (const member of membersResult.data ?? []) {
    const members = membersBySeriesId.get(member.live_series_id) ?? [];
    members.push(member);
    membersBySeriesId.set(member.live_series_id, members);
  }

  return (seriesResult.data ?? []).map((series) => ({
    id: series.id,
    eyebrow: "SERIES",
    title: series.title,
    items: (membersBySeriesId.get(series.id) ?? []).flatMap((member) => {
      const performance = performanceById.get(member.live_performance_id);
      return performance
        ? [
            {
              id: performance.id,
              title: performance.title,
              date: performance.performance_date,
              label: performance.title,
            },
          ]
        : [];
    }),
  }));
}

function mapSetlist(
  rows: LiveSetlistEntryRow[],
  performanceId: number,
  componentSongsByEntryId: Map<number, Array<{ songId: number; title: string }>>,
) {
  if (rows.length === 0) {
    return [];
  }

  const entries = rows.map<LiveSetlistEntry>((row) => {
    if (row.entry_type === "marker") {
      if (!row.marker_label) {
        throw new Error("区切りラベルが設定されていません。");
      }

      return {
        id: `marker-${row.id}`,
        kind: "marker",
        label: row.marker_label,
      };
    }

    if (!row.song_title_raw) {
      throw new Error("セットリストの曲名が設定されていません。");
    }

    const componentSongs = componentSongsByEntryId.get(row.id);

    return {
      id: `song-${row.id}`,
      kind: "song",
      setlistNoRaw: row.setlist_no_raw ?? "",
      songTitleRaw: row.song_title_raw,
      artistCreditRaw: row.artist_credit_raw ?? "",
      noteRaw: row.note_raw,
      ...(row.song_id === null ? {} : { songId: row.song_id }),
      ...(componentSongs?.length ? { componentSongs } : {}),
    };
  });

  return [
    {
      id: `performance-${performanceId}-setlist`,
      tableIndexRaw: "1",
      sectionLabelRaw: null,
      entries,
    },
  ] satisfies LiveSetlistTable[];
}

function InformationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-black/10 py-3 last:border-b-0 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-5">
      <dt className="font-mono text-[10px] tracking-[0.12em] text-black/35">{label}</dt>
      <dd className="break-words text-sm leading-6 text-black/75">{value}</dd>
    </div>
  );
}

function RelationItemView({
  item,
  currentPerformanceId,
}: {
  item: RelationItem;
  currentPerformanceId: number;
}) {
  const isCurrent = item.id === currentPerformanceId;
  const content = (
    <div className="grid gap-1 py-3 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-4">
      <p className="font-mono text-[10px] tracking-[0.1em] text-black/35">
        {formatLiveDate(item.date)}
      </p>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-6 text-black">{item.label}</p>
        {item.title !== item.label ? (
          <p className="mt-0.5 text-xs leading-5 text-black/45">{item.title}</p>
        ) : null}
      </div>
    </div>
  );

  if (!isCurrent) {
    return (
      <Link
        href={`/live/${item.id}`}
        className="group block transition hover:bg-black/[0.03] [&_p:first-child]:transition group-hover:[&_p:first-child]:text-black/60"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-black/[0.025]" aria-current="page">
      {content}
    </div>
  );
}

function RelationSection({
  relation,
  currentPerformanceId,
  heading,
}: {
  relation: Relation;
  currentPerformanceId: number;
  heading: string;
}) {
  return (
    <section className="mt-12 grid gap-8 md:grid-cols-[180px_1fr]">
      <div className="section-head">
        <p className="section-label text-black/45">{relation.eyebrow}</p>
        <h2 className="section-title-ja">{heading}</h2>
      </div>

      <div>
        <p className="font-serif-jp mb-4 text-xl font-medium tracking-[0.02em] text-black/75">
          {relation.title}
        </p>
        <div className="divide-y divide-black/10 border-y border-black/10">
          {relation.items.map((item) => (
            <RelationItemView
              key={item.id}
              item={item}
              currentPerformanceId={currentPerformanceId}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export async function generateMetadata({
  params,
}: LiveDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const performanceId = parsePerformanceId(id);

  if (performanceId === null) {
    return { title: "ライブが見つかりません" };
  }

  const { data: live, error } = await getPublishedPerformance(performanceId);

  if (error || !live) {
    return { title: "ライブが見つかりません" };
  }

  const date = formatLiveDate(live.performance_date);
  return {
    title: live.title,
    description: date
      ? `${date}に行われた「${live.title}」のセットリストです。`
      : `「${live.title}」のセットリストです。`,
  };
}

export default async function LiveDetailPage({ params }: LiveDetailPageProps) {
  const { id } = await params;
  const performanceId = parsePerformanceId(id);

  if (performanceId === null) {
    notFound();
  }

  const { data: live, error } = await getPublishedPerformance(performanceId);

  if (error || !live) {
    notFound();
  }

  const [setlistResult, linksResult, eventGroupRelation, seriesRelations] =
    await Promise.all([
      supabase
        .from("live_setlist_entries")
        .select(
          "id,entry_type,setlist_no_raw,song_id,song_title_raw,artist_credit_raw,note_raw,marker_label",
        )
        .eq("live_performance_id", live.id)
        .order("sort_order", { ascending: true })
        .returns<LiveSetlistEntryRow[]>(),
      supabase
        .from("live_performance_links")
        .select("id,link_type,label,url")
        .eq("live_performance_id", live.id)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .returns<LivePerformanceLink[]>(),
      getEventGroupRelation(live.live_event_group_id),
      getSeriesRelations(live.id),
    ]);

  if (setlistResult.error) {
    throw new Error("セットリストの取得に失敗しました。");
  }
  if (linksResult.error) {
    throw new Error("公式リンクの取得に失敗しました。");
  }

  const setlistRows = setlistResult.data ?? [];
  const setlistEntryIds = setlistRows.map((entry) => entry.id);
  const componentResult = setlistEntryIds.length
    ? await supabase
        .from("live_setlist_entry_songs")
        .select("live_setlist_entry_id,song_id,sort_order")
        .in("live_setlist_entry_id", setlistEntryIds)
        .order("sort_order", { ascending: true })
        .returns<LiveSetlistEntrySongRow[]>()
    : { data: [], error: null };

  if (componentResult.error) {
    throw new Error("複合セットリストの構成曲取得に失敗しました。");
  }

  const componentRows = componentResult.data ?? [];
  const componentSongIds = [...new Set(componentRows.map((row) => row.song_id))];
  const componentSongResult = componentSongIds.length
    ? await supabase
        .from("songs")
        .select("id,title")
        .in("id", componentSongIds)
        .returns<SongTitleRow[]>()
    : { data: [], error: null };

  if (componentSongResult.error) {
    throw new Error("複合セットリストの曲情報取得に失敗しました。");
  }

  const titleBySongId = new Map(
    (componentSongResult.data ?? []).map((song) => [song.id, song.title]),
  );
  const componentSongsByEntryId = new Map<
    number,
    Array<{ songId: number; title: string }>
  >();
  for (const component of componentRows) {
    const title = titleBySongId.get(component.song_id);
    if (!title) {
      continue;
    }

    const songs = componentSongsByEntryId.get(component.live_setlist_entry_id) ?? [];
    songs.push({ songId: component.song_id, title });
    componentSongsByEntryId.set(component.live_setlist_entry_id, songs);
  }

  const setlistTables = mapSetlist(
    setlistRows,
    live.id,
    componentSongsByEntryId,
  );
  const songCount = setlistRows.filter(
    (entry) => entry.entry_type === "song",
  ).length;
  const officialLinks = linksResult.data ?? [];
  const relatedPerformances = eventGroupRelation
    ? eventGroupRelation.items.filter((item) => item.id !== live.id)
    : [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 border-b border-black/10 pb-5">
        <Link
          href="/live"
          className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
        >
          BACK TO LIVE ARCHIVE
        </Link>
      </div>

      {eventGroupRelation ? (
        <section className="mb-8 border-y border-black/15 py-5">
          <p className="section-label text-black/45">{eventGroupRelation.eyebrow}</p>
          <h2 className="font-serif-jp mt-2 text-xl font-medium tracking-[0.02em] text-black/75">
            {eventGroupRelation.title}
          </h2>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {eventGroupRelation.items.map((item) => {
              const isCurrent = item.id === live.id;

              return (
                <Link
                  key={item.id}
                  href={`/live/${item.id}`}
                  aria-current={isCurrent ? "page" : undefined}
                  className={
                    isCurrent
                      ? "border border-black bg-black px-4 py-3 text-[#f5f5f2]"
                      : "border border-black/20 px-4 py-3 text-black/60 transition hover:border-black hover:text-black"
                  }
                >
                  <p className="font-mono text-[10px] tracking-[0.14em]">{item.label}</p>
                  <p className="mt-1 text-sm font-medium leading-6">{item.title}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section
        className={
          live.image_url
            ? "grid gap-8 border-b border-black/15 pb-10 md:grid-cols-[minmax(0,1fr)_280px] md:items-start"
            : "border-b border-black/15 pb-10"
        }
      >
        <div className="min-w-0">
          {live.format_label ? (
            <p className="section-label text-black/45">{live.format_label}</p>
          ) : null}

          <h1
            className={`font-serif-jp max-w-4xl break-words text-3xl font-medium leading-[1.35] tracking-[0.02em] text-black md:text-5xl ${
              live.format_label ? "mt-3" : ""
            }`}
          >
            {live.title}
          </h1>

          {live.performance_date || live.artist_credit ? (
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-6 text-black/55">
              {live.performance_date ? (
                <time dateTime={live.performance_date}>
                  {formatLiveDate(live.performance_date)}
                </time>
              ) : null}
              {live.performance_date && live.artist_credit ? (
                <span className="text-black/20">/</span>
              ) : null}
              {live.artist_credit ? <span>{live.artist_credit}</span> : null}
            </div>
          ) : null}
        </div>

        {live.image_url ? (
          <div className="overflow-hidden border border-black/15 bg-black/[0.02]">
            <img src={live.image_url} alt="" className="h-auto w-full" />
          </div>
        ) : null}
      </section>

      <section className="mt-12 grid gap-8 md:grid-cols-[180px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">INFORMATION</p>
          <h2 className="section-title-ja">公演情報</h2>
        </div>

        <dl className="border-y border-black/10">
          {live.performance_date ? (
            <InformationRow label="DATE" value={formatLiveDate(live.performance_date)} />
          ) : null}
          {live.artist_credit ? (
            <InformationRow label="ARTIST" value={live.artist_credit} />
          ) : null}
          {live.format_label ? (
            <InformationRow label="FORMAT" value={live.format_label} />
          ) : null}
          {live.venue ? <InformationRow label="VENUE" value={live.venue} /> : null}
          {live.streaming_platforms.length > 0 ? (
            <InformationRow
              label="STREAMING PLATFORM"
              value={live.streaming_platforms.join(" / ")}
            />
          ) : null}
        </dl>
      </section>

      <section className="mt-12 grid gap-8 md:grid-cols-[180px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">SETLIST</p>
          <h2 className="section-title-ja">セットリスト</h2>
          <p className="mt-2 font-mono text-[10px] tracking-[0.1em] text-black/30">
            {songCount} ITEMS
          </p>
        </div>

        <LiveSetlist tables={setlistTables} />
      </section>

      {eventGroupRelation && relatedPerformances.length > 0 ? (
        <RelationSection
          relation={{ ...eventGroupRelation, items: relatedPerformances }}
          currentPerformanceId={live.id}
          heading="関連公演"
        />
      ) : null}

      {seriesRelations.map((relation) => (
        <RelationSection
          key={relation.id}
          relation={relation}
          currentPerformanceId={live.id}
          heading="シリーズ"
        />
      ))}

      {officialLinks.length > 0 ? (
        <section className="mt-12 grid gap-8 md:grid-cols-[180px_1fr]">
          <div className="section-head">
            <p className="section-label text-black/45">OFFICIAL LINKS</p>
            <h2 className="section-title-ja">公式リンク</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {officialLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="action-button inline-flex"
              >
                {link.label || link.link_type}
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
