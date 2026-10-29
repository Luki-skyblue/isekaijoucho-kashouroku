// G0 experiment only. No network, database writes, publishing, or fixture overlays.
import {readFileSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {songArtworkCandidatesForEntry,songTypeForEntry,songMetadataForEntry,songTitleCaptionForEntry} from './song-detail-data.mjs';
import {supplementalReleasesForEntry} from './release-content-data.mjs';
import {singerIdsForEntry} from './catalog-people.mjs';
import {eventArtworkForEvent} from './catalog-artwork.mjs';
import {supplementalLivesForEntry} from './live-program-supplements.mjs';
import {isAbsolute} from 'node:path';
import {catalogNameMatches} from './catalog-name-search.mjs';
import {workSearchTitles,releaseTitleMatches,eventTitleMatches} from './catalog-title-search.mjs';

export const PURPOSE = 'PRIVATE_G0_READ_MODEL_EXPERIMENT_NOT_FOR_PUBLICATION';
export const PUBLIC_PURPOSE = 'KASHOUROKU_PUBLIC_RELEASE_V1';
const readable = model => [PURPOSE,PUBLIC_PURPOSE].includes(model?.purpose);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const check = (ok, message) => {if (!ok) throw new Error(message);};
const integer = x => Number.isSafeInteger(x) && x >= 0;

export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], field = '', quoted = false, closed = false;
  const push = () => {row.push(field); field = ''; closed = false;};
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') {field += '"'; i++;}
      else {quoted = false; closed = true;}
    } else if (c === ',' || c === '\n' || c === '\r') {
      push();
      if (c !== ',') {rows.push(row); row = []; if (c === '\r' && text[i+1] === '\n') i++;}
    } else if (c === '"') {
      check(!closed && field === '', 'Malformed CSV quoting'); quoted = true;
    } else {check(!closed, 'Unexpected text after CSV quote'); field += c;}
  }
  check(!quoted, 'Truncated CSV quoted field');
  if (field !== '' || row.length || closed) {push(); rows.push(row);}
  const header = rows.shift();
  check(header?.length === 3 && ['record_type','record_id','payload'].every(k => header.includes(k)), 'Unexpected CSV columns');
  const positions = ['record_type','record_id','payload'].map(k => header.indexOf(k));
  return rows.filter(r => !(r.length === 1 && r[0] === '')).map(r => {
    check(r.length === 3, 'Truncated or malformed CSV row');
    return Object.fromEntries(positions.map((at, i) => [['record_type','record_id','payload'][i], r[at]]));
  });
}

export function readExport(path, expectedSha256) {
  check(statSync(path).size <= 100 * 1024 * 1024, 'Export exceeds 100 MiB experiment limit');
  const bytes = readFileSync(path);
  check(bytes.length <= 100 * 1024 * 1024, 'Export exceeds 100 MiB experiment limit');
  if (expectedSha256 !== undefined)
    check(/^[a-f0-9]{64}$/.test(expectedSha256) && createHash('sha256').update(bytes).digest('hex') === expectedSha256, 'Private snapshot hash mismatch');
  const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe;
  const text = new TextDecoder(utf16 ? 'utf-16le' : 'utf-8', {fatal:true})
    .decode(utf16 ? bytes.subarray(2) : bytes).replace(/^\uFEFF/, '');
  const rows = text.trimStart().startsWith('[') ? JSON.parse(text) : parseCsv(text);
  return {rows, bytes};
}

/** Reject missing pages and unstable totals instead of calling a prefix complete. */
export function collectPages(pages, {items = 'items', total = 'total', step = 50} = {}) {
  check(Array.isArray(pages) && pages.length > 0, 'Missing first page');
  const n = pages[0]?.[total];
  check(integer(n), 'Invalid page total');
  check(pages.length === Math.max(1, Math.ceil(n / step)), 'Missing or extra pages');
  const collected = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    check(object(p) && p[total] === n && Array.isArray(p[items]), 'Invalid page or changing total');
    // Some existing detail RPCs omit pagination metadata; array/total checks still apply.
    if (p.offset !== undefined) check(p.offset === i * step, 'Wrong page offset');
    if (p.limit !== undefined) check(p.limit === step, 'Unexpected page limit');
    const prefix=items === 'occurrences' ? 'occurrences' : 'items';
    if (p[`${prefix}Offset`] !== undefined) check(p[`${prefix}Offset`] === i * step, 'Wrong detail page offset');
    if (p[`${prefix}Limit`] !== undefined) check(p[`${prefix}Limit`] === step, 'Unexpected detail page limit');
    check(p[items].length === Math.min(step, Math.max(0, n - i * step)), 'Incomplete page');
    collected.push(...p[items]);
  }
  return collected;
}

