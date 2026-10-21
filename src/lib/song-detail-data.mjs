// Public presentation adapter shared by the private snapshot and public file.
// Empty reads are not negative findings. Work-scoped links never establish a
// particular vocal configuration, and a work arranger is not a version arranger.
import legacy from './song-legacy-data.json' with {type:'json'};
import {artworkEntryMatches,catalogArtworkCandidatesForEntry,eventArtworkForEvent,rankArtworkCandidates} from './catalog-artwork.mjs';
import {ARTWORK_RECORDS,RELEASE_ARTWORK_RECORDS,EVENT_ARTWORK_RECORDS} from './catalog-artwork-data.mjs';

const arr=x=>Array.isArray(x)?x:[],str=x=>typeof x==='string'?x:'',object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const byLegacyId=new Map(legacy.records.map(x=>[x.legacyId,x]));
const norm=x=>str(x).normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase('ja');
const unique=xs=>[...new Map(xs.map(x=>[JSON.stringify(x),x])).values()];
const known=xs=>{const values=unique(xs.filter(x=>x!==null&&x!==undefined&&x!==''));return values.length===1?values[0]:null;};
const SIRIUS_WORK='5dd5d31d-4b77-5259-b5b9-d4828d4c1098',SIRIUS_SOLO='912cf6d0-0f06-4112-9bba-0b1333895122',SIRIUS_DUET='adcac7ec-b932-4a89-a0ac-dd5d3e5445aa';
const SIRIUS_SOLO_MEDIA=['64c5a08c-b2b6-5738-b5ce-bd418445525a','75be6381-71ba-5c2f-981c-58f1d91debb2'];
const SIRIUS_SOLO_RELEASES=['ff946479-c1ef-5b05-8d43-93c3163779f3','a5253209-7c10-5945-aedc-dabc8779e75e'];
// Official alpha/beta pages explicitly state that the fifteen tracks are shared.
// This is a presentation hint, not a copy of beta tracks or an edition merge.
export const SHARED_RELEASE_TRACKLISTS=[{familyId:'de19530d-b318-5828-b6c8-b381e2a98a30',title:'創生',editionIds:['43236903-58cb-52cb-b3c6-65f2ba4371fb','ecdc3b97-33b2-5a66-a13c-3ca302f3358f'],label:'α・β共通',sourceUrl:'https://kamitsubaki.jp/discography/isekaijoucho/1036/'}];
export function youtubeId(value){
 try{const u=new URL(value);const id=u.hostname==='youtu.be'?u.pathname.slice(1):['www.youtube.com','youtube.com','m.youtube.com'].includes(u.hostname)?u.searchParams.get('v'):null;return /^[\w-]{11}$/.test(id??'')?id:null;}catch{return null;}
}
export function safeSongUrl(value){
 if(typeof value!=='string'||value.length>2048||/[\s\\]/.test(value))return null;
 try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!/^localhost$|^127\.|^10\.|^192\.168\.|^169\.254\.|\.local$/i.test(u.hostname)&&![...u.searchParams.keys()].some(k=>/token|secret|password|credential|auth|session|api.?key|signature/i.test(k))?u.toString():null;}catch{return null;}
}
export const missingSongText=review=>review?.outcome==='not_found'?'見つかっていません。':review?.outcome==='not_applicable'?'該当なし':'準備中';

function legacyRecords(entry){
 const d=entry?.detail??{};
 // Old labels can differ from the adopted display title. The frozen target
 // descriptor, together with the original ID, supplies the exact identity.
 return arr(entry?.legacyIds).map(id=>byLegacyId.get(id)).filter(x=>x&&arr(x.targets).some(t=>
  t.entryId===d.entryId&&t.primaryWorkId===d.primaryWorkId&&t.title===d.title&&JSON.stringify(t.variations??[])===JSON.stringify(d.variations??[])&&
  Array.isArray(entry.singerIds)&&t.singerIds.length===entry.singerIds.length&&t.singerIds.every(id=>entry.singerIds.includes(id))));
}
/** A complete canonical metadata object wins, even when its values are null.
 * The bridge never resurrects a value deliberately cleared in a newer record. */
