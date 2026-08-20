import PreparationPage from "../PreparationPage";

const timelineItems = [
  { label: "初歌唱", description: "楽曲との出会いを記録" },
  { label: "公開・配信", description: "MVや配信開始日を記録" },
  { label: "リリース", description: "作品単位の発表を記録" },
  { label: "ライブ・イベント", description: "現地での歌唱履歴を記録" },
];

export default function TimelinePage() {
  return (
    <PreparationPage
      eyebrow="TIMELINE"
      title="歌唱録年表"
      description="初歌唱、MV公開、配信開始、リリース、ライブなど、ヰ世界情緒さんの活動を時系列で辿れるページです。"
    >
      <div className="grid gap-px border border-black/15 bg-black/15 sm:grid-cols-2">
        {timelineItems.map((item, index) => (
          <div key={item.label} className="bg-[#f5f5f2]/90 p-6 sm:p-8">
            <p className="archive-label text-black/35">0{index + 1}</p>
            <h2 className="font-serif-jp mt-5 text-xl text-black/80">{item.label}</h2>
            <p className="mt-3 text-sm leading-7 text-black/50">{item.description}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-xs tracking-[0.08em] text-black/40">このページは準備中です。</p>
    </PreparationPage>
  );
}