function sameIds(items, ids, field, context) {
  const actual = items.map(x => x?.[field]);
  check(actual.every(x => typeof x === 'string') && new Set(actual).size === actual.length, `${context}: duplicate/missing ID`);
  check(actual.length === ids.size && actual.every(x => ids.has(x)), `${context}: ID coverage mismatch`);
}
function uniqueItems(items,key,context) {
  const ids=items.map(x=>x?.[key]);
  check(ids.every(x=>typeof x === 'string' && uuid.test(x)) && new Set(ids).size === ids.length,`${context}: duplicate/missing item identity`);
}

export function validateExport(input,{purpose=PURPOSE}={}) {
  check([PURPOSE,PUBLIC_PURPOSE].includes(purpose),'Invalid read model purpose');
  check(Array.isArray(input) && input.length > 0, 'Empty export');
  const groups = Object.fromEntries(['manifest','directory','entry','work','event','release'].map(k => [k, new Map()]));
  for (const row of input) {
    check(object(row) && Object.hasOwn(groups, row.record_type) && typeof row.record_id === 'string', 'Unexpected export record');
    const group = groups[row.record_type];
    check(!group.has(row.record_id), 'Duplicate export record');
    let payload = row.payload;
    if (typeof payload === 'string') {try {payload = JSON.parse(payload);} catch {throw new Error('Invalid/truncated payload JSON');}}
    check(object(payload), 'Missing record payload');
    if (!['manifest','directory'].includes(row.record_type)) check(uuid.test(row.record_id), 'Invalid record UUID');
    group.set(row.record_id, payload);
  }
  const manifestId=purpose===PURPOSE?'g0-private-v1':'catalog-public-v1';
  check(groups.manifest.size === 1 && groups.manifest.has(manifestId), 'Missing export manifest');
  const m = groups.manifest.get(manifestId);
  check(m.formatVersion === 1 && m.purpose === purpose && typeof m.exportId === 'string' && uuid.test(m.exportId), 'Wrong export format/purpose');
  for (const type of ['directory','entry','work','event','release'])
    for (const payload of groups[type].values()) check(payload._exportId === m.exportId, 'Mixed export versions');
  if(purpose===PURPOSE)check(m.databaseReadOnly === 'on' && m.isolation === 'repeatable read', 'Database snapshot boundary not confirmed');
  check(m.expectedRows === input.length && object(m.counts), 'Truncated export: manifest row count mismatch');
  for (const type of ['directory','entry','work','event','release']) {
    check((m.counts[type] ?? 0) === groups[type].size, `${type}: manifest count mismatch`);
  }
  check(groups.directory.size === 3 && m.allWorkCount === groups.work.size, 'Canonical work coverage mismatch');
  const directories = {};
  for (const [kind, field] of [['work','id'],['event','eventId'],['release','familyId']]) {
    directories[kind] = collectPages(groups.directory.get(kind)?.pages);
    sameIds(directories[kind], new Set(groups[kind].keys()), field, kind);
  }
  const workData = new Map(); let relatedSourceRows = 0;
  for (const [id, w] of groups.work) {
    check(object(w.detail) && w.detail.id === id && typeof w.detail.title === 'string', 'Missing work detail');
    check(Array.isArray(w.detail.localizedTitles) && Array.isArray(w.detail.versions), 'Invalid work title/version projection');
    check(object(w.collections), 'Missing work collections');
    const data = {detail:w.detail,collectionMeta:{}};
    for (const k of ['renditions','media','releases','sources']) {
      data[k] = collectPages(w.collections[k]);data.collectionMeta[k]=w.collections[k][0];
      for (const page of w.collections[k]) check(page.workId === id, 'Collection scoped to a different work');
    }
    for(const [k,key] of [['renditions','renditionPartId'],['media','mediaId'],['releases','releaseItemId']])uniqueItems(data[k],key,k);
    relatedSourceRows += data.sources.length; workData.set(id, data);
  }
  const entryData = new Map();
  for (const [id, e] of groups.entry) {
    const d = e.detail;
    check(object(d) && d.entryId === id && typeof d.title === 'string', 'Missing entry detail');
    check((purpose===PURPOSE?['draft','published']:['listed']).includes(e.visibility), 'Unexpected entry visibility');
    check(['song_variant','medley'].includes(d.kind), 'Invalid entry kind');
    check(Array.isArray(e.singerIds) && e.singerIds.every(x => uuid.test(x)) && new Set(e.singerIds).size === e.singerIds.length, 'Invalid singer set');
    check(Array.isArray(d.singers), 'Missing singer display projection');
    sameIds(d.singers, new Set(e.singerIds), 'entityId', 'entry singers');
    check(e.candidateSetExhaustive === null || typeof e.candidateSetExhaustive === 'boolean', 'Invalid candidate closure');
    if(purpose===PURPOSE){
      check(e.unresolvedTokens === null || Array.isArray(e.unresolvedTokens), 'Invalid unresolved tokens');
      check(e.flags === null || Array.isArray(e.flags), 'Invalid candidate flags');
    }
    check(Array.isArray(e.legacyIds) && e.legacyIds.every(x => Number.isSafeInteger(x) && x > 0), 'Invalid legacy mapping');
    check(Array.isArray(d.medleySegments), 'Missing medley projection');
    if (d.kind === 'song_variant') check(workData.has(d.primaryWorkId), 'Entry work missing from export');
    else check(d.primaryWorkId === null, 'Medley cannot have an inferred primary work');
    for (const segment of d.medleySegments) check(workData.has(segment.workId), 'Medley component missing from export');
    const history = collectPages(e.historyPages, {step:100});
    for (const page of e.historyPages) check(page.entryId === id, 'History scoped to a different entry');
    for (const item of history) check(item.singerSetConfirmedForEntry === false, 'History projection unexpectedly asserts exact live singers');
    uniqueItems(history,'renditionPartId','entry history');
    check(object(e.credits) && e.credits.entryId === id && Array.isArray(e.credits.credits), 'Missing entry credits projection');
    if (d.kind === 'song_variant') check(object(e.compare) && e.compare.workId === d.primaryWorkId && Array.isArray(e.compare.entries), 'Missing or incorrectly scoped comparison projection');
    else check(e.compare === null, 'Medley comparison must not imply one work');
    entryData.set(id, {...e, history});
  }
  const eventData = new Map(); let programItemCount = 0;
  for (const [id, e] of groups.event) {
    const occurrences = collectPages(e.pages, {items:'occurrences',total:'totalOccurrences'});
    for (const page of e.pages) check(page.eventId === id, 'Detail scoped to a different event');
    check(Array.isArray(e.programs), 'Missing event programs');
    sameIds(e.programs, new Set(occurrences.map(x => x.occurrenceId)), 'occurrenceId', 'program coverage');
    const occurrenceIds = occurrences.map(x => x.occurrenceId);
    check(occurrenceIds.every(x => uuid.test(x)) && new Set(occurrenceIds).size === occurrenceIds.length, 'Duplicate/invalid occurrences');
    const programs = e.programs.map(p => {
      const items = collectPages(p.pages, {total:'totalItems',step:100});
      uniqueItems(items,'programItemId','event program');
      for (const page of p.pages) check(page.occurrenceId === p.occurrenceId, 'Program belongs to another occurrence');
      programItemCount += items.length; return {...p,items};
    });
    eventData.set(id, {detail:e.pages[0],occurrences,programs,...(purpose===PUBLIC_PURPOSE&&e.filterMetadata?{filterMetadata:e.filterMetadata}:{})});
  }
  const releaseData = new Map(); let releaseItemCount = 0;
  for (const [id, r] of groups.release) {
    const items = collectPages(r.pages, {total:'totalItems',step:100});
    for (const page of r.pages) check(page.familyId === id, 'Detail scoped to a different release');
    uniqueItems(items,'itemId','release');
    releaseItemCount += items.length; releaseData.set(id, {detail:r.pages[0],items});
  }
  return {purpose,manifest:m,directories,entries:entryData,works:workData,events:eventData,releases:releaseData,
    metrics:{counts:m.counts,programItemCount,releaseItemCount,relatedSourceRows}};
}

