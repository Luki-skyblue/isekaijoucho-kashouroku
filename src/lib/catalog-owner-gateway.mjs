// Node/server ONLY. Local capability adapter around the existing shared store.
// Not an Internet login or a second database/backend. No automatic retries.
import {timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {DraftError,isUuid,validateTitleDraft,validateSongDraft,validateDraftSnapshot,validateDraftReceipt} from './catalog-draft-contract.mjs';
import {validateOwnerChoicesRequest,validateOwnerChoicesResponse} from './catalog-owner-choices.mjs';
import {createDraftStore} from './catalog-draft-client.mjs';

const keys=(x,names)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===[...names].sort().join('|');
class Stop extends Error{constructor(status,code){super(code);this.status=status;this.code=code;}}
const reject=(status,code)=>{throw new Stop(status,code);};
function localPolicy(env,now){
  if(env.CATALOG_OWNER_MODE!=='local'||env.NODE_ENV!=='development'||env.VERCEL!==undefined||env.CI)reject(404,'OWNER_DISABLED');
  const origin=env.CATALOG_OWNER_LOCAL_ORIGIN,token=env.CATALOG_OWNER_LOCAL_TOKEN,expires=env.CATALOG_OWNER_TOKEN_EXPIRES_AT;
  let url;try{url=new URL(origin);}catch{reject(503,'OWNER_CONFIG_MISSING');}
  if(url.origin!==origin||url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||
    !/^\d+$/.test(url.port)||Number(url.port)<1024||Number(url.port)>65535||
    typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||
    typeof expires!=='string'||!/^\d{13}$/.test(expires)||Number(expires)>now+8*60*60*1000)reject(503,'OWNER_CONFIG_MISSING');
  if(Number(expires)<=now)reject(401,'OWNER_SESSION_EXPIRED');
  return {origin,host:url.host,port:url.port,token};
}
function localHeaders(h,policy){
  if(h.get('host')!==policy.host||h.has('forwarded'))reject(403,'OWNER_FORBIDDEN');
  for(const [name,expected] of [['x-forwarded-host',policy.host],['x-forwarded-proto','http'],['x-forwarded-port',policy.port]])
    if(h.has(name)&&h.get(name)!==expected)reject(403,'OWNER_FORBIDDEN');
  if(h.has('x-forwarded-for')&&!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(h.get('x-forwarded-for')))reject(403,'OWNER_FORBIDDEN');
}
// Page sends only an empty editor shell. Credentials are never serialized in props.
export function ownerPageEnabled(headers,{env=process.env,now=Date.now}={}){
  try{localHeaders(headers,localPolicy(env,now()));return true;}catch{return false;}
}
function authorize(request,policy){
  let url;try{url=new URL(request.url);}catch{reject(403,'OWNER_FORBIDDEN');}
  const h=request.headers;
  // Next16.4.1 NextURL rewrites loopback IPs to localhost in request.url.
  // Only this internal URL may use that alias; raw Host/Origin stay exact below.
  const nextLocalUrl=url.protocol==='http:'&&url.hostname==='localhost'&&url.port===policy.port;
  if((url.origin!==policy.origin&&!nextLocalUrl)||url.username||url.password||url.pathname!=='/api/owner'||url.search||url.hash||
    h.get('origin')!==policy.origin)reject(403,'OWNER_FORBIDDEN');
  localHeaders(h,policy);
  if(h.has('sec-fetch-site')&&h.get('sec-fetch-site')!=='same-origin')reject(403,'OWNER_FORBIDDEN');
  const supplied=h.get('authorization');
  if(typeof supplied!=='string'||!/^Bearer [a-f0-9]{64}$/.test(supplied)||
    !timingSafeEqual(Buffer.from(supplied.slice(7),'hex'),Buffer.from(policy.token,'hex')))reject(401,'OWNER_AUTH_REQUIRED');
}
async function bodyJson(request,timeoutMs){
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')??'')||
    request.headers.has('content-encoding'))reject(415,'JSON_REQUIRED');
  const declared=request.headers.get('content-length');
  if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>131072))reject(413,'REQUEST_TOO_LARGE');
  if(!request.body)reject(400,'INVALID_REQUEST');
  const reader=request.body.getReader(),chunks=[];let size=0,timer;
  const timeout=new Promise((_,no)=>{timer=setTimeout(()=>no(new Stop(408,'REQUEST_TIMEOUT')),timeoutMs);});
  try{
    while(true){
      const {done,value}=await Promise.race([reader.read(),timeout]);if(done)break;
      size+=value.byteLength;if(size>131072)reject(413,'REQUEST_TOO_LARGE');chunks.push(value);
    }
    try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
    catch{reject(400,'INVALID_REQUEST');}
  }finally{clearTimeout(timer);void reader.cancel().catch(()=>{});reader.releaseLock();}
}
function envelope(x){
  if(!keys(x,['schemaVersion','action','payload'])||x.schemaVersion!==1||!['get','choices','save','create'].includes(x.action))reject(400,'INVALID_REQUEST');
  if(x.action==='get'){
    if(!keys(x.payload,['entryId'])||!isUuid(x.payload.entryId))reject(400,'INVALID_REQUEST');
    return x;
  }
  const validators={choices:validateOwnerChoicesRequest,save:validateTitleDraft,create:validateSongDraft};
  return {...x,payload:validators[x.action](x.payload)};
}
function response(status,body,extra={}){
  return Response.json(body,{status,headers:{'Cache-Control':'no-store, max-age=0',Pragma:'no-cache',Vary:'Origin',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...extra}});
}
const failures={INVALID_REQUEST:400,INVALID_ENTRY_ID:400,FORBIDDEN:403,ENTRY_NOT_FOUND:404,DRAFT_REQUIRED:409,
  STALE_REVISION:409,SAVE_CONFLICT:409,SAVE_BLOCKED_REVIEW_REQUIRED:409,BUSY_RETRY_SAME_OPERATION:409,
  OWNER_CONFIG_MISSING:503,OWNER_KEY_REQUIRED:503,CONNECTION_UNCERTAIN:503,INVALID_RESPONSE:502,
  INVALID_SNAPSHOT:502,INVALID_RECEIPT:502,INVALID_CHOICES:502,SAVE_RESULT_UNKNOWN:503,CANCELLED_NOT_SAVED:503};

