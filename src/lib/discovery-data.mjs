// Derived from each displayed vocal form's resources, never from a song title
// or singer count. Registered destinations and current full listening differ.
import {songDetailFromModel,youtubeId,safeSongUrl} from './song-detail-data.mjs';
import {isLiveRelease} from './release-detail-data.mjs';
import {EVENT_ARTWORK_RECORDS} from './catalog-artwork-data.mjs';
import eventSources from './discovery-event-data.json' with {type:'json'};

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
const sourceLabel=x=>str(x).normalize('NFKC').toLowerCase().replace(/[\s「」『』“”"'・:：~〜～－—–-]/g,'');
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

function eventSource(event,metadata){
 const d=event?.detail;if(!d)return null;
 const saved=arr(metadata.events??eventSources.events).filter(e=>e.eventId===d.eventId&&e.title===d.title&&
  arr(event.occurrences).some(o=>o.officialDate===e.date));
 const record=saved.length===1?saved[0]:null;
 const format=event.filterMetadata?.format??d.eventKind;
 if(['one_man','concert','festival','joint_live','mini_live','cover_live'].includes(format))return {category:'live_event',record};
 if(record?.kind==='stream')return {category:channelCategory({authorUrl:record.channelUrl},metadata),record};
 if(['stream','livestream','broadcast','talk_event'].includes(format))return null;
 if(record?.kind==='live')return {category:'live_event',record};
 // A poster's official source identifies a known concert, not its singers.
 if(EVENT_ARTWORK_RECORDS.some(e=>e.eventId===d.eventId&&e.title===d.title&&arr(event.occurrences).some(o=>o.officialDate===e.officialDate)))return {category:'live_event',record};
 const labels=[d.title,...arr(d.eventSeries).map(s=>s.title)].join(' ');
 // Do not use Live2D, renditionKind, or membership in the event directory as
 // evidence of a concert. Unknown streams remain unclassified without a channel.
 if(/生配信|記念配信|歌枠|拡声の会|ARIA[- –]ISEKAIJOUCHO|夜会/i.test(labels))return null;
 return /\blive\b|ライブ|\bfes\b|festival|音楽祭|ANISAMA|XPERIENCE|Music Award/i.test(labels)?{category:'live_event',record}:null;
}
function originEvent(model,first,metadata){
 if(!first?.date||!sourceLabel(first.label))return null;
 const matches=[...model.events?.values()??[]].filter(event=>{
  const d=event.detail,record=eventSource(event,metadata)?.record;
  const labels=[d.title,...arr(d.eventSeries).map(s=>s.title),...arr(record?.aliases)];
  return arr(event.occurrences).some(o=>o.officialDate===first.date)&&labels.some(label=>sourceLabel(label)===sourceLabel(first.label));
 });
 return matches.length===1?matches[0]:null;
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

/** Reuse song detail's version-scoped media/products and its identity-checked
 * first appearance. A same-version candidate alone still supplies no route. */
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
 const seen=new Set(),addEvent=(event,date,basis)=>{
  const source=eventSource(event,metadata),d=event?.detail;if(!source||source.category==='unclassified')return;
  const key=d.eventId+'|'+str(date);if(seen.has(key))return;seen.add(key);
  routes.push({key:'event:'+key,kind:'performance',category:source.category,exactEntry:true,label:d.title,sourceUrl:'/lives/'+d.eventId,
   date:date??null,evidenceBasis:basis,current:false,coverage:'unknown',access:'unknown'});
 };
 for(const h of arr(entry.history))if(['explicit_part','legacy_rendition'].includes(h.matchBasis)&&h.multiWork!==true)for(const event of arr(h.relatedEvents))
  addEvent(model.events?.get(event.eventId),h.occurredOn,'direct_history');
 // Own origin metadata is separate evidence; this does not confirm any
 // same_version_only history, cast, whole-song coverage, or playable archive.
 const first=song.metadata.firstAppearance,origin=originEvent(model,first,metadata);
 if(origin)addEvent(origin,first.date,'entry_first_appearance');
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