function closed(e) {
  return e.candidateSetExhaustive === true && (e.unresolvedTokens ?? []).length === 0 && e.singerIds.length > 0 &&
    !(e.flags ?? []).some(x => ['group_without_membership','role_or_identity_review_voicebank'].includes(x));
}
const cmp = (a,b) => Buffer.compare(Buffer.from(a,'utf8'),Buffer.from(b,'utf8'));
const matches = (a,b) => typeof a === 'string' && catalogNameMatches({name:a},b);

/** Reads persisted candidates and reviewed named-vocal links. Supplemental IDs
 * do not change the raw set or its completeness/verification state. */
export function queryEntries(model, filters = {}) {
  check(readable(model), 'A validated catalog model is required');
  const {search = '',singerIds = [],singerMatch = 'contains',selectedKinds = [],sort = 'first_desc',limit = 24,offset = 0} = filters;
  check(typeof search === 'string' && Array.isArray(singerIds) && singerIds.length <= 20 && singerIds.every(x => typeof x === 'string' && uuid.test(x)), 'Invalid query');
  check(['contains','only','any','subset'].includes(singerMatch), 'Invalid singer mode');
  check(Array.isArray(selectedKinds) && new Set(selectedKinds).size === selectedKinds.length && selectedKinds.every(x => ['original','cover','collaboration','variant','medley'].includes(x)), 'Invalid categories');
  check(['title_asc','title_desc','first_asc','first_desc'].includes(sort) && integer(limit) && limit >= 1 && limit <= 100 && integer(offset) && offset <= 100000, 'Invalid pagination/sort');
  const chronological=sort==='first_asc'||sort==='first_desc';
  const q = search.trim().slice(0,100), chosen = new Set(singerIds);
  const rows = [];
  for (const [entryId,e] of model.entries) {
    const d = e.detail, songType=songTypeForEntry(e), actual = new Set(singerIdsForEntry(e));
    // Supplementing a named candidate cannot close an old incomplete set.
    const exhaustive=closed(e)&&actual.size===new Set(e.singerIds).size;
    if (chosen.size) {
      const overlap = [...chosen].some(x => actual.has(x));
      if (singerMatch === 'any' && !overlap) continue;
      if (singerMatch === 'contains' && ![...chosen].every(x => actual.has(x))) continue;
      if (singerMatch === 'only' && !(exhaustive && actual.size === chosen.size && [...chosen].every(x => actual.has(x)))) continue;
      if (singerMatch === 'subset' && !(exhaustive && [...actual].every(x => chosen.has(x)))) continue;
    }
    if (selectedKinds.length && !selectedKinds.includes(d.kind === 'medley' ? 'medley' : songType)) continue;
    const workTitles = id => workSearchTitles(model.works.get(id)?.detail);
    let rank = 0;
    if (q && ![...workSearchTitles(d),...workTitles(d.primaryWorkId)].some(t => matches(t,q)) &&
        !matches(songMetadataForEntry(e,undefined,model.works.get(d.primaryWorkId)).titleKana,q) &&
        !(d.kind === 'medley' && matches('メドレー',q) && matches(q,'メドレー'))) {
      if (d.kind !== 'medley' || !d.medleySegments.some(s => [s.rawLabel,s.workTitle,...workTitles(s.workId)].some(t => matches(t,q)))) continue;
      rank = 1;
    }
    let firstAppearanceDate=null;
    if(chronological){
      const value=songMetadataForEntry(e,undefined,model.works.get(d.primaryWorkId)).firstAppearance?.date;
      if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value)firstAppearanceDate=value;
    }
    rows.push({entryId,title:d.title,kind:d.kind,displayCredit:songTitleCaptionForEntry(e),legacySongType:songType,
      matchKind:rank ? 'component' : 'title',rank,sortTitle:e.sortTitle ?? d.title,...(chronological?{firstAppearanceDate}:{})});
  }
  rows.sort((a,b) => {
    if(chronological){
      if(!a.firstAppearanceDate||!b.firstAppearanceDate){if(a.firstAppearanceDate!==b.firstAppearanceDate)return a.firstAppearanceDate?-1:1;}
      else if(a.firstAppearanceDate!==b.firstAppearanceDate)return (sort==='first_desc'?-1:1)*cmp(a.firstAppearanceDate,b.firstAppearanceDate);
      return a.rank-b.rank||cmp(a.sortTitle,b.sortTitle)||cmp(a.entryId,b.entryId);
    }
    return a.rank-b.rank || (sort === 'title_desc' ? -1 : 1)*cmp(a.sortTitle,b.sortTitle) || cmp(a.entryId,b.entryId);
  });
  return {items:rows.slice(offset,offset+limit).map(({rank,sortTitle,...x}) => {
    const entry=model.entries.get(x.entryId);
    const images=songArtworkCandidatesForEntry(entry,model.works.get(entry.detail.primaryWorkId),{additionalLives:supplementalLivesForEntry(model,x.entryId),additionalReleases:supplementalReleasesForEntry(model,x.entryId)});
    return {...x,thumbnailUrl:images[0]?.imageUrl??null,thumbnailUrls:images.map(image=>image.imageUrl)};
  }),total:rows.length,limit,offset};
}

