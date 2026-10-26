// Shared identity and whole-credit index. Displayed roles keep their original
// scope; neither billing nor entity resolution verifies a performance.
import {songDetailFromModel,songTitleCreditForEntry} from './song-detail-data.mjs';
import {creditNameKey,personKeyForCredit,entityForId,singersForEntry,billingPeopleForEntry,membershipsForEntity,personRelationsForEntity} from './catalog-people.mjs';
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
 function add(key,name,entryId,role,{listed=true,jointParticipants=[],jointLabel=null}={}){
  if(!key||!name)return;
  const entity=entityForId(key);
  if(!people.has(key))people.set(key,{key,name:entity?.name??name,aliases:arr(entity?.aliases),type:entity?.type??'credit',roles:new Set(),songs:new Map(),listed:false,jointParticipants:new Map(),jointLabels:new Set()});
  const person=people.get(key);person.roles.add(role);person.listed ||=listed;
  for(const participant of jointParticipants)person.jointParticipants.set(participant.personKey,participant);
  if(jointLabel)person.jointLabels.add(jointLabel);
  // Keep old name URLs as well as every explicitly reviewed alias. If the
  // spelling points at multiple current IDs, retain the ambiguity below.
  for(const spelling of new Set([name,...(entity?[entity.name,...arr(entity.aliases)]:[])])){
   const oldKey=creditNameKey(spelling);if(!aliases.has(oldKey))aliases.set(oldKey,new Set());aliases.get(oldKey).add(key);
  }
  if(!person.songs.has(entryId))person.songs.set(entryId,new Set());person.songs.get(entryId).add(role);
 }
 function addCreator(credit,entryId,role){
  const key=credit.personKey===undefined?personKeyForCredit(credit.name,[credit]):credit.personKey,participants=arr(credit.participants);
  if(participants.length>1){
   // Preserve the old joint-name page while the directory indexes its people.
   add(key,credit.name,entryId,role,{listed:false,jointParticipants:participants});
   for(const person of participants)add(person.personKey,person.name,entryId,role,{jointLabel:credit.name});
  }else add(key,credit.name,entryId,role);
 }
 for(const [entryId,entry]of model.entries){
  const song=songDetailFromModel(model,entryId);
  for(const singer of singersForEntry(entry))if(uuid.test(text(singer.entityId)))add(singer.entityId,text(singer.name),entryId,'vocal');
  const billing=billingPeopleForEntry(entry);billedGroups.set(entryId,new Set(billing.filter(p=>p.type==='group').map(p=>p.id)));
  for(const entity of billing)if(entity.type==='group'||!song.detail.singers.some(s=>s.entityId===entity.id))add(entity.id,entity.name,entryId,'artist');
  for(const credit of song.credits)for(const person of credit.people)addCreator(person,entryId,songCreditRole(song.detail,credit));
  if(song.detail.legacySongType==='cover')for(const credit of song.originalCredits)if(['lyricist','composer','arranger'].includes(credit.role))addCreator(credit,entryId,'original_'+credit.role);
  for(const video of song.videos)for(const credit of video.credits)addCreator(credit,entryId,`video:${credit.role}`);
 }
 const result={people,aliases,billedGroups};cache.set(model,result);return result;
}
const roleLabels=values=>orderedCreditRoles(values).map(creditRoleLabel);
const presentation=person=>entityForId(person.key)?.presentation;
const kindLabels={artist:'アーティスト',creator:'クリエイター',group:'グループ',character:'キャラクター',voicebank:'音声ライブラリ',musical_isotope:'音楽的同位体'};
const kindLabel=person=>person.jointParticipants.size?'連名':kindLabels[presentation(person)?.kind]??(person.key.startsWith('credit-')?'クリエイター':'関係者');
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
  return {entryId,href:'/songs/'+entryId+(activeRole.startsWith('video:')||videoOnly?'?tab=videos':''),title:d.title,displayCredit:songTitleCreditForEntry(entry),roles:roleLabels(entryRoles)};
 }).sort((a,b)=>compare(text(model.entries.get(a.entryId).sortTitle)||a.title,text(model.entries.get(b.entryId).sortTitle)||b.title)||compare(a.entryId,b.entryId));
 limit=Number.isSafeInteger(limit)&&limit>0&&limit<=100?limit:24;
 const pages=Math.ceil(songs.length/limit);page=Number.isSafeInteger(page)&&page>0?Math.min(page,Math.max(pages,1)):1;
 const items=songs.slice((page-1)*limit,page*limit).map(song=>{
  // Use the same live supplements and image fallback sequence as song detail.
  const images=songDetailFromModel(model,song.entryId).artworkCandidates;
  return {...song,thumbnailUrl:images[0]?.imageUrl??null,thumbnailUrls:images.map(x=>x.imageUrl)};
 });
 const creditParticipants=[...person.jointParticipants.values()].map(p=>({key:p.personKey,name:p.name,href:index.people.has(p.personKey)?personDetailHref(p.personKey):null}));
 const related=personRelationsForEntity(person.key),link=(id,context)=>({key:id,name:entityForId(id).name,href:index.people.has(id)?personDetailHref(id):null,...(context?{context}:{})});
 const alternateNames=related.filter(r=>r.relation==='alternate_name').map(r=>link(r.fromId===person.key?r.toId:r.fromId));
 const characters=related.filter(r=>r.relation==='character_voice'&&r.toId===person.key).map(r=>link(r.fromId,r.context));
 const voiceActors=related.filter(r=>r.relation==='character_voice'&&r.fromId===person.key).map(r=>link(r.toId,r.context));
 const isotopes=related.filter(r=>r.relation==='musical_isotope'&&r.fromId===person.key).map(r=>link(r.toId)),voiceOrigins=related.filter(r=>r.relation==='musical_isotope'&&r.toId===person.key).map(r=>link(r.fromId));
 const groupLinks=groups.map(g=>link(g.id));
 const relationGroups=[['alternate-names','別名義',alternateNames],['characters','担当キャラクター',characters],['groups','所属グループ',groupLinks],['isotopes','音楽的同位体',isotopes],['voice-actors','CV',voiceActors],['voice-origins','歌声のオリジン',voiceOrigins],['members','メンバー',members],['credit-participants','連名の参加者',creditParticipants]].filter(([id,,items])=>items?.length||(id==='members'&&items!==null)).map(([id,label,items])=>({id,label,items}));
 return {key:person.key,name:person.name,kindLabel:kindLabel(person),groups:groupLinks,members,...(creditParticipants.length?{creditParticipants}:{}),...(alternateNames.length?{alternateNames}:{}),...(characters.length?{characters}:{}),...(voiceActors.length?{voiceActors}:{}),relationGroups,billing:activeBilling,billingTabs,roles:roleLabels(person.roles),role:activeRole,roleTabs,total:songs.length,page,pages,items};
}

