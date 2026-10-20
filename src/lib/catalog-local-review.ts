import 'server-only';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {asObject,validId,JsonObject} from './core';
import type {CatalogListFilters,CatalogEntryCard} from './catalog-entry-api';
import {VOICEBANK_SINGERS} from './catalog-vocal-identities';
import {historicalSingerCase} from './catalog-historical-singer-exceptions';
import {characterVocalCreditCase} from './catalog-character-vocal-identities';

type Candidate = {
 entryId:string;legacyId:number|null;kind:'song_variant'|'medley';title:string;
 workId:string|null;displayCredit:string;legacySongType:string|null;
 singerIds:string[];singerNames:string[];candidateSetExhaustive:boolean;
 flags:string[];unresolvedTokens:string[];rawTitle:string;workTitleCandidates:string[];
 medleySegments:Array<{sequence:number;workId:string;workTitle:string;rawLabel:string;workTitleCandidates:string[]}>;
};
type LocalFixture = {purpose:string;candidateCount:number;originCount:number;workCount:number;entries:Candidate[]};

/** Unavailable in every production build, even when the review env variables leak into deployment. */
export function localCatalogReviewEnabled():boolean {
 return process.env.NODE_ENV==='development' &&
  process.env.CATALOG_REVIEW_MODE==='local_fixture' &&
  typeof process.env.CATALOG_REVIEW_FILE==='string' &&
  typeof process.env.CATALOG_REVIEW_SHA256==='string' &&
  /^[a-f0-9]{64}$/.test(process.env.CATALOG_REVIEW_SHA256);
}
/** Exact group-credit overlay. Applied ONLY to the SHA-checked offline fixture.
 * Source credit and all unverified flags are kept unchanged.
 * V.I.P is the five musical-isotope singing voices (not an unknown human group).
 */
function addCreditedVoicebanks(entry:Candidate):Candidate{
 if(entry.kind!=='song_variant')return entry;
 const credit=entry.displayCredit.trim();
 const vip=/^V\.W\.P\s*(?:×|&|feat\.?|with)\s*V\.I\.P$/i.test(credit);
 const creditedTokens=credit.split(/\s*(?:×|&|feat\.?|with|・)\s*/i);
 const names=vip?VOICEBANK_SINGERS.map(s=>s.name):entry.unresolvedTokens.filter(name=>
  VOICEBANK_SINGERS.some(s=>s.name===name) && creditedTokens.includes(name));
 if(!names.length)return entry;
 const added=VOICEBANK_SINGERS.filter(s=>names.includes(s.name)&&!entry.singerIds.includes(s.id));
 return {...entry,
  singerIds:[...entry.singerIds,...added.map(s=>s.id)],
  singerNames:[...entry.singerNames,...added.map(s=>s.name)],
  unresolvedTokens:entry.unresolvedTokens.filter(name=>!added.some(s=>s.name===name)),
 };
}
/**
 * Exact historic source-scoped performer override. Called only AFTER the
 * local-only voicebank candidates are expanded, without touching source credit,
 * raw fixture, proof flags or DB. Fail closed on stale title/credit/identity.
 */
function applyAuditedHistoricalSingers(e:Candidate):Candidate{
 const rule=historicalSingerCase(e.legacyId);
 if(!rule)return e;
 const actual=new Set(e.singerNames), expected=new Set(rule.expectedNames);
 if(e.kind!=='song_variant'||e.title!==rule.title||e.displayCredit!==rule.credit||
    !e.flags.includes('historical_substitute_risk')||e.unresolvedTokens.length!==0||
    e.singerIds.length!==e.singerNames.length||e.singerNames.length!==expected.size+1||
    new Set(e.singerIds).size!==e.singerIds.length||actual.size!==e.singerNames.length||
    !actual.has(rule.absent)||expected.has(rule.absent)||
    [...expected].some(name=>!actual.has(name)))
  throw new Error(`Historic fixture singer case drift: ${e.legacyId} ${e.title}`);
 const drop=e.singerNames.indexOf(rule.absent);
 return {...e,
   singerNames:e.singerNames.filter((_,i)=>i!==drop),
   singerIds:e.singerIds.filter((_,i)=>i!==drop),
 };
}
/** Map only these four known character-performance credits to actual vocal performers.
 * Display credit remains the character names, original fixture and all review flags
 * remain untouched. Any fixture drift aborts instead of guessing an identity.
 */
