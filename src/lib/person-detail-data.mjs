// Shared identity and whole-credit index. Displayed roles keep their original
// scope; neither billing nor entity resolution verifies a performance.
import {songDetailFromModel,songArtworkCandidatesForEntry} from './song-detail-data.mjs';
import {creditNameKey,personKeyForCredit,entityForId,singersForEntry,billingPeopleForEntry,membershipsForEntity} from './catalog-people.mjs';
import {catalogNameMatches} from './catalog-name-search.mjs';
import {creditRoleLabel,orderedCreditRoles,songCreditRole} from './catalog-credit-labels.mjs';
export {creditNameKey} from './catalog-people.mjs';

const arr=x=>Array.isArray(x)?x:[],text=x=>typeof x==='string'?x:'';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cache=new WeakMap();
const compare=(a,b)=>a<b?-1:a>b?1:0;
export function validPersonKey(key){return typeof key==='string'&&(uuid.test(key)||/^credit-[a-f0-9]{64}$/.test(key));}

/** Link only whole, explicitly named singers in this entry's display credit.
 * Keep every character of raw billing, including unresolved partners/groups.
 * Character names are not replaced with the performer behind that character. */
export function singerCreditParts(detail){
 const singers=arr(detail?.singers),fallback=singers.map(s=>text(s?.name)).filter(Boolean).join('・');
 const value=text(detail?.displayCredit)||fallback,byName=new Map();
 for(const singer of singers){
  const name=text(singer?.name),id=text(singer?.entityId);if(!name||!uuid.test(id))continue;
  for(const spelling of [name,...arr(entityForId(id)?.aliases)]){
   if(!byName.has(spelling))byName.set(spelling,new Set());byName.get(spelling).add(id);
  }
 }
 const candidates=[...byName].filter(([,ids])=>ids.size===1).map(([name,ids])=>({name,id:[...ids][0]})).sort((a,b)=>b.name.length-a.name.length||compare(a.name,b.name));
 const boundary=c=>c===undefined||/[\s・･·×✕✖&＆+＋/／,，、（）()「」【】\[\]<>〈〉]/u.test(c);
 const parts=[];let plain='';
 for(let at=0;at<value.length;){
  const match=candidates.find(c=>value.startsWith(c.name,at)&&boundary(value[at-1])&&boundary(value[at+c.name.length]));
  if(!match){plain+=value[at++];continue;}
  if(plain){parts.push({text:plain,personKey:null});plain='';}
  parts.push({text:match.name,personKey:match.id});at+=match.name.length;
 }
 if(plain)parts.push({text:plain,personKey:null});return parts;
}

