// Home uses registered first-appearance/release dates, never insertion order
// or a work's shared performance history. This does not verify those dates.
import {songMetadataForEntry,songArtworkCandidatesForEntry} from './song-detail-data.mjs';
import {releaseListArtworkFromModel,releaseKindLabel,releaseMediaLabel,isLiveRelease} from './release-detail-data.mjs';

const arr=x=>Array.isArray(x)?x:[],text=x=>typeof x==='string'?x.trim():'';
const compare=(a,b)=>a<b?-1:a>b?1:0;
function day(value,precision){
 if(precision&&precision!=='date'||typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const parsed=new Date(value+'T00:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value?value:null;
}
export function homeToday(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function homeRecentFromModel(model,{today=homeToday()}={}){
 const songs=[];
 for(const entry of model.entries.values()){
  const d=entry.detail,first=songMetadataForEntry(entry).firstAppearance,date=day(first?.date);
  if(!date||date>today)continue;
  songs.push({entryId:d.entryId,title:d.title,date,sourceLabel:text(first?.label),
   displayCredit:text(d.displayCredit)||arr(d.singers).map(s=>text(s.name)).filter(Boolean).join('・')});
 }
 songs.sort((a,b)=>compare(b.date,a.date)||compare(a.entryId,b.entryId));
 const recentSongs=songs.slice(0,5).map(song=>{
  const entry=model.entries.get(song.entryId),images=songArtworkCandidatesForEntry(entry,model.works.get(entry.detail.primaryWorkId));
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
