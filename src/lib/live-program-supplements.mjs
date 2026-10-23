// Sourced display rows for an otherwise empty programme. These are not DB
// programme/capture IDs, full-performance findings or closed singer sets.
import registry from './catalog-live-program-supplements.json' with {type:'json'};
import {artworkEntryMatches} from './catalog-artwork.mjs';
import {liveVocalTargetForRow} from './live-vocal-entries.mjs';
export const LIVE_PROGRAM_SUPPLEMENTS=registry.records;
const arr=x=>Array.isArray(x)?x:[];
function sourceUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function liveProgramSupplementsForEvent(model,eventId,records=LIVE_PROGRAM_SUPPLEMENTS){
 const event=model.events?.get(eventId);if(!event)return [];
 const candidates=arr(records).filter(r=>r.status==='active'&&r.eventId===eventId&&r.title===event.detail.title&&sourceUrl(r.url));
 const result=[];
 for(const occurrence of arr(event.occurrences)){
  const matches=candidates.filter(r=>r.occurrenceId===occurrence.occurrenceId&&r.officialDate===occurrence.officialDate&&r.sessionLabel===occurrence.sessionLabel);
  // A new canonical programme wins as a whole, including partial programmes.
  // Never append an old source snapshot to it or replace a deliberately empty one.
  if(matches.length!==1||occurrence.programId!==null||occurrence.programItemCount!==0)continue;
  const programs=arr(event.programs).filter(p=>p.occurrenceId===occurrence.occurrenceId),program=programs[0];
  if(programs.length!==1||arr(program.items).length||!arr(program.pages).length||program.pages.some(p=>p.programId!==null||p.totalItems!==0||arr(p.items).length))continue;
  const r=matches[0],programLinks={},programVocals={};
  const items=arr(r.items).map((row,index)=>{
   const programItemId=`source:${r.sourceId}:${occurrence.occurrenceId}:${index+1}`;
   const target=row.entry&&model.entries.get(row.entry.entryId);
   if(target&&row.rawLabel===row.entry.title&&row.displayCredit===row.entry.displayCredit&&artworkEntryMatches(target,row.entry)&&target.detail.displayCredit===row.entry.displayCredit)
    programLinks[programItemId]={entryId:row.entry.entryId,title:target.detail.title};
   const sourcedTarget=liveVocalTargetForRow(model,row);if(sourcedTarget)programLinks[programItemId]=sourcedTarget;
   // Keep raw source billing. Group membership and an incomplete list never
   // establish a missing singer's absence, nor generate participant IDs.
   programVocals[programItemId]={displayCredit:row.displayCredit,people:[],targetVocal:row.displayCredit.split('×').includes('ヰ世界情緒')?'present':'unknown'};
   return {programItemId,sequenceNo:index+1,rawPosition:row.rawPosition,rawLabel:row.rawLabel,itemKind:'rendition',associations:[]};
  });
  result.push({occurrenceId:occurrence.occurrenceId,totalItems:items.length,items,programLinks,programVocals,source:{label:r.sourceLabel,url:sourceUrl(r.url)}});
 }
 return result;
}
export function supplementalLivesForEntry(model,entryId,records=LIVE_PROGRAM_SUPPLEMENTS){
 const lives=[];
 for(const eventId of new Set(arr(records).map(r=>r.eventId)))for(const program of liveProgramSupplementsForEvent(model,eventId,records)){
  if(!Object.values(program.programLinks).some(link=>link.entryId===entryId))continue;
  const event=model.events.get(eventId),occurrence=event.occurrences.find(o=>o.occurrenceId===program.occurrenceId);
  lives.push({eventId,title:event.detail.title,date:occurrence.officialDate,uncertain:true});
 }
 return lives;
}
