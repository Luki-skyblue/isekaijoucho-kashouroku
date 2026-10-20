import {ARTWORK_RECORDS} from './catalog-artwork-data.mjs';

function usableImage(value){
 if(typeof value!=='string')return false;
 try{const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&
   ((['i.ytimg.com','img.youtube.com'].includes(u.hostname)&&u.pathname.startsWith('/vi/'))||
    (u.hostname==='is1-ssl.mzstatic.com'&&u.pathname.startsWith('/image/')));
 }catch{return false;}
}
/** Exact curated entry, work and singer set; no title-based or work-wide fallback.
 * Only the tiers needed now are implemented. Album/LIVE tier details remain
 * outside this first batch. Resolving an image does not verify any music fact. */
export function catalogArtworkForEntry(entry,records=ARTWORK_RECORDS){
 const d=entry?.detail;if(!d||d.kind!=='song_variant'||d.variations?.length)return null;
 const r=records.find(x=>x.entryId===d.entryId);
 if(!r||r.primaryWorkId!==d.primaryWorkId||r.title!==d.title||
  !Array.isArray(entry.singerIds)||r.singerIds.length!==entry.singerIds.length||
  !r.singerIds.every(id=>entry.singerIds.includes(id)))return null;
 for(const kind of ['manual','digital_single','mv']){
  const image=r.candidates.find(x=>x.kind===kind&&usableImage(x.imageUrl));
  if(image)return {...image};
 }
 return null;
}