function indexFor(model){
 if(cache.has(model))return cache.get(model);
 const people=new Map(),aliases=new Map(),billedGroups=new Map();
 function add(key,name,entryId,role){
  if(!key||!name)return;
  const entity=entityForId(key);
  if(!people.has(key))people.set(key,{key,name:entity?.name??name,aliases:arr(entity?.aliases),type:entity?.type??'credit',roles:new Set(),songs:new Map()});
  const person=people.get(key);person.roles.add(role);
  const oldKey=creditNameKey(name);if(!aliases.has(oldKey))aliases.set(oldKey,new Set());aliases.get(oldKey).add(key);
  if(!person.songs.has(entryId))person.songs.set(entryId,new Set());person.songs.get(entryId).add(role);
 }
 for(const [entryId,entry]of model.entries){
  const song=songDetailFromModel(model,entryId);
  for(const singer of singersForEntry(entry))if(uuid.test(text(singer.entityId)))add(singer.entityId,text(singer.name),entryId,'vocal');
  const billing=billingPeopleForEntry(entry);billedGroups.set(entryId,new Set(billing.filter(p=>p.type==='group').map(p=>p.id)));
  for(const entity of billing)if(entity.type==='group'||!song.detail.singers.some(s=>s.entityId===entity.id))add(entity.id,entity.name,entryId,'artist');
  for(const credit of song.credits)for(const person of credit.people)add(person.personKey,person.name,entryId,songCreditRole(entry.detail,credit));
  if(entry.detail.legacySongType==='cover')for(const credit of song.originalCredits)if(['lyricist','composer','arranger'].includes(credit.role))add(credit.personKey,credit.name,entryId,'original_'+credit.role);
  for(const video of song.videos)for(const credit of video.credits)add(personKeyForCredit(credit.name,[credit]),credit.name,entryId,`video:${credit.role}`);
 }
 const result={people,aliases,billedGroups};cache.set(model,result);return result;
}
const roleLabels=values=>orderedCreditRoles(values).map(creditRoleLabel);
const presentation=person=>entityForId(person.key)?.presentation;
const kindLabels={artist:'アーティスト',creator:'クリエイター',group:'グループ',character:'キャラクター',voicebank:'音声ライブラリ',musical_isotope:'音楽的同位体'};
const kindLabel=person=>kindLabels[presentation(person)?.kind]??(person.key.startsWith('credit-')?'クリエイター':'関係者');
export function personDetailFromModel(model,key,{page=1,limit=24,role='all',billing='all'}={}){
 if(!validPersonKey(key))return null;
 const index=indexFor(model),targets=index.aliases.get(key);
 const person=index.people.get(key)??(targets?.size===1?index.people.get([...targets][0]):null);if(!person)return null;
 const relations=membershipsForEntity(person.key),groups=relations.filter(r=>r.memberId===person.key).map(r=>entityForId(r.groupId));
 const members=person.type==='group'?relations.filter(r=>r.groupId===person.key).map(r=>entityForId(r.memberId)).map(e=>({key:e.id,name:e.name,href:index.people.has(e.id)?personDetailHref(e.id,{billing:person.key}):null})):null;
 const groupIdsFor=(entryId,entryRoles)=>['vocal','artist'].some(r=>entryRoles.has(r))?groups.filter(g=>index.billedGroups.get(entryId)?.has(g.id)).map(g=>g.id):[];
 const groupCounts=new Map(groups.map(g=>[g.id,[...person.songs].filter(([id,rs])=>groupIdsFor(id,rs).includes(g.id)).length]));
 const billingTabs=[...groupCounts.values()].some(n=>n>0)?[{id:'all',label:'すべて',count:person.songs.size},{id:'self',label:person.name,count:[...person.songs].filter(([id,rs])=>groupIdsFor(id,rs).length===0).length},...groups.filter(g=>groupCounts.get(g.id)>0).map(g=>({id:g.id,label:g.name,count:groupCounts.get(g.id)}))]:[];
 const activeBilling=billingTabs.some(t=>t.id===billing)?billing:'all';
 const billedSongs=[...person.songs].filter(([id,rs])=>activeBilling==='all'||(activeBilling==='self'?groupIdsFor(id,rs).length===0:groupIdsFor(id,rs).includes(activeBilling)));
 const availableRoles=new Set(billedSongs.flatMap(([,rs])=>[...rs])),activeRole=typeof role==='string'&&availableRoles.has(role)?role:'all';
 const roleTabs=[{id:'all',label:'すべて',count:billedSongs.length},...orderedCreditRoles(availableRoles).map(r=>({id:r,label:creditRoleLabel(r),count:billedSongs.filter(([,rs])=>rs.has(r)).length}))];
 const songs=billedSongs.filter(([,entryRoles])=>activeRole==='all'||entryRoles.has(activeRole)).map(([entryId,entryRoles])=>{
  const entry=model.entries.get(entryId),d=entry.detail;
  const videoOnly=[...entryRoles].every(r=>r.startsWith('video:'));
  return {entryId,href:'/songs/'+entryId+(activeRole.startsWith('video:')||videoOnly?'?tab=videos':''),title:d.title,displayCredit:text(d.displayCredit)||arr(d.singers).map(s=>text(s.name)).filter(Boolean).join('・'),roles:roleLabels(entryRoles)};
 }).sort((a,b)=>compare(text(model.entries.get(a.entryId).sortTitle)||a.title,text(model.entries.get(b.entryId).sortTitle)||b.title)||compare(a.entryId,b.entryId));
 limit=Number.isSafeInteger(limit)&&limit>0&&limit<=100?limit:24;
 const pages=Math.ceil(songs.length/limit);page=Number.isSafeInteger(page)&&page>0?Math.min(page,Math.max(pages,1)):1;
 const items=songs.slice((page-1)*limit,page*limit).map(song=>{
  const entry=model.entries.get(song.entryId),images=songArtworkCandidatesForEntry(entry,model.works.get(entry.detail.primaryWorkId));
  return {...song,thumbnailUrl:images[0]?.imageUrl??null,thumbnailUrls:images.map(x=>x.imageUrl)};
 });
 return {key:person.key,name:person.name,kindLabel:kindLabel(person),groups:groups.map(g=>({key:g.id,name:g.name,href:index.people.has(g.id)?personDetailHref(g.id):null})),members,billing:activeBilling,billingTabs,roles:roleLabels(person.roles),role:activeRole,roleTabs,total:songs.length,page,pages,items};
}

