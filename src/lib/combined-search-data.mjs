// One read-only search over the same identity-checked projections as the pages.
// No remote queries, database writes, title-based joins or inferred memberships.
import {readCombinedSearch,fieldFor,SEARCH_FIELDS,SOURCE_SEARCH_OPTIONS} from './combined-search-query.mjs';
import {songDetailFromModel,songTitleCaptionForEntry} from './song-detail-data.mjs';
import {songDisplayTitle} from './catalog-song-title.mjs';
import {discoveryRoutesForEntry} from './discovery-data.mjs';
import {sourceKindsForRoutes} from './catalog-source-data.mjs';
import {searchPeopleIndexFromModel,creditFilterChoicesFromModel,creditMatchingEntries} from './person-detail-data.mjs';
import {creditRoleLabel,orderedCreditRoles} from './catalog-credit-labels.mjs';
import {queryEvents} from './private-read-model.mjs';
import {liveDisplayContextFromModel} from './live-detail-data.mjs';
import {releaseListFromModel} from './release-list-data.mjs';
import {releaseDisplayContextFromModel,releaseMediaLabel,releaseKindLabel} from './release-detail-data.mjs';
import {recordedEventsForRelease} from './live-release-links.mjs';
import {eventArtworkForEvent} from './catalog-artwork.mjs';
import {liveHeading} from './live-heading.mjs';
import {SONG_TYPE_LABELS} from './catalog-song-classification.mjs';

