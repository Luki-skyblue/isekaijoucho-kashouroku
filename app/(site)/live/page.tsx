import PreparationPage from "../PreparationPage";

const liveSections = [
  { label: "LIVE", title: "ライブ一覧", description: "公演ごとの歌唱履歴を辿る" },
  { label: "EVENT", title: "イベント", description: "企画や出演記録をまとめる" },
  { label: "SETLIST", title: "セットリスト", description: "その日に歌われた楽曲を見る" },
];

export default function LivePage() {
  return (
    <PreparationPage
      eyebrow="LIVE / EVENT"
      title="ライブ・イベント"
      description="ライブやイベントの出演記録、セットリストを通して、その場所で歌われた楽曲へ辿れるページです。"
    >
      <div className="grid gap-8 border-y border-black/15 py-8 md:grid-cols-3">
        {liveSections.map((section) => (
          <div key={section.label} className="border-l border-black/20 pl-5">
            <p className="archive-label text-black/35">{section.label}</p>
            <h2 className="font-serif-jp mt-4 text-xl text-black/75">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-black/50">{section.description}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-xs tracking-[0.08em] text-black/40">このページは準備中です。</p>
    </PreparationPage>
  );
}