export function personDetailHref(key,{page=1,role='all',billing='all'}={}){
 const p=new URLSearchParams();if(billing&&billing!=='all')p.set('billing',billing);if(role&&role!=='all')p.set('role',role);if(page>1)p.set('page',String(page));return '/people/'+key+(p.size?'?'+p.toString():'');
}

export function peopleListFromModel(model,{category='artists',term='',role='all',page=1,limit=48}={}){
 category=['creators','groups'].includes(category)?category:'artists';term=text(term).trim().slice(0,100);
 const people=[...indexFor(model).people.values()].filter(p=>p.listed);
 // The editorial placement is separate from song duties and broad DB types.
 // A named producer in billing is not automatically an artist or a singer.
 const belongs=(person,tab)=>arr(presentation(person)?.categories).includes(tab)||(tab==='creators'&&[...person.roles].some(r=>!['vocal','artist'].includes(r)));
 const categories=[{id:'artists',label:'アーティスト'},{id:'groups',label:'グループ'},{id:'creators',label:'クリエイター'}].map(c=>({...c,count:people.filter(p=>belongs(p,c.id)).length}));
 const creators=people.filter(p=>belongs(p,'creators'));
 const creatorRoles=orderedCreditRoles(creators.flatMap(p=>[...p.roles].filter(r=>!['vocal','artist'].includes(r))));
 const activeRole=category==='creators'&&creatorRoles.includes(role)?role:'all';
 const roleOptions=[{id:'all',label:'すべて'},...creatorRoles.map(r=>({id:r,label:creditRoleLabel(r)}))];
 // A full reviewed joint label can find its participants, but one member's
 // name must not become another member's identity alias or partial match.
 const matches=person=>catalogNameMatches(person,term)||[...person.jointLabels].some(label=>catalogNameMatches({name:label},term)&&catalogNameMatches({name:term},label));
 const creatorRole=role=>!['vocal','artist'].includes(role);
 const countSongs=person=>category==='creators'?[...person.songs.values()].filter(roles=>activeRole==='all'?[...roles].some(creatorRole):roles.has(activeRole)).length:person.songs.size;
 const filtered=people.filter(p=>belongs(p,category)&&(activeRole==='all'||p.roles.has(activeRole))&&matches(p)).sort((a,b)=>(category==='creators'?countSongs(b)-countSongs(a):0)||a.name.localeCompare(b.name,'ja')||compare(a.key,b.key));
 const suggestions=term&&filtered.length===0?people.filter(p=>!belongs(p,category)&&matches(p))
  .sort((a,b)=>a.name.localeCompare(b.name,'ja')||compare(a.key,b.key)).slice(0,5).flatMap(person=>{
   const other=categories.find(c=>c.id!==category&&belongs(person,c.id));
   return other?[{key:person.key,name:person.name,category:other.id,categoryLabel:other.label}]:[];
  }):[];
 limit=Number.isSafeInteger(limit)&&limit>0&&limit<=100?limit:48;
 const pages=Math.ceil(filtered.length/limit);page=Number.isSafeInteger(page)&&page>0?Math.min(page,Math.max(pages,1)):1;
 return {category,term,role:activeRole,roleOptions,page,pages,total:filtered.length,categories,suggestions,items:filtered.slice((page-1)*limit,page*limit).map(p=>({key:p.key,name:p.name,type:p.type,kindLabel:kindLabel(p),roles:roleLabels(category==='creators'?[...p.roles].filter(creatorRole):p.roles),songCount:countSongs(p)}))};
}

export function peopleListHref({category='artists',term='',role='all',page=1}={}){
 const p=new URLSearchParams();if(['creators','groups'].includes(category))p.set('category',category);if(term)p.set('q',term);if(category==='creators'&&role&&role!=='all')p.set('role',role);if(page>1)p.set('page',String(page));return '/people'+(p.size?'?'+p.toString():'');
}
