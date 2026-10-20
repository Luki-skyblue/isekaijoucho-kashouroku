import 'server-only';
import {join,isAbsolute} from 'node:path';
import {readPublicRelease} from './catalog-public-release.mjs';
import {queryEntries,queryEvents,eventFilterOptions,snapshotRpc} from './private-read-model.mjs';
import type {PrivateModel,LiveListFilters} from './private-read-model.mjs';
import type {CatalogListFilters} from './catalog-entry-api';
import type {JsonObject} from './core';

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
export function publicLiveList(filters:LiveListFilters){return queryEvents(load(),filters);}
export function publicLiveFilterOptions(){return {...eventFilterOptions(load()),review:{id:null,applied:false,publicRelease:true}};}
export function publicCatalogRpc(name:string,params:JsonObject){return snapshotRpc(load(),name,params);}
export function publicCatalogInfo(){return {releaseId:String(load().manifest.exportId)};}
export function publicLegacySongTarget(id:number):string|null{
 const matches=[...load().entries.values()].filter(e=>e.legacyIds.includes(id));
 if(matches.length===1)return String(matches[0].detail.entryId);
 const works=new Set(matches.map(e=>e.detail.primaryWorkId).filter(x=>typeof x==='string'));
 return matches.length>0&&works.size===1?String([...works][0]):null;
}
