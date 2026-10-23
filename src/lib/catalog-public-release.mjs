// Public DTO projection. Never serialize private rows by spreading them.
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {validateExport,PURPOSE,PUBLIC_PURPOSE,liveCandidatesApplicable,applyLiveFilterCandidates} from './private-read-model.mjs';
import {songMetadataForEntry,songTypeForEntry} from './song-detail-data.mjs';

const scalar=Symbol('scalar'),url=Symbol('url'),absentUrl=Symbol('absent-url');
const obj=(names='',children={})=>({...Object.fromEntries(names.split(' ').filter(Boolean).map(k=>[k,scalar])),...children});
const list=schema=>[schema];
const version=obj('id kind label labelBasis officialTitle');
const localizedTitle=obj('language languageCode locale title kind titleKind script');
const credit=obj('creditId entityId name rawName role scope basis verificationStatus');
const singer=obj('entityId name role');
const variation=obj('kind semitoneOffset value');
const cast=obj('castId castStatus entityId name rawName role scope provesParticipationInEverySong');
const resource=obj('resourceId resourceKind targetRelation targetScope targetEditionId officiality availability provider publisher rawTitle publishedAt publishedOn datePrecision resourceTargetRelation',{url});
const part=obj('id entityId name rawName role scope partSpecificVocalConfirmed');
const programAssociation=obj('associationScope confirmsPartSpecificPerformance eventId eventOccurrenceStatus eventOfficialDate eventStartsAt eventStatus eventTitle linkCompleteness linkId occurrenceId programItemId programItemKind rawLabel rawPosition relationType sequenceNo');
const rendition=obj('completeness dateBasis isReference occurredAt occurredOn partRawLabel partSequenceNo realizationKind renditionContainsMultipleWorks renditionId renditionKind renditionPartId renditionRawLabel versionId workId',{
 version,exactPartParticipants:list(part),renditionWideParticipants:list(part),programAssociations:list(programAssociation)});
const mediaAssociation=obj('identityScope linkCompleteness linkId partSpecificContentConfirmed relationType renditionContainsAnotherWork sequenceNo targetRenditionId targetVersionId targetWorkId');
const media=obj('canonicalTitle durationMs mediaId mediaKind presentationKind',{associations:list(mediaAssociation),publications:list(resource),credits:list(credit)});
const releaseAssociation=obj('identityScope linkCompleteness linkId positionScope provesWholeWorkFullPerformance relationType releaseItemPartId subpartKind subpartRawLabel subpartSequenceNo targetVersionId targetWorkId');
const workRelease=obj('durationMs itemKind rawTrackPosition rawTrackTitle releaseItemId trackNumber',{
 family:obj('catalogScope familyId releaseKind title'),edition:obj('catalogNumber datePrecision editionId editionKind editionName releaseDate status'),
 component:obj('componentId componentKind componentNo rawLabel'),associations:list(releaseAssociation),itemCredits:list(credit),releaseResources:list(resource)});
const source=obj('confirmsSpecificFact provesFullPerformance publisher relationLevel relationScope sourceId sourceKind title urlStatus',{url:absentUrl});
const page=(item,names='')=>obj('workId entryId limit offset total '+names,{items:list(item)});
const historyItem=obj('completeness matchBasis multiWork occurredOn partLabel partVocalRows renditionId renditionKind renditionLabel renditionPartId sequenceNo singerSetConfirmedForEntry versionId workId',{relatedEvents:list(obj('eventId title'))});
const factReview=obj('outcome');
const songMetadata=obj('titleKana tieUp originalArtist originalVocal',{
 firstAppearance:obj('date label'),firstFull:obj('date label'),originalCredits:list(obj('role name')),
 lyricsUrl:url,firstAppearanceReview:obj('coverage partialConfirmed'),
 fieldReview:obj('',{firstAppearance:factReview,firstFull:factReview,tieUp:factReview,media:factReview,releases:factReview,history:factReview,versions:factReview,
  credits:obj('',{lyricist:factReview,composer:factReview,arranger:factReview})})});
