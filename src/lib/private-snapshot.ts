import 'server-only';
import {headers} from 'next/headers';
import {privateSnapshotConfig,assertPrivateLoopback,readExport,validateExport,queryEntries,queryEvents,eventFilterOptions,applyLiveFilterCandidates,liveCandidatesApplicable,snapshotRpc} from './private-read-model.mjs';
import liveCandidates from './live-filter-candidates.json';
import type {PrivateModel,LiveListFilters} from './private-read-model.mjs';
import type {CatalogListFilters} from './catalog-entry-api';
import type {JsonObject} from './core';
import {songDetailFromModel} from './song-detail-data.mjs';
import {liveDisplayContextFromModel} from './live-detail-data.mjs';
import {releaseDisplayContextFromModel,releaseListArtworkFromModel,releaseDetailFromModel,type ReleaseDetailQuery} from './release-detail-data.mjs';
import {releaseListFromModel,type ReleaseListQuery} from './release-list-data.mjs';
import {homeRecentFromModel} from './home-recent-data.mjs';
import {personDetailFromModel,peopleListFromModel,type PeopleListQuery} from './person-detail-data.mjs';
import {catalogSingerChoices} from './catalog-people.mjs';
import {discoveryFromModel} from './discovery-data.mjs';
import discoveryChannels from './discovery-channel-data.json';

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
export async function privateHomeRecent(){return homeRecentFromModel(await load());}
export async function privatePersonDetail(key:string,page=1){return personDetailFromModel(await load(),key,{page});}
export async function privateSingerChoices(){return catalogSingerChoices(await load());}
export async function privatePeopleList(query:PeopleListQuery){return peopleListFromModel(await load(),query);}
export async function privateDiscovery(query:{category?:string;page?:number}){return discoveryFromModel(await load(),query,discoveryChannels);}
export async function privateReleaseDisplayContext(familyId:string){return releaseDisplayContextFromModel(await load(),familyId);}
export async function privateReleaseDetail(familyId:string,query:ReleaseDetailQuery){return releaseDetailFromModel(await load(),familyId,query);}
export async function privateReleaseList(query:ReleaseListQuery){return releaseListFromModel(await load(),query);}
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
 const model=await load(),result=snapshotRpc(model,name,params);
 return name==='kashouroku_v3_release_families'?releaseListArtworkFromModel(model,result):result;
}
