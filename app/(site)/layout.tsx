import Link from "next/link";
import SiteHeader from "./SiteHeader";

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <div className="flex-1">{children}</div>

      <footer className="border-t border-black/15">
        <div className="mx-auto grid max-w-6xl gap-3 px-6 py-8 text-xs leading-6 text-black/55 md:grid-cols-[220px_1fr]">
          <p className="section-label text-black/65">NOTICE</p>
          <div>
            <p>非公式ファンデータベース / 制作補助：ChatGPT</p>
            <p>
              本サイトはKAMITSUBAKI STUDIOおよび関係各社とは関係ありません。
              掲載している情報・画像等の権利は各権利者に帰属します。
              掲載情報には未確認・不確定なものが含まれる場合があります。
              詳細は{" "}
              <Link href="/about" className="underline underline-offset-4 hover:text-black">
                ABOUT
              </Link>
              をご確認ください。
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}