export function personDetailHref(key,{page=1,role='all',billing='all'}={}){
 const p=new URLSearchParams();if(billing&&billing!=='all')p.set('billing',billing);if(role&&role!=='all')p.set('role',role);if(page>1)p.set('page',String(page));return '/people/'+key+(p.size?'?'+p.toString():'');
}

export function peopleListFromModel(model,{category='artists',term='',role='all',page=1,limit=48}={}){
 category=['creators','groups'].includes(category)?category:'artists';term=text(term).trim().slice(0,100);
 const people=[...indexFor(model).people.values()];
 // The editorial placement is separate from song duties and broad DB types.
 // A named producer in billing is not automatically an artist or a singer.
 const belongs=(person,tab)=>arr(presentation(person)?.categories).includes(tab)||(tab==='creators'&&[...person.roles].some(r=>!['vocal','artist'].includes(r)));
 const categories=[{id:'artists',label:'アーティスト'},{id:'groups',label:'グループ'},{id:'creators',label:'クリエイター'}].map(c=>({...c,count:people.filter(p=>belongs(p,c.id)).length}));
 const creators=people.filter(p=>belongs(p,'creators'));
 const creatorRoles=orderedCreditRoles(creators.flatMap(p=>[...p.roles].filter(r=>!['vocal','artist'].includes(r))));
 const activeRole=category==='creators'&&creatorRoles.includes(role)?role:'all';
 const roleOptions=[{id:'all',label:'すべて'},...creatorRoles.map(r=>({id:r,label:creditRoleLabel(r)}))];
 const filtered=people.filter(p=>belongs(p,category)&&(activeRole==='all'||p.roles.has(activeRole))&&catalogNameMatches(p,term)).sort((a,b)=>a.name.localeCompare(b.name,'ja')||compare(a.key,b.key));
 limit=Number.isSafeInteger(limit)&&limit>0&&limit<=100?limit:48;
 const pages=Math.ceil(filtered.length/limit);page=Number.isSafeInteger(page)&&page>0?Math.min(page,Math.max(pages,1)):1;
 return {category,term,role:activeRole,roleOptions,page,pages,total:filtered.length,categories,items:filtered.slice((page-1)*limit,page*limit).map(p=>({key:p.key,name:p.name,type:p.type,kindLabel:kindLabel(p),roles:roleLabels(p.roles),songCount:p.songs.size}))};
}

export function peopleListHref({category='artists',term='',role='all',page=1}={}){
 const p=new URLSearchParams();if(['creators','groups'].includes(category))p.set('category',category);if(term)p.set('q',term);if(category==='creators'&&role&&role!=='all')p.set('role',role);if(page>1)p.set('page',String(page));return '/people'+(p.size?'?'+p.toString():'');
}