// LIVE search separates billing from participation. Individual metadata remains scoped to its source.
// Presence at event/occurrence scope never establishes who sang any one song.
function confirmedEventCast(event) {
  if (!event) return [];
  const eligible = (rows,scope) => (Array.isArray(rows) ? rows : []).filter(c =>
    object(c) && c.scope === scope && c.role === 'performer' && c.castStatus === 'confirmed_present' &&
    typeof c.entityId === 'string' && uuid.test(c.entityId));
  return [...eligible(event.detail.eventCast,'event'),...eligible(event.filterMetadata?.castAdditions,'event'),
    ...event.occurrences.flatMap(o => eligible(o.occurrenceCast,'occurrence'))];
}
const liveFormats = ['one_man','festival','unclassified'];
const billingArtists = event => event?.filterMetadata?.billingArtists ?? [];
const eventFormat = (item,event) => event?.filterMetadata?.format ?? (liveFormats.includes(item.eventKind) ? item.eventKind : 'unclassified');

/** Explicit source-backed draft additions for the LIVE preview only. Does not edit
 * the export, detail RPCs, eventCast, or canonical database. Stale candidates fail. */
const canonicalJson=value=>JSON.stringify(value,(_key,item)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export function liveCandidateEventHash(model,eventId){
  const directory=model.directories.event.find(x=>x.eventId===eventId),event=model.events.get(eventId);
  check(directory&&event,'Missing LIVE candidate target');
  return createHash('sha256').update(canonicalJson({directory,event})).digest('hex');
}
export function liveCandidatesApplicable(model,candidates,sourceSha256){
  if(model?.purpose!==PURPOSE||candidates?.purpose!=='PRIVATE_LIVE_FILTER_CANDIDATES_NOT_APPLIED')return false;
  if(model.manifest.exportId===candidates.baseExportId&&sourceSha256===candidates.baseSha256)return true;
  const c=candidates.eventCompatibility;
  if(!c||c.algorithm!=='sha256-event-v1'||c.baseExportId!==candidates.baseExportId||c.baseSha256!==candidates.baseSha256||
    !Array.isArray(candidates.records)||candidates.records.length===0)return false;
  try{return candidates.records.every(r=>typeof r.baseEventSha256==='string'&&liveCandidateEventHash(model,r.eventId)===r.baseEventSha256);}catch{return false;}
}
export function applyLiveFilterCandidates(model,candidates) {
  check(model?.purpose === PURPOSE && object(candidates) && candidates.purpose === 'PRIVATE_LIVE_FILTER_CANDIDATES_NOT_APPLIED', 'Invalid LIVE candidates');
  check(candidates.baseExportId === model.manifest.exportId||liveCandidatesApplicable(model,candidates), 'LIVE candidate base mismatch');
  check(typeof candidates.reviewId === 'string' && Array.isArray(candidates.records), 'Invalid LIVE candidate manifest');
  const events = new Map(model.events), seen = new Set();
  const actor = x => object(x) && typeof x.entityId === 'string' && uuid.test(x.entityId) && typeof x.name === 'string' && x.name.trim().length > 0;
  for (const r of candidates.records) {
    check(object(r) && !seen.has(r.eventId), 'Duplicate or invalid LIVE candidate');seen.add(r.eventId);
    const directory = model.directories.event.find(x => x.eventId === r.eventId), event = events.get(r.eventId);
    check(directory && event && directory.title === r.expectedTitle && directory.firstOfficialDate === r.expectedFirstOfficialDate, 'LIVE candidate target mismatch');
    check(r.state === 'source_checked_draft' && (r.format === undefined || liveFormats.includes(r.format)), 'Invalid LIVE candidate state/format');
    check(Array.isArray(r.sourceUrls) && r.sourceUrls.length > 0 && r.sourceUrls.every(x => {
      try {const u=new URL(x);return u.protocol === 'https:' && !u.username && !u.password;} catch {return false;}
    }), 'LIVE candidates need explicit sources');
    check(Array.isArray(r.billingArtists) && r.billingArtists.every(actor) && new Set(r.billingArtists.map(x=>x.entityId.toLowerCase())).size === r.billingArtists.length, 'Invalid LIVE billing');
    const additions = r.castAdditions ?? [];
    check(Array.isArray(additions) && additions.every(x => actor(x) && x.castStatus === 'confirmed_present') && new Set(additions.map(x=>x.entityId.toLowerCase())).size === additions.length, 'Invalid LIVE cast additions');
    events.set(r.eventId,{...event,filterMetadata:{format:r.format,
      billingArtists:r.billingArtists.map(x=>({entityId:x.entityId.toLowerCase(),name:x.name})),
      castAdditions:additions.map(x=>({entityId:x.entityId.toLowerCase(),name:x.name,scope:'event',role:'performer',castStatus:x.castStatus,provesParticipationInEverySong:false})),
      reviewId:candidates.reviewId}});
  }
  return {...model,events};
}
const eventNameOrder = new Intl.Collator('ja',{numeric:true});
function eventDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value ? value : null;
}

