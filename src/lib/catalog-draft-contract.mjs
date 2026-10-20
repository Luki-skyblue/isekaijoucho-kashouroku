// Shared input contract for Chat-assisted changes and the future owner UI.
// Validation does not save, fetch a source URL, approve facts, or publish.
export class DraftError extends Error {
  constructor(code, {mayHaveSaved = false} = {}) {
    super(code); this.name = 'DraftError'; this.code = code; this.mayHaveSaved = mayHaveSaved;
  }
}
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const keys = (x, names) => object(x) && Object.keys(x).sort().join('|') === [...names].sort().join('|');
export const isUuid = x => typeof x === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(x);
export const isRevision = x => typeof x === 'string' && /^ce1:[0-9a-f]{32}$/.test(x);
const length = x => [...x].length;
const title = x => typeof x === 'string' && length(x) >= 1 && length(x) <= 500 &&
  !/^ | $|[\u0000-\u001f\u007f]/.test(x);
const note = (x, max) => typeof x === 'string' && length(x) <= max && /[^ \t\r\n]/.test(x) &&
  !/[\u0000-\u001f\u007f]/.test(x.replace(/[\t\r\n]/g, ''));
// Deliberately bounded source locator; stored verbatim, never fetched here.
const sourceUrl = x => x === null || (typeof x === 'string' && length(x) <= 4096 &&
  /^https?:\/\/[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?:[/?#][^\s]*)?$/.test(x) &&
  !/[\u0000-\u001f\u007f]/.test(x));

export function validateTitleDraft(input) {
  const ok = keys(input, ['schemaVersion','operationId','entryId','baseRevision','patch','reason','evidence']) &&
    input.schemaVersion === 1 && isUuid(input.operationId) && isUuid(input.entryId) && isRevision(input.baseRevision) &&
    keys(input.patch, ['displayTitle','sortTitle']) && title(input.patch.displayTitle) &&
    (input.patch.sortTitle === null || title(input.patch.sortTitle)) && note(input.reason, 1000) &&
    keys(input.evidence, ['url','note']) && sourceUrl(input.evidence.url) && note(input.evidence.note, 2000);
  if (!ok || new TextEncoder().encode(JSON.stringify(input)).length > 65536) throw new DraftError('INVALID_REQUEST');
  // Copy only the validated contract, without changing source wording or Unicode.
  return structuredClone(input);
}

const rowRevision = x => Number.isSafeInteger(x) && x > 0;
export function validateSongDraft(input) {
  const work = input?.work;
  const validWork = (keys(work,['mode','title','sortTitle']) && work.mode === 'new' && title(work.title) &&
    (work.sortTitle === null || title(work.sortTitle))) ||
    (keys(work,['mode','id','revision','version']) && work.mode === 'existing' && isUuid(work.id) && rowRevision(work.revision) &&
      (work.version === null || (keys(work.version,['id','revision']) && isUuid(work.version.id) && rowRevision(work.version.revision))));
  const vocal = input?.vocal;
  const validVocal = keys(vocal,['rawCredit','memberIds','unresolvedTokens','setComplete']) &&
    (vocal.rawCredit === null || note(vocal.rawCredit,2000)) && Array.isArray(vocal.memberIds) &&
    vocal.memberIds.length <= 64 && vocal.memberIds.every(isUuid) && new Set(vocal.memberIds).size === vocal.memberIds.length &&
    Array.isArray(vocal.unresolvedTokens) && vocal.unresolvedTokens.length <= 64 && vocal.unresolvedTokens.every(title) &&
    new Set(vocal.unresolvedTokens).size === vocal.unresolvedTokens.length && typeof vocal.setComplete === 'boolean' &&
    (!vocal.setComplete || (vocal.memberIds.length > 0 && vocal.unresolvedTokens.length === 0));
  const ok = keys(input,['schemaVersion','operationId','work','entry','vocal','reason','evidence']) &&
    input.schemaVersion === 1 && isUuid(input.operationId) && validWork && validVocal &&
    keys(input.entry,['displayTitle','sortTitle']) && title(input.entry.displayTitle) &&
    (input.entry.sortTitle === null || title(input.entry.sortTitle)) && note(input.reason,1000) &&
    keys(input.evidence,['url','note']) && input.evidence.url !== null && sourceUrl(input.evidence.url) && note(input.evidence.note,2000);
  if (!ok || new TextEncoder().encode(JSON.stringify(input)).length > 65536) throw new DraftError('INVALID_REQUEST');
  return structuredClone(input);
}

export function validateDraftSnapshot(input) {
  if (!object(input) || input.schemaVersion !== 1 || !isUuid(input.id) || !isRevision(input.revision) ||
      !title(input.displayTitle) || !(input.sortTitle === null || title(input.sortTitle)) ||
      !['official','editorial','legacy'].includes(input.titleBasis) || input.visibility !== 'draft') {
    throw new DraftError('INVALID_SNAPSHOT');
  }
  return Object.fromEntries(['schemaVersion','id','revision','displayTitle','sortTitle','titleBasis','visibility'].map(k => [k,input[k]]));
}

export function validateDraftReceipt(input, request) {
  const state = x => object(x) && typeof x.displayTitle === 'string' &&
    (x.sortTitle === null || typeof x.sortTitle === 'string') &&
    ['official','editorial','legacy'].includes(x.titleBasis) && x.visibility === 'draft';
  const creating = 'work' in request;
  const expected = creating ? request.entry : request.patch;
  if (!object(input) || input.schemaVersion !== 1 || input.operationId !== request.operationId ||
      input.changeSetId !== request.operationId || !rowRevision(input.journalRevision) ||
      !isUuid(input.entryId) || (input.workId !== null && !isUuid(input.workId)) ||
      (creating ? (input.before !== null || input.baseRevision !== null || input.journalRevision !== 1 || !isUuid(input.workId) ||
        (request.work.mode === 'existing' && input.workId !== request.work.id)) :
        (input.entryId !== request.entryId || input.baseRevision !== request.baseRevision || !state(input.before))) ||
      !isRevision(input.revision) || !state(input.after) || input.after.displayTitle !== expected.displayTitle ||
      input.after.sortTitle !== expected.sortTitle ||
      input.after.titleBasis !== (creating ? 'editorial' : (input.before.displayTitle === input.after.displayTitle ? input.before.titleBasis : 'editorial')) ||
      typeof input.savedAt !== 'string' || !Number.isFinite(Date.parse(input.savedAt)) || typeof input.replayed !== 'boolean') {
    throw new DraftError('INVALID_RECEIPT', {mayHaveSaved:true});
  }
  const pick = x => Object.fromEntries(['displayTitle','sortTitle','titleBasis','visibility'].map(k=>[k,x[k]]));
  return {schemaVersion:1,operationId:input.operationId,changeSetId:input.changeSetId,entryId:input.entryId,workId:input.workId,
    baseRevision:input.baseRevision,revision:input.revision,journalRevision:input.journalRevision,
    before:creating?null:pick(input.before),after:pick(input.after),savedAt:input.savedAt,replayed:input.replayed};
}
