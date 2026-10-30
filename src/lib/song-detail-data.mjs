// Public presentation adapter shared by the private snapshot and public file.
// Empty reads are not negative findings. Work-scoped links never establish a
// particular vocal configuration, and a work arranger is not a version arranger.
import legacy from './song-legacy-data.json' with {type:'json'};
import sourceRegistry from './catalog-song-sources.json' with {type:'json'};
import {artworkEntryMatches,catalogArtworkCandidatesForEntry,eventArtworkForEvent,rankArtworkCandidates} from './catalog-artwork.mjs';
import {ARTWORK_RECORDS,RELEASE_ARTWORK_RECORDS,EVENT_ARTWORK_RECORDS} from './catalog-artwork-data.mjs';
import releaseEditions from './catalog-release-editions.json' with {type:'json'};
import {singersForEntry,singerIdsForEntry,entityForId,personKeyForCredit,vocalDisplayCreditForEntry,medleyPerformanceForEntry} from './catalog-people.mjs';
import {resolveSongClassification,isCoverSongType,formatSongTitleCredit} from './catalog-song-classification.mjs';
import {supplementalLivesForEntry} from './live-program-supplements.mjs';
import {liveVocalRecordsForEntry} from './live-vocal-entries.mjs';
import {supplementalReleasesForEntry} from './release-content-data.mjs';
import {resolveCreatorCredit} from './creator-credit-data.mjs';

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
export const SHARED_RELEASE_TRACKLISTS=releaseEditions.releases;
export function youtubeId(value){
 try{const u=new URL(value);const id=u.hostname==='youtu.be'?u.pathname.slice(1):['www.youtube.com','youtube.com','m.youtube.com'].includes(u.hostname)?u.searchParams.get('v'):null;return /^[\w-]{11}$/.test(id??'')?id:null;}catch{return null;}
}
export function safeSongUrl(value){
 if(typeof value!=='string'||value.length>2048||/[\s\\]/.test(value))return null;
 try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!/^localhost$|^127\.|^10\.|^192\.168\.|^169\.254\.|\.local$/i.test(u.hostname)&&![...u.searchParams.keys()].some(k=>/token|secret|password|credential|auth|session|api.?key|signature/i.test(k))?u.toString():null;}catch{return null;}
}
export const missingSongText=review=>review?.outcome==='not_found'?'見つかっていません。':review?.outcome==='not_applicable'?'該当なし':'準備中';

