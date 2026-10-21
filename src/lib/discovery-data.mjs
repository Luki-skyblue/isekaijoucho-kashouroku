// Derived from each displayed vocal form's resources, never from a song title
// or singer count. Registered destinations and current full listening differ.
import {songDetailFromModel,youtubeId,safeSongUrl} from './song-detail-data.mjs';
import {isLiveRelease} from './release-detail-data.mjs';

export const DISCOVERY_CATEGORIES=[
 {id:'isekai_official',label:'ヰ世界情緒公式'},
 {id:'vwp_official',label:'V.W.P公式'},
 {id:'other_channel',label:'その他のYouTube'},
 {id:'cd_album',label:'CD・配信'},
 {id:'live_event',label:'LIVE'},
 {id:'other',label:'その他'},
 {id:'unclassified',label:'未分類'},
];
const arr=x=>Array.isArray(x)?x:[],str=x=>typeof x==='string'?x:'';
const categoryIds=new Set(DISCOVERY_CATEGORIES.map(c=>c.id)),compare=(a,b)=>a<b?-1:a>b?1:0;
export function youtubeChannelKey(value){
 try{
  const u=new URL(value);if(u.protocol!=='https:'||!['youtube.com','www.youtube.com'].includes(u.hostname)||u.port||u.username||u.password||u.search||u.hash)return null;
  const path=decodeURIComponent(u.pathname).replace(/\/$/,'');
  return /^\/@[^/?#]+$|^\/channel\/UC[\w-]+$/.test(path)?path.startsWith('/@')?path.toLowerCase():path:null;
 }catch{return null;}
}
function channelCategory(record,metadata){
 const key=youtubeChannelKey(record?.authorUrl);if(!key)return 'unclassified';
 const matches=arr(metadata?.officialChannels).filter(c=>arr(c.urls).some(url=>youtubeChannelKey(url)===key));
 const roles=[...new Set(matches.map(c=>c.category))];
 if(roles.length>1)return 'unclassified';
 return roles.length===1&&['isekai_official','vwp_official'].includes(roles[0])?roles[0]:'other_channel';
}

/** Pure ranker. All facts are inputs. oEmbed success is NOT free/full/current.
 * Unknown channels/categories remain unknown, not negative findings or other.
 * Performance history is not a currently playable source. */
export function classifyDiscoveryRoutes(routes){
 const candidates=arr(routes).filter(r=>r.exactEntry===true&&categoryIds.has(r.category));
 const rank=r=>DISCOVERY_CATEGORIES.findIndex(c=>c.id===r.category);
 const ordered=[...candidates].sort((a,b)=>rank(a)-rank(b)||compare(str(a.date)||'9999',str(b.date)||'9999')||compare(str(a.key),str(b.key)));
 const primary=ordered.find(r=>r.category!=='unclassified')??null;
 const currentFull=ordered.find(r=>r.category!=='unclassified'&&r.kind!=='performance'&&r.current===true&&r.coverage==='full'&&
  (['isekai_official','vwp_official','other_channel'].includes(r.category)?r.access==='free':['free','purchase','subscription'].includes(r.access)))??null;
 return {category:primary?.category??'unclassified',primary,currentFullCategory:currentFull?.category??null,currentFullSource:currentFull,candidates:ordered};
}

/** Reuse song detail's version-scoped eligibility for media/products. A shared
 * work or same-version LIVE candidate alone does not classify this vocal form. */
export function discoveryRoutesForEntry(model,entryId,metadata={}){
 const entry=model.entries.get(entryId);if(!entry)return [];
 const song=songDetailFromModel(model,entryId),work=model.works.get(entry.detail.primaryWorkId),routes=[];
 for(const video of song.videos){
  const videoId=youtubeId(video.url),records=arr(metadata.videos).filter(r=>r.videoId===videoId),record=records.length===1?records[0]:null;
  const media=arr(work?.media).find(m=>m.mediaId===video.mediaId),publication=arr(media?.publications).find(p=>safeSongUrl(p.url)===safeSongUrl(video.url));
  // Only explicitly recorded listening facts can qualify a current full route.
  // Current schema availability is unknown; do not turn metadata reads into it.
  routes.push({key:'media:'+video.mediaId+':'+video.url,kind:videoId?'youtube':'other',category:videoId?channelCategory(record,metadata):'other',
   exactEntry:true,label:str(record?.authorName)||video.title||'動画',sourceUrl:video.url,date:video.publishedOn,
   current:publication?.availability==='unavailable'?false:null,coverage:'unknown',access:'unknown'});
 }
 for(const release of song.releases){
  const family=release.family??{},detail=model.releases.get(family.familyId)?.detail??family;
  routes.push({key:'release:'+release.releaseItemId,kind:'release',category:isLiveRelease(detail)?'live_event':'cd_album',exactEntry:true,
   label:family.title||'収録作品',sourceUrl:'/releases/'+family.familyId,date:release.edition?.releaseDate??null,current:null,coverage:'unknown',access:'unknown'});
 }
 const seen=new Set();
 for(const h of arr(entry.history))if(['explicit_part','legacy_rendition'].includes(h.matchBasis)&&h.multiWork!==true)for(const event of arr(h.relatedEvents)){
  const key=event.eventId+'|'+str(h.occurredOn);if(seen.has(key))continue;seen.add(key);
  routes.push({key:'event:'+key,kind:'performance',category:'live_event',exactEntry:true,label:event.title||'LIVE',sourceUrl:'/lives/'+event.eventId,date:h.occurredOn??null,current:false,coverage:'unknown',access:'unknown'});
 }
 return routes;
}
const cache=new WeakMap();
function indexFor(model,metadata){
 let byMetadata=cache.get(model);if(!byMetadata){byMetadata=new WeakMap();cache.set(model,byMetadata);}
 if(byMetadata.has(metadata))return byMetadata.get(metadata);
 const rows=[...model.entries].map(([entryId,entry])=>{
  const result=classifyDiscoveryRoutes(discoveryRoutesForEntry(model,entryId,metadata)),d=entry.detail;
  return {entryId,title:d.title,displayCredit:str(d.displayCredit)||arr(d.singers).map(s=>str(s.name)).filter(Boolean).join('・'),category:result.category,
   currentFullCategory:result.currentFullCategory,sortTitle:str(entry.sortTitle)||d.title};
 }).sort((a,b)=>compare(a.sortTitle,b.sortTitle)||compare(a.entryId,b.entryId));
 byMetadata.set(metadata,rows);return rows;
}
const emptyMetadata={};
export function discoveryFromModel(model,{category='isekai_official',page=1}={},metadata=emptyMetadata){
 const rows=indexFor(model,metadata),selected=categoryIds.has(category)?category:'isekai_official',filtered=rows.filter(r=>r.category===selected),limit=24;
 const pages=Math.max(1,Math.ceil(filtered.length/limit));page=Number.isSafeInteger(page)&&page>0?Math.min(page,pages):1;
 const items=filtered.slice((page-1)*limit,page*limit).map(row=>{
  const song=songDetailFromModel(model,row.entryId);return {entryId:row.entryId,title:row.title,displayCredit:row.displayCredit,thumbnailUrl:song.artwork?.imageUrl??null,thumbnailUrls:song.artworkCandidates.map(x=>x.imageUrl)};
 });
 return {category:selected,page,pages,total:filtered.length,allEntries:rows.length,categories:DISCOVERY_CATEGORIES.map(c=>({...c,count:rows.filter(r=>r.category===c.id).length})),items};
}
