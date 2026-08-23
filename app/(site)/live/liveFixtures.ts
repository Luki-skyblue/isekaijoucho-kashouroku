// 公開routeでは参照しない、変則SETLISTやrelationのUI regression確認専用fixture。
export type LiveSetlistSongEntryFixture = {
  id: string;
  kind: "song";
  setlistNoRaw: string;
  songTitleRaw: string;
  artistCreditRaw: string;
  noteRaw: string | null;
  songId?: number;
};

export type LiveSetlistMarkerEntryFixture = {
  id: string;
  kind: "marker";
  label: string;
};

export type LiveSetlistEntryFixture =
  | LiveSetlistSongEntryFixture
  | LiveSetlistMarkerEntryFixture;

export type LiveSetlistTableFixture = {
  id: string;
  tableIndexRaw: string;
  sectionLabelRaw: string | null;
  entries: LiveSetlistEntryFixture[];
};

export type LiveRelationItemFixture = {
  pageKey: string;
  dateRaw: string;
  label: string;
  title: string;
};

export type LiveRelationFixture = {
  eyebrow: string;
  title: string;
  items: LiveRelationItemFixture[];
};

export type LiveFixture = {
  pageKey: string;
  dateRaw: string;
  titleRaw: string;
  sourceCategoryRaw: string;
  archiveVisible: boolean;
  displayTitleLead?: string;
  displayTitleDetail?: string;
  displayArtistCredit?: string;
  formatLabel?: string;
  imageUrl?: string;
  venue?: string;
  streamingPlatforms?: string[];
  fixtureParent?: LiveRelationFixture;
  fixtureSeries?: LiveRelationFixture;
  officialLinks?: { label: string; url: string }[];
  recordedMedia?: LiveRecordedMediaFixture[];
  setlistTables: LiveSetlistTableFixture[];
};

export type LiveRecordedMediaFixture = {
  id: string;
  title: string;
  releaseDate?: string;
  imageUrl?: string;
  url?: string;
  note?: string;
};

type SetlistTuple = readonly [
  setlistNoRaw: string,
  songTitleRaw: string,
  artistCreditRaw: string,
  noteRaw?: string,
];

type SetlistMarkerInput = LiveSetlistMarkerEntryFixture;
type SetlistInput = SetlistTuple | SetlistMarkerInput;

function isSetlistMarkerInput(input: SetlistInput): input is SetlistMarkerInput {
  return !Array.isArray(input);
}

function createSetlistTable(
  pageKey: string,
  inputs: readonly SetlistInput[],
  options?: { tableIndexRaw?: string; sectionLabelRaw?: string },
): LiveSetlistTableFixture {
  const tableIndexRaw = options?.tableIndexRaw ?? "1";
  let songIndex = 0;

  return {
    id: `${pageKey}-table-${tableIndexRaw}`,
    tableIndexRaw,
    sectionLabelRaw: options?.sectionLabelRaw ?? null,
    entries: inputs.map((input) => {
      if (isSetlistMarkerInput(input)) {
        return input;
      }

      const [setlistNoRaw, songTitleRaw, artistCreditRaw, noteRaw] = input;
      songIndex += 1;

      return {
        // markerを挿入しても既存の歌唱機会IDが変わらないよう、songだけを数える。
        id: `${pageKey}-appearance-${String(songIndex).padStart(3, "0")}`,
        kind: "song" as const,
        setlistNoRaw,
        songTitleRaw,
        artistCreditRaw,
        noteRaw: noteRaw ?? null,
      };
    }),
  };
}

// 親イベントとseriesは、DB設計を決めるためのUI検証用仮relation。
// raw収集データそのものへ親子関係を追記したものではない。
const twoDaysRelation: LiveRelationFixture = {
  eyebrow: "2DAYS LIVE",
  title: "ヰ世界情緒 2DAYS LIVE",
  items: [
    {
      pageKey: "2026.0501",
      dateRaw: "2026.0501",
      label: "DAY 1",
      title: "Flower Closet",
    },
    {
      pageKey: "2026.0502",
      dateRaw: "2026.0502",
      label: "DAY 2",
      title: "Anima Re:birth",
    },
  ],
};