function applyAuditedCharacterVocalCredits(e:Candidate):Candidate {
 const rule=characterVocalCreditCase(e.legacyId);
 if(!rule)return e;
 if(e.kind!=='song_variant'||e.title!==rule.title||e.displayCredit!==rule.credit||
    !e.flags.includes('role_or_identity_review_character')||
    e.singerIds.length!==0||e.singerNames.length!==0||
    e.unresolvedTokens.length!==rule.characterTokens.length||
    !rule.characterTokens.every((name,i)=>e.unresolvedTokens[i]===name)||
    new Set(rule.actualSingers.map(s=>s.id)).size!==rule.actualSingers.length)
  throw new Error(`Character vocal credit fixture drift: ${e.legacyId} ${e.title}`);
 return {...e,
  singerIds:rule.actualSingers.map(s=>s.id),
  singerNames:rule.actualSingers.map(s=>s.name),
  unresolvedTokens:[],
 };
}
/** Provisional but self-contained actual voice set for an explicitly audited credit.
 * A fictional character remains a distinct credited character entity in the DB.
 */
function auditedCharacterSingerSet(e:Candidate):boolean {
 const rule=characterVocalCreditCase(e.legacyId);
 return !!rule && e.kind==='song_variant' &&
  e.title===rule.title && e.displayCredit===rule.credit &&
  e.flags.includes('role_or_identity_review_character') &&
  e.unresolvedTokens.length===0 && e.singerIds.length===rule.actualSingers.length &&
  rule.actualSingers.every((s,i)=>e.singerIds[i]===s.id && e.singerNames[i]===s.name);
}
/** Verified historical substitute sets are eligible for "only" (locally).
 * They are still source-scoped candidates, not a verified DB mutation.
 */
