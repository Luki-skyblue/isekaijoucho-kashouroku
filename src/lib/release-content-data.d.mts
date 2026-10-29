import type {JsonObject} from './core';
import type {PrivateModel} from './private-read-model.mjs';
export const RELEASE_CONTENT_RECORDS:JsonObject[];
export const RELEASE_ENTRY_LINK_RECORDS:JsonObject[];
export function releaseContentFromModel(model:PrivateModel,familyId:string,records?:JsonObject[],entryLinkRecords?:JsonObject[],artworkRecords?:JsonObject[]):{records:JsonObject[];items:JsonObject[];itemLinks:Record<string,{entryId:string}>;componentLabels:Record<string,string>};
export function supplementalReleasesForEntry(model:PrivateModel,entryId:string,records?:JsonObject[],artworkRecords?:JsonObject[],entryLinkRecords?:JsonObject[]):JsonObject[];