/** Raw stored kinds are not a reviewed UI taxonomy; especially other != confirmed "other". */
export function eventFilterOptions(model) {
  check(readable(model), 'A validated catalog model is required');
  const cast = new Map(), kinds = new Map(), billing = new Map(), formats = new Map();
  let eventsWithCast = 0, eventsWithBilling = 0;
  for (const item of model.directories.event) {
    const event = model.events.get(item.eventId), rows = confirmedEventCast(event), seen = new Set();
    if (rows.length) eventsWithCast++;
    for (const c of rows) {
      const entityId = c.entityId.toLowerCase();
      if (seen.has(entityId)) continue;
      seen.add(entityId);
      const current = cast.get(entityId);
      if (current) current.eventCount++;
      else cast.set(entityId,{entityId,name:typeof c.name === 'string' ? c.name : '',eventCount:1});
    }
    const named = billingArtists(event);
    if (named.length) eventsWithBilling++;
    for (const a of named) {
      const current = billing.get(a.entityId);
      if (current) current.eventCount++;
      else billing.set(a.entityId,{...a,eventCount:1});
    }
    const format = eventFormat(item,event);formats.set(format,(formats.get(format) ?? 0) + 1);
    if (typeof item.eventKind === 'string' && item.eventKind)
      kinds.set(item.eventKind,(kinds.get(item.eventKind) ?? 0) + 1);
  }
  const order = (a,b) => eventNameOrder.compare(a.name,b.name) || cmp(a.entityId,b.entityId);
  const artists = new Map([...cast,...billing].map(([id,a]) => [id,{entityId:id,name:a.name}]));
  return {cast:[...cast.values()].sort(order),billing:[...billing.values()].sort(order),artists:[...artists.values()].sort(order),
    formats:liveFormats.map(value=>({value,eventCount:formats.get(value) ?? 0})),
    storedKinds:[...kinds].sort(([a],[b]) => cmp(a,b)).map(([value,eventCount]) => ({value,eventCount})),
    billingCoverage:{totalEvents:model.directories.event.length,eventsWithBilling,eventsWithoutBilling:model.directories.event.length-eventsWithBilling},
    coverage:{totalEvents:model.directories.event.length,eventsWithCast,eventsWithoutCast:model.directories.event.length-eventsWithCast}};
}

