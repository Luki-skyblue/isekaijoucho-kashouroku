import 'server-only';
import {headers} from 'next/headers';
import {privateSnapshotConfig,assertPrivateLoopback,readExport,validateExport,queryEntries,queryEvents,eventFilterOptions,applyLiveFilterCandidates,liveCandidatesApplicable,snapshotRpc} from './private-read-model.mjs';
import liveCandidates from './live-filter-candidates.json';
import type {PrivateModel,LiveListFilters} from './private-read-model.mjs';
import type {CatalogListFilters} from './catalog-entry-api';
import type {JsonObject} from './core';
import {songDetailFromModel} from './song-detail-data.mjs';
import {liveDisplayContextFromModel} from './live-detail-data.mjs';

let cached:{file:string;sha256:string;model:PrivateModel}|null=null;
export function privateSnapshotEnabled():boolean {return process.env.CATALOG_DATA_MODE!=='public_release'&&privateSnapshotConfig() !== null;}
async function load():Promise<PrivateModel> {
 const config=privateSnapshotConfig();
 if(!config) throw new Error('Private snapshot is not enabled');
 const h=await headers();
 assertPrivateLoopback(h.get('host'),h.get('x-forwarded-host'));
 if(cached?.file===config.file && cached.sha256===config.sha256)return cached.model;
 try {
  const {rows}=readExport(config.file,config.sha256);
  const model=validateExport(rows);
  cached={...config,model};
  return model;
 } catch {throw new Error('Private snapshot validation failed; live fallback is disabled');}
}
export async function privateSnapshotInfo():Promise<{exportId:string}> {
 const model=await load();return {exportId:String(model.manifest.exportId)};
}
export async function privateSongDetail(entryId:string){return songDetailFromModel(await load(),entryId);}
export async function privateCatalogList(filters:CatalogListFilters) {return queryEntries(await load(),filters);}
async function liveContext() {
 const base=await load(),config=privateSnapshotConfig();
 const applicable=liveCandidatesApplicable(base,liveCandidates,config?.sha256);
 return {model:applicable?applyLiveFilterCandidates(base,liveCandidates):base,
  review:{id:applicable?liveCandidates.reviewId:null,applied:applicable}};
}
export async function privateLiveList(filters:LiveListFilters) {return queryEvents((await liveContext()).model,filters);}
export async function privateLiveDisplayContext(eventId:string){return liveDisplayContextFromModel((await liveContext()).model,eventId);}
export async function privateLiveFilterOptions() {const {model,review}=await liveContext();return {...eventFilterOptions(model),review};}
export async function privateSnapshotRpc(name:string,params:JsonObject):Promise<JsonObject|null> {
 return snapshotRpc(await load(),name,params);
}
