'use client';

import Link from "next/link";
import { useState } from "react";

const navigation = [
  { href: "/songs", label: "楽曲" },
  { href: "/releases", label: "リリース" },
  { href: "/timeline", label: "年表", status: "（準備中）" },
  { href: "/discover", label: "探す", status: "（準備中）" },
  { href: "/live", label: "ライブ", status: "（準備中）" },
  { href: "/about", label: "About" },
];

export default function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-black/15 bg-[#f5f5f2]/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:py-5">
        <Link href="/" className="group" onClick={() => setIsMenuOpen(false)}>
          <p className="section-label text-black/45">UNOFFICIAL DATABASE</p>
          <p className="font-serif-jp mt-1 text-lg font-medium tracking-[0.02em] text-black">
            ヰ世界情緒 歌唱録
          </p>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-black/60 md:flex" aria-label="主要ナビゲーション">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-black">
              {item.label}
            </Link>
          ))}
          <Link href="/submit" className="ml-1 border-l border-black/15 pl-5 text-black/45 transition hover:text-black">
            情報提供
          </Link>
          <button
            type="button"
            className="border-l border-black/15 pl-5 text-black/35 transition hover:text-black"
            title="テーマ切替は準備中です"
            disabled
          >
            テーマ
          </button>
        </nav>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center border border-black/20 text-black/65 md:hidden"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
          aria-label={isMenuOpen ? "メニューを閉じる" : "メニューを開く"}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span className="relative block h-3.5 w-5">
            <span className={`absolute left-0 top-0 block h-px w-5 bg-current transition ${isMenuOpen ? "translate-y-[7px] rotate-45" : ""}`} />
            <span className={`absolute left-0 top-[7px] block h-px w-5 bg-current transition ${isMenuOpen ? "opacity-0" : ""}`} />
            <span className={`absolute left-0 top-[14px] block h-px w-5 bg-current transition ${isMenuOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
          </span>
        </button>
      </div>

      {isMenuOpen ? (
        <nav id="mobile-navigation" className="border-t border-black/10 px-6 py-5 md:hidden" aria-label="モバイルナビゲーション">
          <div className="mx-auto grid max-w-6xl gap-1 text-sm">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border-b border-black/10 py-3 text-black/70"
                onClick={() => setIsMenuOpen(false)}
              >
                <span>{item.label}</span>
                {item.status ? (
                  <span className="ml-3 text-xs tracking-[0.08em] text-black/35">
                    {item.status}
                  </span>
                ) : null}
              </Link>
            ))}
            <Link href="/submit" className="border-b border-black/10 py-3 text-black/70" onClick={() => setIsMenuOpen(false)}>
              情報提供
            </Link>
            <span className="py-3 text-black/35">テーマ（準備中）</span>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
