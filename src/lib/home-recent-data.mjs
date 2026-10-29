// First appearance is the earliest publication currently known for this vocal
// form. Home and song detail share it; never use insertion order.
import {songMetadataForEntry,songArtworkCandidatesForEntry,songTitleCaptionForEntry} from './song-detail-data.mjs';
import {releaseListArtworkFromModel,releaseKindLabel,releaseMediaLabel,isLiveRelease} from './release-detail-data.mjs';
import {supplementalLivesForEntry} from './live-program-supplements.mjs';
import {liveDisplayContextFromModel} from './live-detail-data.mjs';

const arr=x=>Array.isArray(x)?x:[],text=x=>typeof x==='string'?x.trim():'';
const compare=(a,b)=>a<b?-1:a>b?1:0;
function day(value,precision){
 if(precision&&precision!=='date'||typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const parsed=new Date(value+'T00:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value?value:null;
}
export function homeToday(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function debutProgramOrder(model,songs){
 const byId=new Map(songs.map(s=>[s.entryId,s])),counts=new Map();
 for(const song of songs)counts.set(song.date,(counts.get(song.date)??0)+1);
 const cutoff=[...songs].sort((a,b)=>compare(b.date,a.date))[4]?.date??'0000-00-00';
 const tiedDates=new Set([...counts].filter(([date,count])=>count>1&&date>=cutoff).map(([date])=>date)),candidates=new Map();
 for(const [eventId,event]of model.events??[]){
  if(!arr(event.occurrences).some(o=>tiedDates.has(o.officialDate)))continue;
  // Reuse the live page's exact, conflict-checked song links and its source
  // fallback. A canonical programme automatically supersedes that fallback.
  const context=liveDisplayContextFromModel(model,eventId);
  for(const program of [...arr(event.programs),...Object.values(context.programSupplements)]){
   const occurrence=arr(event.occurrences).find(o=>o.occurrenceId===program.occurrenceId);if(!tiedDates.has(occurrence?.officialDate))continue;
   const links=program.programLinks??context.programLinks;
   for(const item of arr(program.items)){
    const entryId=links[item.programItemId]?.entryId,song=byId.get(entryId);
    if(!song||song.date!==occurrence.officialDate||!Number.isSafeInteger(item.sequenceNo)||item.sequenceNo<1)continue;
    const key=eventId+'|'+program.occurrenceId;if(!candidates.has(entryId))candidates.set(entryId,new Map());
    const positions=candidates.get(entryId);positions.set(key,Math.min(positions.get(key)??Infinity,item.sequenceNo));
   }
  }
 }
 const order=new Map(),anchors=new Map();
 for(const [entryId,positions]of candidates)if(positions.size===1){const [key,sequence]=[...positions][0];order.set(entryId,{key,sequence});anchors.set(key,[anchors.get(key)??entryId,entryId].sort()[0]);}
 // A shared stable bucket makes this comparator transitive even when unrelated
 // same-day releases are mixed in. No order between different shows is claimed.
 return new Map([...order].map(([id,value])=>[id,{...value,bucket:anchors.get(value.key)}]));
}
export function homeRecentFromModel(model,{today=homeToday()}={}){
 const songs=[];
 for(const entry of model.entries.values()){
  const d=entry.detail,first=songMetadataForEntry(entry,undefined,model.works.get(d.primaryWorkId)).firstAppearance,date=day(first?.date);
  if(!date||date>today)continue;
  songs.push({entryId:d.entryId,title:d.title,date,sourceLabel:text(first?.label),
   displayCredit:songTitleCaptionForEntry(entry)});
 }
 const order=debutProgramOrder(model,songs);
 songs.sort((a,b)=>compare(b.date,a.date)||compare(order.get(a.entryId)?.bucket??a.entryId,order.get(b.entryId)?.bucket??b.entryId)||compare(order.get(b.entryId)?.sequence??0,order.get(a.entryId)?.sequence??0)||compare(a.entryId,b.entryId));
 const recentSongs=songs.slice(0,5).map(song=>{
  const entry=model.entries.get(song.entryId),images=songArtworkCandidatesForEntry(entry,model.works.get(entry.detail.primaryWorkId),{additionalLives:supplementalLivesForEntry(model,song.entryId)});
  return {...song,thumbnailUrl:images[0]?.imageUrl??null,thumbnailUrls:images.map(x=>x.imageUrl)};
 });
 const releases=[];
 for(const {detail}of model.releases.values()){
  if(isLiveRelease(detail))continue;
  const editions=arr(detail.editions),dates=editions.map(e=>day(e.releaseDate,e.datePrecision)).filter(Boolean).sort();
  // A later pressing does not make the same release family a new release.
  const date=dates[0];if(!date)continue;
  const firstEditions=editions.filter(e=>day(e.releaseDate,e.datePrecision)===date);
  const digital=firstEditions.every(e=>e.kind==='digital');
  const media=[...new Set(arr(detail.components).filter(c=>firstEditions.some(e=>e.editionId===c.editionId)).map(c=>releaseMediaLabel(c.componentKind)).filter(Boolean))];
  const kindLabel=digital&&detail.releaseKind==='single'?'配信シングル':releaseKindLabel(detail.releaseKind)||media.join('・');
  releases.push({familyId:detail.familyId,title:detail.title,date,upcoming:date>today,kindLabel});
 }
 releases.sort((a,b)=>compare(b.date,a.date)||compare(a.familyId,b.familyId));
 return {songs:recentSongs,releases:releaseListArtworkFromModel(model,{items:releases.slice(0,5)}).items};
}
