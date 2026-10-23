export type SearchTarget='songs'|'lives'|'releases'|'people';
export const SEARCH_TARGETS:Array<{id:SearchTarget;label:string;path:string}>;
export function searchTarget(value:unknown):SearchTarget;
export function detailSearchHref(listHref:string):string;
export function searchTargetHref(target:SearchTarget,term?:string):string;
