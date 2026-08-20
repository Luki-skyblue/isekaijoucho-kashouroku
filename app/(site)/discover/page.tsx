import PreparationPage from "../PreparationPage";

const discoverySources = ["他チャンネル", "YouTube外", "ライブ・イベント", "現在視聴困難"];

export default function DiscoverPage() {
  return (
    <PreparationPage
      eyebrow="DISCOVER"
      title="まだ知らない歌を探す"
      description="メインチャンネルを中心に見ている人が、普段なら見落とす歌唱と出会える場所です。単なる検索ではなく、知らない楽曲へ自然に辿り着ける導線を目指します。"
    >
      <div className="flex flex-wrap gap-2 border-b border-black/15 pb-8">
        {discoverySources.map((source, index) => (
          <span
            key={source}
            className={`border px-4 py-2 text-xs ${index === 0 ? "border-black/45 text-black/75" : "border-black/15 text-black/45"}`}
          >
            {source}
          </span>
        ))}
      </div>
      <div className="grid gap-8 py-10 md:grid-cols-[1fr_280px]">
        <div>
          <p className="section-label text-black/35">COMING ARCHIVE</p>
          <p className="font-serif-jp mt-4 text-2xl leading-relaxed text-black/70">
            まだ知らない歌に、<br />
            ここで出会う。
          </p>
        </div>
        <p className="text-sm leading-8 text-black/50">
          出典や歌唱の背景を添えながら、普段の検索では見つけにくい記録を紹介します。
        </p>
      </div>
      <p className="text-xs tracking-[0.08em] text-black/40">このページは準備中です。</p>
    </PreparationPage>
  );
}
