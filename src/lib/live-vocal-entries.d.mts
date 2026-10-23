import type {JsonObject} from './core';
import type {PrivateModel} from './private-read-model.mjs';
export const LIVE_VOCAL_ENTRY_RECORDS:JsonObject[];
export function liveVocalRecordsForEntry(entry:JsonObject,records?:JsonObject[]):JsonObject[];
export function liveVocalTargetForRow(model:PrivateModel,row:JsonObject):{entryId:string;title:string}|null;
