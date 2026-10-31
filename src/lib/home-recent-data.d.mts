import type {PrivateModel} from './private-read-model.mjs';
export type HomeSong={entryId:string;title:string;date:string;sourceLabel:string;displayCredit:string;thumbnailUrl:string|null;thumbnailUrls:string[]};
export type HomeRelease={familyId:string;title:string;date:string;upcoming:boolean;kindLabel:string;displayCredit:string;thumbnailUrl:string|null;thumbnailUrls:string[]};
export type HomeRecent={songs:HomeSong[];releases:HomeRelease[]};
export function homeToday():string;
export function singleReleaseCreditFromModel(model:PrivateModel,entryId:string):string;
export function homeReleaseCreditFromModel(model:PrivateModel,familyId:string,records?:import('./core').JsonObject[]):string;
export function homeRecentFromModel(model:PrivateModel,options?:{today?:string}):HomeRecent;
