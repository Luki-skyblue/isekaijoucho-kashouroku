import 'server-only';
import {publicCatalogEnabled,publicSongDetail,publicSongWork} from './public-catalog';
import {privateSnapshotEnabled,privateSongDetail,privateSongWork} from './private-snapshot';
import {localCatalogReviewEnabled} from './catalog-local-review';
import {getCatalogEntry,compareCatalogEntries,getCatalogEntryCredits,getCatalogEntryHistory} from './catalog-entry-api';
import {rpc,type RpcName} from './api';
import {asArray,asObject,num,str,validId,type JsonObject} from './core';
import {buildSongDetail,type SongDetailData} from './song-detail-data.mjs';
import type {CatalogSongWork} from './catalog-song-work.mjs';

export async function getCatalogSongWork(workId:string):Promise<CatalogSongWork|null>{
 if(!validId(workId))return null;
 if(publicCatalogEnabled())return publicSongWork(workId);
 if(privateSnapshotEnabled())return privateSongWork(workId);
 return null;
}

async function completeCollection(name:RpcName,params:JsonObject,limit:number){
 const first=await rpc(name,{...params,p_limit:limit,p_offset:0});if(!first)return [];
 const total=num(first.total),items=asArray(first.items);
 for(let offset=limit;offset<total;offset+=limit){
  const page=await rpc(name,{...params,p_limit:limit,p_offset:offset});
  if(!page||num(page.total)!==total)throw new Error('Song detail collection changed while loading');
  items.push(...asArray(page.items));
 }
 if(items.length!==total)throw new Error('Song detail collection is incomplete');
 return items;
}
/** Reuse complete validated file collections; no per-view database traffic. */
export async function getCatalogSongDetail(entryId:string):Promise<SongDetailData|null>{
 if(!validId(entryId))return null;
 if(publicCatalogEnabled())return publicSongDetail(entryId);
 if(privateSnapshotEnabled())return privateSongDetail(entryId);
 const detail=await getCatalogEntry(entryId);if(!detail)return null;
 const singers=asArray(detail.singers).map(x=>str(x.entityId));
 const entry:JsonObject={detail,singerIds:singers,legacyIds:[],history:[],compare:null,credits:{credits:[]}};
 if(localCatalogReviewEnabled())return buildSongDetail(entry);
 const workId=str(detail.primaryWorkId);
 const [compare,credits,history,work,media,releases]=await Promise.all([
  compareCatalogEntries(entryId),getCatalogEntryCredits(entryId),getCatalogEntryHistory(entryId,100,0),
  validId(workId)?rpc('kashouroku_v3_work',{p_work_id:workId}):null,
  validId(workId)?completeCollection('kashouroku_v3_work_media',{p_work_id:workId},50):[],
  validId(workId)?completeCollection('kashouroku_v3_work_releases',{p_work_id:workId},50):[]
 ]);
 const histories=asArray(history?.items),total=num(history?.total);
 for(let offset=100;offset<total;offset+=100){
  const page=await getCatalogEntryHistory(entryId,100,offset);
  if(!page||num(page.total)!==total)throw new Error('Song history changed while loading');
  histories.push(...asArray(page.items));
 }
 if(histories.length!==total)throw new Error('Song history is incomplete');
 return buildSongDetail({...entry,compare,credits:credits??{credits:[]},history:histories},
  {detail:asObject(work),media,releases});
}
