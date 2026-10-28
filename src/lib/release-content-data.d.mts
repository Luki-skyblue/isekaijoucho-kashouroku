import type {JsonObject} from './core';
import type {PrivateModel} from './private-read-model.mjs';
export const RELEASE_CONTENT_RECORDS:JsonObject[];
export function releaseContentFromModel(model:PrivateModel,familyId:string,records?:JsonObject[]):{records:JsonObject[];items:JsonObject[];itemLinks:Record<string,{entryId:string}>;componentLabels:Record<string,string>};
export function supplementalReleasesForEntry(model:PrivateModel,entryId:string,records?:JsonObject[],artworkRecords?:JsonObject[]):JsonObject[];