function auditedHistoricalSingerSet(e:Candidate):boolean{
 const rule=historicalSingerCase(e.legacyId);
 if(!rule||e.title!==rule.title||e.displayCredit!==rule.credit||
    e.unresolvedTokens.length!==0||e.singerNames.length!==rule.expectedNames.length||
    e.singerNames.length!==e.singerIds.length||
    new Set(e.singerIds).size!==e.singerIds.length)return false;
 const expected=new Set(rule.expectedNames);
 return e.singerNames.every(name=>expected.delete(name))&&expected.size===0;
}
function explicitVoicebankCandidateSet(e:Candidate):boolean{
 if(e.kind!=='song_variant'||e.unresolvedTokens.length!==0 || new Set(e.singerIds).size!==e.singerIds.length)return false;
 const vip=/^V\.W\.P\s*(?:×|&|feat\.?|with)\s*V\.I\.P$/i.test(e.displayCredit.trim());
 if(vip)return e.singerIds.length===10 && VOICEBANK_SINGERS.every(s=>e.singerIds.includes(s.id));
 if(!e.flags.includes('role_or_identity_review_voicebank'))return false;
 const tokens=e.displayCredit.trim().split(/\s*(?:×|&|feat\.?|with|・)\s*/i);
 return VOICEBANK_SINGERS.some(s=>tokens.includes(s.name)&&e.singerIds.includes(s.id)) &&
  tokens.every(t=>t==='V.W.P'||e.singerNames.includes(t));
}
let memo:LocalFixture|null=null;
function load():LocalFixture {
 if(!localCatalogReviewEnabled()) throw new Error('Local catalog preview is disabled');
 if(memo)return memo;
 const content=readFileSync(process.env.CATALOG_REVIEW_FILE!);
 if(createHash('sha256').update(content).digest('hex')!==process.env.CATALOG_REVIEW_SHA256)
  throw new Error('Local review fixture SHA256 mismatch; no preview');
 const data=asObject(JSON.parse(content.toString('utf8'))) as Partial<LocalFixture>;
 if(data.purpose!=='OFFLINE_LOCAL_DEVELOPMENT_UI_REVIEW_ONLY' || data.candidateCount!==433 ||
    data.originCount!==429 || data.workCount!==372 || !Array.isArray(data.entries) || data.entries.length!==433)
  throw new Error('Local preview fixture counts/purpose mismatch');
 const ids=new Set<string>();
 for(const e of data.entries){
  if(!validId(e.entryId) || ids.has(e.entryId) || !['song_variant','medley'].includes(e.kind))
    throw new Error('Invalid/duplicate preview entry');
  ids.add(e.entryId);
 }
 memo={...(data as LocalFixture),entries:(data.entries as Candidate[]).map(e=>applyAuditedCharacterVocalCredits(applyAuditedHistoricalSingers(addCreditedVoicebanks(e))))};
 return memo;
}
function cmp(a:string,b:string):number {return Buffer.compare(Buffer.from(a,'utf8'),Buffer.from(b,'utf8'));}
function nameMatch(text:string,q:string):boolean {return text.toLowerCase().includes(q.toLowerCase());}
function relevance(e:Candidate,q:string):0|1|null {
 if(!q || nameMatch(e.title,q) || e.workTitleCandidates.some(t=>nameMatch(t,q)))return 0;
 // A category keyword is also a discoverable search term. Do not rename any titles.
 if(e.kind==='medley' && q==='メドレー')return 0;
 if(e.kind==='medley'&&e.medleySegments.some(s=>nameMatch(s.rawLabel,q)||nameMatch(s.workTitle,q)||s.workTitleCandidates.some(t=>nameMatch(t,q))))return 1;
 return null;
}
/**
 * Local-review-only provisional exact match for an explicit list of N singers.
 * Legacy G6 intentionally marks compound credits non-exhaustive pending
 * vocal-role verification. HD-015 allows an unverified *candidate-set* exact
 * match when ALL displayed credit names are the resolved singer candidates.
 * This parser accepts only clearly delimited literal person names; it NEVER
 * expands group credits, guesses omitted singers, resolves voicebanks, or
 * changes the stored verification/exhaustiveness flags.
 */
function provisionalLiteralSingerSet(e:Candidate):boolean {
 if(e.kind!=='song_variant' || e.singerIds.length<2 ||
    e.singerIds.length!==e.singerNames.length ||
    new Set(e.singerIds).size!==e.singerIds.length ||
    e.singerNames.some(n=>!n || n!==n.trim()) ||
    new Set(e.singerNames).size!==e.singerNames.length ||
    e.unresolvedTokens.length!==0 || e.flags.length!==1 ||
    e.flags[0]!=='compound_credit_needs_vocal_role_review')return false;
 // A literal credit may mix ×, &, feat., with and Japanese middle dots;
 // require every resulting token to be exactly one resolved candidate name.
 // No partial/subset match is allowed; a new or unknown token fails closed.
 const tokens=e.displayCredit.trim().split(/\s*(?:×|&|feat\.?|with|・)\s*/i);
 if(tokens.length!==e.singerNames.length)return false;
 const expected=new Set(e.singerNames);
 return tokens.every(name=>expected.delete(name)) && expected.size===0;
}
/** Complete-set modes must not match against incomplete/unknown rosters.
 * The flag is intentionally NOT upgraded: local candidate completeness is not verification.
 */
