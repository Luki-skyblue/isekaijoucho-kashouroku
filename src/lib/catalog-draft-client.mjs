// Node-only transport. Never import this module into a Client Component.
// A future server-only UI adapter must authorize every request before calling it.
import {Buffer} from 'node:buffer';
import {DraftError,isUuid,validateTitleDraft,validateSongDraft,validateDraftSnapshot,validateDraftReceipt} from './catalog-draft-contract.mjs';
import {validateOwnerChoicesRequest,validateOwnerChoicesResponse} from './catalog-owner-choices.mjs';

export function ownerDatabaseConfig(env) {
  const url = env.SUPABASE_URL;
  const project = env.CATALOG_OWNER_PROJECT_REF;
  const key = env.CATALOG_OWNER_SUPABASE_KEY;
  if (typeof project !== 'string' || !/^[a-z0-9-]+$/.test(project) ||
      url !== `https://${project}.supabase.co` || typeof key !== 'string') throw new DraftError('OWNER_CONFIG_MISSING');
  let legacy = false;
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(key)) {
    try {
      const parts = key.split('.');
      legacy = parts.length === 3 && parts.every(x=>/^[A-Za-z0-9_-]+$/.test(x)) &&
        JSON.parse(Buffer.from(parts[1],'base64url').toString()).role === 'service_role';
    } catch { /* report a fixed error, never the supplied key */ }
    if (!legacy) throw new DraftError('OWNER_KEY_REQUIRED');
  }
  return {url,key,legacy};
}

export function createDraftStore({env = process.env, fetchImpl = globalThis.fetch} = {}) {
  const {url,key,legacy} = ownerDatabaseConfig(env);
  async function call(name, body, writing) {
    let response;
    try {
      response = await fetchImpl(`${url}/rest/v1/rpc/${name}`, {
        method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(legacy ? {Authorization:`Bearer ${key}`} : {})},
        body:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)
      });
    } catch { throw new DraftError('CONNECTION_UNCERTAIN', {mayHaveSaved:writing}); }
    let data;
    try { data = await response.json(); }
    catch { throw new DraftError('INVALID_RESPONSE', {mayHaveSaved:writing}); }
    if (!response.ok) {
      const errors = {'42501':'FORBIDDEN','40001':'STALE_REVISION','23505':'SAVE_CONFLICT',
        '22023':'INVALID_REQUEST','P0002':'ENTRY_NOT_FOUND','P0001':'SAVE_BLOCKED_REVIEW_REQUIRED',
        '55000':'DRAFT_REQUIRED','55P03':'BUSY_RETRY_SAME_OPERATION','57014':'CANCELLED_NOT_SAVED',
        '22P02':'INVALID_REQUEST','22P05':'INVALID_REQUEST','23514':'SAVE_BLOCKED_REVIEW_REQUIRED'};
      throw new DraftError(errors[data?.code] ?? 'SAVE_RESULT_UNKNOWN', {mayHaveSaved:writing && !errors[data?.code]});
    }
    return data;
  }
  return Object.freeze({
    async get(entryId) {
      if (!isUuid(entryId)) throw new DraftError('INVALID_ENTRY_ID');
      const result = validateDraftSnapshot(await call('kashouroku_owner_entry_draft_v1',{p_entry_id:entryId},false));
      if (result.id !== entryId) throw new DraftError('INVALID_SNAPSHOT');
      return result;
    },
    async save(input) {
      const request = validateTitleDraft(input);
      return validateDraftReceipt(await call('kashouroku_owner_save_title_draft_v1',{p_request:request},true),request);
    },
    async create(input) {
      const request = validateSongDraft(input);
      return validateDraftReceipt(await call('kashouroku_owner_create_song_draft_v1',{p_request:request},true),request);
    },
    async choices(input) {
      const request=validateOwnerChoicesRequest(input);
      return validateOwnerChoicesResponse(await call('kashouroku_owner_choices_v1',{p_request:request},false),request);
    }
  });
}
