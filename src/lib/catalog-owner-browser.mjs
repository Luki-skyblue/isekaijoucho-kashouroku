// Browser-safe adapter and durable submission state. NO server/database keys.
import {DraftError,validateTitleDraft,validateSongDraft,validateDraftSnapshot,validateDraftReceipt} from './catalog-draft-contract.mjs';
import {validateOwnerChoicesRequest,validateOwnerChoicesResponse} from './catalog-owner-choices.mjs';

const codes=new Set(['INVALID_REQUEST','INVALID_ENTRY_ID','FORBIDDEN','ENTRY_NOT_FOUND','DRAFT_REQUIRED','STALE_REVISION',
  'SAVE_CONFLICT','SAVE_BLOCKED_REVIEW_REQUIRED','BUSY_RETRY_SAME_OPERATION','OWNER_CONFIG_MISSING','OWNER_KEY_REQUIRED',
  'CONNECTION_UNCERTAIN','INVALID_RESPONSE','INVALID_SNAPSHOT','INVALID_RECEIPT','INVALID_CHOICES','SAVE_RESULT_UNKNOWN',
  'CANCELLED_NOT_SAVED','OWNER_DISABLED','OWNER_FORBIDDEN','OWNER_AUTH_REQUIRED','OWNER_SESSION_EXPIRED',
  'REQUEST_TOO_LARGE','REQUEST_TIMEOUT','JSON_REQUIRED','OWNER_RESULT_UNKNOWN']);
export function createOwnerBrowserClient({token,fetchImpl=globalThis.fetch}={}){
  async function call(action,payload){
    const writing=action==='save'||action==='create';
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw new DraftError('OWNER_AUTH_REQUIRED');
    let response,data;
    try{
      response=await fetchImpl('/api/owner',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({schemaVersion:1,action,payload}),credentials:'omit',cache:'no-store',redirect:'error',
        referrerPolicy:'no-referrer',signal:AbortSignal.timeout(25000)});
      const text=await response.text();if(new TextEncoder().encode(text).length>262144)throw new Error();
      data=JSON.parse(text);
    }catch{throw new DraftError('CONNECTION_UNCERTAIN',{mayHaveSaved:writing});}
    if(!response.ok){
      if(data?.ok!==false||!codes.has(data?.error?.code)||typeof data?.error?.mayHaveSaved!=='boolean')
        throw new DraftError('INVALID_RESPONSE',{mayHaveSaved:writing});
      throw new DraftError(data.error.code,{mayHaveSaved:writing&&data.error.mayHaveSaved});
    }
    if(data?.ok!==true)throw new DraftError('INVALID_RESPONSE',{mayHaveSaved:writing});
    return data.data;
  }
  return Object.freeze({
    async get(entryId){
      // Same snapshot validator also checks the exact requested id after receipt.
      if(typeof entryId!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(entryId))throw new DraftError('INVALID_ENTRY_ID');
      const data=validateDraftSnapshot(await call('get',{entryId}));
      if(data.id!==entryId)throw new DraftError('INVALID_SNAPSHOT');return data;
    },
    async choices(input){const r=validateOwnerChoicesRequest(input);return validateOwnerChoicesResponse(await call('choices',r),r);},
    async save(input){const r=validateTitleDraft(input);return validateDraftReceipt(await call('save',r),r);},
    async create(input){const r=validateSongDraft(input);return validateDraftReceipt(await call('create',r),r);}
  });
}
const requestFor=(action,request)=>action==='create'?validateSongDraft(request):action==='save'?validateTitleDraft(request):(()=>{throw new DraftError('INVALID_REQUEST');})();
export const ownerJournalKey=project=>`kashouroku-owner-submission-v1:${project}`;
export function readOwnerJournal(raw,project){
  if(raw===null)return null;
  try{
    if(typeof raw!=='string'||raw.length>150000)throw new Error();
    const x=JSON.parse(raw);
    if(x?.schemaVersion!==1||x.project!==project||!['prepared','uncertain','failed','saved'].includes(x.phase))throw new Error();
    const request=requestFor(x.action,x.request);
    const receipt=x.phase==='saved'?validateDraftReceipt(x.receipt,request):null;
    const before=x.action==='save'?validateDraftSnapshot(x.before):null;
    if(before&&(before.id!==request.entryId||before.revision!==request.baseRevision))throw new Error();
    const summary=x.summary;
    const label=v=>typeof v==='string'&&v.length<=8000;
    if(!summary||!label(summary.work)||!label(summary.version)||!Array.isArray(summary.singers)||
      summary.singers.length>64||!summary.singers.every(label))throw new Error();
    return {schemaVersion:1,project,phase:x.phase,action:x.action,request,receipt,before,
      summary:{work:summary.work,version:summary.version,singers:[...summary.singers]}};
  }catch{throw new DraftError('LOCAL_JOURNAL_INVALID');}
}
export function prepareOwnerJournal(project,action,request,{before=null,summary={work:'',version:'',singers:[]}}={}){
  return readOwnerJournal(JSON.stringify({schemaVersion:1,project,phase:'prepared',action,request:requestFor(action,request),receipt:null,before,summary}),project);
}
// Write the SAME operation to local storage BEFORE issuing HTTP. Reloading an
// in-flight submission therefore restores uncertainty, never a fresh operation.
export async function submitOwnerJournal(client,journal,persist){
  const previous=readOwnerJournal(JSON.stringify(journal),journal.project);
  if(previous.phase==='saved')return {journal:previous,error:null};
  const uncertain={...previous,phase:'uncertain'};
  try{persist(uncertain);}catch{return {journal:previous,error:new DraftError('LOCAL_SAVE_BLOCKED')};}
  try{
    const receipt=validateDraftReceipt(await client[previous.action](previous.request),previous.request);
    const saved={...previous,phase:'saved',receipt};
    persist(saved);return {journal:saved,error:null};
  }catch(error){
    // A later auth/config failure cannot disprove an earlier uncertain commit.
    const mayHaveSaved=previous.phase==='uncertain'||!(error instanceof DraftError)||error.mayHaveSaved;
    const failed={...previous,phase:mayHaveSaved?'uncertain':'failed'};
    try{persist(failed);}catch{/* The preflight uncertain journal remains durable. */}
    return {journal:failed,error:error instanceof DraftError?error:new DraftError('CONNECTION_UNCERTAIN',{mayHaveSaved:true})};
  }
}
