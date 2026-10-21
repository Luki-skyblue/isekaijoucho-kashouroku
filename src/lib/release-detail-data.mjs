// Read-only presentation of the existing release projection. Printed tracks,
// disc boundaries and subparts stay intact; links never establish a full song.
import {songReleasesForEntry,safeSongUrl,SHARED_RELEASE_TRACKLISTS} from './song-detail-data.mjs';
import {rankArtworkCandidates} from './catalog-artwork.mjs';
import {RELEASE_ARTWORK_RECORDS} from './catalog-artwork-data.mjs';

const arr=x=>Array.isArray(x)?x:[],text=x=>typeof x==='string'?x.trim():'';
const kinds={single:'シングル',album:'アルバム',ep:'EP',compilation:'コンピレーション',cover_live_album:'カバーライブアルバム',live_package:'LIVE映像・音源',video_release:'映像作品',cd:'CD'};
const media={cd:'CD',audio_disc:'音源',audio_program:'音源',digital:'配信',blu_ray:'Blu-ray',download_card:'ダウンロードカード',booklet:'ブックレット'};
const playable=new Set(['cd','audio_disc','audio_program','digital','blu_ray','download_card']);
export const releaseKindLabel=kind=>Object.hasOwn(kinds,kind??'')?kinds[kind]:null;
export const releaseMediaLabel=kind=>Object.hasOwn(media,kind??'')?media[kind]:null;
// Separate concert recordings from music, without classifying an album
// from its title (e.g. LoveLive!) or from a bonus concert disc alone.
export function isLiveRelease(release){
 if(['live_package','cover_live_album'].includes(release?.releaseKind))return true;
 const video=arr(release?.components).some(c=>['blu_ray','dvd'].includes(c.componentKind));
 return video&&release?.releaseKind==='video_release'&&arr(release.eventRelations).some(r=>r.relationType==='documents_event');
}
export function releaseTrackPosition(item){return text(item?.rawPosition)||(Number.isSafeInteger(item?.sequenceNo)?String(item.sequenceNo):'—');}
export function releaseDuration(value){
 if(!Number.isSafeInteger(value)||value<0)return null;
 const total=Math.floor(value/1000),seconds=String(total%60).padStart(2,'0'),minutes=Math.floor(total/60);
 return minutes<60?`${minutes}:${seconds}`:`${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}:${seconds}`;
}
export function releaseLinks(release){
 const editions=arr(release?.editions),links=new Map();
 for(const r of arr(release?.resources)){
  const url=safeSongUrl(r.url);if(!url)continue;
  const official=r.officiality==='official';
  const label=official?(r.resourceKind==='official_store_page'?'公式ストア':'公式情報'):'関連ページ';
  const edition=r.targetScope==='edition'?editions.find(e=>e.editionId===r.targetEditionId):null;
  const suffix=editions.length>1?text(edition?.name):'';
  const key=url+'|'+label;
  if(!links.has(key))links.set(key,{url,label,editions:[]});
  if(suffix&&!links.get(key).editions.includes(suffix))links.get(key).editions.push(suffix);
 }
 return [...links.values()].map(x=>({url:x.url,label:[x.label,x.editions.join('・')].filter(Boolean).join(' · ')}));
}
export function groupReleaseItems(release,items){
 const components=arr(release?.components),editions=arr(release?.editions),groups=new Map();
 const make=(component,editionId,key)=>{
  const edition=editions.find(e=>e.editionId===editionId),kind=component?.componentKind;
  const label=text(component?.rawLabel)||[releaseMediaLabel(kind),component?.componentNo].filter(x=>x!==null&&x!==undefined&&x!=='').join(' ');
  return {key,editionId:editionId??null,editionName:editions.length>1?text(edition?.name)||null:null,label:label||null,componentKind:kind??null,items:[]};
 };
 for(const item of arr(items)){
  // An unknown component is kept as its own group, never folded into a disc.
  const component=components.find(c=>c.componentId===item.componentId),editionId=item.editionId??component?.editionId;
  const key=String(editionId??'')+'|'+String(item.componentId??'');
  if(!groups.has(key))groups.set(key,make(component,editionId,key));
  groups.get(key).items.push(item);
 }
 // If no tracks have been registered, show known playable discs as preparing.
 // Parent CD sets and booklets are not treated as empty audio discs.
 if(!groups.size)for(const c of components.filter(c=>playable.has(c.componentKind))){
  const key=String(c.editionId??'')+'|'+c.componentId;groups.set(key,make(c,c.editionId,key));
 }
 return [...groups.values()];
}
export function releaseDisplayContextFromModel(model,familyId,options={}){
 const release=model.releases.get(familyId);if(!release)return null;
 const detail=release.detail,editions=arr(detail.editions),editionIds=new Set(editions.map(x=>x.editionId));
 const items=new Map(release.items.map(x=>[x.itemId,x])),targets=new Map(),candidates=[];
 const records=options.releaseRecords??RELEASE_ARTWORK_RECORDS;
 for(const image of records.filter(x=>x.familyId===familyId&&editionIds.has(x.editionId))){
  candidates.push({kind:'release',imageUrl:image.imageUrl,sourceUrl:image.sourceUrl,date:editions.find(x=>x.editionId===image.editionId)?.releaseDate??null});
 }
 for(const [entryId,entry]of model.entries){
  const work=model.works.get(entry.detail.primaryWorkId);
  if(!arr(work?.releases).some(r=>r.family?.familyId===familyId))continue;
  // Reuse the exact vocal-form eligibility used by the song's release list.
  // A work/version association or matching title alone cannot choose an entry.
  for(const row of songReleasesForEntry(entry,work,records)){
   if(row.family?.familyId!==familyId)continue;
   const item=items.get(row.releaseItemId);
   if(!item||item.editionId!==row.edition?.editionId||item.componentId!==row.component?.componentId)continue;
   if(!targets.has(item.itemId))targets.set(item.itemId,new Set());targets.get(item.itemId).add(entryId);
   if(row.imageUrl)candidates.push({kind:'release',imageUrl:row.imageUrl,sourceUrl:row.imageSourceUrl,date:row.edition?.releaseDate??null});
  }
 }
 const itemLinks=Object.fromEntries([...targets].filter(([,ids])=>ids.size===1).map(([id,ids])=>[id,{entryId:[...ids][0]}]));
 const artwork=rankArtworkCandidates(candidates);
 const shared=SHARED_RELEASE_TRACKLISTS.find(x=>x.familyId===familyId&&x.title===detail.title&&x.editionIds.length===editionIds.size&&x.editionIds.every(id=>editionIds.has(id)));
 return {artwork,itemLinks,sharedTracklistLabel:shared?.label??null};
}
export function releaseListArtworkFromModel(model,result){
 if(!result)return result;
 return {...result,items:arr(result.items).map(item=>{
  const candidates=releaseDisplayContextFromModel(model,item.familyId)?.artwork??[];
  return {...item,thumbnailUrl:candidates[0]?.imageUrl??null,thumbnailUrls:candidates.map(x=>x.imageUrl)};
 })};
}
