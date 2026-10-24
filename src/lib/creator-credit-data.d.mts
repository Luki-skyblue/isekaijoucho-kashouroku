import type {JsonObject} from './core';
export type CreditPart={text:string;personKey:string|null};
export type CreditParticipant={name:string;personKey:string};
export type ResolvedCreditName={name:string;personKey:string|null;parts?:CreditPart[];participants?:CreditParticipant[]};
export const CREATOR_CREDIT_RECORDS:JsonObject[];
export function resolveCreatorCredit<T extends {name:string;personKey?:string|null;entityId?:string}>(entry:JsonObject,credit:T,context:{role:string;scope:string;mediaId?:string;mediaUrl?:string},records?:JsonObject[]):T&{parts?:CreditPart[];participants?:CreditParticipant[]};
