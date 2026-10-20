import 'server-only';
import {asObject, JsonObject} from './core';
import {privateSnapshotEnabled,privateSnapshotRpc} from './private-snapshot';
import {publicCatalogEnabled,publicCatalogRpc} from './public-catalog';

/** Server-only access to public RPCs. Never grant browser access to base tables. */
export class CatalogApiError extends Error { constructor(message: string, public readonly code: string) {super(message);this.name='CatalogApiError';} }
const RPC_ALLOWLIST = new Set([
 'kashouroku_v3_works','kashouroku_v3_work','kashouroku_v3_work_renditions',
 'kashouroku_v3_work_media','kashouroku_v3_work_releases',
 'kashouroku_v3_release_families','kashouroku_v3_release_family',
 'kashouroku_v3_events','kashouroku_v3_event','kashouroku_v3_event_program',
 'kashouroku_v3_work_sources',
 'kashouroku_v3_catalog_entries','kashouroku_v3_catalog_entries_v2','kashouroku_v3_catalog_entry','kashouroku_v3_catalog_compare',
 'kashouroku_v3_catalog_entry_history','kashouroku_v3_catalog_entry_credits'
]);
export type RpcName = 'kashouroku_v3_works'|'kashouroku_v3_work'|
 'kashouroku_v3_work_renditions'|'kashouroku_v3_work_media'|'kashouroku_v3_work_releases'|
 'kashouroku_v3_release_families'|'kashouroku_v3_release_family'|
 'kashouroku_v3_events'|'kashouroku_v3_event'|'kashouroku_v3_event_program'|
 'kashouroku_v3_work_sources'|
 'kashouroku_v3_catalog_entries'|'kashouroku_v3_catalog_entries_v2'|'kashouroku_v3_catalog_entry'|'kashouroku_v3_catalog_compare'|
 'kashouroku_v3_catalog_entry_history'|'kashouroku_v3_catalog_entry_credits';

export async function rpc(name:RpcName, params: JsonObject):Promise<JsonObject|null>{
 if(!RPC_ALLOWLIST.has(name)) throw new CatalogApiError('RPCが許可されていません。','RPC_NOT_ALLOWED');
 if(privateSnapshotEnabled())return await privateSnapshotRpc(name,params);
 if(publicCatalogEnabled())return publicCatalogRpc(name,params);
 const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key||!/^sb_publishable_[\w-]+$/.test(key))
   throw new CatalogApiError('接続設定が未完了です。READMEの環境変数を確認してください。','CONFIG_MISSING');
 let response: Response;
 try {response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(params),cache:'no-store',signal:AbortSignal.timeout(15000)});}
 catch{throw new CatalogApiError('データ取得先に接続できませんでした。','NETWORK_ERROR');}
 if(!response.ok) throw new CatalogApiError(`データを取得できません（HTTP ${response.status}）。`,'RPC_ERROR');
 const payload:unknown=await response.json();
 if(payload===null)return null;
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new CatalogApiError('予期しないAPI応答です。','INVALID_RESPONSE');
 return asObject(payload);
}
export const paged=(p_limit:number,p_offset:number):JsonObject=>({p_limit,p_offset});