export function songMetadataForEntry(entry){
 if(object(entry?.detail?.songMetadata))return entry.detail.songMetadata;
 const records=legacyRecords(entry),fields=['titleKana','firstAppearance','firstFull','tieUp','originalArtist','originalVocal'];
 const out=Object.fromEntries(fields.map(k=>[k,known(records.map(x=>x.metadata[k]))]));
 out.originalCredits=unique(records.flatMap(x=>arr(x.metadata.originalCredits)));
 out.fieldReview={};out.firstAppearanceReview={coverage:'unknown',partialConfirmed:false};
 const lyrics=unique(records.flatMap(x=>x.lyricsUrls).filter(safeSongUrl));out.lyricsUrl=lyrics.length===1?lyrics[0]:null;
 // Lyrics are a work/title property. Dates and media are not inherited here.
 if(entry?.detail?.primaryWorkId===SIRIUS_WORK&&entry.detail.title==='シリウスの心臓'){
  out.titleKana??='しりうすのしんぞう';out.lyricsUrl??='https://piapro.jp/t/S1w7';
 }
 return out;
}
function exactSiriusSolo(entry){
 return entry?.detail?.entryId===SIRIUS_SOLO&&entry.detail.primaryWorkId===SIRIUS_WORK&&entry.detail.title==='シリウスの心臓'&&arr(entry.detail.variations).length===0&&arr(entry.legacyIds).includes(41)&&entry.singerIds?.length===1&&entry.singerIds[0]==='81a01233-230e-50a8-a309-11275c794cd0';
}
export function songCreditsForEntry(entry,metadata=songMetadataForEntry(entry)){
 const credits=arr(entry?.credits?.credits),names=(scope,role)=>unique(credits.filter(c=>c.scope===scope&&c.role===role).map(c=>str(c.name||c.rawName)).filter(Boolean));
 const rows=['lyricist','composer','arranger'].map(role=>{
  let values=names('version',role);
  if(!values.length&&role!=='arranger')values=names('work',role);
  if(!values.length&&role!=='arranger')values=names('original',role);
  // Explicit original solo MV credit, retained from the user-supplied description.
  if(!values.length&&role==='arranger'&&exactSiriusSolo(entry))values=['傘村トータ'];
  return {role,names:values,value:values.join('・')||null,review:metadata.fieldReview?.credits?.[role]??null};
 });
 const original=arr(metadata.originalCredits).length?metadata.originalCredits:credits.filter(c=>c.scope==='original');
 return {rows,originalArranger:known(original.filter(c=>c.role==='arranger').map(c=>c.name))};
}
function releaseCandidates(r,records){
 const f=r.family??{},e=r.edition??{},c=r.component??{};
 const titles=[norm(f.title),norm(str(f.title)+str(e.editionName))];
 return records.flatMap(x=>x.releases).filter(x=>titles.includes(norm(x.title))&&x.trackNumber===r.trackNumber&&(x.discNumber===null||x.discNumber===c.componentNo));
}
function songVideosForEntry(entry,work){
 const d=entry.detail,records=legacyRecords(entry),solo=exactSiriusSolo(entry);
 const directRenditions=new Set(arr(d.linkedRenditions).map(x=>x.renditionId));
 for(const h of arr(entry.history))if(['explicit_part','legacy_rendition'].includes(h.matchBasis)&&h.multiWork!==true)directRenditions.add(h.renditionId);
 const oldVideos=new Map(records.flatMap(x=>x.videos).map(x=>[x.videoId,x]));
 const videos=[];
 for(const m of arr(work.media)){
  const direct=arr(m.associations).some(a=>a.identityScope==='rendition'&&directRenditions.has(a.targetRenditionId)&&a.renditionContainsAnotherWork!==true);
  for(const publication of arr(m.publications)){
   const url=safeSongUrl(publication.url);if(!url)continue;
   const id=youtubeId(url),old=id?oldVideos.get(id):null;
   if(!old&&!direct&&!(solo&&SIRIUS_SOLO_MEDIA.includes(m.mediaId)))continue;
   const kind=m.mediaKind==='unknown'?({'MV':'music_video','LYRIC MV':'lyric_video','LIVE MV':'live_video'})[old?.kind]||null:m.mediaKind;
   const video={mediaId:m.mediaId,url,title:str(m.canonicalTitle||publication.rawTitle||old?.title)||null,kind,publishedOn:publication.publishedOn||old?.publishedOn||null,
    imageUrl:id?`https://i.ytimg.com/vi/${id}/hqdefault.jpg`:null,credits:[]};
   if(id==='UKZt1vq8bKI'&&solo)video.credits=[{role:'映像',name:'UDON (VIXI)'},{role:'Mix',name:'＄ＫＩＹＡＫＩ＄ＫＩ'}];
   if(!videos.some(x=>youtubeId(x.url)&&youtubeId(x.url)===id||x.url===url))videos.push(video);
  }
 }
 videos.sort((a,b)=>(a.kind==='music_video'?0:1)-(b.kind==='music_video'?0:1)||str(a.publishedOn).localeCompare(str(b.publishedOn)));
 return videos;
}
export function songReleasesForEntry(entry,work={},releaseRecords=RELEASE_ARTWORK_RECORDS){
 const records=legacyRecords(entry),solo=exactSiriusSolo(entry);
 const rawReleases=arr(work.releases),releases=[];
 for(const r of rawReleases){
  const candidates=releaseCandidates(r,records);
  const unambiguous=candidates.some(old=>rawReleases.filter(other=>releaseCandidates(other,[{releases:[old]}]).length).length===1);
  const registered=releaseRecords.filter(x=>x.familyId===r.family?.familyId&&x.editionId===r.edition?.editionId);
  const explicit=registered.some(x=>arr(x.entries).some(target=>artworkEntryMatches(entry,target)));
  if(!unambiguous&&!explicit&&!(solo&&SIRIUS_SOLO_RELEASES.includes(r.releaseItemId)))continue;
  const cover=known(candidates.map(x=>safeSongUrl(x.imageUrl))),shared=SHARED_RELEASE_TRACKLISTS.some(x=>x.familyId===r.family?.familyId&&x.title===r.family?.title);
  const image=rankArtworkCandidates(registered.map(x=>({kind:'release',imageUrl:x.imageUrl,sourceUrl:x.sourceUrl})))[0];
  releases.push({...r,imageUrl:image?.imageUrl??(cover?.startsWith('https:')?cover:null),imageSourceUrl:image?.sourceUrl??records.find(x=>x.releases.some(y=>candidates.includes(y)))?.sourceUrl??null,editionLabel:shared?null:r.edition?.editionKind==='digital'?'配信':r.edition?.editionName??null});
 }
 return releases;
}
function songLivesForEntry(entry,eventRecords=EVENT_ARTWORK_RECORDS){
 const lives=new Map();
 for(const h of arr(entry.history))for(const ev of arr(h.relatedEvents)){
  const key=ev.eventId+'|'+str(h.occurredOn),previous=lives.get(key),uncertain=h.matchBasis==='same_version_only'&&h.singerSetConfirmedForEntry!==true;
  lives.set(key,{eventId:ev.eventId,title:ev.title,date:h.occurredOn??null,uncertain:previous?previous.uncertain&&uncertain:uncertain});
 }
 return [...lives.values()].map(live=>({...live,imageUrl:eventArtworkForEvent(live,eventRecords)?.imageUrl??null})).sort((a,b)=>str(b.date).localeCompare(str(a.date)));
}
function artworkCandidates(entry,videos,releases,lives,{entryRecords=ARTWORK_RECORDS,releaseRecords=RELEASE_ARTWORK_RECORDS,eventRecords=EVENT_ARTWORK_RECORDS}={}){
 const candidates=catalogArtworkCandidatesForEntry(entry,entryRecords).map(c=>({...c,date:c.date??videos.find(v=>youtubeId(v.url)&&youtubeId(v.url)===youtubeId(c.sourceUrl))?.publishedOn??null}));
 const kinds={music_video:'mv',cover_video:'cover',cover_duet_video:'cover',live_video:'live_mv'};
 for(const video of videos)if(kinds[video.kind]&&video.imageUrl)candidates.push({kind:kinds[video.kind],imageUrl:video.imageUrl,sourceUrl:video.url,date:video.publishedOn});
 for(const release of releases){
  const registered=releaseRecords.filter(x=>x.familyId===release.family?.familyId&&x.editionId===release.edition?.editionId);
  const kind=release.family?.releaseKind==='single'&&release.edition?.editionKind==='digital'?'digital_single':'release';
  for(const image of [...registered,...(release.imageUrl?[{imageUrl:release.imageUrl,sourceUrl:release.imageSourceUrl}]:[])])
   candidates.push({kind,imageUrl:image.imageUrl,sourceUrl:image.sourceUrl,date:release.edition?.releaseDate??null});
 }
 // A poster illustrates a displayed event; using it must not require or mutate
 // the independent singer verification state of that history row.
 for(const live of lives){const image=eventArtworkForEvent(live,eventRecords);if(image)candidates.push({...image,date:live.date});}
 return rankArtworkCandidates(candidates);
}
/** All display surfaces and failure fallbacks share the same ordered candidates. */
export function songArtworkCandidatesForEntry(entry,work={},options={}){
 if(!entry?.detail)return [];
 return artworkCandidates(entry,songVideosForEntry(entry,work),songReleasesForEntry(entry,work,options.releaseRecords),songLivesForEntry(entry,options.eventRecords),options);
}
export function songArtworkForEntry(entry,work={}){return songArtworkCandidatesForEntry(entry,work)[0]??null;}
export function buildSongDetail(entry,work={},options={}){
 if(!entry?.detail)return null;
 const d=entry.detail,metadata=songMetadataForEntry(entry),creditData=songCreditsForEntry(entry,metadata),videos=songVideosForEntry(entry,work),releases=songReleasesForEntry(entry,work,options.releaseRecords),allLives=songLivesForEntry(entry,options.eventRecords);
 const images=artworkCandidates(entry,videos,releases,allLives,options);
 return {detail:d,metadata,credits:creditData.rows,originalArranger:creditData.originalArranger,
  artwork:images[0]??null,artworkCandidates:images,listenUrl:videos[0]?.url??null,videos,releases,lives:allLives,
  hasUncertainLives:allLives.some(x=>x.uncertain),comparison:entry.compare??null,
  versionLabel:d.entryId===SIRIUS_DUET&&d.primaryWorkId===SIRIUS_WORK?'デュエット':null};
}
export function songDetailFromModel(model,entryId){
 const entry=model.entries.get(entryId);if(!entry)return null;
 return buildSongDetail(entry,model.works.get(entry.detail.primaryWorkId)??{});
}