/** Filter and sort the entire same-version directory before pagination. */
export function queryEvents(model, filters = {}) {
  check(readable(model) && object(filters), 'A validated catalog model and filters are required');
  check(Object.keys(filters).every(k => ['search','castIds','billingIds','castMatch','eventKinds','formats','sort','dateBasis','limit','offset'].includes(k)), 'Unsupported event filter');
  const {search = '',castIds = [],billingIds = [],castMatch = 'any',eventKinds = [],formats = [],sort = 'date_desc',dateBasis = 'first',limit = 24,offset = 0} = filters;
  check(typeof search === 'string' && Array.isArray(castIds) && castIds.length <= 100 &&
    castIds.every(x => typeof x === 'string' && uuid.test(x)), 'Invalid event cast query');
  const selected = new Set(castIds.map(x => x.toLowerCase()));
  check(selected.size === castIds.length && ['any','all'].includes(castMatch), 'Invalid event cast mode/selection');
  check(Array.isArray(billingIds) && billingIds.length <= 100 && billingIds.every(x=>typeof x === 'string' && uuid.test(x)) &&
    new Set(billingIds.map(x=>x.toLowerCase())).size === billingIds.length, 'Invalid LIVE billing selection');
  check(Array.isArray(formats) && new Set(formats).size === formats.length && formats.every(x=>liveFormats.includes(x)), 'Invalid LIVE formats');
  const selectedBilling = new Set(billingIds.map(x=>x.toLowerCase()));
  const matchesSet = (chosen,actual) => !chosen.size || (castMatch === 'all' ? [...chosen].every(id=>actual.has(id)) : [...chosen].some(id=>actual.has(id)));
  check(Array.isArray(eventKinds) && eventKinds.length <= 100 && new Set(eventKinds).size === eventKinds.length &&
    eventKinds.every(x => typeof x === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(x)), 'Invalid stored event kinds');
  check(['date_desc','date_asc','title_asc','title_desc'].includes(sort) && ['first','last'].includes(dateBasis) &&
    integer(limit) && limit >= 1 && limit <= 100 && integer(offset) && offset <= 100000, 'Invalid event pagination/sort');
  const q = search.trim().slice(0,100);
  const rows = model.directories.event.filter(item => {
    if (q && !eventTitleMatches(model,item.eventId,item.title,q)) return false;
    if (eventKinds.length && !eventKinds.includes(item.eventKind)) return false;
    const event = model.events.get(item.eventId);
    if (formats.length && !formats.includes(eventFormat(item,event))) return false;
    if (!matchesSet(selectedBilling,new Set(billingArtists(event).map(x=>x.entityId)))) return false;
    if (!selected.size) return true;
    const actual = new Set(confirmedEventCast(model.events.get(item.eventId)).map(c => c.entityId.toLowerCase()));
    return castMatch === 'all' ? [...selected].every(id => actual.has(id)) : [...selected].some(id => actual.has(id));
  });
  rows.sort((a,b) => {
    if (sort.startsWith('date_')) {
      const key = dateBasis === 'first' ? 'firstOfficialDate' : 'lastOfficialDate', ad = eventDate(a[key]), bd = eventDate(b[key]);
      // Unknown dates stay last in either direction; never guess from another date field.
      if (ad === null && bd !== null) return 1;
      if (ad !== null && bd === null) return -1;
      if (ad !== bd) return (sort === 'date_desc' ? -1 : 1) * cmp(ad,bd);
    }
    const titleOrder = eventNameOrder.compare(typeof a.title === 'string' ? a.title : '',typeof b.title === 'string' ? b.title : '');
    return (sort === 'title_desc' ? -1 : 1) * titleOrder || cmp(a.eventId,b.eventId);
  });
  return {items:rows.slice(offset,offset+limit).map(x => {
    const event=model.events.get(x.eventId);
    return {...x,thumbnailUrl:eventArtworkForEvent(x)?.imageUrl??null,liveFormat:eventFormat(x,event),billingArtists:billingArtists(event).map(({entityId,name})=>({entityId,name}))};
  }),total:rows.length,limit,offset};
}

