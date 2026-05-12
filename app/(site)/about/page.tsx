import Link from "next/link";

const officialLinks = [
  {
    label: "公式プロフィール",
    description: "KAMITSUBAKI STUDIO アーティストページ",
    href: "https://kamitsubaki.jp/artist/isekaijoucho/",
  },
  {
    label: "X",
    description: "ヰ世界情緒 公式X",
    href: "https://x.com/isekaijoucho",
  },
  {
    label: "YouTube Main",
    description: "YouTube メインチャンネル",
    href: "https://www.youtube.com/channel/UCah4_WVjmr8XA7i5aigwV-Q",
  },
  {
    label: "YouTube Sub",
    description: "YouTube サブチャンネル",
    href: "https://www.youtube.com/@isekaijoucho_sub",
  },
  {
    label: "TikTok",
    description: "TikTok",
    href: "https://www.tiktok.com/@isekaijoucho",
  },
  {
    label: "piapro",
    description: "piapro",
    href: "https://piapro.jp/isekaijoucho",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <section className="border-b border-black/15 pb-8">
        <p className="section-label text-black/45">ABOUT</p>

        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
          本サイトについて
        </h1>

        <p className="mt-5 text-sm leading-7 text-black/60">
          「ヰ世界情緒 歌唱録」は、ヰ世界情緒さんの歌唱楽曲・関連リンク・ライブセトリなどを整理する、ファンによる非公式データベースです。
          <br />
          KAMITSUBAKI STUDIO、ヰ世界情緒さん本人、および関係各社とは関係ありません。
        </p>
      </section>

      <section className="grid gap-10 border-b border-black/15 py-8 md:grid-cols-[220px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">UNOFFICIAL</p>
          <h2 className="section-title-ja">非公式サイト</h2>
        </div>

        <div className="space-y-4 text-sm leading-7 text-black/65">
          <p>
            本サイトはファン個人が制作・運営する非公式データベースです。
            KAMITSUBAKI STUDIO、ヰ世界情緒さん本人、および関係各社とは関係ありません。
          </p>

          <p>
            掲載している名称・楽曲名・アーティスト名・画像・各種リンク等の権利は、それぞれの権利者に帰属します。
          </p>
        </div>
      </section>

      <section className="grid gap-10 border-b border-black/15 py-8 md:grid-cols-[220px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">IMAGES / LINKS</p>
          <h2 className="section-title-ja">画像・外部リンク</h2>
        </div>

        <div className="space-y-4 text-sm leading-7 text-black/65">
          <p>
            本サイトでは、作品情報の確認および参照のため、公式サイト・公式配信ページ・公式動画などへの外部リンクを掲載しています。
          </p>

          <p>
            ジャケット画像・サムネイル画像等を表示する場合は、原則として公式ページ等で公開されている画像URLを参照し、画像そのものを本サイトに保存・再配布しない運用としています。
            各画像・作品名・商品名等の権利は、それぞれの権利者に帰属します。
          </p>

          <p>
            掲載内容に問題がある場合は、情報提供フォームよりご連絡ください。
            確認のうえ、必要に応じて修正・削除等の対応を行います。
          </p>
        </div>
      </section>

      <section className="grid gap-10 border-b border-black/15 py-8 md:grid-cols-[220px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">SITE</p>
          <h2 className="section-title-ja">本サイトの目的</h2>
        </div>

        <div className="space-y-4 text-sm leading-7 text-black/65">
          <p>
            本サイトは、ヰ世界情緒さんが歌唱した楽曲、カバー、コラボ、関連名義での歌唱、ライブ・配信での歌唱履歴などを、確認できる範囲で整理するための記録ページです。
          </p>

          <p>
            楽曲そのものの情報だけでなく、初出し日、歌唱名義、原曲情報、関連リンク、今後追加予定のライブセトリ情報などを横断的に確認できる場所を目指しています。
          </p>
        </div>
      </section>

      <section className="grid gap-10 border-b border-black/15 py-8 md:grid-cols-[220px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">SCOPE</p>
          <h2 className="section-title-ja">掲載範囲</h2>
        </div>

        <div className="space-y-4 text-sm leading-7 text-black/65">
          <p>
            本サイトでは、ヰ世界情緒さん本人名義の楽曲、カバー歌唱、コラボ歌唱、V.W.P等の関連名義での歌唱、ライブ・配信での歌唱履歴を主な整理対象とします。
          </p>

          <p>
            個人による非公式な転載動画、権利者による公開が確認できない音源、出典不明の情報は、原則として掲載対象外、または未確認情報として扱います。
          </p>
        </div>
      </section>

      <section className="grid gap-10 border-b border-black/15 py-8 md:grid-cols-[220px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">DATA</p>
          <h2 className="section-title-ja">掲載情報</h2>
        </div>

        <div className="space-y-4 text-sm leading-7 text-black/65">
          <p>
            掲載情報は、公開されている動画・配信・ライブ情報・告知・音楽配信サービス等をもとに整理しています。
          </p>

          <p>
            可能な限り正確な情報の掲載を目指していますが、未確認・不確定な情報、表記ゆれ、記載漏れを含む場合があります。
          </p>

          <p>
            情報の誤りや追加情報を見つけた場合は、各楽曲ページまたは共通の情報提供フォームからお知らせいただけると助かります。
          </p>
        </div>
      </section>

      <section className="grid gap-10 border-b border-black/15 py-8 md:grid-cols-[220px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">SUBMIT</p>
          <h2 className="section-title-ja">情報提供</h2>
        </div>

        <div className="space-y-4 text-sm leading-7 text-black/65">
          <p>
            送信された情報は管理者が確認し、内容が確認できた場合に反映します。
            確認には通常1日〜1週間程度かかる場合があります。
          </p>

          <p>
            出典URL、公開日、告知元、動画URLなどがあると確認しやすくなります。
            すべての送信内容が反映されるとは限りません。
          </p>

          <div className="pt-2">
            <Link href="/submit" className="action-button inline-flex">
              SUBMIT INFO
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-10 border-b border-black/15 py-8 md:grid-cols-[220px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">AI ASSISTANCE</p>
          <h2 className="section-title-ja">制作補助</h2>
        </div>

        <div className="space-y-4 text-sm leading-7 text-black/65">
          <p>
            本サイトの設計・実装・データ整理の一部には、ChatGPTを制作補助として利用しています。
          </p>

          <p>
            ただし、掲載内容の確認・編集・公開判断は管理者が行います。
          </p>
        </div>
      </section>

      <section className="grid gap-10 border-b border-black/15 py-8 md:grid-cols-[220px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">OFFICIAL LINKS</p>
          <h2 className="section-title-ja">公式リンク</h2>
        </div>

        <div className="divide-y divide-black/10 border-y border-black/15">
          {officialLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="grid gap-2 py-4 transition hover:bg-black/[0.03] md:grid-cols-[180px_1fr]"
            >
              <p className="link-label text-black">{item.label}</p>
              <p className="text-sm leading-6 text-black/60">
                {item.description}
              </p>
            </a>
          ))}
        </div>
      </section>

      <section className="grid gap-10 border-b border-black/15 py-8 md:grid-cols-[220px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">REFERENCE</p>
          <h2 className="section-title-ja">公式プロフィール</h2>
        </div>

        <div className="space-y-4 text-sm leading-7 text-black/65">
          <p>
            ヰ世界情緒さんの詳しいプロフィールや最新の公式情報は、KAMITSUBAKI
            STUDIOの公式アーティストページをご確認ください。
          </p>

          <p>
            公式プロフィールでは、歌唱だけでなく、創作・イラスト・ナレーション・声優など複数の表現領域で活動するクリエイターとして紹介されています。
          </p>
        </div>
      </section>

      <section className="grid gap-10 py-8 md:grid-cols-[220px_1fr]">
        <div className="section-head">
          <p className="section-label text-black/45">LINKS</p>
          <h2 className="section-title-ja">関連ページ</h2>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/songs" className="action-button">
            SONGS
          </Link>

          <Link href="/submit" className="action-button">
            SUBMIT
          </Link>

          <Link href="/" className="action-button">
            TOP
          </Link>
        </div>
      </section>
    </main>
  );
}