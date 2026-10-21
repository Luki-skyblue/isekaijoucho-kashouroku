import type {JsonObject} from './core';
import type {PrivateModel} from './private-read-model.mjs';
export type PersonDetailData={key:string;name:string;roles:string[];total:number;page:number;pages:number;items:Array<{entryId:string;title:string;displayCredit:string;roles:string[];thumbnailUrl:string|null;thumbnailUrls:string[]}>};
export function creditNameKey(name:unknown):string|null;
export function validPersonKey(key:unknown):boolean;
export function singerCreditParts(detail:JsonObject):Array<{text:string;personKey:string|null}>;
export function personDetailFromModel(model:PrivateModel,key:string,options?:{page?:number;limit?:number}):PersonDetailData|null;