export function inspectFile(path) {
  const started = performance.now(), {rows,bytes} = readExport(path), parsed = performance.now();
  const model = validateExport(rows), validated = performance.now();
  const compact = Buffer.from(JSON.stringify(rows.map(({record_type,record_id,payload}) => ({
    record_type,record_id,payload:typeof payload === 'string' ? JSON.parse(payload) : payload
  }))));
  return {status:'PRIVATE_EXPORT_VALIDATED',purpose:PURPOSE,exportSha256:createHash('sha256').update(bytes).digest('hex'),
    sourceBytes:bytes.length,compactBytes:compact.length,gzipBytes:gzipSync(compact).length,
    parseMs:parsed-started,validationMs:validated-parsed,serverElapsedMs:model.manifest.serverElapsedMs,
    ...model.metrics,bAdoption:'PENDING_OWNER_EDIT_PUBLIC_RELEASE_AND_BROWSER_ACCEPTANCE'};
}

export function privateSnapshotConfig(env = process.env) {
  if (env.CATALOG_REVIEW_MODE !== 'private_snapshot') return null;
  check(env.NODE_ENV === 'development' && !env.VERCEL, 'Private snapshot is local development only');
  const file=env.CATALOG_REVIEW_FILE, sha256=env.CATALOG_REVIEW_SHA256;
  check(typeof file === 'string' && isAbsolute(file) && typeof sha256 === 'string' && /^[a-f0-9]{64}$/.test(sha256), 'Private snapshot file/hash required');
  return {file,sha256};
}

export function assertPrivateLoopback(host, forwardedHost = null) {
  const local = x => typeof x === 'string' && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(x);
  check(local(host) && (forwardedHost === null || local(forwardedHost)), 'Private snapshot requires a loopback host');
}