const arr=x=>Array.isArray(x)?x:[],str=x=>typeof x==='string'?x:'',unique=x=>[...new Set(x.filter(v=>v!==null&&v!==undefined&&v!==''))];
const norm=x=>str(x).normalize('NFKC').toLocaleLowerCase('ja').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/[\s\u3000]+/g,' ').trim();
const order=(a,b)=>str(a).localeCompare(str(b),'ja',{numeric:true});
const scalarOrder=(a,b)=>a<b?-1:a>b?1:0;
const cache=new WeakMap();
const videoLabels={music_video:'MV',mv:'MV',cover_video:'歌ってみた',cover_duet_video:'歌ってみた（デュエット）',live_video:'LIVE MV',live_music_video:'LIVE MV',live_mv:'LIVE MV',community_edit_live_video:'ライブ映像（編集版）',lyric_video:'リリックMV',opening_video:'オープニング映像',official_audio:'公式音源',other:'その他'};
const formatLabels={one_man:'ワンマン',festival:'フェス',broadcast:'配信',talk_event:'トーク',unclassified:'未分類'};
const songLabels={...SONG_TYPE_LABELS,medley:'メドレー'};
const personLabels={artist:'アーティスト',creator:'クリエイター',group:'グループ',character:'キャラクター',voicebank:'音声ライブラリ',musical_isotope:'音楽的同位体',unknown:'種類未登録'};
const mediumFor={cd:'cd',cd_set:'cd',digital:'digital',blu_ray:'blu_ray',dvd:'dvd',download_card:'download_card'};
function allReleases(model){return ['music','live'].flatMap(category=>{
 const first=releaseListFromModel(model,{category,page:1}),rows=[...first.items];
 for(let page=2;page<=first.pages;page++)rows.push(...releaseListFromModel(model,{category,page}).items);return rows;
});}
function allEvents(model){const result=queryEvents(model,{limit:100,offset:0}),rows=[...result.items];for(let offset=100;offset<result.total;offset+=100)rows.push(...queryEvents(model,{limit:100,offset}).items);return rows;}
function makeIndex(model,metadata){
 const choices={};const maps=new Map();
 const add=(key,id,label,aliases=[])=>{if(!id||!label)return;if(!maps.has(key))maps.set(key,new Map());if(!maps.get(key).has(id))maps.get(key).set(id,{id,label,aliases});};
 for(const x of SOURCE_SEARCH_OPTIONS)add('sources',x.id,x.label);
 for(const [id,label]of [['vocal','歌唱'],['billing','歌唱名義'],['music','楽曲制作'],['cover_source','カバー原曲'],['production','映像・音源制作']])add('involvements',id,label);
 for(const [id,label]of [['music','リリース'],['live','LIVE音源・映像']])add('releaseCategories',id,label);
 const releases=allReleases(model),releaseByHref=new Map(releases.map(r=>[r.href,r.key]));
 for(const r of releases)add('releases',r.key,r.title+(r.date?' · '+r.date:''));
 const songs=[],songRows=new Map();
 for(const [id,entry]of model.entries){
  const song=songDetailFromModel(model,id),d=song.detail,title=songDisplayTitle(d),routes=discoveryRoutesForEntry(model,id,metadata);
  const source=sourceKindsForRoutes(routes);
  for(const r of routes)if(r.exactEntry===true&&r.kind==='youtube'&&r.current!==false){const specific={isekai_official:'youtube_isekai',vwp_official:'youtube_vwp',other_channel:'youtube_other'}[r.category];if(specific)source.push(specific);}
  const releaseIds=unique(song.releases.map(r=>r.externalUrl?releaseByHref.get(r.externalUrl):r.family?.familyId));
  const events=unique(routes.filter(r=>r.exactEntry===true&&r.kind==='performance'&&r.sourceUrl?.startsWith('/lives/')).map(r=>r.sourceUrl.slice('/lives/'.length)));
  const singers=arr(d.singers);for(const s of singers)add('singers',s.entityId,s.name);
  const kind=d.kind==='medley'?'medley':d.legacySongType;if(kind)add('songKinds',kind,songLabels[kind]??kind);
  for(const v of song.videos)if(v.kind)add('videoKinds',v.kind,videoLabels[v.kind]??v.kind);
  add('songs',id,title+' · '+songTitleCaptionForEntry(entry));
  const names=[d.title,song.metadata.titleKana,title],billing=songTitleCaptionForEntry(entry),creditText=[...song.credits.flatMap(c=>[...arr(c.names),c.value]),...song.originalCredits.map(c=>c.name),...song.videos.flatMap(v=>v.credits.map(c=>c.name))];
  const row={id,href:'/songs/'+id,title,sortName:entry.sortTitle??d.title,subtitle:billing,date:song.metadata.firstAppearance?.date??null,
   meta:songLabels[kind]??'',imageUrl:song.artwork?.imageUrl??null,imageUrls:song.artworkCandidates.map(c=>c.imageUrl),
   values:{title:names,billing:[billing],singer:singers.map(s=>s.entityId),song_kind:[kind],first_date:song.metadata.firstAppearance?.date??null,
    source:unique(source),release:releaseIds,event:events,tie_up:arr(Array.isArray(song.metadata.tieUp)?song.metadata.tieUp:[song.metadata.tieUp]).map(v=>typeof v==='string'?v:v?.title).filter(Boolean),
    video_title:song.videos.map(v=>v.title).filter(Boolean),video_kind:unique(song.videos.map(v=>v.kind)),
    keyword:[...names,billing,...singers.map(s=>s.name),...creditText,song.metadata.originalArtist,song.metadata.originalVocal,...song.videos.map(v=>v.title),...song.releases.map(r=>r.family?.title),...song.lives.map(l=>l.title)].filter(Boolean)},
   singerComplete:entry.candidateSetExhaustive===true,hasCredit:creditText.some(Boolean)};
  songs.push(row);songRows.set(id,row);
 }
 const lives=allEvents(model).map(event=>{
  const id=event.eventId,saved=model.events.get(id),context=liveDisplayContextFromModel(model,id),title=event.title;
  add('events',id,title+(event.firstOfficialDate?' · '+event.firstOfficialDate:''));
  for(const p of [...arr(event.billingArtists),...arr(context?.performers)])add('artists',p.entityId??p.id,p.name);
  if(event.liveFormat)add('liveFormats',event.liveFormat,formatLabels[event.liveFormat]??event.liveFormat);
  const songIds=unique(Object.values(context?.programLinks??{}).map(l=>l.entryId));
  // Exact registered origin/history links supplement set-list correspondences.
  for(const s of songs)if(s.values.event.includes(id))songIds.push(s.id);
  const releaseIds=unique(arr(context?.recordings).map(r=>r.familyId)),venue=arr(saved?.occurrences).map(o=>o.venueName).filter(Boolean);
  return {id,href:'/lives/'+id,title,subtitle:context?.billingLabel??liveHeading(event),date:event.firstOfficialDate??null,meta:'',imageUrl:eventArtworkForEvent(saved??event)?.imageUrl??event.thumbnailUrl??null,imageUrls:[],
   values:{title:[title,...arr(saved?.detail.localizedTitles).map(x=>x.title)],date:event.firstOfficialDate??null,artist:arr(context?.performers).map(p=>p.entityId),billing_artist:arr(event.billingArtists).map(p=>p.entityId??p.id),
    live_format:event.liveFormat?[event.liveFormat]:[],venue,song:unique(songIds),release:releaseIds,
    keyword:[title,context?.billingLabel,...venue,...arr(context?.performers).map(p=>p.name),...arr(saved?.programs).flatMap(p=>arr(p.items).map(i=>i.rawTitle)),...unique(songIds).map(songId=>songRows.get(songId)?.title),...arr(context?.recordings).map(r=>r.title)].filter(Boolean)}};
 });
 const releaseRows=releases.map(r=>{
  const saved=r.familyId?model.releases.get(r.familyId):null,d=saved?.detail,context=saved?releaseDisplayContextFromModel(model,r.familyId):null;
  const songIds=unique(Object.values(context?.itemLinks??{}).map(l=>l.entryId));for(const s of songs)if(s.values.release.includes(r.key))songIds.push(s.id);
  const events=saved?unique(recordedEventsForRelease(model,r.familyId).map(e=>e.eventId)):[],kind=d?.releaseKind??'single',media=saved?unique(arr(d.components).map(c=>mediumFor[c.componentKind])):['digital'];
  add('releaseKinds',kind,kind==='other'?'その他':releaseKindLabel(kind)||r.kindLabel||kind);for(const m of media)add('media',m,m==='dvd'?'DVD':releaseMediaLabel(m)||m);
  return {id:r.key,href:r.href,external:r.external,title:r.title,subtitle:r.displayCredit??'',date:r.date,meta:r.kindLabel??'',imageUrl:r.thumbnailUrl,imageUrls:r.thumbnailUrls??[],
   values:{title:[r.title,...arr(d?.localizedTitles).map(t=>t.title)],billing:[r.displayCredit].filter(Boolean),date:r.date,release_category:[r.category],release_kind:[kind],media,
    catalog_number:arr(d?.editions).map(e=>e.catalogNumber).filter(Boolean),song:unique(songIds),event:events,
    keyword:[r.title,r.displayCredit,r.kindLabel,...arr(d?.editions).flatMap(e=>[e.name,e.catalogNumber]),...arr(saved?.items).map(i=>i.rawTitle),...unique(songIds).map(songId=>songRows.get(songId)?.title),...events.map(eventId=>model.events.get(eventId)?.detail.title)].filter(Boolean)}};
 });
 const people=searchPeopleIndexFromModel(model).map(p=>{
  for(const r of p.roles)add('roles',r,creditRoleLabel(r));add('personKinds',p.kind,personLabels[p.kind]??p.kindLabel);
  for(const g of p.groups)add('groups',g.id,g.name);
  const roles=orderedCreditRoles(p.roles).map(creditRoleLabel);
  return {id:p.key,href:'/people/'+p.key,title:p.name,subtitle:roles.length>3?roles.slice(0,2).join('・')+'・ほか':roles.join('・'),meta:`関連楽曲 ${p.songCount}`,songCount:p.songCount,imageUrl:null,imageUrls:[],
   values:{title:[p.name,...p.aliases],involvement:p.involvements,person_kind:[p.kind],role:p.roles,related_count:p.songCount,group:p.groups.map(g=>g.id),song:p.entryIds,
    keyword:[p.name,...p.aliases,...roles,p.kindLabel,...p.groups.map(g=>g.name),...p.entryIds.map(entryId=>songRows.get(entryId)?.title)].filter(Boolean)}};
 });
 const creators=creditFilterChoicesFromModel(model);for(const p of creators.people)add('creators',p.key,p.name,p.aliases);
 for(const r of creators.roles)add('creditRoles',r.id,r.label);
 for(const [key,map]of maps)choices[key]=[...map.values()].sort((a,b)=>order(a.label,b.label)||order(a.id,b.id));
 // Keep the broad source choices together, followed by channel refinements.
 choices.sources=SOURCE_SEARCH_OPTIONS;return {rows:{songs,lives,releases:releaseRows,people},choices};
}
function searchIndex(model,metadata){let byMetadata=cache.get(model);if(!byMetadata){byMetadata=new Map();cache.set(model,byMetadata);}if(!byMetadata.has(metadata))byMetadata.set(metadata,makeIndex(model,metadata));return byMetadata.get(metadata);}
const defaultMetadata={};