const entryDetail=obj('displayCredit entryId kind legacySongType primaryWorkId title editorialOriginLabel editorialOriginStatus',{
 songMetadata,
 singers:list(singer),variations:list(variation),relatedVariants:list(obj('displayCredit entryId title')),linkedRenditions:list(obj('renditionId')),
 medleySegments:list(obj('rawLabel sequence workId workTitle')),containingMedleys:list(obj('entryId title'))});
const entry=obj('_exportId visibility candidateSetExhaustive sortTitle verificationStatus',{
 singerIds:list(scalar),legacyIds:list(scalar),detail:entryDetail,
 compare:obj('workId',{entries:list(obj('displayCredit entryId title',{singers:list(scalar),variations:list(variation)}))}),
 credits:obj('entryId',{credits:list(credit)}),historyPages:list(page(historyItem,'directPartCount interpretation renditionCount sameVersionCount workPartCount'))});
const work=obj('_exportId',{
 detail:obj('id sortTitle title',{localizedTitles:list(localizedTitle),versions:list(version),workCredits:list(credit)}),
 collections:obj('',{renditions:list(page(rendition)),media:list(page(media)),releases:list(page(workRelease,'associationPolicy programCaptureLinksAutoPromoted')),
  sources:list({...page(source,'status urlsEnabled'),urlsEnabled:scalar})})});
const distribution=obj('distributionId resourceId resourceKind provider officiality availability channel title label distributionKind startsAt endsAt publishedAt publishedOn',{url});
const occurrence=obj('dateBasis doorsAt endsAt occurrenceId officialDate programCoverageScope programEvidenceStrength programId programItemCount sessionLabel startsAt status timezone venueName',{
 occurrenceCast:list(cast),distributions:list(distribution)});
const eventRelation=obj('relationId relationType eventId relatedEventId sourceEventId targetEventId title relatedEventTitle eventOccurrenceId releaseEditionId releaseScope');
const programPart=obj('completeness partId relationshipToProgram sequenceNo versionId workId workTitle');
const programItem=obj('itemKind programItemId rawLabel rawPosition sequenceNo',{
 associations:list(obj('associationScope completeness linkId mediaObjectId provesPartSpecificSinger provesWholeSongFull relationType renditionId targetKind versionId workId',{renditionParts:list(programPart)}))});
const filterMetadata=obj('format verificationStatus',{
 billingArtists:list(obj('entityId name')),castAdditions:list(cast)});
const event=obj('_exportId',{
 pages:list(obj('eventId eventKind occurrencesLimit occurrencesOffset status title totalOccurrences',{
  eventCast:list(cast),eventRelations:list(eventRelation),eventSeries:list(obj('seriesId seriesKind title')),occurrences:list(occurrence)})),
 programs:list(obj('occurrenceId',{pages:list(page(programItem,'eventId eventStatus eventTitle occurrenceId occurrenceStatus officialDate programAssociationPolicy programCoverageScope programEvidenceStrength programId sessionLabel totalItems'))})),filterMetadata});
const releaseItem=obj('componentId durationMs editionId itemId itemKind rawPosition rawTitle sequenceNo',{
 associations:list(obj('completeness linkId mediaId positionScope programItemId provesWholeWorkFullPerformance relationType releaseItemPartId renditionId targetKind versionId workId')),
 credits:list(credit),subparts:list(obj('partId releaseItemPartId itemPartId sequenceNo kind subpartKind rawLabel rawTitle startsAtMs endsAtMs'))});
const release=obj('_exportId',{
 pages:list(obj('catalogScope familyId fullReleaseLinkProvesSongFull itemIdentityPolicy itemsLimit itemsOffset programCapturePromotedToWork releaseKind title totalEditions totalItems',{
  editions:list(obj('catalogNumber datePrecision editionId kind name releaseDate status',{inclusions:list(obj('id kind quantity rawName'))})),
  components:list(obj('componentId componentKind componentNo editionId parentComponentId rawLabel')),eventRelations:list(eventRelation),
  resources:list(resource),localizedTitles:list(localizedTitle),items:list(releaseItem)}))});
