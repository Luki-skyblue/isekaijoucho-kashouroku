import type {JsonObject} from './core';
import type {PrivateModel} from './private-read-model.mjs';
export function workSearchTitles(detail:JsonObject|null|undefined):string[];
export function releaseTitleMatches(model:PrivateModel,detail:JsonObject|null|undefined,term:string):boolean;
export function eventTitleMatches(model:PrivateModel,eventId:string,title:unknown,term:string):boolean;
