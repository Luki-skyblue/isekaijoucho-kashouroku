import {ARTWORK_RECORDS,EVENT_ARTWORK_RECORDS} from './catalog-artwork-data.mjs';

const PRIORITY={manual:0,digital_single:1,mv:2,cover:3,live_mv:4,release:5,live:6,other_video:7};
// Extend this list when adopting an image from another confirmed public source.
const IMAGE_HOSTS=new Set(['i.ytimg.com','img.youtube.com','is1-ssl.mzstatic.com','kamitsubaki.jp','findmestore.thinkr.jp','pbs.twimg.com','linkstorage.linkfire.com','static.wixstatic.com','lantis.jp']);

function usableImage(value){
 if(typeof value!=='string')return false;
 if(value.startsWith('/artwork/')&&!value.includes('..')&&!/[?#\\\s]/.test(value))return true;
 try{const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&IMAGE_HOSTS.has(u.hostname)&&
   ![...u.searchParams.keys()].some(k=>/token|secret|password|credential|auth|session|api.?key|signature/i.test(k));
 }catch{return false;}
}
const dateKey=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)?x:'9999-99-99';
/** Within a tier, oldest known date first. Unknown dates follow known ones.
 * Equal/unknown dates use a stable URL order, without assigning a new priority. */
export function rankArtworkCandidates(candidates){
 const sorted=candidates.filter(x=>x&&Object.hasOwn(PRIORITY,x.kind)&&usableImage(x.imageUrl)).map(x=>({...x,sourceUrl:typeof x.sourceUrl==='string'?x.sourceUrl:x.imageUrl,date:dateKey(x.date)==='9999-99-99'?null:x.date}));
 sorted.sort((a,b)=>PRIORITY[a.kind]-PRIORITY[b.kind]||dateKey(a.date).localeCompare(dateKey(b.date))||a.imageUrl.localeCompare(b.imageUrl));
 const seen=new Set();return sorted.filter(x=>{if(seen.has(x.imageUrl))return false;seen.add(x.imageUrl);return true;});
}
/** A recording association belongs to this exact catalogue vocal form. */
export function artworkEntryMatches(entry,r){
 const d=entry?.detail;if(!d||!r)return false;
 return r.entryId===d.entryId&&(r.kind??'song_variant')===d.kind&&r.primaryWorkId===d.primaryWorkId&&r.title===d.title&&
  JSON.stringify(r.variations??[])===JSON.stringify(d.variations??[])&&
  Array.isArray(entry.singerIds)&&Array.isArray(r.singerIds)&&r.singerIds.length===entry.singerIds.length&&
  r.singerIds.every(id=>entry.singerIds.includes(id));
}
/** Exact curated entry, work, singer set and variations. Never inherit by title. */
export function catalogArtworkCandidatesForEntry(entry,records=ARTWORK_RECORDS){
 const r=records.find(x=>artworkEntryMatches(entry,x));
 if(!r)return [];
 return rankArtworkCandidates(r.candidates);
}
export function catalogArtworkForEntry(entry,records=ARTWORK_RECORDS){
 return catalogArtworkCandidatesForEntry(entry,records)[0]??null;
}
/** A poster belongs to the exact event, independently of song-vocal matching. */
export function eventArtworkForEvent(event,records=EVENT_ARTWORK_RECORDS){
 const detail=event?.detail??event;if(!detail)return null;
 const record=records.find(x=>x.eventId===detail.eventId&&x.title===detail.title);
 return record?rankArtworkCandidates([{kind:'live',imageUrl:record.imageUrl,sourceUrl:record.sourceUrl,date:record.officialDate??null}])[0]??null:null;
}
