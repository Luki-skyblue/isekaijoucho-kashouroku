import type {JsonObject,ViewMode} from './core';
import type {PrivateModel} from './private-read-model.mjs';
export type ReleaseListQuery={category?:string;term?:string;page?:number};
export type ReleaseListItem={key:string;familyId:string|null;title:string;href:string;external:boolean;category:'music'|'live';date:string|null;kindLabel:string|null;thumbnailUrl:string|null;thumbnailUrls:string[]};
export type ReleaseListData={category:'music'|'live';term:string;page:number;pages:number;limit:number;total:number;categories:Array<{id:string;label:string;count:number}>;items:ReleaseListItem[]};
export function releaseListFromModel(model:PrivateModel,query?:ReleaseListQuery,options?:{sourceRecords?:JsonObject[]}):ReleaseListData;
export function releaseListHref(query?:ReleaseListQuery&{view?:ViewMode}):string;
