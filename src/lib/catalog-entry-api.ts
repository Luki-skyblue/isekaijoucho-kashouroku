import 'server-only';
import {rpc} from './api';
import {localCatalogReviewEnabled,localCatalogList,localCatalogDetail,localCatalogCompare} from './catalog-local-review';
import {asArray,asObject,num,str,validId,JsonObject} from './core';
import {catalogV2Params} from './catalog-v2-params';
import {privateSnapshotEnabled,privateCatalogList} from './private-snapshot';
import {publicCatalogEnabled,publicCatalogList} from './public-catalog';

// G7 read adapter. Not enabled on /songs until publication/migration reviews pass.
export type CatalogSort = 'title_asc'|'title_desc'|'first_desc'|'first_asc';
export type SingerMatch = 'contains'|'only'|'any'|'subset';
export type LegacySongType = 'original'|'cover'|'collaboration'|'variant';
export type CatalogCategory=LegacySongType|'medley';
export type CatalogListFilters = {
  search?: string;
  singerIds?: string[];
  singerMatch?: SingerMatch;
  selectedKinds?: CatalogCategory[];
  sort?: CatalogSort;
  limit?: number;
  offset?: number;
};
export type CatalogEntryCard = {
  entryId: string;
  title: string;
  kind: 'song_variant'|'medley';
  displayCredit: string;
  legacySongType: string|null;
  thumbnailUrl: string|null;
  thumbnailUrls?: string[];
  matchKind: 'title'|'component';
  firstAppearanceDate?: string|null;
};
export async function listCatalogEntries(filters: CatalogListFilters = {}): Promise<{items:CatalogEntryCard[];total:number;limit:number;offset:number}> {
  const ids=filters.singerIds ?? [];
  if (!ids.every(validId) || ids.length>20) throw new Error('Invalid singer IDs');
  if(privateSnapshotEnabled())return await privateCatalogList(filters);
  if(publicCatalogEnabled())return publicCatalogList(filters);
if(filters.sort==='first_asc'||filters.sort==='first_desc')throw new Error('First-appearance ordering requires the catalog snapshot reader');
if(localCatalogReviewEnabled())return localCatalogList(filters);
// Opt-in only after the additive G7v2 RPC has passed DB/HTTP security tests.
// Default stays on G7v1; local fixture preview is unaffected.
const useV2 = process.env.CATALOG_RPC_VERSION === 'v2';
// The current deployed G7 RPC accepts ONE legacy type, and cannot return
// medley-only or OR-unions with correct total/page ordering. Fail closed,
// never display an incomplete page as if it were a correct OR result.
// A new additive DB RPC will be required before entry-mode publication.
const kinds=filters.selectedKinds??[];
if(kinds.some(k=>!['original','cover','collaboration','variant','medley'].includes(k)) ||
   new Set(kinds).size!==kinds.length)throw new Error('Invalid catalog categories');
if(!useV2 && (kinds.length>1 || kinds.includes('medley')))throw new Error('Category OR search requires the not-yet-deployed G7 multi-category RPC');
// Deployed G7 only recognizes the historical contains=AND and only=exact modes.
// Do not silently degrade OR/subset into a different meaning.
if(!useV2 && ids.length && ['any','subset'].includes(filters.singerMatch??''))
 throw new Error('Singer OR/subset search requires a future additive G7 RPC');
const data=useV2
  ? await rpc('kashouroku_v3_catalog_entries_v2', catalogV2Params(filters))
  : await rpc('kashouroku_v3_catalog_entries', {
    p_search:(filters.search??'').trim().slice(0,100)||null,
    p_singer_ids:ids.length?ids:null,
    p_singer_match:filters.singerMatch==='only'?'only':'contains',
    p_include_medleys:kinds.length===0,
    p_legacy_song_type:kinds.length?kinds[0]:null,
    p_sort:filters.sort??'title_asc',
    p_limit:filters.limit??24,
    p_offset:filters.offset??0,
  });
  const items=asArray(data?.items).map(item=>({
    entryId:str(item.entryId),title:str(item.title),
    kind:item.kind==='medley'?'medley' as const:'song_variant' as const,
    displayCredit:str(item.displayCredit),
    legacySongType:typeof item.legacySongType==='string'?item.legacySongType:null,
    thumbnailUrl:typeof item.thumbnailUrl==='string'?item.thumbnailUrl:null,
    thumbnailUrls:Array.isArray(item.thumbnailUrls)?item.thumbnailUrls.filter((url):url is string=>typeof url==='string'):[],
    matchKind:item.matchKind==='component'?'component' as const:'title' as const,
  }));
  return {items,total:num(data?.total),limit:num(data?.limit),offset:num(data?.offset)};
}
export async function getCatalogEntry(entryId:string):Promise<JsonObject|null>{
  if(!validId(entryId))return null;
  if(localCatalogReviewEnabled())return localCatalogDetail(entryId);
  return await rpc('kashouroku_v3_catalog_entry',{p_entry_id:entryId});
}
export async function compareCatalogEntries(entryId:string):Promise<JsonObject|null>{
  if(!validId(entryId))return null;
  if(localCatalogReviewEnabled())return localCatalogCompare(entryId);
  return await rpc('kashouroku_v3_catalog_compare',{p_entry_id:entryId});
}
export function relatedVariants(detail:JsonObject):JsonObject[]{
  return asArray(asObject(detail).relatedVariants);
}

/** Entry-scoped evidence associations; version-only matches never prove live vocal identity. */
export async function getCatalogEntryHistory(entryId:string,limit=50,offset=0):Promise<JsonObject|null>{
 if(!validId(entryId))return null;
 if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>100000)
  throw new Error('Invalid history pagination');
 // Fixture has no scoped rendition-part history; never synthesize a performance.
 if(localCatalogReviewEnabled())return null;
 return await rpc('kashouroku_v3_catalog_entry_history',{p_entry_id:entryId,p_limit:limit,p_offset:offset});
}

/** Credits are work/version/original scoped and deliberately NOT a verified vocal claim. */
export async function getCatalogEntryCredits(entryId:string):Promise<JsonObject|null>{
 if(!validId(entryId))return null;
 // Live work-level context is fetched separately from the existing public RPC.
 if(localCatalogReviewEnabled())return null;
 return await rpc('kashouroku_v3_catalog_entry_credits',{p_entry_id:entryId});
}
