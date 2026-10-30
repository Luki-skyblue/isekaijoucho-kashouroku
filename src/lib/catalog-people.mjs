// One identity index for song search and person pages. Database IDs are reused;
// new, reviewed catalogue IDs are persisted in the registry, never written to DB
// by this reader. Raw credits, singer sets and verification states stay intact.
import {createHash} from 'node:crypto';
import registry from './catalog-people.json' with {type:'json'};

const arr=x=>Array.isArray(x)?x:[],str=x=>typeof x==='string'?x:'';
export const ENTITY_RECORDS=registry.entities;
export const VOCAL_LINK_RECORDS=registry.vocalLinks;
export const MEMBERSHIP_RECORDS=registry.memberships??[];
export const VOCAL_CORRECTION_RECORDS=registry.vocalCorrections??[];
export const PERSON_RELATION_RECORDS=registry.personRelations??[];
export const MEDLEY_PERFORMANCE_RECORDS=registry.medleyPerformances??[];
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
const historyKey=rows=>JSON.stringify(arr(rows).map(h=>({renditionId:h.renditionId,renditionPartId:h.renditionPartId,occurredOn:h.occurredOn,eventIds:arr(h.eventIds??h.relatedEvents?.map(e=>e.eventId)).slice().sort()})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
export function vocalCorrectionMatches(entry,record){
 return vocalLinkMatches(entry,record)&&arr(entry?.legacyIds).includes(record.legacyId)&&historyKey(entry.history)===historyKey(record.history)&&
  arr(record.entityIds).length>0&&new Set(record.entityIds).size===record.entityIds.length&&record.entityIds.every(id=>['artist','character','voicebank'].includes(byId.get(id)?.type));
}
function vocalCorrectionFor(entry,records=VOCAL_CORRECTION_RECORDS){
 const matches=arr(records).filter(r=>vocalCorrectionMatches(entry,r));return matches.length===1?matches[0]:null;
}
const medleyHistoryKey=rows=>JSON.stringify(arr(rows).map(h=>[h.renditionId,h.renditionPartId,h.workId,h.versionId,h.occurredOn,arr(h.eventIds??h.relatedEvents?.map(e=>e.eventId)).slice().sort()]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
const medleySegmentsKey=rows=>JSON.stringify(arr(rows).map(s=>[s.sequence,s.workId,s.rawLabel,s.workTitle]));
/** A reviewed aggregate performance is neither a new work nor an expansion of
 * group membership. Later canonical billing, singers or programme corrections
 * retire the old display supplement. Incomplete lineups remain incomplete. */
export function medleyPerformanceForEntry(entry,records=MEDLEY_PERFORMANCE_RECORDS){
 if(entry?.detail?.kind!=='medley'||entry.detail.primaryWorkId!==null||Object.hasOwn(entry.detail.songMetadata??{},'artistCredit'))return null;
 const matches=arr(records).filter(r=>vocalLinkMatches(entry,r)&&str(r.displayCredit).trim()&&
  medleyHistoryKey(entry.history)===medleyHistoryKey(r.history)&&
  medleySegmentsKey(entry.detail.medleySegments)===medleySegmentsKey(r.segments)&&
  arr(r.evidence).some(e=>typeof e.url==='string'&&e.url.startsWith('https://'))&&
  Array.isArray(r.entityIds)&&new Set(r.entityIds).size===r.entityIds.length&&r.entityIds.every(id=>['artist','character','voicebank'].includes(byId.get(id)?.type))&&
  arr(r.billingEntityIds).length>0&&new Set(r.billingEntityIds).size===r.billingEntityIds.length&&r.billingEntityIds.every(id=>byId.has(id)));
 return matches.length===1?matches[0]:null;
}
export function singersForEntry(entry,links=VOCAL_LINK_RECORDS,corrections=VOCAL_CORRECTION_RECORDS){
 const corrected=vocalCorrectionFor(entry,corrections);
 if(corrected)return corrected.entityIds.map(id=>({entityId:id,name:byId.get(id).name,role:'vocal'}));
 const singers=new Map(arr(entry?.detail?.singers).filter(s=>uuid.test(str(s.entityId))&&str(s.name)).map(s=>[s.entityId,s]));
 for(const link of arr(links))if(vocalLinkMatches(entry,link))for(const id of arr(link.entityIds)){
  const entity=byId.get(id);if(entity&&['artist','character','voicebank'].includes(entity.type)&&!singers.has(id))singers.set(id,{entityId:id,name:entity.name,role:'vocal'});
 }
 for(const id of medleyPerformanceForEntry(entry)?.entityIds??[]){const entity=byId.get(id);if(!singers.has(id))singers.set(id,{entityId:id,name:entity.name,role:'vocal'});}
 return [...singers.values()];
}
export function singerIdsForEntry(entry){const correction=vocalCorrectionFor(entry);return correction?[...correction.entityIds]:[...new Set([...arr(entry?.singerIds),...singersForEntry(entry).map(s=>s.entityId)])];}

/** Expand only explicitly reviewed collective credits in the song's vocal
 * field. The stored artist billing and all other song credits stay intact. */
export function vocalDisplayCreditForEntry(entry){
 const medley=medleyPerformanceForEntry(entry);
 if(medley)return medley.showIndividualNames===true?singersForEntry(entry).map(s=>s.name).join('・'):medley.displayCredit;
 if(!VOCAL_LINK_RECORDS.some(link=>link.showIndividualNames===true&&vocalLinkMatches(entry,link)))return null;
 return singersForEntry(entry).map(s=>s.name).join('・')||null;
}

/** Membership supplies navigation only. It never adds singers to an entry. */
export function membershipsForEntity(id,records=MEMBERSHIP_RECORDS){
 return arr(records).filter(r=>r.status==='active'&&r.relation==='member_of'&&['artist','character','voicebank'].includes(byId.get(r.memberId)?.type)&&byId.get(r.groupId)?.type==='group'&&(r.memberId===id||r.groupId===id));
}

/** Navigation between distinct credited identities. Neither an activity-name
 * relationship nor a CV credit copies song duties, singers or membership. */
export function personRelationsForEntity(id,records=PERSON_RELATION_RECORDS){
 return arr(records).filter(r=>{
  if(r.status!=='active'||r.fromId===r.toId||![r.fromId,r.toId].includes(id)||!arr(r.sourceUrls).some(url=>typeof url==='string'&&url.startsWith('https://')))return false;
  const from=byId.get(r.fromId),to=byId.get(r.toId);
  return r.relation==='alternate_name'?from?.type==='artist'&&to?.type==='artist':r.relation==='character_voice'?from?.type==='character'&&to?.type==='artist':r.relation==='musical_isotope'?from?.type==='artist'&&to?.type==='voicebank'&&to.presentation?.kind==='musical_isotope':false;
 });
}

const boundary=c=>c===undefined||/[\s・･·×✕✖&＆+＋/／,，、（）()「」【】\[\]<>〈〉]/u.test(c);
/** Billing identities are separate from vocals. A group never expands to its
 * members, nor does a producer featured in billing become a singer. */
export function billingPeopleForEntry(entry){
 const value=str(entry?.detail?.displayCredit)||str(medleyPerformanceForEntry(entry)?.displayCredit),found=[];
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