/** Three values: missing information remains unknown under NOT. Only explicit
 * '登録なし' queries select unknown values. All/any propagate unknown normally. */
export function combineSearchTruth(values,match='all',negate=false){
 const result=match==='all'?(values.includes(false)?false:values.includes(null)?null:true):(values.includes(true)?true:values.includes(null)?null:false);
 return result===null?null:negate?!result:result;
}
function present(value){return Array.isArray(value)?value.some(v=>v!==null&&v!==undefined&&v!==''):value!==null&&value!==undefined&&value!=='';}
export function evaluateSearchRule(rule,row,creditMatches=null,creditKnown=null){
 const value=rule.field==='credit'?(row.hasCredit?true:null):row.values[rule.field],known=present(value);
 if(rule.op==='exists')return known;if(rule.op==='missing')return !known;if(!known)return null;
 const chosen=rule.value;
 if(rule.field==='credit'){if(creditKnown&&!creditKnown.has(row.id))return null;const match=creditMatches?.has(row.id)??false;return rule.op==='not_matches'?!match:match;}
 if(['contains','equals','not_contains'].includes(rule.op)){
  const target=norm(chosen),found=(Array.isArray(value)?value:[value]).some(v=>rule.op==='equals'?norm(v)===target:norm(v).includes(target));return rule.op==='not_contains'?!found:found;
 }
 if(['any','all','none','only','subset'].includes(rule.op)){
  const values=new Set(value),some=chosen.some(x=>values.has(x)),all=chosen.every(x=>values.has(x));
  if(rule.field==='singer'&&['only','subset','none'].includes(rule.op)&&!row.singerComplete)return null;
  return rule.op==='any'?some:rule.op==='all'?all:rule.op==='none'?!some:rule.op==='only'?all&&values.size===chosen.length:[...values].every(x=>chosen.includes(x));
 }
 const number=typeof value==='number',from=chosen.from?(number?Number(chosen.from):chosen.from):null,to=chosen.to?(number?Number(chosen.to):chosen.to):null;
 return rule.op==='gte'?value>=from:rule.op==='lte'?value<=from:rule.op==='eq'?value===from:(from===null||value>=from)&&(to===null||value<=to);
}
export function evaluateSearchTree(tree,row,creditSets=new Map()){
 if(tree.type==='rule'){const credit=creditSets.get(JSON.stringify(tree.value));return evaluateSearchRule(tree,row,credit instanceof Set?credit:credit?.matches??null,credit instanceof Set?null:credit?.known??null);}
 return combineSearchTruth(tree.children.map(child=>evaluateSearchTree(child,row,creditSets)),tree.match,tree.not);
}
function validateChoices(tree,target,choices,errors){
 if(tree.type==='group'){tree.children.forEach(c=>validateChoices(c,target,choices,errors));return;}
 if(['exists','missing'].includes(tree.op))return;
 const def=fieldFor(target,tree.field);
 if(def.kind==='set'&&tree.value.some(id=>!arr(choices[def.choices]).some(c=>c.id===id)))errors.push(`${def.label}に現在の登録情報にない選択があります。選び直してください。`);
 if(def.kind==='credit'&&((tree.value.person&&!choices.creators.some(c=>c.id===tree.value.person))||(tree.value.role&&!choices.creditRoles.some(c=>c.id===tree.value.role))))errors.push('制作担当に現在の登録情報にない選択があります。選び直してください。');
}
function collectCredits(tree,model,sets){if(tree.type==='group')tree.children.forEach(c=>collectCredits(c,model,sets));else if(tree.field==='credit'&&!['exists','missing'].includes(tree.op)){const key=JSON.stringify(tree.value);if(!sets.has(key))sets.set(key,{matches:creditMatchingEntries(model,tree.value.person,tree.value.role),known:tree.value.role?creditMatchingEntries(model,'',tree.value.role):null});}}
export function combinedSearchFromModel(model,raw={},metadata=defaultMetadata){
 const query=readCombinedSearch(raw),index=searchIndex(model,metadata),errors=[...query.errors];
 if(query.tree)validateChoices(query.tree,query.target,index.choices,errors);
 const creditSets=new Map();if(!errors.length)collectCredits(query.tree,model,creditSets);
 const matches=errors.length?[]:index.rows[query.target].filter(row=>evaluateSearchTree(query.tree,row,creditSets)===true),sort=query.sort;
 matches.sort((a,b)=>{
  if(sort.startsWith('date_')){if(!a.date||!b.date){if(a.date!==b.date)return a.date?-1:1;}else if(a.date!==b.date)return (sort==='date_desc'?-1:1)*order(a.date,b.date);}
  if(sort.startsWith('related_')&&a.songCount!==b.songCount)return (sort==='related_desc'?-1:1)*(a.songCount-b.songCount);
  const names=query.target==='songs'?scalarOrder(a.sortName,b.sortName):order(a.title,b.title);
  return (sort==='title_desc'?-1:1)*names||order(a.id,b.id);
 });
 const limit=24,pages=Math.max(1,Math.ceil(matches.length/limit)),page=Math.min(query.page,pages);
 const choiceKeys=SEARCH_FIELDS[query.target].flatMap(f=>f.choices?[f.choices]:f.kind==='credit'?['creators','creditRoles']:[]);
 return {...query,errors:[...new Set(errors)],choices:Object.fromEntries([...new Set(choiceKeys)].map(key=>[key,index.choices[key]??[]])),total:matches.length,page,pages,limit,
  items:matches.slice((page-1)*limit,page*limit).map(({values,singerComplete,hasCredit,sortName,...card})=>card)};
}
