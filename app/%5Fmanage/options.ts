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

export function isManageOptionValue(
  options: readonly ManageSelectOption[],
  value: string,
) {
  return options.some((option) => option.value === value);
}
