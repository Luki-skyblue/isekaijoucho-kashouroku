// Publisher tracklists supplement empty saved discs. Source row IDs are local
// display keys, never fabricated DB identities or performance findings.
import registry from './catalog-release-content.json' with {type:'json'};
import {artworkEntryMatches,rankArtworkCandidates} from './catalog-artwork.mjs';
import {RELEASE_ARTWORK_RECORDS} from './catalog-artwork-data.mjs';
import {songReleasesForEntry} from './song-detail-data.mjs';
export const RELEASE_CONTENT_RECORDS=registry.records;
export const RELEASE_ENTRY_LINK_RECORDS=registry.entryLinks??[];
export const RELEASE_CONTEXT_TRACKLISTS=registry.contextTracklists??[];
/** A scoped participation-only album list is not a complete tracklist. Stop
 * this hint automatically when canonical rows or edition identities change. */
export function releaseContentNoteFromModel(model,familyId,editionId=null){
 const saved=model.releases.get(familyId);if(!saved)return null;
 const completeEditions=new Set(contextTracklistsForModel(model,familyId).map(r=>r.edition.editionId));
 const partial=(registry.partialEditions??[]).some(r=>!completeEditions.has(r.editionId)&&r.familyId===familyId&&r.title===saved.detail.title&&(!editionId||r.editionId===editionId)&&
  saved.detail.editions.some(e=>e.editionId===r.editionId)&&saved.detail.resources.some(s=>s.url===r.url&&s.officiality==='official'&&s.targetEditionId===r.editionId)&&
  saved.items.filter(i=>i.editionId===r.editionId).length===r.items.length&&r.items.every(expected=>saved.items.some(i=>i.editionId===r.editionId&&Object.entries(expected).every(([k,v])=>i[k]===v))));
 return partial?'ヰ世界情緒の参加曲を掲載しています。':null;
}
const arr=x=>Array.isArray(x)?x:[],str=x=>typeof x==='string'?x:'';
const labels={bd_main:'Blu-ray（本編）',bd_fixed:'Blu-ray（定点映像）',bd_main_day1:'Blu-ray DAY-1',bd_main_day2:'Blu-ray DAY-2',bd_fixed_day1:'Blu-ray DAY-1（定点映像）',bd_fixed_day2:'Blu-ray DAY-2（定点映像）',cd_spoken:'CD（放課後音声編）',cd_live:'CD（LIVE音源）',bd_live:'Blu-ray（LIVE・アフタートーク）',playback_card_1:'Playback Card #1'};
const same=(value,expected)=>expected&&Object.entries(expected).every(([key,want])=>value?.[key]===want);
const itemId=(record,row)=>`source:${record.key}:${row.sequenceNo}`;
// A complete publisher tracklist may surround already catalogued participation
// tracks. These rows describe the product only; they create no song identities.
function contextTracklistsForModel(model,familyId){
 const saved=model.releases?.get(familyId);if(!saved)return [];
 const eligible=RELEASE_CONTEXT_TRACKLISTS.filter(r=>{
  if(r.status!=='active'||!str(r.key)||!same(saved.detail,r.family)||r.family?.familyId!==familyId)return false;
  if(!arr(saved.detail.editions).some(e=>same(e,r.edition))||!arr(saved.detail.components).some(c=>same(c,r.component))||r.component?.editionId!==r.edition?.editionId)return false;
  if(!arr(saved.detail.resources).some(s=>s.url===r.url&&s.officiality==='official'&&s.targetScope==='edition'&&s.targetEditionId===r.edition.editionId))return false;
  if(!arr(saved.items).some(i=>same(i,r.anchor)))return false;
  return arr(r.items).length>0&&r.items.every((row,index)=>row.sequenceNo===index+1&&str(row.rawPosition)&&str(row.rawTitle));
 });
 return eligible.filter(r=>eligible.filter(other=>other.component.componentId===r.component.componentId).length===1);
}
function usableRecord(model,record){
 if(record?.status!=='active'||!str(record.key)||!str(record.edition?.editionId)||!str(record.component?.componentId)||record.component.editionId!==record.edition.editionId||!['cd','blu_ray'].includes(record.component.componentKind))return false;
 let url;try{url=new URL(record.url);}catch{return false;}
 if(url.protocol!=='https:'||url.username||url.password)return false;
 const saved=model.releases?.get(record.family?.familyId),detail=saved?.detail;
 if(!detail||!same(detail,record.family))return false;
 if(!arr(detail.editions).some(e=>same(e,record.edition))||!arr(detail.components).some(c=>same(c,record.component)))return false;
 // Some saved products retain only their artist-discography URL. Keep that
 // exact catalog anchor separate from the reviewed publisher tracklist URL.
 const catalogUrl=record.catalogUrl??record.url;
 if(!arr(detail.resources).some(r=>r.url===catalogUrl&&r.officiality==='official'&&(r.targetScope!=='edition'||r.targetEditionId===record.edition.editionId)))return false;
 // Canonical content wins per disc, even if only part of it has been entered.
 if(arr(saved.items).some(i=>i.componentId===record.component.componentId))return false;
 return arr(record.items).length>0&&record.items.every((row,index)=>row.sequenceNo===index+1&&str(row.rawPosition)&&str(row.rawTitle));
}
function entryMatches(model,row){
 const entry=model.entries?.get(row.entry?.entryId);
 return entry&&artworkEntryMatches(entry,row.entry)&&str(entry.detail.displayCredit)===str(row.entry.displayCredit);
}
const sortedRows=rows=>rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
const associationBasis=item=>sortedRows(arr(item.associations).map(a=>['linkId','relationType','targetKind','workId','versionId','renditionId','programItemId','mediaId','positionScope','releaseItemPartId','completeness','provesWholeWorkFullPerformance'].map(k=>a[k]??null)));
const creditBasis=item=>sortedRows(arr(item.credits).map(c=>[c.entityId??null,c.rawName??c.name??null,c.role??null,c.scope??null]));
/** Bind existing printed rows, never create a row or promote its associations.
 * The base release reader is deliberately called without any supplements. */
