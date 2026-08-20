import PreparationPage from "../PreparationPage";

const creatorRoles = [
  { label: "作曲者", description: "楽曲のメロディーを手がけた人" },
  { label: "作詞者", description: "歌詞を手がけた人" },
  { label: "編曲者", description: "楽曲のアレンジを手がけた人" },
  { label: "原曲アーティスト", description: "カバー元の楽曲を歌った人" },
];

export default function CreatorsPage() {
  return (
    <PreparationPage
      eyebrow="CREATORS"
      title="制作者から探す"
      description="作曲者、作詞者、編曲者、原曲アーティストなど、楽曲に関わる人や名義から歌唱録を横断して辿れるページです。"
    >
      <div className="grid gap-px border border-black/15 bg-black/15 sm:grid-cols-2">
        {creatorRoles.map((role, index) => (
          <div key={role.label} className="bg-[#f5f5f2]/90 p-6 sm:p-8">
            <p className="archive-label text-black/35">0{index + 1}</p>
            <h2 className="font-serif-jp mt-5 text-xl text-black/80">{role.label}</h2>
            <p className="mt-3 text-sm leading-7 text-black/50">{role.description}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-xs tracking-[0.08em] text-black/40">このページは準備中です。</p>
    </PreparationPage>
  );
}
