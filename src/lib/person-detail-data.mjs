// File-backed name/credit index. No entity creation, name splitting, alias
// normalization, singer-set closure or fact verification is performed here.
import {createHash} from 'node:crypto';
import {songDetailFromModel,songArtworkCandidatesForEntry} from './song-detail-data.mjs';

const arr=x=>Array.isArray(x)?x:[],text=x=>typeof x==='string'?x:'';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cache=new WeakMap();
const roles={vocal:'歌唱',lyricist:'作詞',composer:'作曲',arranger:'編曲',original_arranger:'原曲の編曲'};
const roleOrder=['vocal','lyricist','composer','arranger','original_arranger'];
const compare=(a,b)=>a<b?-1:a>b?1:0;
export function creditNameKey(name){
 return typeof name==='string'&&name.trim()?`credit-${createHash('sha256').update(name).digest('hex')}`:null;
}
export function validPersonKey(key){return typeof key==='string'&&(uuid.test(key)||/^credit-[a-f0-9]{64}$/.test(key));}

/** Link only whole, explicitly named singers in this entry's display credit.
 * Keep every character of raw billing, including unresolved partners/groups.
 * Character names are not replaced with the performer behind that character. */
export function singerCreditParts(detail){
 const singers=arr(detail?.singers),fallback=singers.map(s=>text(s?.name)).filter(Boolean).join('・');
 const value=text(detail?.displayCredit)||fallback,byName=new Map();
 for(const singer of singers){
  const name=text(singer?.name),id=text(singer?.entityId);if(!name||!uuid.test(id))continue;
  if(!byName.has(name))byName.set(name,new Set());byName.get(name).add(id);
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
 const people=new Map();
 function add(key,name,entryId,role){
  if(!key||!name)return;
  if(!people.has(key))people.set(key,{key,name,roles:new Set(),songs:new Map()});
  const person=people.get(key);person.roles.add(role);
  if(!person.songs.has(entryId))person.songs.set(entryId,new Set());person.songs.get(entryId).add(role);
 }
 for(const [entryId,entry]of model.entries){
  const song=songDetailFromModel(model,entryId);
  for(const singer of arr(entry.detail.singers))if(uuid.test(text(singer.entityId)))add(singer.entityId,text(singer.name),entryId,'vocal');
  for(const credit of song.credits)for(const name of credit.names)add(creditNameKey(name),name,entryId,credit.role);
  if(entry.detail.legacySongType==='cover'&&song.originalArranger)add(creditNameKey(song.originalArranger),song.originalArranger,entryId,'original_arranger');
  for(const video of song.videos)for(const credit of video.credits)add(creditNameKey(credit.name),credit.name,entryId,`video:${credit.role}`);
 }
 cache.set(model,people);return people;
}
const roleLabel=role=>roles[role]??(role.startsWith('video:')?`${role.slice(6)}（動画）`:role);
const roleLabels=values=>[...values].sort((a,b)=>(roleOrder.includes(a)?roleOrder.indexOf(a):roleOrder.length)-(roleOrder.includes(b)?roleOrder.indexOf(b):roleOrder.length)||compare(a,b)).map(roleLabel);
export function personDetailFromModel(model,key,{page=1,limit=24}={}){
 if(!validPersonKey(key))return null;
 const person=indexFor(model).get(key);if(!person)return null;
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
