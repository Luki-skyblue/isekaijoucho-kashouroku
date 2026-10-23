import type {JsonObject} from './core';
import type {PrivateModel} from './private-read-model.mjs';
import type {LiveProgramVocals} from './live-detail-data.mjs';
export type LiveProgramSupplement={occurrenceId:string;totalItems:number;items:JsonObject[];programLinks:Record<string,{entryId:string;title:string}>;programVocals:Record<string,LiveProgramVocals>;source:{label:string;url:string}};
export const LIVE_PROGRAM_SUPPLEMENTS:JsonObject[];
export function liveProgramSupplementsForEvent(model:PrivateModel,eventId:string,records?:JsonObject[]):LiveProgramSupplement[];
export function supplementalLivesForEntry(model:PrivateModel,entryId:string,records?:JsonObject[]):Array<{eventId:string;title:string;date:string;uncertain:boolean}>;
