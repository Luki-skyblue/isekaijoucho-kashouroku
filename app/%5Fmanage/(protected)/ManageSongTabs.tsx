"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function useActiveSongTab() {
  const pathname = usePathname();
  if (pathname.endsWith("/links")) return "links";
  if (pathname.endsWith("/digital-releases")) return "digital";
  return "overview";
}

export default function ManageSongTabs({ songId }: { songId: number }) {
  const active = useActiveSongTab();
  const tabs = [["overview", "登録情報", `/_manage/songs/${songId}`], ["links", "関連リンク", `/_manage/songs/${songId}/links`], ["digital", "配信リリース", `/_manage/songs/${songId}/digital-releases`]] as const;
  return <nav aria-label="楽曲管理タブ" className="mt-8 flex gap-1 border-b border-black/15">{tabs.map(([key, label, href]) => <Link key={key} href={href} scroll={false} className={`border-b-2 px-4 py-3 text-sm transition ${active === key ? "border-black text-black" : "border-transparent text-black/40 hover:text-black"}`}>{label}</Link>)}</nav>;
}

type NavSong = { id: number; title: string | null } | null;

export function ManageSongHeader({ songId, title, previousSong, nextSong }: { songId: number; title: string | null; previousSong: NavSong; nextSong: NavSong }) {
  const active = useActiveSongTab();
  const suffix = active === "links" ? "/links" : active === "digital" ? "/digital-releases" : "";
  return <>
    <header className="border-b border-black/15 pb-8">
      <div className="flex flex-wrap items-center gap-4 text-xs text-black/45">
        <Link href="/_manage/songs" className="transition hover:text-black">楽曲一覧へ戻る</Link>
        <Link href={`/songs/${songId}?from=manage`} target="_blank" className="transition hover:text-black">公開ページを見る ↗</Link>
      </div>
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_minmax(180px,2fr)_minmax(0,1fr)] items-center gap-4 border-t border-black/10 pt-5">
        <div className="min-w-0 text-left">{previousSong ? <Link href={`/_manage/songs/${previousSong.id}${suffix}`} className="group block text-black/45 hover:text-black"><span className="block text-xs">← 前の曲</span><span className="mt-1 block truncate text-sm">{previousSong.title ?? `#${previousSong.id}`}</span></Link> : <span className="text-xs text-black/20">← 前の曲</span>}</div>
        <h1 className="font-serif-jp text-center text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">{title ?? `#${songId}`}</h1>
        <div className="min-w-0 text-right">{nextSong ? <Link href={`/_manage/songs/${nextSong.id}${suffix}`} className="group block text-black/45 hover:text-black"><span className="block text-xs">次の曲 →</span><span className="mt-1 block truncate text-sm">{nextSong.title ?? `#${nextSong.id}`}</span></Link> : <span className="text-xs text-black/20">次の曲 →</span>}</div>
      </div>
    </header>
    <ManageSongTabs songId={songId} />
  </>;
}
