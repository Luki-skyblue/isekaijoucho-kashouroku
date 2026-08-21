"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DISCOVERY_CATEGORY_OPTIONS } from "@/app/%5Fmanage/options";

type DiscoveryCategory = "isekai_official" | "vwp_official" | "other_channel" | "cd_album" | "live_event" | "other";

type DiscoverSong = {
  id: number;
  title: string | null;
  artist_credit: string | null;
  first_date: string | null;
  first_source: string | null;
  song_type: string | null;
  version_name: string | null;
  is_primary_version: boolean | null;
  discovery_category: string | null;
};

const descriptions: Record<DiscoveryCategory, string> = {
  isekai_official: "ヰ世界情緒公式チャンネルで公開されている歌唱です。",
  vwp_official: "V.W.P公式チャンネルで公開されている歌唱です。",
  other_channel: "コラボ相手や企画など、その他のYouTubeチャンネルで公開されている歌唱です。",
  cd_album: "CDやアルバムなどの作品に収録されている歌唱です。",
  live_event: "ライブやイベントで披露された歌唱記録です。",
  other: "音源作品やYouTube以外の場所など、上記に含まれない歌唱記録です。",
};

function formatDate(date: string | null) {
  return date ? date.replaceAll("-", ".") : "日付未確認";
}

function getVersion(song: DiscoverSong) {
  return song.version_name || (song.is_primary_version === false ? "別バージョン" : null);
}

export default function DiscoverCatalog({ songs }: { songs: DiscoverSong[] }) {
  const [active, setActive] = useState<DiscoveryCategory>("isekai_official");
  const grouped = useMemo(() => new Map(DISCOVERY_CATEGORY_OPTIONS.map((category) => [category.value, songs.filter((song) => song.discovery_category === category.value)])), [songs]);
  const activeOption = DISCOVERY_CATEGORY_OPTIONS.find((category) => category.value === active)!;
  const activeSongs = grouped.get(active) ?? [];

  return (
    <section className="mt-8">
      <div className="grid gap-px border border-black/15 bg-black/15 sm:grid-cols-2 lg:grid-cols-3" role="tablist" aria-label="聴ける場所">
        {DISCOVERY_CATEGORY_OPTIONS.map((category, index) => {
          const selected = category.value === active;
          return (
            <button key={category.value} type="button" role="tab" aria-selected={selected} onClick={() => setActive(category.value as DiscoveryCategory)} className={`min-h-28 p-4 text-left transition ${selected ? "bg-black text-[#f5f5f2]" : "bg-[#f5f5f2] text-black hover:bg-white"}`}>
              <span className={`block text-[10px] tracking-[0.18em] ${selected ? "text-white/45" : "text-black/35"}`}>0{index + 1}</span>
              <span className="mt-3 block text-sm leading-6">{category.label}</span>
              <span className={`mt-2 block text-xs ${selected ? "text-white/50" : "text-black/40"}`}>{grouped.get(category.value)?.length ?? 0}曲</span>
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex flex-wrap items-end justify-between gap-4 border-b border-black/15 pb-5">
        <div><p className="section-label text-black/40">SELECTED CATEGORY</p><h2 className="font-serif-jp mt-2 text-2xl text-black/80">{activeOption.label}</h2><p className="mt-3 text-sm leading-7 text-black/50">{descriptions[active]}</p></div>
        <p className="text-xs text-black/40">{activeSongs.length} SONGS</p>
      </div>

      {activeSongs.length > 0 ? (
        <div className="grid gap-px border-x border-b border-black/15 bg-black/10 sm:grid-cols-2">
          {activeSongs.map((song) => {
            const version = getVersion(song);
            return (
              <Link key={song.id} href={`/songs/${song.id}`} className="group min-w-0 bg-[#f5f5f2] p-5 transition hover:bg-white">
                <div className="flex items-start justify-between gap-4"><p className="text-xs tabular-nums text-black/35">{formatDate(song.first_date)}</p><span className="text-xs text-black/30 transition group-hover:translate-x-1 group-hover:text-black">→</span></div>
                <h3 className="font-serif-jp mt-4 text-xl leading-8 text-black/80">{song.title ?? `#${song.id}`}</h3>
                <p className="mt-2 text-xs text-black/45">{song.artist_credit || "アーティスト未設定"}{version ? ` · ${version}` : ""}</p>
                {song.first_source ? <p className="mt-4 line-clamp-2 text-xs leading-6 text-black/40">{song.first_source}</p> : null}
              </Link>
            );
          })}
        </div>
      ) : <div className="border-x border-b border-black/15 px-5 py-12"><p className="text-sm text-black/40">この分類の楽曲はまだ登録されていません。</p></div>}
    </section>
  );
}
