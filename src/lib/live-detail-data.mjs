import {liveHeading} from './live-heading.mjs';
// Presentation only. A public programme/entry link is not a full-song or
// singer-verification assertion. Keep the original rows and their scope intact.
import registry from './catalog-live-program-links.json' with {type:'json'};
import creditsRegistry from './catalog-live-program-credits.json' with {type:'json'};
import {artworkEntryMatches} from './catalog-artwork.mjs';
import {entityForId,MAIN_SINGER_IDS,MEDLEY_PERFORMANCE_RECORDS,medleyPerformanceForEntry} from './catalog-people.mjs';
import {personDetailFromModel} from './person-detail-data.mjs';
import {safeSongUrl} from './song-detail-data.mjs';
import {recordingsForEvent} from './live-release-links.mjs';
import {liveProgramSupplementsForEvent} from './live-program-supplements.mjs';
const arr=x=>Array.isArray(x)?x:[];
export const LIVE_PROGRAM_RECORDS=registry.records;
export const LIVE_PROGRAM_VOCAL_RECORDS=creditsRegistry.records;
const extraLabels={special_rebroadcast:'再配信',special_distribution_bonus:'配信特典'};
export const isLiveSupplement=occurrence=>Object.hasOwn(extraLabels,occurrence?.sessionLabel??'');
export function liveSessionLabel(occurrence){
 const label=occurrence?.sessionLabel;
 return Object.hasOwn(extraLabels,label??'')?extraLabels[label]:(typeof label==='string'?label.trim():'');
}
export function liveCoverageNote(scope){
 return scope==='partial_program'?'セットリストは一部のみ掲載しています。':scope==='target_artist_segment'?'一部の出演者のセットリストを掲載しています。':null;
}
export function liveProgramPosition(item){
 const raw=typeof item?.rawPosition==='string'?item.rawPosition.trim():'';
 // Legacy printed numbers can overlap after instrumental items were inserted.
 // Use the programme order for numeric positions; keep explicit EN/MC labels.
 if(raw&&!/^\d+$/.test(raw))return raw;
 return Number.isSafeInteger(item?.sequenceNo)&&item.sequenceNo>0?String(item.sequenceNo).padStart(2,'0'):raw||'—';
}
function registeredProgramTargets(model,event,program,item,records){
 const targets=[];
 for(const record of arr(records)){
  if(record.status!=='active'||record.eventId!==event.detail.eventId||record.title!==event.detail.title||record.occurrenceId!==program.occurrenceId)continue;
  const occurrence=arr(event.occurrences).find(o=>o.occurrenceId===record.occurrenceId);
  if(!occurrence||occurrence.officialDate!==record.officialDate||occurrence.sessionLabel!==record.sessionLabel||
   occurrence.programId!==record.programId||program.pages?.[0]?.programId!==record.programId)continue;
  for(const link of arr(record.items)){
   // Numbering and a song's earliest date can change independently of this
   // performance. Keep the stable programme/capture identities authoritative.
   if(link.programItemId!==item.programItemId||link.rawLabel!==item.rawLabel)continue;
   const entry=model.entries.get(link.entry?.entryId);
   if(!artworkEntryMatches(entry,link.entry)||entry.detail.displayCredit!==link.entry.displayCredit)continue;
   const associations=arr(item.associations),association=associations[0],parts=arr(association?.renditionParts),part=parts[0];
   if(associations.length!==1||association.targetKind!=='rendition'||association.renditionId!==link.renditionId||
    parts.length!==1||part.partId!==link.renditionPartId||part.versionId!==link.versionId||part.workId!==link.entry.primaryWorkId)continue;
   const history=arr(entry.history).some(h=>h.renditionId===link.renditionId&&h.renditionPartId===link.renditionPartId&&
    h.workId===link.entry.primaryWorkId&&h.versionId===link.versionId&&h.occurredOn===record.officialDate&&h.multiWork!==true&&
    arr(h.relatedEvents).some(e=>e.eventId===record.eventId));
   if(history)targets.push(link.entry.entryId);
  }
 }
 return targets;
}
function exactProgramVocals(model,item){
 const associations=arr(item.associations),association=associations[0],parts=arr(association?.renditionParts),part=parts[0];
 if(associations.length!==1||association.targetKind!=='rendition'||parts.length!==1)return null;
 const recordings=arr(model.works?.get(part.workId)?.renditions).filter(r=>r.renditionId===association.renditionId&&r.renditionPartId===part.partId&&r.versionId===part.versionId&&r.workId===part.workId);
 if(recordings.length!==1)return null;
 const people=arr(recordings[0].exactPartParticipants).filter(p=>p.scope==='rendition_part'&&p.role==='vocal'&&p.entityId&&p.name).map(p=>({entityId:p.entityId,name:p.name}));
 if(!people.length)return null;
 // Exact positive participants do not establish that the whole list is closed.
 return {displayCredit:people.map(p=>p.name).join('・'),people,singerSetComplete:false};
}
function registeredProgramVocals(event,program,item,records){
 const occurrence=arr(event.occurrences).find(o=>o.occurrenceId===program.occurrenceId),matches=[];
 for(const r of arr(records)){
  if(r.status!=='active'||!safeSongUrl(r.url)||r.eventId!==event.detail.eventId||r.title!==event.detail.title||r.occurrenceId!==program.occurrenceId||
   !occurrence||r.officialDate!==occurrence.officialDate||r.sessionLabel!==occurrence.sessionLabel||r.programId!==occurrence.programId||r.programId!==program.pages?.[0]?.programId)continue;
  for(const row of arr(r.items))if(row.programItemId===item.programItemId&&row.rawLabel===item.rawLabel&&typeof row.displayCredit==='string'&&row.displayCredit.trim()&&
   arr(row.people).length&&row.people.every(p=>entityForId(p.entityId)&&typeof p.name==='string'&&p.name.trim()))matches.push({displayCredit:row.displayCredit,people:row.people,singerSetComplete:row.singerSetComplete===true});
 }
 const unique=[...new Map(matches.map(r=>[JSON.stringify(r),r])).values()];return unique.length===1?unique[0]:null;
}
function reviewedMedleyVocals(model,event,program,item){
 const matches=[];
 for(const record of MEDLEY_PERFORMANCE_RECORDS){
  const entry=model.entries.get(record.entry.entryId),basis=record.program;
  if(medleyPerformanceForEntry(entry)!==record||!basis||event.detail.eventId!==basis.eventId||event.detail.title!==basis.title||program.occurrenceId!==basis.occurrenceId||program.pages?.[0]?.programId!==basis.programId||item.programItemId!==basis.programItemId||item.rawLabel!==basis.rawLabel)continue;
  const occurrence=arr(event.occurrences).find(o=>o.occurrenceId===program.occurrenceId),associations=arr(item.associations),a=associations[0];
  if(!occurrence||occurrence.officialDate!==basis.officialDate||occurrence.programId!==basis.programId||associations.length!==1||a.targetKind!=='rendition'||a.renditionId!==basis.renditionId||a.linkId!==basis.linkId)continue;
  const parts=rows=>JSON.stringify(arr(rows).map(p=>[p.partId,p.workId,p.versionId]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  if(parts(a.renditionParts)!==parts(basis.parts))continue;
  // Group billing stays a group; only explicit individual IDs count as vocals.
  const ids=record.entityIds.length?record.entityIds:record.billingEntityIds;
  matches.push({displayCredit:record.displayCredit,people:ids.map(id=>({entityId:id,name:entityForId(id).name})),singerSetComplete:false});
 }
 return matches.length===1?matches[0]:null;
}
export function liveDisplayContextFromModel(model,eventId,options={}){
 const event=model.events.get(eventId);if(!event)return null;
 const f=event.filterMetadata??{};
 const eligible=(rows,scope)=>arr(rows).filter(c=>c.scope===scope&&c.role==='performer'&&c.castStatus==='confirmed_present'&&c.entityId&&c.name);
 const cast=[...eligible(event.detail.eventCast,'event'),...eligible(f.castAdditions,'event'),...arr(event.occurrences).flatMap(o=>eligible(o.occurrenceCast,'occurrence'))];
 const performers=[...new Map(cast.map(c=>[c.entityId,{entityId:c.entityId,name:c.name,personKey:personDetailFromModel(model,c.entityId)?c.entityId:null}])).values()];
 const dates=[...new Set(arr(event.occurrences).filter(o=>!isLiveSupplement(o)).map(o=>o.officialDate).filter(Boolean))].sort();
 const programLinks={},programVocals={};
 for(const program of arr(event.programs))for(const item of arr(program.items)){
  if(item.itemKind!=='rendition')continue;
  const vocals=exactProgramVocals(model,item)??registeredProgramVocals(event,program,item,options.vocalRecords??LIVE_PROGRAM_VOCAL_RECORDS)??reviewedMedleyVocals(model,event,program,item);
  if(vocals){
   const present=vocals.people.some(p=>p.entityId===MAIN_SINGER_IDS[0]);
   const completeIndividuals=vocals.singerSetComplete&&vocals.people.every(p=>['artist','voicebank'].includes(entityForId(p.entityId)?.type));
   programVocals[item.programItemId]={displayCredit:vocals.displayCredit,people:vocals.people.map(p=>({...p,entityId:personDetailFromModel(model,p.entityId)?p.entityId:null})),targetVocal:present?'present':completeIndividuals?'absent':'unknown'};
  }
  const targets=new Set();
  for(const association of arr(item.associations)){
   if(!association.renditionId||association.targetKind!=='rendition')continue;
   const multi=arr(association.renditionParts).length>1;
   for(const [id,entry]of model.entries){
    if(multi&&entry.detail.kind!=='medley')continue;
    const linked=arr(entry.detail.linkedRenditions).some(r=>r.renditionId===association.renditionId);
    const direct=arr(entry.history).some(h=>h.renditionId===association.renditionId&&
     ['explicit_part','legacy_rendition'].includes(h.matchBasis)&&h.multiWork!==true&&
     arr(h.relatedEvents).some(e=>e.eventId===eventId));
    if(linked||direct)targets.add(id);
   }
  }
  // A reviewed source-scoped correspondence can supplement a legacy candidate;
  // never turn all same-version matches or the event cast into song links.
  for(const id of registeredProgramTargets(model,event,program,item,options.programRecords??LIVE_PROGRAM_RECORDS))targets.add(id);
  // A conflicting direct/new correspondence remains plain text.
  if(targets.size===1){const entryId=[...targets][0],e=model.entries.get(entryId);
   programLinks[item.programItemId]={entryId,title:e.detail.title};}
 }
 const programSupplements=Object.fromEntries(liveProgramSupplementsForEvent(model,eventId,options.supplementRecords).map(p=>[p.occurrenceId,p]));
 return {recordings:recordingsForEvent(model,eventId),billingLabel:liveHeading({officialBillingLabel:f.officialBillingLabel,billingArtists:f.billingArtists,liveFormat:f.format??event.detail.eventKind})||null,dates,performers,programLinks,programVocals,programSupplements};
}
