// One identity index for song search and person pages. Database IDs are reused;
// new, reviewed catalogue IDs are persisted in the registry, never written to DB
// by this reader. Raw credits, singer sets and verification states stay intact.
import {createHash} from 'node:crypto';
import registry from './catalog-people.json' with {type:'json'};

const arr=x=>Array.isArray(x)?x:[],str=x=>typeof x==='string'?x:'';
export const ENTITY_RECORDS=registry.entities;
export const VOCAL_LINK_RECORDS=registry.vocalLinks;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const byId=new Map(ENTITY_RECORDS.map(e=>[e.id,e]));
const byName=new Map();
for(const e of ENTITY_RECORDS)for(const name of [e.name,...arr(e.aliases)]){
 if(!byName.has(name))byName.set(name,new Set());byName.get(name).add(e.id);
}
export const MAIN_SINGER_IDS=['81a01233-230e-50a8-a309-11275c794cd0','36129afb-1fe8-5255-958e-b090e17c7905','ae41fa12-3b09-52c0-bc08-1d9218492391','b8307e06-2046-5415-a1f7-0b892dd41041','9ab42d1f-671c-57c5-a5ce-b5bd4303232c'];
export function entityForName(name){const ids=byName.get(name);return ids?.size===1?byId.get([...ids][0]):null;}
export function entityForId(id){return byId.get(id)??null;}
export function creditNameKey(name){return typeof name==='string'&&name.trim()?`credit-${createHash('sha256').update(name).digest('hex')}`:null;}
export function personKeyForCredit(name,credits=[]){
 // An explicit current ID wins over the older registry; conflicting current
 // IDs retain the old whole-credit page rather than selecting one person.
 const ids=new Set(arr(credits).filter(c=>(c.name||c.rawName)===name&&uuid.test(str(c.entityId))).map(c=>c.entityId));
 return ids.size===1?[...ids][0]:ids.size>1?creditNameKey(name):entityForName(name)?.id??creditNameKey(name);
}
export function vocalLinkMatches(entry,link){
 const d=entry?.detail,t=link?.entry;if(link?.status!=='active'||!d||!t)return false;
 return ['entryId','kind','primaryWorkId','title','displayCredit'].every(k=>d[k]===t[k])&&
  JSON.stringify(d.variations??[])===JSON.stringify(t.variations??[])&&
  arr(entry.singerIds).length===arr(t.singerIds).length&&arr(t.singerIds).every(id=>entry.singerIds.includes(id));
}
export function singersForEntry(entry,links=VOCAL_LINK_RECORDS){
 const singers=new Map(arr(entry?.detail?.singers).filter(s=>uuid.test(str(s.entityId))&&str(s.name)).map(s=>[s.entityId,s]));
 for(const link of arr(links))if(vocalLinkMatches(entry,link))for(const id of arr(link.entityIds)){
  const entity=byId.get(id);if(entity&&['artist','character','voicebank'].includes(entity.type)&&!singers.has(id))singers.set(id,{entityId:id,name:entity.name,role:'vocal'});
 }
 return [...singers.values()];
}
export function singerIdsForEntry(entry){return [...new Set([...arr(entry?.singerIds),...singersForEntry(entry).map(s=>s.entityId)])];}

const boundary=c=>c===undefined||/[\s・･·×✕✖&＆+＋/／,，、（）()「」【】\[\]<>〈〉]/u.test(c);
/** Billing identities are separate from vocals. A group never expands to its
 * members, nor does a producer featured in billing become a singer. */
export function billingPeopleForEntry(entry){
 const value=str(entry?.detail?.displayCredit),found=[];
 for(const entity of ENTITY_RECORDS)if([entity.name,...arr(entity.aliases)].some(name=>{
  let from=0,at;while((at=value.indexOf(name,from))!==-1){if(boundary(value[at-1])&&boundary(value[at+name.length]))return true;from=at+name.length;}return false;
 }))found.push(entity);
 return found;
}
export function catalogSingerChoices(model){
 const people=new Map(ENTITY_RECORDS.filter(e=>e.picker).map(e=>[e.id,{id:e.id,name:e.name,aliases:arr(e.aliases),group:e.pickerGroup??'その他の歌唱者'}]));
 for(const entry of model.entries.values())for(const singer of singersForEntry(entry)){
  const entity=byId.get(singer.entityId);
  people.set(singer.entityId,{id:singer.entityId,name:singer.name,aliases:arr(entity?.aliases),group:entity?.pickerGroup??'その他の歌唱者'});
 }
 return [...people.values()].sort((a,b)=>{
  const ai=MAIN_SINGER_IDS.indexOf(a.id),bi=MAIN_SINGER_IDS.indexOf(b.id);
  return ai!==-1||bi!==-1?(ai===-1?99:ai)-(bi===-1?99:bi):a.name.localeCompare(b.name,'ja')||a.id.localeCompare(b.id);
 });
}
