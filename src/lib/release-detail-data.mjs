// Read-only presentation of the existing release projection. Printed tracks,
// disc boundaries and subparts stay intact; links never establish a full song.
import {songReleasesForEntry,safeSongUrl,SHARED_RELEASE_TRACKLISTS} from './song-detail-data.mjs';
import {rankArtworkCandidates} from './catalog-artwork.mjs';
import {RELEASE_ARTWORK_RECORDS} from './catalog-artwork-data.mjs';
import {recordedEventsForRelease} from './live-release-links.mjs';
import {releaseContentFromModel} from './release-content-data.mjs';

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
export function releaseLinks(release,editionId=null){
 const editions=arr(release?.editions),links=new Map();
 for(const r of arr(release?.resources)){
  if(editionId&&r.targetScope==='edition'&&r.targetEditionId!==editionId)continue;
  const url=safeSongUrl(r.url);if(!url)continue;
  const official=r.officiality==='official';
  const label=official?(r.resourceKind==='official_store_page'?'公式ストア':'公式情報'):'関連ページ';
  const edition=r.targetScope==='edition'?editions.find(e=>e.editionId===r.targetEditionId):null;
  const suffix=!editionId&&editions.length>1?text(edition?.name):'';
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
 const items=new Map(release.items.map(x=>[x.itemId,x])),targets=new Map(),candidates=[],byEdition=new Map();
 const addImage=(editionId,image)=>{candidates.push(image);if(!byEdition.has(editionId))byEdition.set(editionId,[]);byEdition.get(editionId).push(image);};
 const records=options.releaseRecords??RELEASE_ARTWORK_RECORDS;
 for(const image of records.filter(x=>x.familyId===familyId&&editionIds.has(x.editionId))){
  addImage(image.editionId,{kind:'release',imageUrl:image.imageUrl,sourceUrl:image.sourceUrl,date:editions.find(x=>x.editionId===image.editionId)?.releaseDate??null});
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
   if(row.imageUrl){
    const image={kind:'release',imageUrl:row.imageUrl,sourceUrl:row.imageSourceUrl,date:row.edition?.releaseDate??null};
    if(records.some(r=>r.familyId===familyId&&r.editionId===row.edition.editionId))candidates.push(image);
    else addImage(row.edition.editionId,image);
   }
  }
 }
 const sourced=releaseContentFromModel(model,familyId,options.contentRecords);
 const itemLinks={...Object.fromEntries([...targets].filter(([,ids])=>ids.size===1).map(([id,ids])=>[id,{entryId:[...ids][0]}])),...sourced.itemLinks};
 const artwork=rankArtworkCandidates(candidates);
 const shared=SHARED_RELEASE_TRACKLISTS.find(x=>x.familyId===familyId&&x.title===detail.title&&x.editionIds.length===editionIds.size&&x.editionIds.every(id=>editionIds.has(id)));
 return {artwork,editionArtwork:Object.fromEntries([...byEdition].map(([id,images])=>[id,rankArtworkCandidates(images)])),itemLinks,sharedTracklistLabel:shared?.label??null};
}
export function releaseEditionName(edition){
 const name=text(edition?.name),names={regular:'通常版',special_box_first_press:'初回限定BOX',digital:'配信'};
 return Object.hasOwn(names,name)?names[name]:name||'版名未登録';
}
export function releaseDetailHref(familyId,{editionId=null,page=1}={}){
 const query=new URLSearchParams();if(editionId)query.set('edition',editionId);if(page>1)query.set('itemsPage',String(page));
 return '/releases/'+encodeURIComponent(familyId)+(query.size?'?'+query.toString():'');
}
/** Select from complete saved items before paging. Common music is admitted
 * only by the reviewed family, editions and exact printed source rows. */
