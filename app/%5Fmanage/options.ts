export type ManageSelectOption = {
  value: string;
  label: string;
};

export const SONG_TYPE_OPTIONS = [
  { value: "original", label: "original / オリジナル" },
  { value: "cover", label: "cover / カバー" },
  { value: "collaboration", label: "collaboration / コラボレーション" },
  { value: "other", label: "other / その他" },
] satisfies readonly ManageSelectOption[];

export const LINK_TYPE_OPTIONS = [
  { value: "mv", label: "mv / ミュージックビデオ" },
  { value: "trailer", label: "trailer / トレーラー" },
  { value: "lyric_mv", label: "lyric_mv / リリックMV" },
  { value: "live_mv", label: "live_mv / ライブ映像" },
  { value: "original", label: "original / 原曲" },
  { value: "streaming", label: "streaming / 配信・ストリーミング" },
  { value: "lyrics", label: "lyrics / 歌詞" },
  { value: "piapro", label: "piapro" },
  { value: "x", label: "x / Xの投稿" },
  { value: "announcement", label: "announcement / お知らせ" },
  { value: "album", label: "album / アルバム" },
  { value: "other", label: "other / その他" },
] satisfies readonly ManageSelectOption[];

export const RELEASE_TYPE_OPTIONS = [
  { value: "digital_single", label: "digital_single / 配信シングル" },
  { value: "single", label: "single / シングル" },
  { value: "ep", label: "ep / EP" },
  { value: "album", label: "album / アルバム" },
  { value: "cd", label: "cd / CD" },
  { value: "compilation", label: "compilation / コンピレーション" },
  { value: "other", label: "other / その他" },
] satisfies readonly ManageSelectOption[];

export const DISCOVERY_CATEGORY_OPTIONS = [
  { value: "isekai_official", label: "ヰ世界情緒公式チャンネル" },
  { value: "vwp_official", label: "V.W.P公式チャンネル" },
  { value: "other_channel", label: "その他のYouTubeチャンネル" },
  { value: "cd_album", label: "CD・アルバム" },
  { value: "live_event", label: "ライブ・イベント" },
  { value: "other", label: "その他" },
] satisfies readonly ManageSelectOption[];

export function isManageOptionValue(
  options: readonly ManageSelectOption[],
  value: string,
) {
  return options.some((option) => option.value === value);
}
