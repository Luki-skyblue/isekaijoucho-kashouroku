import PreparationPage from "../PreparationPage";

const sourceTypes = [
  { label: "動画・配信", description: "YouTubeや各配信サイトの公開ページ" },
  { label: "公式情報", description: "公式サイトや公式告知による情報" },
  { label: "ライブ・イベント", description: "公演情報やセットリストの出典" },
  { label: "情報提供", description: "寄せられた情報と確認の手がかり" },
];

export default function SourcesPage() {
  return (
    <PreparationPage
      eyebrow="SOURCES"
      title="出典・資料"
      description="歌唱楽曲、リリース、ライブなどの記録を確認するために参照した動画・配信・公式情報をまとめるページです。"
    >
      <div className="border-y border-black/15 py-8">
        <p className="section-label text-black/35">REFERENCE ARCHIVE</p>
        <p className="font-serif-jp mt-4 max-w-xl text-2xl leading-relaxed text-black/70">
          記録のそばに、<br />
          たどれる出典を。
        </p>
        <p className="mt-5 max-w-2xl text-sm leading-8 text-black/50">
          将来的には各楽曲やリリースの詳細ページから、関連する出典へ直接移動できるようにします。
        </p>
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {sourceTypes.map((source) => (
          <div key={source.label} className="border-l border-black/20 pl-5">
            <h2 className="font-serif-jp text-lg text-black/75">{source.label}</h2>
            <p className="mt-2 text-sm leading-7 text-black/50">{source.description}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-xs tracking-[0.08em] text-black/40">このページは準備中です。</p>
    </PreparationPage>
  );
}