function eligibleEntryLinks(model,familyId,records,artworkRecords){
 const saved=model.releases?.get(familyId);if(!saved)return [];
 const eligible=arr(records).filter(record=>{
  if(record?.status!=='active'||!str(record.key)||!same(saved.detail,record.family)||record.family?.familyId!==familyId||!entryMatches(model,record))return false;
  let url;try{url=new URL(record.url);}catch{return false;}if(url.protocol!=='https:'||url.username||url.password)return false;
  if(!arr(saved.detail.resources).some(r=>r.url===(record.catalogUrl??record.url)&&r.officiality==='official'&&(r.targetScope!=='edition'||r.targetEditionId===record.edition?.editionId)))return false;
  if(!arr(saved.detail.editions).some(e=>same(e,record.edition))||!arr(saved.detail.components).some(c=>same(c,record.component)))return false;
  if(!['cd','blu_ray'].includes(record.component?.componentKind)||!str(record.item?.rawTitle)||!str(record.item?.rawPosition)||!Number.isSafeInteger(record.item?.sequenceNo)||record.item.sequenceNo<1)return false;
  if(record.component?.editionId!==record.edition?.editionId||record.item?.editionId!==record.edition?.editionId||record.item?.componentId!==record.component?.componentId)return false;
  const item=arr(saved.items).find(i=>i.itemId===record.item?.itemId);if(!item||!same(item,record.item))return false;
  if(arr(item.associations).some(a=>a.targetKind==='work'&&a.workId&&a.workId!==record.entry.primaryWorkId))return false;
  if(JSON.stringify(associationBasis(item))!==JSON.stringify(record.associationBasis)||JSON.stringify(creditBasis(item))!==JSON.stringify(record.creditBasis))return false;
  // An existing base destination, including an ambiguous one, takes priority.
  for(const entry of model.entries.values()){
   const work=model.works.get(entry.detail.primaryWorkId);if(!arr(work?.releases).some(r=>r.releaseItemId===item.itemId))continue;
   if(songReleasesForEntry(entry,work,artworkRecords).some(r=>r.releaseItemId===item.itemId))return false;
  }
  return true;
 });
 return eligible.filter(record=>eligible.filter(other=>other.item.itemId===record.item.itemId).length===1);
}
export function releaseContentFromModel(model,familyId,records=RELEASE_CONTENT_RECORDS,entryLinkRecords=RELEASE_ENTRY_LINK_RECORDS,artworkRecords=RELEASE_ARTWORK_RECORDS){
 const eligible=arr(records).filter(r=>r.family?.familyId===familyId&&usableRecord(model,r));
 // Conflicting source snapshots for one physical disc are not combined.
 const selected=eligible.filter(r=>eligible.filter(other=>other.component.componentId===r.component.componentId).length===1);
 const items=[],itemLinks={},componentLabels={};
 if(selected.length)for(const component of arr(model.releases.get(familyId).detail.components))if(labels[component.rawLabel])componentLabels[component.componentId]=labels[component.rawLabel];
 for(const record of selected){
  componentLabels[record.component.componentId]=record.label;
  for(const row of record.items){
   const id=itemId(record,row);
   items.push({itemId:id,editionId:record.edition.editionId,componentId:record.component.componentId,itemKind:record.component.componentKind==='cd'?'audio_track':'video_chapter',sequenceNo:row.sequenceNo,rawPosition:row.rawPosition,rawTitle:row.rawTitle,durationMs:null,associations:[],credits:[],subparts:[]});
   if(entryMatches(model,row))itemLinks[id]={entryId:row.entry.entryId};
  }
 }
 for(const record of contextTracklistsForModel(model,familyId)){
  const saved=model.releases.get(familyId),occupied=new Set(saved.items.filter(i=>i.componentId===record.component.componentId).map(i=>i.sequenceNo));
  for(const row of record.items){
   if(occupied.has(row.sequenceNo))continue;
   items.push({itemId:itemId(record,row),editionId:record.edition.editionId,componentId:record.component.componentId,itemKind:'audio_track',sequenceNo:row.sequenceNo,rawPosition:row.rawPosition,rawTitle:row.rawTitle,durationMs:null,associations:[],credits:[],subparts:[],contextOnly:true});
  }
 }
 for(const record of eligibleEntryLinks(model,familyId,entryLinkRecords,artworkRecords))itemLinks[record.item.itemId]={entryId:record.entry.entryId};
 return {records:selected,items,itemLinks,componentLabels};
}
export function supplementalReleasesForEntry(model,entryId,records=RELEASE_CONTENT_RECORDS,artworkRecords=RELEASE_ARTWORK_RECORDS,entryLinkRecords=RELEASE_ENTRY_LINK_RECORDS){
 const rows=[],families=new Set([...arr(records).filter(r=>arr(r.items).some(row=>row.entry?.entryId===entryId)),...arr(entryLinkRecords).filter(r=>r.entry?.entryId===entryId)].map(r=>r.family.familyId));
 for(const familyId of families){
  const content=releaseContentFromModel(model,familyId,records,entryLinkRecords,artworkRecords),saved=model.releases.get(familyId);
  for(const record of content.records)for(const row of record.items){
   const id=itemId(record,row);if(content.itemLinks[id]?.entryId!==entryId)continue;
   const edition=saved.detail.editions.find(e=>e.editionId===record.edition.editionId);
   const images=rankArtworkCandidates(arr(artworkRecords).filter(r=>r.familyId===familyId&&r.editionId===edition.editionId).map(r=>({kind:'release',imageUrl:r.imageUrl,sourceUrl:r.sourceUrl})));
   rows.push({releaseItemId:id,rawTrackTitle:row.rawTitle,trackNumber:row.sequenceNo,family:{familyId,title:record.family.title,releaseKind:record.family.releaseKind},edition:{editionId:edition.editionId,editionKind:edition.kind,editionName:edition.name,releaseDate:edition.releaseDate,catalogNumber:edition.catalogNumber},component:record.component,editionLabel:[saved.detail.editions.length>1?(edition.name==='regular'?'通常版':edition.name):null,record.label].filter(Boolean).join(' · '),imageUrl:images[0]?.imageUrl??null,imageSourceUrl:images[0]?.sourceUrl??null});
  }
  for(const record of eligibleEntryLinks(model,familyId,entryLinkRecords,artworkRecords)){
   if(record.entry.entryId!==entryId||content.itemLinks[record.item.itemId]?.entryId!==entryId)continue;
   const item=saved.items.find(i=>i.itemId===record.item.itemId),edition=saved.detail.editions.find(e=>e.editionId===record.edition.editionId),component=saved.detail.components.find(c=>c.componentId===item.componentId);
   const images=rankArtworkCandidates(arr(artworkRecords).filter(r=>r.familyId===familyId&&r.editionId===edition.editionId).map(r=>({kind:'release',imageUrl:r.imageUrl,sourceUrl:r.sourceUrl})));
   rows.push({releaseItemId:item.itemId,rawTrackTitle:item.rawTitle,trackNumber:item.sequenceNo,trackPositionLabel:/^\d+$/.test(str(item.rawPosition))?null:str(item.rawPosition)||null,
    family:{familyId,title:saved.detail.title,releaseKind:saved.detail.releaseKind},edition:{editionId:edition.editionId,editionKind:edition.kind,editionName:edition.name,releaseDate:edition.releaseDate,catalogNumber:edition.catalogNumber},component,
    editionLabel:[saved.detail.editions.length>1?(edition.name==='regular'?'通常版':edition.name):null,component.rawLabel].filter(Boolean).join(' · '),imageUrl:images[0]?.imageUrl??null,imageSourceUrl:images[0]?.sourceUrl??null});
  }
 }
 return rows;
}