function closedSingerSetCandidate(e:Candidate):boolean {
 return e.kind==='song_variant' && e.singerIds.length>0 &&
  e.singerIds.length===new Set(e.singerIds).size &&
  (e.candidateSetExhaustive || provisionalLiteralSingerSet(e) || explicitVoicebankCandidateSet(e) || auditedHistoricalSingerSet(e) || auditedCharacterSingerSet(e)) &&
  e.unresolvedTokens.length===0 &&
  (!e.flags.some(x=>['group_without_membership','role_or_identity_review_voicebank'].includes(x)) ||
   explicitVoicebankCandidateSet(e) || auditedHistoricalSingerSet(e) || auditedCharacterSingerSet(e));
}
function singerMatch(e:Candidate,f:CatalogListFilters):boolean {
 const chosen=[...new Set(f.singerIds??[])];
 if(!chosen.length)return true;
 const actual=new Set(e.singerIds);
 const mode=f.singerMatch??'contains';
 if(mode==='any')return chosen.some(id=>actual.has(id));
 if(mode==='contains')return chosen.every(id=>actual.has(id));
 if(mode==='only')return closedSingerSetCandidate(e) &&
  actual.size===chosen.length && chosen.every(id=>actual.has(id));
 if(mode==='subset')return closedSingerSetCandidate(e) &&
  [...actual].every(id=>chosen.includes(id));
 // Unknown filters never relax to another match.
 return false;
}
export function localCatalogList(f:CatalogListFilters):{items:CatalogEntryCard[];total:number;limit:number;offset:number} {
 const q=(f.search??'').trim().slice(0,100), limit=f.limit??24, offset=f.offset??0;
 if(!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(offset)||offset<0||offset>100000)throw new Error('Invalid pagination');
 const kinds=f.selectedKinds??[];
 const all=load().entries.map(e=>({e,r:relevance(e,q)})).filter(({e,r})=>r!==null&&
   (!kinds.length||kinds.includes(e.kind==='medley'?'medley':e.legacySongType as 'original'|'cover'|'collaboration'|'variant')) && singerMatch(e,f));
 all.sort((a,b)=>Number(a.r)-Number(b.r) || (f.sort==='title_desc'?-cmp(a.e.title,b.e.title):cmp(a.e.title,b.e.title))||cmp(a.e.entryId,b.e.entryId));
 return {items:all.slice(offset,offset+limit).map(({e,r})=>({entryId:e.entryId,title:e.title,kind:e.kind,
  displayCredit:e.displayCredit,legacySongType:e.legacySongType,thumbnailUrl:null,matchKind:r===1?'component':'title'})),total:all.length,limit,offset};
}
export function localCatalogDetail(id:string):JsonObject|null {
 const entries=load().entries, item=entries.find(e=>e.entryId===id);
 if(!item)return null;
 return {entryId:item.entryId,title:item.title,kind:item.kind,primaryWorkId:item.workId,displayCredit:item.displayCredit,
  legacySongType:item.legacySongType,
  editorialOriginLabel: item.title.startsWith(item.rawTitle+' (') && item.title.endsWith(' ver.)')
   ? item.title.slice(item.rawTitle.length+2,-1) : null,
  editorialOriginStatus:'legacy_editorial_display_only',
  singers:item.singerIds.map(x=>({entityId:x,name:loadName(entries,x),role:'vocal'})),variations:[],
  relatedVariants:entries.filter(e=>item.kind==='song_variant'&&e.entryId!==id&&e.kind==='song_variant'&&e.workId===item.workId)
   .map(e=>({entryId:e.entryId,title:e.title,displayCredit:e.displayCredit})),
  medleySegments:item.medleySegments.map(s=>({sequence:s.sequence,workId:s.workId,workTitle:s.workTitle,rawLabel:s.rawLabel})),
  containingMedleys:entries.filter(e=>item.workId&&e.kind==='medley'&&e.medleySegments.some(s=>s.workId===item.workId)).map(e=>({entryId:e.entryId,title:e.title})),
  linkedRenditions:[]};
}
function loadName(entries:Candidate[],id:string):string {
 for(const e of entries){const k=e.singerIds.indexOf(id);if(k>=0&&e.singerNames[k])return e.singerNames[k];}
 return '名称未解決';
}
export function localCatalogCompare(id:string):JsonObject|null {
 const entries=load().entries,item=entries.find(e=>e.entryId===id);
 if(!item||item.kind!=='song_variant'||!item.workId)return null;
 const candidates=entries.filter(e=>e.kind==='song_variant'&&e.workId===item.workId).sort((a,b)=>cmp(a.title,b.title)||cmp(a.entryId,b.entryId));
 return {entries:candidates.map(e=>({entryId:e.entryId,title:e.title,displayCredit:e.displayCredit,
    singers:e.singerIds.map(x=>loadName(entries,x)),variations:[]}))};
}
