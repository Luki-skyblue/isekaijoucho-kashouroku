import type {JsonObject} from './core';
import type {PrivateModel} from './private-read-model.mjs';
export type LiveDisplayContext={billingLabel:string|null;dates:string[];performers:Array<{entityId:string;name:string}>;programLinks:Record<string,{entryId:string;title:string}>};
export const LIVE_PROGRAM_RECORDS:JsonObject[];
export function isLiveSupplement(occurrence:JsonObject):boolean;
export function liveSessionLabel(occurrence:JsonObject):string;
export function liveCoverageNote(scope:unknown):string|null;
export function liveProgramPosition(item:JsonObject):string;
export function liveDisplayContextFromModel(model:PrivateModel,eventId:string,options?:{programRecords?:JsonObject[]}):LiveDisplayContext|null;