// Public, entry-scoped source additions. They supply destinations, never a
// stored Discover category or positive full/free/current listening facts.
export const SONG_SOURCE_RECORDS=sourceRegistry.records;
export const SONG_SOURCE_EXCLUSIONS=sourceRegistry.exclusions??[];
export const SONG_FACT_RECORDS=sourceRegistry.facts??[];
export const SONG_MEDIA_CREDIT_RECORDS=sourceRegistry.mediaCredits??[];
const creditBasis=entry=>arr(entry?.credits?.credits).map(c=>[c.scope,c.role,c.name||c.rawName||'']).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
export function registeredSongFactsForEntry(entry,records=SONG_FACT_RECORDS){
 return arr(records).filter(r=>r.status==='active'&&artworkEntryMatches(entry,r.entry)&&
  str(r.entry.displayCredit)===str(entry.detail.displayCredit)&&safeSongUrl(r.url)&&
  JSON.stringify(r.creditBasis)===JSON.stringify(creditBasis(entry)));
}
export function registeredSongSourcesForEntry(entry,records=SONG_SOURCE_RECORDS){
 const liveVideos=records===SONG_SOURCE_RECORDS?liveVocalRecordsForEntry(entry).filter(r=>r.video).map(r=>({key:r.key,status:'active',kind:'youtube',songType:r.songType,...r.video,entry:{...r.match,entryId:entry.detail.entryId}})):[];
 return [...arr(records),...liveVideos].filter(r=>r.status==='active'&&artworkEntryMatches(entry,r.entry)&&
  str(r.entry.displayCredit)===str(entry.detail.displayCredit)&&safeSongUrl(r.url)&&
  (r.kind==='youtube'?youtubeId(r.url):r.kind==='x'?/^https:\/\/(?:x|twitter)\.com\/[^/]+\/status\/\d+$/.test(r.url):r.kind==='digital_single'));
}
// New owner drafts have no legacy classification. A sourced classification is
// a display fallback for the exact entry, never a change to its DB review state.
function classificationMetadataForEntry(entry,metadata,factRecords){
 let out=metadata;
 const sources=[...registeredSongFactsForEntry(entry,factRecords),...liveVocalRecordsForEntry(entry)];
 for(const key of ['originalSingerSet','songClassification'])if(!Object.hasOwn(metadata,key)){
  const value=known(sources.map(r=>r.metadata?.[key]));if(value!==null)out={...out,[key]:value};
 }
 return out;
}
export function songClassificationForEntry(entry,records=SONG_SOURCE_RECORDS,factRecords=SONG_FACT_RECORDS){
 if(entry?.detail?.kind==='medley')return resolveSongClassification();
 const metadata=classificationMetadataForEntry(entry,object(entry?.detail?.songMetadata)?entry.detail.songMetadata:{},factRecords),original=metadata.originalSingerSet,
  actual=singerIdsForEntry(entry),complete=entry?.candidateSetExhaustive===true&&arr(entry.unresolvedTokens).length===0&&
   !arr(entry.flags).some(flag=>['group_without_membership','role_or_identity_review_voicebank'].includes(flag))&&actual.length===new Set(arr(entry.singerIds)).size&&
   !actual.some(id=>entityForId(id)?.type==='group');
 return resolveSongClassification({setting:metadata.songClassification,legacyType:entry?.detail?.legacySongType,
  sourcedTypes:[...registeredSongSourcesForEntry(entry,records),...liveVocalRecordsForEntry(entry),...registeredSongFactsForEntry(entry,factRecords)].map(r=>r.songType),
  originalSingerIds:original?.singerIds,originalSetComplete:original?.complete===true&&!arr(original?.singerIds).some(id=>entityForId(id)?.type==='group'),singerIds:actual,singerSetComplete:complete});
}
export function songTypeForEntry(entry,records=SONG_SOURCE_RECORDS,factRecords=SONG_FACT_RECORDS){return songClassificationForEntry(entry,records,factRecords).category;}
function sourceReleaseMatches(source,release){
 return source.kind==='digital_single'&&str(source.catalogNumber)!==''&&source.catalogNumber===release.edition?.catalogNumber&&
  source.trackNumber===release.trackNumber;
}
const sourceKey=url=>youtubeId(url)?'youtube:'+youtubeId(url):safeSongUrl(url)?.replace(/^https:\/\/twitter\.com\//,'https://x.com/');
const excludedSourceKeys=(entry,records=SONG_SOURCE_EXCLUSIONS)=>new Set(registeredSongSourcesForEntry(entry,records).map(r=>sourceKey(r.url)));
export function songListenLabel(url){
 if(youtubeId(url))return 'YouTubeで聴く';
 try{return ['x.com','twitter.com'].includes(new URL(url).hostname)?'Xで見る':'動画を見る';}catch{return '動画を見る';}
}

function legacyRecords(entry){
 const d=entry?.detail??{};
 // Old labels can differ from the adopted display title. The frozen target
 // descriptor, together with the original ID, supplies the exact identity.
 return arr(entry?.legacyIds).map(id=>byLegacyId.get(id)).filter(x=>x&&arr(x.targets).some(t=>
  t.entryId===d.entryId&&t.primaryWorkId===d.primaryWorkId&&t.title===d.title&&JSON.stringify(t.variations??[])===JSON.stringify(d.variations??[])&&
  Array.isArray(entry.singerIds)&&t.singerIds.length===entry.singerIds.length&&t.singerIds.every(id=>entry.singerIds.includes(id))));
}
const dated=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
// Explicit, reviewed metadata changes carry the old value as well as the exact
// entry/credit basis. An ordinary fallback never replaces a canonical null.
function reviewedMetadataForEntry(entry,metadata,factRecords){
 const facts=registeredSongFactsForEntry(entry,factRecords);
 let result=metadata;
 for(const key of ['lyricsUrl','tieUp','firstAppearance','originalCredits']){
  if(['not_found','not_applicable'].includes(metadata.fieldReview?.[key]?.outcome))continue;
  const values=facts.filter(r=>Object.hasOwn(r.metadataBasis??{},key)&&Object.hasOwn(r.metadata??{},key)&&
   JSON.stringify(r.metadataBasis[key])===JSON.stringify(metadata[key])).map(r=>r.metadata[key]).filter(value=>{
    if(key==='lyricsUrl')return typeof value==='string'&&!!safeSongUrl(value);
    if(key==='tieUp')return typeof value==='string'&&!!value.trim();
    if(key==='originalCredits')return Array.isArray(value)&&value.every(c=>str(c.role).trim()&&str(c.name).trim())&&
     [...new Set([...arr(metadata.originalCredits),...value].map(c=>c.role))].every(role=>
      !['not_found','not_applicable'].includes(metadata.fieldReview?.credits?.[role]?.outcome)||
      JSON.stringify(value.filter(c=>c.role===role))===JSON.stringify(arr(metadata.originalCredits).filter(c=>c.role===role)));
    return dated(value?.date)&&typeof value.label==='string'&&value.label.trim()&&(!dated(metadata.firstAppearance?.date)||value.date<=metadata.firstAppearance.date);
   });
  const value=known(values);
  if(value!==null&&JSON.stringify(value)!==JSON.stringify(metadata[key]))result={...result,[key]:value};
 }
 return result;
}
function earliestKnownAppearance(entry,metadata,work,options,factRecords){
 metadata=reviewedMetadataForEntry(entry,metadata,factRecords);
 // A scoped source review is a fallback, never a replacement for a later
 // canonical outcome or a named version credit. No placeholder becomes data.
 for(const role of ['lyricist','composer','arranger'])if(!Object.hasOwn(metadata.fieldReview?.credits??{},role)&&!arr(entry?.credits?.credits).some(c=>c.scope==='version'&&c.role===role)){
  const outcome=known(registeredSongFactsForEntry(entry,factRecords).map(r=>r.fieldReview?.credits?.[role]?.outcome));
  if(['not_found','not_applicable'].includes(outcome))metadata={...metadata,fieldReview:{...metadata.fieldReview,credits:{...metadata.fieldReview?.credits,[role]:{outcome}}}};
 }
 metadata=classificationMetadataForEntry(entry,metadata,factRecords);
 // Artist billing does not establish a singer set or replace vocal credits.
 // An explicit canonical value, including null, retains precedence.
 if(!Object.hasOwn(metadata,'artistCredit')){
  const artistCredit=artistCreditForEntry(entry,metadata,factRecords);
  if(artistCredit)metadata={...metadata,artistCredit};
 }
 for(const record of registeredSongFactsForEntry(entry,factRecords)){
  const first=record.metadata?.firstAppearance;
  if(dated(first?.date)&&(!dated(metadata.firstAppearance?.date)||first.date<metadata.firstAppearance.date)){
   metadata={...metadata,firstAppearance:first,firstAppearanceReview:{coverage:'unknown',partialConfirmed:false}};
  }
 }
 for(const record of liveVocalRecordsForEntry(entry)){
  const sourced=record.metadata;
  metadata={...metadata,titleKana:metadata.titleKana??sourced.titleKana,originalArtist:metadata.originalArtist??sourced.originalArtist};
  if(dated(sourced.firstAppearance?.date)&&(!dated(metadata.firstAppearance?.date)||sourced.firstAppearance.date<metadata.firstAppearance.date))metadata.firstAppearance=sourced.firstAppearance;
 }
 const first=metadata.firstAppearance;
 const video=songVideosForEntry(entry,work,options.sourceRecords,options.sourceExclusions)
  .filter(v=>dated(v.publishedOn)).sort((a,b)=>a.publishedOn.localeCompare(b.publishedOn)||a.url.localeCompare(b.url))[0];
 if(!video||(dated(first?.date)&&first.date<=video.publishedOn))return metadata;
 // First appearance means the earliest publication currently known. A null
 // first date is a research gap; an older exact publication advances it.
 return {...metadata,firstAppearance:{date:video.publishedOn,label:youtubeId(video.url)?'YouTube':songListenLabel(video.url)==='Xで見る'?'X':'動画'},
  firstAppearanceReview:{coverage:'unknown',partialConfirmed:false}};
}
function artistCreditForEntry(entry,metadata,factRecords){
 if(Object.hasOwn(metadata??{},'artistCredit'))return str(metadata.artistCredit).trim()?metadata.artistCredit:null;
 return known([...registeredSongFactsForEntry(entry,factRecords),...liveVocalRecordsForEntry(entry)]
  .map(r=>r.metadata?.artistCredit).filter(v=>typeof v==='string'&&v.trim()))??medleyPerformanceForEntry(entry)?.displayCredit??null;
}
/** One title caption across home, lists and detail. Official billing is not a
 * singer set and must not change singer filters, roles or verification. */
export function songTitleCreditForEntry(entry,metadata=entry?.detail?.songMetadata??{},factRecords=SONG_FACT_RECORDS){
 const official=artistCreditForEntry(entry,metadata,factRecords);if(official)return official;
 const existing=str(entry?.detail?.displayCredit);if(existing.trim())return existing;
 const named=arr(entry?.detail?.singers).map(s=>str(s.name)).filter(Boolean);if(named.length)return named.join('・');
 return singersForEntry(entry).map(s=>str(s.name)).filter(Boolean).join('・');
}
/** Display only. Keep billing, named singers and original-artist metadata intact.
 * A mixed medley or an unclassified entry is not inferred to be a cover. */
export function songTitleCaptionForEntry(entry,metadata=entry?.detail?.songMetadata??{},factRecords=SONG_FACT_RECORDS){
 const credit=songTitleCreditForEntry(entry,metadata,factRecords);
 return formatSongTitleCredit(credit,songTypeForEntry(entry,undefined,factRecords),entry?.detail?.kind);
}
/** Canonical fields retain precedence, including explicit nulls, except that
 * first appearance incorporates an earlier known publication (D-084). */
export function songMetadataForEntry(entry,factRecords=SONG_FACT_RECORDS,work={},options={}){
 if(object(entry?.detail?.songMetadata))return earliestKnownAppearance(entry,entry.detail.songMetadata,work,options,factRecords);
 const records=legacyRecords(entry),fields=['titleKana','firstAppearance','firstFull','tieUp','originalArtist','originalVocal'];
 const out=Object.fromEntries(fields.map(k=>[k,known(records.map(x=>x.metadata[k]))]));
 out.originalCredits=unique(records.flatMap(x=>arr(x.metadata.originalCredits)));
 out.fieldReview={};out.firstAppearanceReview={coverage:'unknown',partialConfirmed:false};
 const lyrics=unique(records.flatMap(x=>x.lyricsUrls).filter(safeSongUrl));out.lyricsUrl=lyrics.length===1?lyrics[0]:null;
 // Lyrics are a work/title property. Dates and media are not inherited here.
 if(entry?.detail?.primaryWorkId===SIRIUS_WORK&&entry.detail.title==='シリウスの心臓'){
  out.titleKana??='しりうすのしんぞう';out.lyricsUrl??='https://piapro.jp/t/S1w7';
 }
 const facts=registeredSongFactsForEntry(entry,factRecords);
 for(const key of ['titleKana','tieUp','lyricsUrl'])if(!out[key]){
  const value=known(facts.map(r=>r.metadata?.[key]));if(value&&(key!=='lyricsUrl'||safeSongUrl(value)))out[key]=value;
 }
 return earliestKnownAppearance(entry,out,work,options,factRecords);
}
function exactSiriusSolo(entry){
 return entry?.detail?.entryId===SIRIUS_SOLO&&entry.detail.primaryWorkId===SIRIUS_WORK&&entry.detail.title==='シリウスの心臓'&&arr(entry.detail.variations).length===0&&arr(entry.legacyIds).includes(41)&&entry.singerIds?.length===1&&entry.singerIds[0]==='81a01233-230e-50a8-a309-11275c794cd0';
}
export function songCreditsForEntry(entry,metadata=songMetadataForEntry(entry),factRecords=SONG_FACT_RECORDS){
 const credits=arr(entry?.credits?.credits),names=(scope,role)=>unique(credits.filter(c=>c.scope===scope&&c.role===role).map(c=>str(c.name||c.rawName)).filter(Boolean));
 const facts=registeredSongFactsForEntry(entry,factRecords);
 const standard=['lyricist','composer','arranger'],nonCreator=new Set(['vocal','performer','artist','track_artist_display']);
 const extra=unique([...credits.filter(c=>['version','work'].includes(c.scope)).map(c=>c.role),...facts.flatMap(r=>Object.keys(r.credits??{}))].filter(role=>str(role).trim()&&!standard.includes(role)&&!nonCreator.has(role))).sort((a,b)=>a.localeCompare(b,'ja'));
 const rows=[...standard,...extra].map(role=>{
  let scope='version',values=names(scope,role);
  if(!values.length&&role!=='arranger'){scope='work';values=names(scope,role);}
  if(!values.length&&['lyricist','composer'].includes(role)){scope='original';values=names(scope,role);}
  // Explicit original solo MV credit, retained from the user-supplied description.
  if(!values.length&&role==='arranger'&&exactSiriusSolo(entry))values=['傘村トータ'];
  if(!['not_found','not_applicable'].includes(metadata.fieldReview?.credits?.[role]?.outcome)){
   const candidates=records=>unique(records.filter(r=>Array.isArray(r.credits?.[role])&&r.credits[role].length&&r.credits[role].every(n=>typeof n==='string'&&n.trim())).map(r=>({names:r.credits[role],scope:r.creditScopes?.[role]??(isCoverSongType(songTypeForEntry(entry,undefined,factRecords))&&['lyricist','composer'].includes(role)?'original':'version')})).filter(c=>['version','work','original'].includes(c.scope)&&(role!=='arranger'||c.scope==='version')));
   // A reviewed correction is opt-in and tied to the entire frozen raw credit
   // basis above. Any subsequent DB correction invalidates that old basis.
   const replacement=candidates(facts.filter(r=>arr(r.replaceExistingCredits).includes(role)));
   const selected=replacement.length===1?replacement:!values.length?candidates(facts):[];
   if(selected.length===1){values=selected[0].names;scope=selected[0].scope;}
  }
  return {role,scope,names:values,people:values.map(name=>resolveCreatorCredit(entry,{name,personKey:personKeyForCredit(name,credits.filter(c=>c.role===role&&c.scope===scope))},{role,scope})),value:values.join('・')||null,review:metadata.fieldReview?.credits?.[role]??null};
 });
 const original=arr(metadata.originalCredits).length?metadata.originalCredits:credits.filter(c=>c.scope==='original');
 const originalCredits=unique(original.filter(c=>str(c.role)&&str(c.name||c.rawName)).map(c=>resolveCreatorCredit(entry,{role:c.role,name:c.name||c.rawName,personKey:personKeyForCredit(c.name||c.rawName,credits.filter(c=>c.scope==='original'))},{role:c.role,scope:'original'})));
 const originalArranger=known(original.filter(c=>c.role==='arranger').map(c=>c.name)),originalArrangerCredit=originalCredits.find(c=>c.role==='arranger'&&c.name===originalArranger&&c.parts);
 return {rows,originalCredits,originalArranger,...(originalArrangerCredit?{originalArrangerCredit}:{})};
}
function releaseCandidates(r,records){
 const f=r.family??{},e=r.edition??{},c=r.component??{};
 const titles=[norm(f.title),norm(str(f.title)+str(e.editionName)),norm(str(f.title)+'(type:'+str(e.editionName)+')')];
 return records.flatMap(x=>x.releases).filter(x=>titles.includes(norm(x.title))&&x.trackNumber===r.trackNumber&&(x.discNumber===null||x.discNumber===c.componentNo));
}
export function registeredMediaCreditsForVideo(entry,video,records=SONG_MEDIA_CREDIT_RECORDS){
 return arr(records).filter(r=>r.status==='active'&&artworkEntryMatches(entry,r.entry)&&str(r.entry.displayCredit)===str(entry.detail.displayCredit)&&safeSongUrl(r.url)&&
  r.mediaId===video.mediaId&&sourceKey(r.mediaUrl)===sourceKey(video.url)&&sourceKey(video.url));
}
function publicCredit(c){
 const role=str(c?.role),name=str(c?.name||c?.rawName);if(!role.trim()||!name.trim())return null;
 const out={role,name};if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str(c.entityId)))out.entityId=c.entityId;return out;
}
function mediaCreditsForVideo(entry,video,work,records){
 const canonical=arr(work.media).find(m=>m.mediaId===video.mediaId),current=arr(canonical?.credits).map(publicCredit).filter(Boolean);
 const credits=unique([...current,...arr(video.credits).filter(c=>!current.some(n=>n.role===c.role))]);
 const candidates=registeredMediaCreditsForVideo(entry,video,records).flatMap(r=>arr(r.credits).map(publicCredit).filter(Boolean));
 for(const role of unique(candidates.map(c=>c.role)))if(!credits.some(c=>c.role===role)){
  // Multiple names within one credit are supported. Conflicting source sets
  // are left unresolved instead of picking the first finding.
  const sets=unique(registeredMediaCreditsForVideo(entry,video,records).map(r=>arr(r.credits).map(publicCredit).filter(c=>c?.role===role)).filter(cs=>cs.length).map(cs=>cs.sort((a,b)=>a.name.localeCompare(b.name,'ja'))));
  if(sets.length===1)credits.push(...sets[0]);
 }
 return credits.map(c=>{
  const resolved=resolveCreatorCredit(entry,{...c,personKey:personKeyForCredit(c.name,[c])},{role:c.role,scope:'video',mediaId:video.mediaId,mediaUrl:video.url});
  return resolved.parts?{...c,parts:resolved.parts,participants:resolved.participants}:c;
 });
}
function songVideosForEntry(entry,work,sourceRecords,sourceExclusions,mediaCreditRecords){
 const d=entry.detail,records=legacyRecords(entry),solo=exactSiriusSolo(entry);
 const directRenditions=new Set(arr(d.linkedRenditions).map(x=>x.renditionId));
 for(const h of arr(entry.history))if(['explicit_part','legacy_rendition'].includes(h.matchBasis)&&h.multiWork!==true)directRenditions.add(h.renditionId);
 const oldVideos=new Map(records.flatMap(x=>x.videos).map(x=>[x.videoId,x]));
 const videos=[];
 for(const m of arr(work.media)){
  const direct=arr(m.associations).some(a=>a.identityScope==='rendition'&&directRenditions.has(a.targetRenditionId)&&a.renditionContainsAnotherWork!==true);
  for(const publication of arr(m.publications)){
   const url=safeSongUrl(publication.url);if(!url||liveVocalRecordsForEntry(entry).some(r=>r.sourcePageUrl===url))continue;
   const id=youtubeId(url),old=id?oldVideos.get(id):null;
   if(!old&&!direct&&!(solo&&SIRIUS_SOLO_MEDIA.includes(m.mediaId)))continue;
   const kind=m.mediaKind==='unknown'?({'MV':'music_video','LYRIC MV':'lyric_video','LIVE MV':'live_video'})[old?.kind]||null:m.mediaKind;
   const video={mediaId:m.mediaId,url,title:str(m.canonicalTitle||publication.rawTitle||old?.title)||null,kind,publishedOn:publication.publishedOn||old?.publishedOn||null,
    imageUrl:id?`https://i.ytimg.com/vi/${id}/hqdefault.jpg`:null,credits:[]};
   if(id==='UKZt1vq8bKI'&&solo)video.credits=[{role:'映像',name:'UDON (VIXI)'},{role:'Mix',name:'＄ＫＩＹＡＫＩ＄ＫＩ'}];
   if(!videos.some(x=>youtubeId(x.url)&&youtubeId(x.url)===id||x.url===url))videos.push(video);
  }
 }
 for(const source of registeredSongSourcesForEntry(entry,sourceRecords).filter(r=>['youtube','x'].includes(r.kind))){
  const existing=videos.find(v=>sourceKey(v.url)===sourceKey(source.url));
  if(existing){
   existing.authorName=source.authorName??null;existing.authorUrl=source.authorUrl??null;
   existing.title??=source.title??null;
   if(!existing.kind||existing.kind==='unknown')existing.kind=source.mediaKind??null;
   existing.publishedOn??=source.publishedOn??null;
   continue;
  }
  const id=youtubeId(source.url);
  const canonical=arr(work.media).find(m=>arr(m.publications).some(p=>sourceKey(p.url)===sourceKey(source.url)));
  const publication=arr(canonical?.publications).find(p=>sourceKey(p.url)===sourceKey(source.url));
  videos.push({mediaId:canonical?.mediaId??'registered:'+source.key,url:source.url,title:canonical?.canonicalTitle||publication?.rawTitle||source.title||null,
   kind:canonical?.mediaKind&&canonical.mediaKind!=='unknown'?canonical.mediaKind:source.mediaKind||null,publishedOn:publication?.publishedOn??source.publishedOn??null,
   imageUrl:id?`https://i.ytimg.com/vi/${id}/hqdefault.jpg`:null,credits:[],authorName:source.authorName??null,authorUrl:source.authorUrl??null});
 }
 videos.sort((a,b)=>(a.kind==='music_video'?0:1)-(b.kind==='music_video'?0:1)||str(a.publishedOn).localeCompare(str(b.publishedOn)));
 const excluded=excludedSourceKeys(entry,sourceExclusions);
 return videos.filter(v=>!excluded.has(sourceKey(v.url))).map(video=>({...video,credits:mediaCreditsForVideo(entry,video,work,mediaCreditRecords)}));
}
export function songReleasesForEntry(entry,work={},releaseRecords=RELEASE_ARTWORK_RECORDS,sourceRecords,additionalReleases=[]){
 const records=legacyRecords(entry),solo=exactSiriusSolo(entry);
 const sources=registeredSongSourcesForEntry(entry,sourceRecords).filter(r=>r.kind==='digital_single');
 const targets=registeredSongFactsForEntry(entry).flatMap(f=>arr(f.releaseItems));
 const rawReleases=arr(work.releases),releases=[];
 for(const r of rawReleases){
  const candidates=releaseCandidates(r,records);
  const unambiguous=candidates.some(old=>rawReleases.filter(other=>releaseCandidates(other,[{releases:[old]}]).length).length===1);
  const registered=releaseRecords.filter(x=>x.familyId===r.family?.familyId&&x.editionId===r.edition?.editionId);
  const explicit=registered.some(x=>arr(x.entries).some(target=>artworkEntryMatches(entry,target)))||targets.some(t=>
   t.releaseItemId===r.releaseItemId&&t.familyId===r.family?.familyId&&t.editionId===r.edition?.editionId&&t.componentId===r.component?.componentId&&
   t.rawTrackTitle===r.rawTrackTitle&&t.trackNumber===r.trackNumber&&arr(r.associations).some(a=>a.identityScope==='version'&&a.relationType==='contains_version'&&a.targetVersionId===t.versionId));
  const source=sources.find(s=>sourceReleaseMatches(s,r)&&rawReleases.filter(x=>sourceReleaseMatches(s,x)).length===1);
  if(!unambiguous&&!explicit&&!source&&!(solo&&SIRIUS_SOLO_RELEASES.includes(r.releaseItemId)))continue;
  const cover=known(candidates.map(x=>safeSongUrl(x.imageUrl))),shared=SHARED_RELEASE_TRACKLISTS.some(x=>x.familyId===r.family?.familyId&&x.title===r.family?.title);
  const image=rankArtworkCandidates(registered.map(x=>({kind:'release',imageUrl:x.imageUrl,sourceUrl:x.sourceUrl})))[0];
  releases.push({...r,imageUrl:image?.imageUrl??(cover?.startsWith('https:')?cover:source?.imageUrl??null),imageSourceUrl:image?.sourceUrl??source?.url??records.find(x=>x.releases.some(y=>candidates.includes(y)))?.sourceUrl??null,editionLabel:shared?null:r.edition?.editionKind==='digital'?'配信':r.edition?.editionName??null});
 }
 // A registered external product remains an external link until it has an
 // actual catalogue family. Never invent a DB family ID or an empty detail.
 for(const source of sources)if(rawReleases.filter(r=>sourceReleaseMatches(source,r)).length!==1)releases.push({
  releaseItemId:'registered:'+source.key,family:{title:source.title,releaseKind:'single'},
  edition:{editionKind:'digital',releaseDate:source.releaseDate??null,catalogNumber:source.catalogNumber??null},
  trackNumber:source.trackNumber??null,editionLabel:'配信',externalUrl:source.url,imageUrl:source.imageUrl??null,imageSourceUrl:source.url});
 return [...releases,...arr(additionalReleases).filter(r=>!releases.some(existing=>existing.releaseItemId===r.releaseItemId))];
}
function songLivesForEntry(entry,eventRecords=EVENT_ARTWORK_RECORDS,additionalLives=[]){
 const lives=new Map();
 for(const h of arr(entry.history))for(const ev of arr(h.relatedEvents)){
  const key=ev.eventId+'|'+str(h.occurredOn),previous=lives.get(key),uncertain=h.matchBasis==='same_version_only'&&h.singerSetConfirmedForEntry!==true;
  lives.set(key,{eventId:ev.eventId,title:ev.title,date:h.occurredOn??null,uncertain:previous?previous.uncertain&&uncertain:uncertain});
 }
 for(const live of additionalLives){const key=live.eventId+'|'+str(live.date);if(!lives.has(key))lives.set(key,live);}
 return [...lives.values()].map(live=>({...live,imageUrl:eventArtworkForEvent(live,eventRecords)?.imageUrl??null})).sort((a,b)=>str(b.date).localeCompare(str(a.date)));
}
function artworkCandidates(entry,videos,releases,lives,{entryRecords=ARTWORK_RECORDS,releaseRecords=RELEASE_ARTWORK_RECORDS,eventRecords=EVENT_ARTWORK_RECORDS,sourceExclusions}={}){
 const candidates=catalogArtworkCandidatesForEntry(entry,entryRecords).map(c=>({...c,date:c.date??videos.find(v=>youtubeId(v.url)&&youtubeId(v.url)===youtubeId(c.sourceUrl))?.publishedOn??null}));
 const kinds={music_video:'mv',cover_video:'cover',cover_duet_video:'cover',live_video:'live_mv',opening_video:'other_video',official_audio:'other_video'};
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
 const excluded=excludedSourceKeys(entry,sourceExclusions);
 return rankArtworkCandidates(candidates.filter(c=>!excluded.has(sourceKey(c.sourceUrl))));
}
/** All display surfaces and failure fallbacks share the same ordered candidates. */
export function songArtworkCandidatesForEntry(entry,work={},options={}){
 if(!entry?.detail)return [];
 return artworkCandidates(entry,songVideosForEntry(entry,work,options.sourceRecords,options.sourceExclusions,options.mediaCreditRecords),songReleasesForEntry(entry,work,options.releaseRecords,options.sourceRecords,options.additionalReleases),songLivesForEntry(entry,options.eventRecords,options.additionalLives),options);
}
export function songArtworkForEntry(entry,work={}){return songArtworkCandidatesForEntry(entry,work)[0]??null;}
export function buildSongDetail(entry,work={},options={}){
 if(!entry?.detail)return null;
 const d=entry.detail,metadata=songMetadataForEntry(entry,options.factRecords,work,options),creditData=songCreditsForEntry(entry,metadata,options.factRecords),videos=songVideosForEntry(entry,work,options.sourceRecords,options.sourceExclusions,options.mediaCreditRecords),releases=songReleasesForEntry(entry,work,options.releaseRecords,options.sourceRecords,options.additionalReleases),allLives=songLivesForEntry(entry,options.eventRecords,options.additionalLives);
 const images=artworkCandidates(entry,videos,releases,allLives,options);
 const vocalCredit=vocalDisplayCreditForEntry(entry);
 return {detail:{...d,...(vocalCredit?{vocalDisplayCredit:vocalCredit}:{}),legacySongType:songTypeForEntry(entry,options.sourceRecords,options.factRecords),singers:singersForEntry(entry)},metadata,credits:creditData.rows,originalCredits:creditData.originalCredits,originalArranger:creditData.originalArranger,...(creditData.originalArrangerCredit?{originalArrangerCredit:creditData.originalArrangerCredit}:{}),
  artwork:images[0]??null,artworkCandidates:images,listenUrl:videos[0]?.url??known(registeredSongFactsForEntry(entry,options.factRecords).map(r=>safeSongUrl(r.listenUrl)))??releases.find(r=>r.externalUrl)?.externalUrl??null,videos,releases,lives:allLives,
  hasUncertainLives:allLives.some(x=>x.uncertain),comparison:entry.compare??null,
  versionLabel:d.entryId===SIRIUS_DUET&&d.primaryWorkId===SIRIUS_WORK?'デュエット':null};
}
export function songDetailFromModel(model,entryId){
 const entry=model.entries.get(entryId);if(!entry)return null;
 return buildSongDetail(entry,model.works.get(entry.detail.primaryWorkId)??{},{additionalLives:supplementalLivesForEntry(model,entryId),additionalReleases:supplementalReleasesForEntry(model,entryId)});
}
