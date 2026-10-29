import {pageNumber,searchTerm,viewMode,validId} from './core';
import type {CatalogSort,LegacySongType,SingerMatch,CatalogCategory} from './catalog-entry-api';
import {VOICEBANK_SINGERS} from './catalog-vocal-identities';

/** Compatibility choices for the old RPC/fixture reader. Snapshot/public pages
 * supply catalogSingerChoices(model) to both parsing and the picker instead.
 * Main-five order stays stable; this fallback is not a whitelist for new IDs.
 */
export const MAIN_SINGERS = [
 {name:'ヰ世界情緒',id:'81a01233-230e-50a8-a309-11275c794cd0'},
 {name:'花譜',id:'36129afb-1fe8-5255-958e-b090e17c7905'},
 {name:'理芽',id:'ae41fa12-3b09-52c0-bc08-1d9218492391'},
 {name:'春猿火',id:'b8307e06-2046-5415-a1f7-0b892dd41041'},
 {name:'幸祜',id:'9ab42d1f-671c-57c5-a5ce-b5bd4303232c'},
] as const;
export type SingerChoice={name:string;id:string;aliases?:string[];group?:string};
export const OTHER_SINGER_GROUPS:ReadonlyArray<{label:string;members:ReadonlyArray<SingerChoice>}> = [
 {label:'神椿・関連',members:[
  {name:'CIEL',id:'b4a1c9cb-987f-5e92-863f-5bd1206dcbaa'},
  {name:'佳鏡院',id:'a4f2c16a-1d22-5631-84a6-8fe3d4016653'},
  {name:'跳亜',id:'11990299-8a34-52cb-bed8-00eba4d75aec'},
  {name:'夕凪機',id:'a5a70c55-101c-5a56-a279-96d6b1513950'},
 ]},
 {label:'音楽的同位体',members:[...VOICEBANK_SINGERS]},
 {label:'その他の歌唱者',members:[
  {name:'somunia',id:'92c87749-cdb6-57c0-b319-63458c19fc27'},
  {name:'宮崎恵里花',id:'b4c893f4-75f8-5e6b-8bee-403fe19a6ff6'},
 ]},
] as const;
export const OTHER_SINGERS = OTHER_SINGER_GROUPS.flatMap(group=>group.members);
export const SINGERS = [...MAIN_SINGERS,...OTHER_SINGERS] as const;
export const CATEGORIES:ReadonlyArray<{id:CatalogCategory;label:string}> = [
 {id:'original',label:'オリジナル'},
 {id:'cover',label:'カバー'},
 {id:'collaboration',label:'コラボ'},
 {id:'variant',label:'その他'},
 {id:'medley',label:'メドレー'},
];
const ALL_NON_MEDLEY:LegacySongType[]=['original','cover','collaboration','variant'];
const ALLOWED=new Set<string>(CATEGORIES.map(x=>x.id));
export const DEFAULT_CATALOG_SORT:CatalogSort='first_desc';
export const CATALOG_SORTS:ReadonlyArray<{id:CatalogSort;label:string}> = [
 {id:'first_desc',label:'初出：新しい順'},
 {id:'first_asc',label:'初出：古い順'},
 {id:'title_asc',label:'曲名：昇順'},
 {id:'title_desc',label:'曲名：降順'},
];
export type CatalogQuery={q?:string;page?:string;view?:string;singer?:string|string[];
 singerMatch?:string;type?:string|string[];medleys?:string;sort?:string;};
export function readCatalogQuery(raw:CatalogQuery,choices:ReadonlyArray<SingerChoice>=SINGERS){
 const q=searchTerm(raw.q),page=pageNumber(raw.page),view=viewMode(raw.view);
 const requested=Array.isArray(raw.singer)?raw.singer:raw.singer?[raw.singer]:[];
 const singerIds=[...new Set(choices.filter(s=>validId(s.id)&&requested.includes(s.id)).map(s=>s.id))].slice(0,20);
 // Missing singerMatch on an old shared URL meant AND ('contains').
 // A new, unfiltered form defaults to OR; new links always encode OR explicitly.
 const singerMatch:SingerMatch=raw.singerMatch==='only'?'only':raw.singerMatch==='subset'?'subset':raw.singerMatch==='any'?'any':raw.singerMatch==='contains'?'contains':singerIds.length?'contains':'any';
 const requestedTypes=Array.isArray(raw.type)?raw.type:raw.type?[raw.type]:[];
 // Compatibility for v13.9d links: medleys=exclude with no type means every
 // non-medley category, not the default all-including-medleys state.
 const normalTypes=requestedTypes.filter(x=>ALLOWED.has(x));
 const nonMedleyRequested=normalTypes.filter(x=>x!=='medley');
 const resolved=raw.medleys==='exclude'
  ?(nonMedleyRequested.length?nonMedleyRequested:ALL_NON_MEDLEY)
  :normalTypes;
 const kinds:CatalogCategory[]=CATEGORIES.filter(x=>resolved.includes(x.id)).map(x=>x.id);
 const sort:CatalogSort=CATALOG_SORTS.find(s=>s.id===raw.sort)?.id??DEFAULT_CATALOG_SORT;
 return {q,page,view,singerIds,singerMatch,kinds,sort};
}
export type ParsedCatalogQuery=ReturnType<typeof readCatalogQuery>;
export function catalogHref(v:ParsedCatalogQuery,overrides:Partial<ParsedCatalogQuery>={}):string{
 const state={...v,...overrides};const p=new URLSearchParams();
 if(state.q)p.set('q',state.q);
 for(const id of state.singerIds){if(validId(id))p.append('singer',id);}
 if(state.singerIds.length&&state.singerMatch!=='contains')p.set('singerMatch',state.singerMatch);
 for(const kind of state.kinds){if(ALLOWED.has(kind))p.append('type',kind);}
 if(state.sort!==DEFAULT_CATALOG_SORT&&CATALOG_SORTS.some(s=>s.id===state.sort))p.set('sort',state.sort);
 if(state.view==='grid')p.set('view','grid');
 if(state.page>1)p.set('page',String(state.page));
 return `/songs${p.size?'?'+p.toString():''}`;
}
export function activeCatalogFilters(v:ParsedCatalogQuery):boolean{
 return Boolean(v.singerIds.length||v.kinds.length);
}
export type ActiveCatalogCondition={key:string;label:string;href:string};
/** Conditions that were applied, rather than the unsubmitted checkbox state. */
export function activeCatalogConditions(q:ParsedCatalogQuery,choices:ReadonlyArray<SingerChoice>=SINGERS):ActiveCatalogCondition[]{
 const tags:ActiveCatalogCondition[]=[];
 if(q.q)tags.push({key:'search',label:`検索：${q.q}`,href:catalogHref(q,{q:'',page:1})});
 if(q.singerIds.length){
  const names=q.singerIds.map(id=>choices.find(s=>s.id===id)?.name??'不明');
  const label={only:`${names.join('・')}（完全一致）`,any:`${names.join('・')}のいずれかを含む`,contains:`${names.join('・')}の全員を含む`,subset:`${names.join('・')}のみから構成`}[q.singerMatch];
  tags.push({key:'singers',label:`歌唱者：${label}`,href:catalogHref(q,{singerIds:[],singerMatch:'any',page:1})});
 }
 for(const kind of q.kinds){
  const label=CATEGORIES.find(x=>x.id===kind)?.label??kind;
  tags.push({key:`type-${kind}`,label:`楽曲区分：${label}`,href:catalogHref(q,{kinds:q.kinds.filter(x=>x!==kind),page:1})});
 }
 return tags;
}
