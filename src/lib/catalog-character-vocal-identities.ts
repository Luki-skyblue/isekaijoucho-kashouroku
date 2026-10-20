/** Character-role credits are display identities; vocal search uses the credited performers.
 * Existing G1/G2 artist Entity IDs, not inferred new identities.
 * Exact legacy-ID-scoped, provisional local-review overlay only. No DB mutation.
 */
export type CharacterVocalCreditCase = {
 legacyId:number;title:string;credit:string;
 characterTokens:readonly string[];
 actualSingers:readonly {name:string;id:string}[];
};
const ISEKAI={name:'ヰ世界情緒',id:'81a01233-230e-50a8-a309-11275c794cd0'};
const KAF={name:'花譜',id:'36129afb-1fe8-5255-958e-b090e17c7905'};
const MIYAZAKI={name:'宮崎恵里花',id:'b4c893f4-75f8-5e6b-8bee-403fe19a6ff6'};
export const CHARACTER_VOCAL_CREDIT_CASES:readonly CharacterVocalCreditCase[]=[
 {legacyId:69,title:'生きていく光は',credit:'夜河世界',characterTokens:['夜河世界'],actualSingers:[ISEKAI]},
 {legacyId:87,title:'あわく心模様',credit:'森先化歩 & 夜河世界',characterTokens:['森先化歩','夜河世界'],actualSingers:[KAF,ISEKAI]},
 {legacyId:315,title:'キレイナヒカリ',credit:'夜河世界',characterTokens:['夜河世界'],actualSingers:[ISEKAI]},
 {legacyId:367,title:'ドッペルゲンガー',credit:'日暮翠 & 日暮紅',characterTokens:['日暮翠','日暮紅'],actualSingers:[ISEKAI,MIYAZAKI]},
];
export function characterVocalCreditCase(legacyId:number|null):CharacterVocalCreditCase|undefined {
 return CHARACTER_VOCAL_CREDIT_CASES.find(x=>x.legacyId===legacyId);
}
