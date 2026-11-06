import type {PrivateModel} from './private-read-model.mjs';
import type {CombinedSearchQuery,SearchChoices,SearchNode,SearchRule} from './combined-search-query.mjs';
export type SearchResultCard={id:string;href:string;title:string;subtitle:string;meta:string;date?:string|null;songCount?:number;imageUrl:string|null;imageUrls:string[];external?:boolean};
export type CombinedSearchResult=CombinedSearchQuery&{choices:SearchChoices;items:SearchResultCard[];total:number;pages:number;limit:number};
export function combinedSearchFromModel(model:PrivateModel,raw?:Record<string,string|string[]|undefined>,metadata?:object):CombinedSearchResult;
export function combineSearchTruth(values:Array<boolean|null>,match?:string,negate?:boolean):boolean|null;
export function evaluateSearchRule(rule:SearchRule,row:object,creditMatches?:Set<string>|null,creditKnown?:Set<string>|null):boolean|null;
export function evaluateSearchTree(tree:SearchNode,row:object,creditSets?:Map<string,Set<string>|{matches:Set<string>|null;known:Set<string>|null}>):boolean|null;