export function releaseDetailFromModel(model,familyId,{editionId=null,page=1,limit=100}={}){
 const saved=model.releases.get(familyId);if(!saved)return null;
 const release=saved.detail,context=releaseDisplayContextFromModel(model,familyId);
 const rawEditions=arr(release.editions),ids=rawEditions.map(e=>e.editionId);
 const shared=SHARED_RELEASE_TRACKLISTS.find(r=>r.familyId===familyId&&r.title===release.title&&r.editionIds.length===ids.length&&r.editionIds.every(id=>ids.includes(id))&&r.editions.every(e=>rawEditions.some(x=>x.editionId===e.editionId&&x.name===e.name)));
 const editions=rawEditions.map(e=>{const info=shared?.editions.find(x=>x.editionId===e.editionId);return {...e,catalogNumber:e.catalogNumber||info?.catalogNumber||null,mediaLabel:info?.mediaLabel??null,inclusionLabels:arr(e.inclusions).length?arr(e.inclusions).map(i=>text(i.rawName)).filter(Boolean):info?.inclusionLabels??[]};});
 const selectedEdition=editions.find(e=>e.editionId===editionId)??null;
 const sourced=releaseContentFromModel(model,familyId);
 const displayRelease={...release,components:arr(release.components).map(c=>({...c,rawLabel:sourced.componentLabels[c.componentId]??c.rawLabel}))};
 let groups=groupReleaseItems(displayRelease,[...saved.items,...sourced.items]);
 if(sourced.items.length){
  const present=new Set(groups.map(g=>g.key));
  groups.push(...groupReleaseItems(displayRelease,[]).filter(g=>!present.has(g.key)));
  groups=groups.map(g=>({...g,editionName:g.editionName?releaseEditionName(rawEditions.find(e=>e.editionId===g.editionId)):null}));
 }
 const common=shared?.tracks.map(expected=>saved.items.find(item=>['itemId','editionId','componentId','rawTitle','rawPosition','sequenceNo'].every(k=>item[k]===expected[k])));
 if(common?.length&&common.every(Boolean)){
  const commonIds=new Set(common.map(i=>i.itemId));
  groups=[{key:'shared',editionId:null,editionName:shared.label,label:null,componentKind:'audio_program',items:common},...groupReleaseItems(release,saved.items.filter(i=>!commonIds.has(i.itemId))).filter(g=>g.items.length)];
 }
 if(selectedEdition)groups=groups.filter(g=>g.editionId===null||g.editionId===selectedEdition.editionId);
 const total=groups.reduce((count,g)=>count+g.items.length,0),size=Number.isSafeInteger(limit)&&limit>0?Math.min(limit,100):100;
 const pages=Math.max(1,Math.ceil(total/size)),current=Math.min(Number.isSafeInteger(page)&&page>0?page:1,pages);
 const visible=new Set(groups.flatMap(g=>g.items).slice((current-1)*size,current*size).map(i=>i.itemId));
 groups=groups.filter(g=>g.items.some(i=>visible.has(i.itemId))||g.items.length===0&&(total===0||sourced.items.length>0&&current===1)).map(g=>({...g,items:g.items.filter(i=>visible.has(i.itemId))}));
 const components=arr(release.components).filter(c=>!selectedEdition||c.editionId===selectedEdition.editionId);
 return {release,context,editions,selectedEdition,components,groups,total,page:current,pages,
  recordedEvents:recordedEventsForRelease(model,familyId,{editionId:selectedEdition?.editionId??null}),
  artwork:selectedEdition?context.editionArtwork[selectedEdition.editionId]??[]:context.artwork,
  links:releaseLinks(release,selectedEdition?.editionId??null)};
}
export function releaseListArtworkFromModel(model,result){
 if(!result)return result;
 return {...result,items:arr(result.items).map(item=>{
  const candidates=releaseDisplayContextFromModel(model,item.familyId)?.artwork??[];
  return {...item,thumbnailUrl:candidates[0]?.imageUrl??null,thumbnailUrls:candidates.map(x=>x.imageUrl)};
 })};
}
