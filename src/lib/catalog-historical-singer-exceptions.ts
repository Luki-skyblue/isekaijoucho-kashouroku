/**
 * Audited, LOCAL FIXTURE ONLY historic performer substitution rules.
 * Identity-scoped edits: legacy ID + exact title + exact legacy credit. No
 * general "with" semantics are inferred. Original credits are preserved.
 *
 * 2024-11-02 official absence announcement + official Blu-ray track list:
 * https://kamitsubaki.jp/news/2024/10/04/4621/
 * https://findmestore.thinkr.jp/products/ktr-100-0185
 * 2023-03-30 DAY1 review/track list (RIM absent, 4 V.W.P + RIME):
 * https://www.diskgarage.com/digaonline/liverepo/176732
 * 2023-03-31 DAY2 review/track list (RIM absent, plus CIEL for Rinne):
 * https://www.livefans.jp/report/57352
 */
export type HistoricalSingerCase = {
 legacyId: number;
 title: string;
 credit: string;
 event: '2024-11-02_gen2_re' | '2023-03-30_fes_day1' | '2023-03-31_fes_day2';
 absent: '幸祜' | '理芽';
 expectedNames: readonly string[];
};
const VWP_WITH_COKO = ['花譜','理芽','春猿火','ヰ世界情緒','狐子'] as const;
const VWP_WITH_RIME = ['花譜','春猿火','ヰ世界情緒','幸祜','裏命'] as const;
const VWP_RIME_CIEL = [...VWP_WITH_RIME,'CIEL'] as const;
const VWP4_AND_VIP5 = [...VWP_WITH_RIME.slice(0,4),'可不','裏命','羽累','星界','狐子'] as const;
const entries = (
 list: ReadonlyArray<readonly [number,string]>,
 event: HistoricalSingerCase['event'], credit: string,
 absent: HistoricalSingerCase['absent'], expectedNames: readonly string[]
): HistoricalSingerCase[] => list.map(([legacyId,title])=>({legacyId,title,credit,event,absent,expectedNames}));
export const HISTORICAL_SINGER_EXCEPTIONS:readonly HistoricalSingerCase[] = [
 ...entries([
  [390,'共鳴 (現象II(再) ver.)'],[391,'再会 (現象II(再) ver.)'],
  [392,'切札 (現象II(再) ver.)'],[393,'同盟 (現象II(再) ver.)'],
  [396,'天命 (現象II(再) ver.)'],[397,'定命 (現象II(再) ver.)'],
  [399,'欲望 (現象II(再) ver.)'],[403,'秘密 (現象II(再) ver.)'],
  [404,'花束 (現象II(再) ver.)'],[405,'輪廻 (現象II(再) ver.)'],
  [406,'遊戯 (現象II(再) ver.)'],[408,'飛翔 (現象II(再) ver.)'],
  [409,'魔女(真) (現象II(再) ver.)'],
 ],'2024-11-02_gen2_re','V.W.P with 狐子','幸祜',VWP_WITH_COKO),
 ...entries([
  [414,'変身'],[417,'玩具'],[418,'秘密'],
 ],'2023-03-30_fes_day1','V.W.P & 裏命','理芽',VWP_WITH_RIME),
 ...entries([[428,'祭壇']],
  '2023-03-31_fes_day2','V.W.P & 裏命','理芽',VWP_WITH_RIME),
 ...entries([[354,"輪廻 (KAMITSUBAKI FES '23 ver.)"]],
  '2023-03-31_fes_day2','V.W.P & 裏命 & CIEL','理芽',VWP_RIME_CIEL),
 ...entries([[415,'定命'],[432,'電脳']],
  '2023-03-30_fes_day1','V.W.P & V.I.P','理芽',VWP4_AND_VIP5),
];

export function historicalSingerCase(legacyId:number|null):HistoricalSingerCase|undefined {
 return HISTORICAL_SINGER_EXCEPTIONS.find(x=>x.legacyId===legacyId);
}