export function createOwnerGateway({env=process.env,storeFactory=()=>createDraftStore({env}),now=Date.now,bodyTimeoutMs=5000}={}){
  return async function handle(request){
    let writeStarted=false;
    try{
      const policy=localPolicy(env,now());
      if(request.method!=='POST')return response(405,{ok:false,error:{code:'METHOD_NOT_ALLOWED',mayHaveSaved:false}},{Allow:'POST'});
      authorize(request,policy);
      const input=envelope(await bodyJson(request,bodyTimeoutMs));
      const store=storeFactory();let data;
      if(input.action==='get'){
        data=validateDraftSnapshot(await store.get(input.payload.entryId));
        if(data.id!==input.payload.entryId)throw new DraftError('INVALID_SNAPSHOT');
      }else if(input.action==='choices'){
        data=validateOwnerChoicesResponse(await store.choices(input.payload),input.payload);
      }else{
        writeStarted=true;
        data=validateDraftReceipt(await store[input.action](input.payload),input.payload);
      }
      return response(200,{ok:true,data});
    }catch(error){
      if(error instanceof Stop)return response(error.status,{ok:false,error:{code:error.code,mayHaveSaved:false}});
      if(error instanceof DraftError&&Object.hasOwn(failures,error.code))return response(failures[error.code],{
        ok:false,error:{code:error.code,mayHaveSaved:writeStarted&&error.mayHaveSaved===true}});
      return response(503,{ok:false,error:{code:'OWNER_RESULT_UNKNOWN',mayHaveSaved:writeStarted}});
    }
  };
}