/** Serve the existing RPC shapes from one validated version. No live fallback. */
export function snapshotRpc(model, name, p = {}) {
  check(readable(model) && object(p), 'Validated catalog model and parameters required');
  const page = (items, base = {}, max = 100, defaultLimit = 24, totalKey = 'total', itemsKey = 'items', maxOffset = 10000) => {
    const limit=p.p_limit === undefined ? defaultLimit : p.p_limit, offset=p.p_offset === undefined ? 0 : p.p_offset;
    check(integer(limit) && limit >= 1 && limit <= max && integer(offset) && offset <= maxOffset, 'Invalid snapshot pagination');
    return {...base,[itemsKey]:items.slice(offset,offset+limit),[totalKey]:items.length,limit,offset};
  };
  const term = () => {check(p.p_search === undefined || p.p_search === null || typeof p.p_search === 'string', 'Invalid snapshot search');return (p.p_search ?? '').trim().slice(0,100);};
  const get = (map,key) => typeof p[key] === 'string' && uuid.test(p[key]) ? map.get(p[key]) : undefined;
  const noExtras = allowed => check(Object.keys(p).every(k => allowed.includes(k)), 'Unsupported private RPC parameters');
  const directories={kashouroku_v3_works:'work',kashouroku_v3_events:'event',kashouroku_v3_release_families:'release'};
  if (Object.hasOwn(directories,name)) {
    noExtras(['p_search','p_limit','p_offset']); const kind=directories[name],q=term();
    const items=model.directories[kind].filter(x => !q || (kind==='work'
      ? [x.title,...workSearchTitles(model.works.get(x.id)?.detail)].some(title=>matches(title,q))
      : kind==='release' ? releaseTitleMatches(model,model.releases.get(x.familyId)?.detail??x,q)
      : eventTitleMatches(model,x.eventId,x.title,q)));
    return page(items,{search:q || null},50);
  }
  if (['kashouroku_v3_catalog_entries','kashouroku_v3_catalog_entries_v2'].includes(name)) {
    const v2=name.endsWith('_v2');
    noExtras(v2 ? ['p_search','p_singer_ids','p_singer_match','p_legacy_song_types','p_sort','p_limit','p_offset'] :
      ['p_search','p_singer_ids','p_singer_match','p_include_medleys','p_legacy_song_type','p_sort','p_limit','p_offset']);
    const modes=v2 ? {any:'any',all:'contains',exact:'only',subset:'subset'} : {contains:'contains',only:'only'};
    const mode=p.p_singer_match ?? (v2 ? 'any':'contains');
    check(Object.hasOwn(modes,mode), 'Invalid snapshot singer mode');
    let kinds=p.p_legacy_song_types ?? [];
    if (!v2) {
      check(p.p_include_medleys === undefined || typeof p.p_include_medleys === 'boolean', 'Invalid medley flag');
      kinds=p.p_legacy_song_type ? [p.p_legacy_song_type] : p.p_include_medleys === false ? ['original','cover','collaboration','variant'] : [];
    }
    return queryEntries(model,{search:term(),singerIds:p.p_singer_ids ?? [],singerMatch:modes[mode],selectedKinds:kinds,
      sort:p.p_sort ?? 'title_asc',limit:p.p_limit === undefined ? 24:p.p_limit,offset:p.p_offset === undefined ? 0:p.p_offset});
  }
  if (['kashouroku_v3_catalog_entry','kashouroku_v3_catalog_compare','kashouroku_v3_catalog_entry_credits','kashouroku_v3_catalog_entry_history'].includes(name)) {
    noExtras(name.endsWith('_history') ? ['p_entry_id','p_limit','p_offset'] : ['p_entry_id']);
    const e=get(model.entries,'p_entry_id');if (!e) return null;
    if (name.endsWith('_history')) return page(e.history,e.historyPages[0],100,50,'total','items',100000);
    return name.endsWith('_credits') ? e.credits : name.endsWith('_compare') ? e.compare : e.detail;
  }
  if (name === 'kashouroku_v3_work') {noExtras(['p_work_id']);return get(model.works,'p_work_id')?.detail ?? null;}
  const collections={kashouroku_v3_work_renditions:'renditions',kashouroku_v3_work_media:'media',kashouroku_v3_work_releases:'releases',kashouroku_v3_work_sources:'sources'};
  if (Object.hasOwn(collections,name)) {
    noExtras(['p_work_id','p_limit','p_offset']);const w=get(model.works,'p_work_id');if (!w) return null;
    return page(w[collections[name]],{...w.collectionMeta[collections[name]],workId:p.p_work_id},50,50);
  }
  if (name === 'kashouroku_v3_event') {
    noExtras(['p_event_id','p_limit','p_offset']);const e=get(model.events,'p_event_id');if (!e) return null;
    const result=page(e.occurrences,e.detail,100,50,'totalOccurrences','occurrences');
    return {...result,occurrencesLimit:result.limit,occurrencesOffset:result.offset};
  }
  if (name === 'kashouroku_v3_event_program') {
    noExtras(['p_occurrence_id','p_limit','p_offset']);
    for (const e of model.events.values()) {
      const program=e.programs.find(x => x.occurrenceId === p.p_occurrence_id);
      if (program) return page(program.items,program.pages[0],100,100,'totalItems');
    }
    return null;
  }
  if (name === 'kashouroku_v3_release_family') {
    noExtras(['p_family_id','p_limit','p_offset']);const r=get(model.releases,'p_family_id');if (!r) return null;
    const result=page(r.items,r.detail,100,100,'totalItems');
    return {...result,itemsLimit:result.limit,itemsOffset:result.offset};
  }
  throw new Error('RPC is not implemented in the private snapshot');
}
