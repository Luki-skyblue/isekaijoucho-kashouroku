"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    href: "/_manage",
    label: "管理ホーム",
    description: "全体の入口",
    exact: true,
  },
  {
    href: "/_manage/submissions",
    label: "情報提供",
    description: "届いた提案を確認",
  },
  {
    href: "/_manage/songs",
    label: "楽曲",
    description: "歌唱録の基本データ",
  },
  {
    href: "/_manage/releases",
    label: "リリース",
    description: "作品と収録情報",
  },
];

export default function ManageNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="管理画面ナビゲーション" className="border-b border-black/15 bg-[#eeeee9]">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 py-2">
        {navigation.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`min-w-max border px-3 py-2 transition ${
                isActive
                  ? "border-black/35 bg-[#f5f5f2] text-black"
                  : "border-transparent text-black/50 hover:border-black/15 hover:text-black"
              }`}
            >
              <span className="block text-sm">{item.label}</span>
              <span className="mt-0.5 block text-[10px] text-black/35">
                {item.description}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