const directories={
 work:obj('_exportId',{pages:list(page(obj('id title versionCount'),'search'))}),
 event:obj('_exportId',{pages:list(page(obj('eventId eventKind firstOfficialDate lastOfficialDate occurrenceCount programItemCount status title'),'search'))}),
 release:obj('_exportId',{pages:list(page(obj('catalogScope earliestReleaseDate editionCount familyId itemCount releaseKind title'),'search'))})
};
const manifest=obj('formatVersion purpose exportId createdAt expectedRows allWorkCount policyVersion catalogId',{counts:obj('directory entry work event release')});
const check=(ok,code)=>{if(!ok)throw new Error(code);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const secret=/sb_(?:secret|publishable)_[A-Za-z0-9_-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
export function publicExternalUrl(value){
 if(typeof value!=='string'||value.length>2048||/[\s\\]/.test(value))return null;
 try{const u=new URL(value);
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||/^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|\[::1\])/i.test(u.hostname)||u.hostname.endsWith('.local'))return null;
  if([...u.searchParams.keys()].some(k=>/(?:token|secret|signature|password|credential|auth|session|api.?key|^key$|^sig$|^code$|x-amz-|x-goog-)/i.test(k)))return null;
  return u.toString();
 }catch{return null;}
}
function project(schema,value,strict=false){
 if(schema===absentUrl){if(strict)check(value===null,'PUBLIC_SOURCE_URL_NOT_ALLOWED');return null;}
 if(schema===url){const safe=publicExternalUrl(value);if(strict)check(value===null||value===safe,'UNSAFE_PUBLIC_URL');return safe;}
 if(value===null)return null;
 if(schema===scalar){check(['string','number','boolean'].includes(typeof value),'INVALID_PUBLIC_SCALAR');
  if(typeof value==='string')check(value.length<=20000&&!secret.test(value),'PUBLIC_VALUE_CONTAINS_SECRET');
  if(typeof value==='number')check(Number.isFinite(value),'INVALID_PUBLIC_NUMBER');return value;}
 if(Array.isArray(schema)){check(Array.isArray(value),'INVALID_PUBLIC_ARRAY');return value.map(x=>project(schema[0],x,strict));}
 check(object(value),'INVALID_PUBLIC_OBJECT');
 if(strict)check(Object.keys(value).every(k=>Object.hasOwn(schema,k)),'UNEXPECTED_PUBLIC_FIELD');
 const out={};for(const [key,spec]of Object.entries(schema))if(Object.hasOwn(value,key))out[key]=project(spec,value[key],strict);return out;
}
const payload=r=>typeof r.payload==='string'?JSON.parse(r.payload):r.payload;
const schemaFor=r=>r.record_type==='manifest'?manifest:r.record_type==='directory'?directories[r.record_id]:({entry,work,event,release})[r.record_type];

/** Public policy: include all registered works and all non-hidden catalogue rows.
 * Candidate closure is reduced to a boolean; private flags/tokens/notes are omitted.
 * This creates a FILE candidate. It never changes a DB publication flag. */