const animaSeriesRelation: LiveRelationFixture = {
  eyebrow: "SERIES",
  title: "Anima",
  items: [
    { pageKey: "2021.1023", dateRaw: "2021.1023", label: "Anima", title: "Anima" },
    {
      pageKey: "2023.0618",
      dateRaw: "2023.0618",
      label: "Anima II",
      title: "Anima II -神椿市参番街-",
    },
    {
      pageKey: "2024.0807",
      dateRaw: "2024.0807",
      label: "Anima III",
      title: "Anima III",
    },
    {
      pageKey: "2026.0502",
      dateRaw: "2026.0502",
      label: "Anima Re:birth",
      title: "Anima Re:birth",
    },
  ],
};

const candyLiveSeriesRelation: LiveRelationFixture = {
  eyebrow: "SERIES",
  title: "キャンディライブ",
  items: [
    {
      pageKey: "2020.1226",
      dateRaw: "2020.1226",
      label: "キャンディライブ",
      title: "キャンディライブ",
    },
    {
      pageKey: "2023.0114",
      dateRaw: "2023.0114",
      label: "キャンディライブ 2",
      title: "キャンディライブ 2",
    },
    {
      pageKey: "2025.1011",
      dateRaw: "2025.1011",
      label: "キャンディライブ 3",
      title: "キャンディライブ 3",
    },
  ],
};

