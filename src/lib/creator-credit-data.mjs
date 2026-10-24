// A reviewed credit has both source wording and named participants. Punctuation
// is never a parser rule and unit membership never establishes song authorship.
import registry from './catalog-creator-credits.json' with {type:'json'};
import {entityForId} from './catalog-people.mjs';
import {artworkEntryMatches} from './catalog-artwork.mjs';

export const CREATOR_CREDIT_RECORDS=registry.records;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const url=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
function reviewedParts(record){
 if(!Array.isArray(record.parts)||record.parts.map(p=>p.text).join('')!==record.rawName||!record.sourceUrls?.length||!record.sourceUrls.every(url))return null;
 const ids=new Set(),participants=[];
 for(const part of record.parts){
  if(typeof part.text!=='string'||!part.text)return null;
  if(part.entityId){const entity=entityForId(part.entityId);if(!entity||![entity.name,...(entity.aliases??[])].includes(part.text))return null;if(!ids.has(entity.id)){ids.add(entity.id);participants.push({name:entity.name,personKey:entity.id});}}
  else if(!/^[\s・･·×✕✖&＆+＋/／,，、（）()]+$/u.test(part.text))return null;
 }
 if(ids.size<2)return null;
 return {parts:record.parts.map(p=>({text:p.text,personKey:p.entityId??null})),participants};
}
export function resolveCreatorCredit(entry,credit,context,records=CREATOR_CREDIT_RECORDS){
 // A current explicit identity (including a formal unit) takes precedence.
 if(uuid.test(credit.personKey??'')||uuid.test(credit.entityId??''))return credit;
 const matches=[];
 for(const record of records){
  if(record.status!=='active'||record.rawName!==credit.name||!artworkEntryMatches(entry,record.entry)||entry.detail.displayCredit!==record.entry.displayCredit||!record.contexts?.some(c=>c.role===context.role&&c.scopes.includes(context.scope)))continue;
  if(context.scope==='video'&&(!record.mediaId||record.mediaId!==context.mediaId||record.mediaUrl!==context.mediaUrl))continue;
  const result=reviewedParts(record);if(result)matches.push(result);
 }
 const unique=new Map(matches.map(m=>[JSON.stringify(m),m]));return unique.size===1?{...credit,...unique.values().next().value}:credit;
}
