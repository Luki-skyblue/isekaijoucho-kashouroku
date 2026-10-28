// Publisher tracklists supplement empty saved discs. Source row IDs are local
// display keys, never fabricated DB identities or performance findings.
import registry from './catalog-release-content.json' with {type:'json'};
import {artworkEntryMatches,rankArtworkCandidates} from './catalog-artwork.mjs';
import {RELEASE_ARTWORK_RECORDS} from './catalog-artwork-data.mjs';
export const RELEASE_CONTENT_RECORDS=registry.records;
const arr=x=>Array.isArray(x)?x:[],str=x=>typeof x==='string'?x:'';
const labels={bd_main:'Blu-ray（本編）',bd_fixed:'Blu-ray（定点映像）',bd_main_day1:'Blu-ray DAY-1',bd_main_day2:'Blu-ray DAY-2',bd_fixed_day1:'Blu-ray DAY-1（定点映像）',bd_fixed_day2:'Blu-ray DAY-2（定点映像）',cd_spoken:'CD（放課後音声編）',cd_live:'CD（LIVE音源）',bd_live:'Blu-ray（LIVE・アフタートーク）',playback_card_1:'Playback Card #1'};
const same=(value,expected)=>expected&&Object.entries(expected).every(([key,want])=>value?.[key]===want);
const itemId=(record,row)=>`source:${record.key}:${row.sequenceNo}`;
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
export function releaseContentFromModel(model,familyId,records=RELEASE_CONTENT_RECORDS){
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
 return {records:selected,items,itemLinks,componentLabels};
}
export function supplementalReleasesForEntry(model,entryId,records=RELEASE_CONTENT_RECORDS,artworkRecords=RELEASE_ARTWORK_RECORDS){
 const rows=[],families=new Set(arr(records).filter(r=>arr(r.items).some(row=>row.entry?.entryId===entryId)).map(r=>r.family.familyId));
 for(const familyId of families){
  const content=releaseContentFromModel(model,familyId,records),saved=model.releases.get(familyId);
  for(const record of content.records)for(const row of record.items){
   const id=itemId(record,row);if(content.itemLinks[id]?.entryId!==entryId)continue;
   const edition=saved.detail.editions.find(e=>e.editionId===record.edition.editionId);
   const images=rankArtworkCandidates(arr(artworkRecords).filter(r=>r.familyId===familyId&&r.editionId===edition.editionId).map(r=>({kind:'release',imageUrl:r.imageUrl,sourceUrl:r.sourceUrl})));
   rows.push({releaseItemId:id,rawTrackTitle:row.rawTitle,trackNumber:row.sequenceNo,family:{familyId,title:record.family.title,releaseKind:record.family.releaseKind},edition:{editionId:edition.editionId,editionKind:edition.kind,editionName:edition.name,releaseDate:edition.releaseDate,catalogNumber:edition.catalogNumber},component:record.component,editionLabel:[saved.detail.editions.length>1?(edition.name==='regular'?'通常版':edition.name):null,record.label].filter(Boolean).join(' · '),imageUrl:images[0]?.imageUrl??null,imageSourceUrl:images[0]?.sourceUrl??null});
  }
 }
 return rows;
}