export const liveFixtures: LiveFixture[] = [
  {
    pageKey: "2021.1023",
    dateRaw: "2021.1023",
    titleRaw: "ヰ世界情緒 1st ONE-MAN LIVE「Anima」",
    sourceCategoryRaw: "箱内",
    archiveVisible: true,
    displayArtistCredit: "ヰ世界情緒",
    formatLabel: "1st ONE-MAN LIVE",
    fixtureSeries: animaSeriesRelation,
    setlistTables: [
      createSetlistTable("2021.1023", [
        ["01", "物語りのワルツ", "ヰ世界情緒"],
        ["02", "ジオラマドラマ", "ヰ世界情緒"],
        ["03", "ハイドレンジア", "ヰ世界情緒"],
        ["04", "いろはに咲きて", "ヰ世界情緒"],
        ["05", "ディメンション", "ヰ世界情緒"],
        ["06", "斯く美しき造花", "ヰ世界情緒"],
        ["07", "やさしいせかい", "ヰ世界情緒"],
        ["08", "マボロシのまち", "ヰ世界情緒"],
        ["09", "ヰ世界の宝石譚", "ヰ世界情緒"],
        ["10", "霞がついてくる", "ヰ世界情緒"],
        ["11", "牢獄", "ヰ世界情緒 feat. 春猿火"],
        ["12", "暗闇", "ヰ世界情緒 feat. 花譜"],
        ["13", "泡沫", "ヰ世界情緒 feat. 理芽"],
        ["14", "刻印", "ヰ世界情緒 feat. 幸祜"],
        ["15", "変身", "V.W.P"],
        ["16", "とめどなき白情", "ヰ世界情緒"],
        ["17", "誰もいない絵で", "ヰ世界情緒"],
        ["18", "シリウスの心臓", "ヰ世界情緒"],
        // UI検証用の仮marker。rawからこの位置を事実として確定したものではない。
        {
          id: "2021.1023-marker-archive-preview",
          kind: "marker",
          label: "アーカイブ限定（UI検証）",
        },
        ["19", "深淵(アーカイブ限定)", "ヰ世界情緒"],
        ["20", "ANEMONE(アーカイブ限定)", "ヰ世界情緒"],
        ["21", "輪廻(アーカイブ限定)", "ヰ世界情緒"],
      ]),
    ],
  },
  {
    pageKey: "2024.0113",
    dateRaw: "2024.0113",
    titleRaw: "V.W.P 2nd ONE-MAN LIVE「現象II -魔女拡成-」",
    sourceCategoryRaw: "箱内",
    archiveVisible: true,
    displayArtistCredit: "V.W.P",
    formatLabel: "2nd ONE-MAN LIVE",
    setlistTables: [
      createSetlistTable("2024.0113", [
        ["01", "共鳴", "V.W.P"],
        ["02", "輪廻", "V.W.P"],
        ["03", "玩具", "V.W.P"],
        ["04", "秘密", "V.W.P"],
        ["05", "変身", "V.W.P"],
        ["06", "再会", "V.W.P"],
        ["07", "定命", "V.W.P"],
        ["08", "魔的", "理芽×花譜"],
        ["09", "素的", "理芽×幸祜"],
        ["10", "不的", "理芽×ヰ世界情緒"],
        ["11", "私的", "理芽×春猿火"],
        ["12", "飛翔", "V.W.P"],
        ["13", "此処で咲かせて", "幸祜×CIEL"],
        ["14", "絵画のように美しくいたかった", "理芽×Guiano"],
        ["15", "異世界転調リクヱスト", "ヰ世界情緒×VALIS"],
        ["16", "friction (Remix)", "春猿火×梓川"],
        ["17", "千年奏者", "花譜×Albemuth"],
        ["18", "プロトコール", "V.W.P & V.I.P with VALIS"],
        ["19", "機械の声", "V.W.P & V.I.P with VALIS"],
        ["20", "描き続けた君へ", "ヰ世界情緒"],
        ["21", "百年", "理芽"],
        ["22", "ゲンフウケイ", "幸祜"],
        ["23", "身空歌", "春猿火"],
        ["24", "邂逅", "花譜"],
        ["25", "花束", "V.W.P"],
        ["26", "祭霊(祭壇+言霊)", "V.W.P"],
        ["27", "同盟", "V.W.P"],
        ["28", "強気", "V.W.P"],
        ["29", "感情", "V.W.P"],
        ["30", "切札", "V.W.P"],
        ["31", "魔女(真)", "V.W.P"],
      ]),
    ],
  },
  {
    pageKey: "2026.0501",
    dateRaw: "2026.0501",
    titleRaw: "ヰ世界情緒 2DAYS LIVE DAY-1「Flower Closet」",
    sourceCategoryRaw: "箱内",
    archiveVisible: true,
    displayTitleLead: "ヰ世界情緒 2DAYS LIVE",
    displayTitleDetail: "DAY-1「Flower Closet」",
    displayArtistCredit: "ヰ世界情緒",
    formatLabel: "ONE-MAN LIVE / DAY 1",
    fixtureParent: twoDaysRelation,
    setlistTables: [
      createSetlistTable("2026.0501", [
        ["01", "果てなきソラへ", "ヰ世界情緒"],
        ["02", "ラケナリアの夢", "ヰ世界情緒"],
        ["03", "まぼろしの行方", "ヰ世界情緒"],
        ["04", "FARAWAY", "ヰ世界情緒"],
        ["05", "そして白に還る", "ヰ世界情緒"],
        ["06", "パンドラコール", "ヰ世界情緒"],
        ["07", "ラピスのお人形", "ヰ世界情緒"],
        ["08", "此処に棘と死を", "ヰ世界情緒"],
        ["09", "ARCADIA", "ヰ世界情緒"],
        ["10", "ANGELIC", "ヰ世界情緒"],
        ["11", "ETERNAL", "ヰ世界情緒"],
        ["12", "アンビバレント", "ヰ世界情緒"],
        ["13", "Capullo", "ヰ世界情緒"],
        ["14", "コンパスローズ", "ヰ世界情緒"],
        ["15", "モシモノセカイ", "ヰ世界情緒"],
        ["16", "また、ここから", "ヰ世界情緒"],
        ["17", "物語りのワルツ", "ヰ世界情緒"],
        ["18", "とめどなき白情", "ヰ世界情緒"],
        ["19", "シリウスの心臓", "ヰ世界情緒"],
        ["20", "ヰ世界の宝石譚", "ヰ世界情緒"],
        ["21", "かたちなきもの", "ヰ世界情緒"],
        ["22", "みらいのかたち", "ヰ世界情緒"],
        ["23", "永遠に枯れぬ花", "ヰ世界情緒"],
      ]),
    ],
  },
  {
    pageKey: "2026.0502",
    dateRaw: "2026.0502",
    titleRaw: "ヰ世界情緒 2DAYS LIVE DAY-2「Anima Re:birth」",
    sourceCategoryRaw: "箱内",
    archiveVisible: true,
    displayTitleLead: "ヰ世界情緒 2DAYS LIVE",
    displayTitleDetail: "DAY-2「Anima Re:birth」",
    displayArtistCredit: "ヰ世界情緒",
    formatLabel: "ONE-MAN LIVE / DAY 2",
    fixtureParent: twoDaysRelation,
    fixtureSeries: animaSeriesRelation,
    setlistTables: [
      createSetlistTable("2026.0502", [
        ["01", "物語りのワルツ", "ヰ世界情緒"],
        ["02", "ジオラマドラマ", "ヰ世界情緒"],
        ["03", "ハイドレンジア", "ヰ世界情緒"],
        ["04", "いろはに咲きて", "ヰ世界情緒"],
        ["05", "ディメンション", "ヰ世界情緒"],
        ["06", "斯く美しき造花", "ヰ世界情緒"],
        ["07", "やさしいせかい", "ヰ世界情緒"],
        ["08", "マボロシのまち", "ヰ世界情緒"],
        ["09", "ヰ世界の宝石譚", "ヰ世界情緒"],
        ["10", "霞がついてくる", "ヰ世界情緒"],
        ["11", "牢獄", "ヰ世界情緒 feat. 春猿火"],
        ["12", "暗闇", "ヰ世界情緒 feat. 花譜"],
        ["13", "泡沫", "ヰ世界情緒 feat. 理芽"],
        ["14", "刻印", "ヰ世界情緒 feat. 幸祜"],
        ["15", "変身", "ヰ世界情緒"],
        ["16", "とめどなき白情", "ヰ世界情緒"],
        ["17", "誰もいない絵で", "ヰ世界情緒"],
        ["18", "シリウスの心臓", "ヰ世界情緒"],
        ["19", "ANEMONE", "ヰ世界情緒"],
        ["20", "グレイスケイル", "ヰ世界情緒"],
        ["21", "描き続けた君へ", "ヰ世界情緒"],
      ]),
    ],
  },
  {
    pageKey: "2025.0717",
    dateRaw: "2025.0717",
    titleRaw: "ヰ世界情緒 拡声の会「ARIA-ISEKAIJOUCHO」",
    sourceCategoryRaw: "歌枠・配信",
    archiveVisible: true,
    displayArtistCredit: "ヰ世界情緒",
    setlistTables: [
      createSetlistTable("2025.0717", [
        ["01", "ホントノ", "ヰ世界情緒"],
        ["02", "The Decisive Hour", "ヰ世界情緒"],
        ["03", "わたしレプリカ", "ヰ世界情緒"],
        ["04", "はやく夜へ", "ヰ世界情緒"],
        ["05", "黒塗り世界宛て書簡", "ヰ世界情緒"],
        ["06", "はやく夜へ", "ヰ世界情緒"],
      ]),
    ],
  },
  {
    pageKey: "2024.0813",
    dateRaw: "2024.0813",
    titleRaw: "バーチャル舞台劇「御伽噺(染) ver0.92_prototype」",
    sourceCategoryRaw: "箱内",
    archiveVisible: true,
    formatLabel: "バーチャル舞台劇",
    setlistTables: [
      createSetlistTable("2024.0813", [
        ["01", "鱗翅目的特異点", "花譜 & 理芽"],
        ["02", "守護・純血・理", "春猿火 & 幸祜"],
        ["03", "君の目に私は", "花譜"],
        ["04", "深き者白き背に乗りて", "ヰ世界情緒"],
        ["05", "廃校舎の幽霊", "理芽"],
        ["06", "照射", "V.W.P"],
      ]),
    ],
  },
  {
    pageKey: "2023.1022",
    dateRaw: "2023.1022",
    titleRaw: "VALIS TALK & LIVE「無限ミーティング Vol.2 -SIDE Origin-」名古屋",
    sourceCategoryRaw: "箱内",
    archiveVisible: false,
    displayArtistCredit: "VALIS",
    formatLabel: "TALK & LIVE",
    setlistTables: [
      // raw上は同じ表の中で01へ戻る。根拠のないPART分割は行わない。
      createSetlistTable("2023.1022", [
        ["01", "逆光", "MYU & VITTE"],
        ["02", "いーあるふぁんくらぶ", "CHONO & NEFFY & RARA"],
        ["03", "普通、アイドル10年やってらんないでしょ！？", "VALIS"],
        ["01", "Blessing", "CHINO & NEFFY"],
        ["02", "天ノ弱", "MYU & RARA & VITTE"],
        ["03", "オーケストラ", "VALIS"],
      ]),
    ],
  },
  {
    pageKey: "2025.1011",
    dateRaw: "2025.1011",
    titleRaw: "ヰ世界情緒 STREAMING COVER LIVE「キャンディライブ 3」",
    sourceCategoryRaw: "箱内",
    archiveVisible: true,
    displayArtistCredit: "ヰ世界情緒",
    formatLabel: "STREAMING COVER LIVE",
    fixtureSeries: candyLiveSeriesRelation,
    setlistTables: [
      createSetlistTable("2025.1011", [
        ["01", "Calc.", "ヰ世界情緒"],
        ["02", "アスノヨゾラ哨戒班", "ヰ世界情緒"],
        ["03", "砂の惑星", "ヰ世界情緒"],
        ["04", "きゅうくらりん", "ヰ世界情緒"],
        ["05", "ビビビビ", "ヰ世界情緒"],
        ["06", "non-reflection", "ヰ世界情緒"],
        ["07", "深海のリトルクライ", "ヰ世界情緒"],
        ["08", "コネクト", "ヰ世界情緒"],
        ["09", "God knows...", "ヰ世界情緒"],
        ["10", "ファンサ", "ヰ世界情緒"],
        ["11", "芝居の終焉", "ヰ世界情緒"],
        ["12", "僕は依存症", "ヰ世界情緒"],
        ["13", "rose", "ヰ世界情緒"],
        ["14", "月曜日戦争", "ヰ世界情緒"],
        ["15", "Buffer", "ヰ世界情緒"],
        ["16", "愛のまま", "ヰ世界情緒"],
        ["17", "本当の音", "ヰ世界情緒"],
        ["18", "All Alone With You", "ヰ世界情緒"],
        ["19", "奏（かなで）", "ヰ世界情緒"],
        ["20", "鏡面の波", "ヰ世界情緒"],
      ]),
    ],
  },
];

export function getLiveFixture(pageKey: string) {
  return liveFixtures.find((live) => live.pageKey === pageKey);
}

export function getArchiveLiveFixtures() {
  return liveFixtures
    .filter((live) => live.archiveVisible)
    .sort((a, b) => b.dateRaw.localeCompare(a.dateRaw));
}

export function formatLiveDate(dateRaw: string) {
  const match = /^(\d{4})\.(\d{2})(\d{2})$/.exec(dateRaw);

  if (!match) {
    return dateRaw;
  }

  return `${match[1]}.${match[2]}.${match[3]}`;
}

export function getLiveYear(dateRaw: string) {
  return dateRaw.slice(0, 4);
}

export function getLiveMonthDay(dateRaw: string) {
  const match = /^\d{4}\.(\d{2})(\d{2})$/.exec(dateRaw);

  if (!match) {
    return dateRaw;
  }

  return `${match[1]}.${match[2]}`;
}

export function getSetlistItemCount(live: LiveFixture) {
  return live.setlistTables.reduce(
    (total, table) =>
      total + table.entries.filter((entry) => entry.kind === "song").length,
    0,
  );
}
