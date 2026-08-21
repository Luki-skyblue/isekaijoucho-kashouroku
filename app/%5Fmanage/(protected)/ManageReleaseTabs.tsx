"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavRelease = { id: number; title: string | null } | null;

function useActiveReleaseTab() {
  const pathname = usePathname();
  return pathname.endsWith("/items") ? "items" : "overview";
}

function ManageReleaseTabs({ releaseId }: { releaseId: number }) {
  const active = useActiveReleaseTab();
  const tabs = [
    ["overview", "登録情報", `/_manage/releases/${releaseId}`],
    ["items", "収録曲", `/_manage/releases/${releaseId}/items`],
  ] as const;

  return (
    <nav aria-label="リリース管理タブ" className="mt-8 flex gap-1 border-b border-black/15">
      {tabs.map(([key, label, href]) => (
        <Link
          key={key}
          href={href}
          scroll={false}
          className={`border-b-2 px-4 py-3 text-sm transition ${active === key ? "border-black text-black" : "border-transparent text-black/40 hover:text-black"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function ManageReleaseHeader({
  releaseId,
  title,
  previousRelease,
  nextRelease,
}: {
  releaseId: number;
  title: string | null;
  previousRelease: NavRelease;
  nextRelease: NavRelease;
}) {
  const active = useActiveReleaseTab();
  const suffix = active === "items" ? "/items" : "";

  return (
    <>
      <header className="border-b border-black/15 pb-8">
        <div className="flex flex-wrap items-center gap-4 text-xs text-black/45">
          <Link href="/_manage/releases" className="transition hover:text-black">リリース一覧へ戻る</Link>
          <Link href={`/releases/${releaseId}`} target="_blank" className="transition hover:text-black">公開ページを見る ↗</Link>
        </div>
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)_minmax(180px,2fr)_minmax(0,1fr)] items-center gap-4 border-t border-black/10 pt-5">
          <div className="min-w-0 text-left">
            {previousRelease ? <Link href={`/_manage/releases/${previousRelease.id}${suffix}`} className="group block text-black/45 hover:text-black"><span className="block text-xs">← 前のリリース</span><span className="mt-1 block truncate text-sm">{previousRelease.title ?? `#${previousRelease.id}`}</span></Link> : <span className="text-xs text-black/20">← 前のリリース</span>}
          </div>
          <h1 className="font-serif-jp text-center text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">{title ?? `#${releaseId}`}</h1>
          <div className="min-w-0 text-right">
            {nextRelease ? <Link href={`/_manage/releases/${nextRelease.id}${suffix}`} className="group block text-black/45 hover:text-black"><span className="block text-xs">次のリリース →</span><span className="mt-1 block truncate text-sm">{nextRelease.title ?? `#${nextRelease.id}`}</span></Link> : <span className="text-xs text-black/20">次のリリース →</span>}
          </div>
        </div>
      </header>
      <ManageReleaseTabs releaseId={releaseId} />
    </>
  );
}