export function createPublicRelease(input,{releaseId=randomUUID(),createdAt=new Date().toISOString(),catalogId=null,liveCandidates,sourceSha256}={}){
 const base=validateExport(input);let live=base;
 if(liveCandidates&&liveCandidatesApplicable(base,liveCandidates,sourceSha256))live=applyLiveFilterCandidates(base,liveCandidates);
 const ids=new Set(base.entries.keys());
 const rows=input.filter(r=>r.record_type!=='manifest').map(r=>{
  const spec=schemaFor(r);check(spec,'UNEXPECTED_PUBLIC_RECORD');
  const p=project(spec,payload(r));p._exportId=releaseId;
  if(r.record_type==='entry'){
   const e=base.entries.get(r.record_id);p.visibility='listed';
   p.detail.legacySongType=songTypeForEntry(e);
   p.detail.songMetadata=project(songMetadata,songMetadataForEntry(e));
   p.candidateSetExhaustive=e.candidateSetExhaustive===true&&(e.unresolvedTokens??[]).length===0&&e.singerIds.length>0&&
    !(e.flags??[]).some(x=>['group_without_membership','role_or_identity_review_voicebank'].includes(x));
   p.detail.relatedVariants=p.detail.relatedVariants.filter(x=>ids.has(x.entryId));
   p.detail.containingMedleys=p.detail.containingMedleys.filter(x=>ids.has(x.entryId));
   if(p.compare)p.compare.entries=p.compare.entries.filter(x=>ids.has(x.entryId));
  }
  if(r.record_type==='work')for(const page of p.collections.sources)page.urlsEnabled=false;
  if(r.record_type==='event'){
   const f=live.events.get(r.record_id)?.filterMetadata;
   if(f)p.filterMetadata=project(filterMetadata,{...f,verificationStatus:'unverified'});
  }
  return {record_type:r.record_type,record_id:r.record_id,payload:p};
 });
 const counts=Object.fromEntries(['directory','entry','work','event','release'].map(k=>[k,rows.filter(r=>r.record_type===k).length]));
 rows.unshift({record_type:'manifest',record_id:'catalog-public-v1',payload:{formatVersion:1,purpose:PUBLIC_PURPOSE,
  exportId:releaseId,createdAt,catalogId,policyVersion:1,expectedRows:rows.length+1,allWorkCount:base.works.size,counts}});
 validatePublicRelease(rows);
 return rows;
}
export function validatePublicRelease(rows){
 check(Array.isArray(rows)&&rows.length>0,'INVALID_PUBLIC_RELEASE');
 for(const r of rows){check(object(r)&&Object.keys(r).sort().join('|')==='payload|record_id|record_type','UNEXPECTED_PUBLIC_RECORD');
  const schema=schemaFor(r);check(schema,'UNEXPECTED_PUBLIC_RECORD');project(schema,r.payload,true);}
 const m=rows.find(r=>r.record_type==='manifest')?.payload;
 check(m?.policyVersion===1&&typeof m.createdAt==='string'&&Number.isFinite(Date.parse(m.createdAt)),'INVALID_PUBLIC_MANIFEST');
 return validateExport(rows,{purpose:PUBLIC_PURPOSE});
}
export function readPublicRelease(path,expectedSha256){
 check(statSync(path).size<=32*1024*1024,'PUBLIC_RELEASE_TOO_LARGE');const bytes=readFileSync(path);
 const sha256=createHash('sha256').update(bytes).digest('hex');if(expectedSha256!==undefined)check(expectedSha256===sha256,'PUBLIC_RELEASE_HASH_MISMATCH');
 const rows=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 return {rows,bytes,sha256,model:validatePublicRelease(rows)};
}
export function publicReleaseDiff(before,after){
 const a=before?validatePublicRelease(before):null,b=validatePublicRelease(after);
 const result={};
 for(const kind of ['entries','works','events','releases']){
  const left=a?.[kind]??new Map(),right=b[kind],added=[],removed=[],changed=[];
  const canonical=v=>Array.isArray(v)?v.map(canonical):object(v)?Object.fromEntries(Object.keys(v).filter(k=>k!=='_exportId').sort().map(k=>[k,canonical(v[k])])):v;
  for(const[id,value]of right){if(!left.has(id))added.push(id);else if(JSON.stringify(canonical(left.get(id)))!==JSON.stringify(canonical(value)))changed.push(id);}
  for(const id of left.keys())if(!right.has(id))removed.push(id);
  result[kind]={added,removed,changed};
 }
 return result;
}
