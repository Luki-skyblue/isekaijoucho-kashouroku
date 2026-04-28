import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notoSerifJp = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://isekaijoucho-kashouroku.vercel.app"),
  title: {
    default: "ヰ世界情緒 歌唱録",
    template: "%s | ヰ世界情緒 歌唱録",
  },
  description:
    "ヰ世界情緒さんの歌唱楽曲・関連リンク・ライブセトリなどを整理する、ファンによる非公式データベースです。",
  openGraph: {
    title: "ヰ世界情緒 歌唱録",
    description:
      "ヰ世界情緒さんの歌唱楽曲・関連リンク・ライブセトリなどを整理する、ファンによる非公式データベースです。",
    url: "https://isekaijoucho-kashouroku.vercel.app",
    siteName: "ヰ世界情緒 歌唱録",
    type: "website",
    locale: "ja_JP",
    images: [
      {
        url: "/ogp.png",
        width: 1200,
        height: 630,
        alt: "ヰ世界情緒 歌唱録",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ヰ世界情緒 歌唱録",
    description:
      "ヰ世界情緒さんの歌唱楽曲・関連リンク・ライブセトリなどを整理する、ファンによる非公式データベースです。",
    images: ["/ogp.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${notoSansJp.variable} ${notoSerifJp.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#f5f5f2] text-[#111111]">
        {children}
      </body>
    </html>
  );
}