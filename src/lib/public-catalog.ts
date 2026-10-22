import 'server-only';
import {join,isAbsolute} from 'node:path';
import {readPublicRelease} from './catalog-public-release.mjs';
import {queryEntries,queryEvents,eventFilterOptions,snapshotRpc} from './private-read-model.mjs';
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

let cache:{file:string;model:PrivateModel}|null=null;
export function publicCatalogEnabled(){return process.env.CATALOG_DATA_MODE==='public_release';}
function load():PrivateModel{
 if(!publicCatalogEnabled())throw new Error('Public catalog is not enabled');
 const file=process.env.CATALOG_PUBLIC_FILE||join(process.cwd(),'catalog-release.json');
 if(!isAbsolute(file))throw new Error('Public catalog path must be absolute');
 if(cache?.file===file)return cache.model;
 try{const {model}=readPublicRelease(file);cache={file,model};return model;}
 catch{throw new Error('Public catalog validation failed; live fallback is disabled');}
}
export function publicCatalogList(filters:CatalogListFilters){return queryEntries(load(),filters);}
export function publicSingerChoices(){return catalogSingerChoices(load());}
export function publicPeopleList(query:PeopleListQuery){return peopleListFromModel(load(),query);}
export function publicLiveList(filters:LiveListFilters){return queryEvents(load(),filters);}
export function publicLiveFilterOptions(){return {...eventFilterOptions(load()),review:{id:null,applied:false,publicRelease:true}};}
export function publicCatalogRpc(name:string,params:JsonObject){const model=load(),result=snapshotRpc(model,name,params);return name==='kashouroku_v3_release_families'?releaseListArtworkFromModel(model,result):result;}
export function publicCatalogInfo(){return {releaseId:String(load().manifest.exportId)};}
export function publicSongDetail(entryId:string){return songDetailFromModel(load(),entryId);}
export function publicLiveDisplayContext(eventId:string){return liveDisplayContextFromModel(load(),eventId);}
export function publicReleaseDisplayContext(familyId:string){return releaseDisplayContextFromModel(load(),familyId);}
export function publicReleaseDetail(familyId:string,query:ReleaseDetailQuery){return releaseDetailFromModel(load(),familyId,query);}
export function publicReleaseList(query:ReleaseListQuery){return releaseListFromModel(load(),query);}
export function publicHomeRecent(){return homeRecentFromModel(load());}
export function publicPersonDetail(key:string,page=1){return personDetailFromModel(load(),key,{page});}
export function publicDiscovery(query:{category?:string;page?:number}){return discoveryFromModel(load(),query,discoveryChannels);}
export function publicLegacySongTarget(id:number):string|null{
 const matches=[...load().entries.values()].filter(e=>e.legacyIds.includes(id));
 if(matches.length===1)return String(matches[0].detail.entryId);
 const works=new Set(matches.map(e=>e.detail.primaryWorkId).filter(x=>typeof x==='string'));
 return matches.length>0&&works.size===1?String([...works][0]):null;
}
