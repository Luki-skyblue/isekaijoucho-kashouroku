// Shared identity and whole-credit index. Displayed roles keep their original
// scope; neither billing nor entity resolution verifies a performance.
import {songDetailFromModel,songArtworkCandidatesForEntry} from './song-detail-data.mjs';
import {creditNameKey,personKeyForCredit,entityForId,singersForEntry,billingPeopleForEntry} from './catalog-people.mjs';
import {catalogNameMatches} from './catalog-name-search.mjs';
export {creditNameKey} from './catalog-people.mjs';

const arr=x=>Array.isArray(x)?x:[],text=x=>typeof x==='string'?x:'';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cache=new WeakMap();
const roles={vocal:'歌唱',artist:'アーティスト',lyricist:'作詞',composer:'作曲',arranger:'編曲',original_arranger:'原曲の編曲'};
const roleOrder=['vocal','lyricist','composer','arranger','original_arranger'];
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
 const people=new Map(),aliases=new Map();
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
  for(const entity of billingPeopleForEntry(entry))if(entity.type==='group'||!song.detail.singers.some(s=>s.entityId===entity.id))add(entity.id,entity.name,entryId,'artist');
  for(const credit of song.credits)for(const person of credit.people)add(person.personKey,person.name,entryId,credit.role);
  if(entry.detail.legacySongType==='cover'&&song.originalArranger)add(personKeyForCredit(song.originalArranger),song.originalArranger,entryId,'original_arranger');
  for(const video of song.videos)for(const credit of video.credits)add(personKeyForCredit(credit.name,[credit]),credit.name,entryId,`video:${credit.role}`);
 }
 const result={people,aliases};cache.set(model,result);return result;
}
const roleLabel=role=>roles[role]??(role.startsWith('video:')?`${role.slice(6)}（動画）`:role);
const roleLabels=values=>[...values].sort((a,b)=>(roleOrder.includes(a)?roleOrder.indexOf(a):roleOrder.length)-(roleOrder.includes(b)?roleOrder.indexOf(b):roleOrder.length)||compare(a,b)).map(roleLabel);
export function personDetailFromModel(model,key,{page=1,limit=24}={}){
 if(!validPersonKey(key))return null;
 const index=indexFor(model),targets=index.aliases.get(key);
 const person=index.people.get(key)??(targets?.size===1?index.people.get([...targets][0]):null);if(!person)return null;
 const songs=[...person.songs].map(([entryId,entryRoles])=>{
  const entry=model.entries.get(entryId),d=entry.detail;
  return {entryId,title:d.title,displayCredit:text(d.displayCredit)||arr(d.singers).map(s=>text(s.name)).filter(Boolean).join('・'),roles:roleLabels(entryRoles)};
 }).sort((a,b)=>compare(text(model.entries.get(a.entryId).sortTitle)||a.title,text(model.entries.get(b.entryId).sortTitle)||b.title)||compare(a.entryId,b.entryId));
 limit=Number.isSafeInteger(limit)&&limit>0&&limit<=100?limit:24;
 const pages=Math.ceil(songs.length/limit);page=Number.isSafeInteger(page)&&page>0?Math.min(page,pages):1;
 const items=songs.slice((page-1)*limit,page*limit).map(song=>{
  const entry=model.entries.get(song.entryId),images=songArtworkCandidatesForEntry(entry,model.works.get(entry.detail.primaryWorkId));
  return {...song,thumbnailUrl:images[0]?.imageUrl??null,thumbnailUrls:images.map(x=>x.imageUrl)};
 });
 return {key:person.key,name:person.name,roles:roleLabels(person.roles),total:songs.length,page,pages,items};
}

export function peopleListFromModel(model,{category='artists',term='',page=1,limit=48}={}){
 category=category==='creators'?'creators':'artists';term=text(term).trim().slice(0,100);
 const people=[...indexFor(model).people.values()];
 const belongs=(person,tab)=>tab==='artists'?[...person.roles].some(r=>['vocal','artist'].includes(r)):[...person.roles].some(r=>!['vocal','artist'].includes(r));
 const categories=[{id:'artists',label:'アーティスト'},{id:'creators',label:'クリエイター'}].map(c=>({...c,count:people.filter(p=>belongs(p,c.id)).length}));
 const filtered=people.filter(p=>belongs(p,category)&&catalogNameMatches(p,term)).sort((a,b)=>a.name.localeCompare(b.name,'ja')||compare(a.key,b.key));
 limit=Number.isSafeInteger(limit)&&limit>0&&limit<=100?limit:48;
 const pages=Math.ceil(filtered.length/limit);page=Number.isSafeInteger(page)&&page>0?Math.min(page,Math.max(pages,1)):1;
 return {category,term,page,pages,total:filtered.length,categories,items:filtered.slice((page-1)*limit,page*limit).map(p=>({key:p.key,name:p.name,type:p.type,roles:roleLabels(p.roles),songCount:p.songs.size}))};
}

export function peopleListHref({category='artists',term='',page=1}={}){
 const p=new URLSearchParams();if(category==='creators')p.set('category',category);if(term)p.set('q',term);if(page>1)p.set('page',String(page));return '/people'+(p.size?'?'+p.toString():'');
}
