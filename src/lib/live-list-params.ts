import {asArray,str,pageNumber,searchTerm,viewMode,validId,type JsonObject} from './core';
import {liveHeading} from './live-heading.mjs';

export const LIVE_FORMATS=[{id:'one_man',label:'ワンマン'},{id:'festival',label:'フェス'},{id:'unclassified',label:'未分類'}] as const;
export const LIVE_SORTS=[{id:'date_desc',label:'開催日：新しい順'},{id:'date_asc',label:'開催日：古い順'},{id:'title_asc',label:'公演名：昇順'},{id:'title_desc',label:'公演名：降順'}] as const;
export type LiveFormat=typeof LIVE_FORMATS[number]['id'];
export type LiveSort=typeof LIVE_SORTS[number]['id'];
export type LiveArtist={entityId:string;name:string};
/** Billing describes whose show this is. Guests/counts/titles never fill it in. */
export function liveCardLabel(item:JsonObject):string {
 return liveHeading(item);
}
export type LiveQuery=Record<string,string|string[]|undefined>;
export type ParsedLiveQuery={q:string;page:number;view:'list'|'grid';artistIds:string[];artistScope:'billing'|'appearance';artistMatch:'any'|'all';formats:LiveFormat[];sort:LiveSort};
const scalar=(x:string|string[]|undefined)=>Array.isArray(x)?x[0]:x;
const values=(x:string|string[]|undefined)=>Array.isArray(x)?x:x?[x]:[];
export function readLiveQuery(raw:LiveQuery):ParsedLiveQuery {
 const requested=values(raw.artist),types=values(raw.type),scope=scalar(raw.artistScope),match=scalar(raw.artistMatch),sort=scalar(raw.sort);
 if(requested.length>100||requested.some(x=>!validId(x))||types.some(x=>!LIVE_FORMATS.some(f=>f.id===x))||
  (scope!==undefined&&!['billing','appearance'].includes(scope))||(match!==undefined&&!['any','all'].includes(match)))throw new Error('LIVEの絞り込み指定を確認してください。');
 return {q:searchTerm(scalar(raw.q)),page:pageNumber(scalar(raw.page)),view:viewMode(scalar(raw.view)),
  artistIds:[...new Set(requested.map(x=>x.toLowerCase()))],artistScope:scope==='appearance'?'appearance':'billing',artistMatch:match==='all'?'all':'any',
  formats:LIVE_FORMATS.filter(x=>types.includes(x.id)).map(x=>x.id),sort:LIVE_SORTS.some(x=>x.id===sort)?sort as LiveSort:'date_desc'};
}
export function liveHref(query:ParsedLiveQuery,overrides:Partial<ParsedLiveQuery>={}) {
 const v={...query,...overrides},p=new URLSearchParams();
 if(v.q)p.set('q',v.q);
 for(const id of v.artistIds)if(validId(id))p.append('artist',id.toLowerCase());
 if(v.artistIds.length||v.artistScope==='appearance')p.set('artistScope',v.artistScope);
 if(v.artistIds.length&&v.artistMatch==='all')p.set('artistMatch','all');
 for(const kind of LIVE_FORMATS)if(v.formats.includes(kind.id))p.append('type',kind.id);
 if(v.sort!=='date_desc')p.set('sort',v.sort);
 if(v.view==='grid')p.set('view','grid');
 if(v.page>1)p.set('page',String(v.page));
 return `/lives${p.size?'?'+p.toString():''}`;
}
export function activeLiveConditions(v:ParsedLiveQuery,artists:LiveArtist[]) {
 const tags:Array<{key:string;label:string;href:string}>=[];
 if(v.q)tags.push({key:'search',label:`検索：${v.q}`,href:liveHref(v,{q:'',page:1})});
 if(v.artistIds.length){
  const names=v.artistIds.map(id=>artists.find(a=>a.entityId===id)?.name??'登録のないアーティスト');
  tags.push({key:'artists',label:`${v.artistScope==='billing'?'公演名義':'出演者'}：${names.join('・')}（${v.artistMatch==='all'?'全員':'いずれか'}）`,href:liveHref(v,{artistIds:[],artistMatch:'any',page:1})});
 }
 for(const kind of v.formats)tags.push({key:`type-${kind}`,label:`公演区分：${LIVE_FORMATS.find(x=>x.id===kind)?.label}`,href:liveHref(v,{formats:v.formats.filter(x=>x!==kind),page:1})});
 return tags;
}
