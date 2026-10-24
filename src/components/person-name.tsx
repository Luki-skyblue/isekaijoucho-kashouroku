import Link from 'next/link';
import {singerCreditParts} from '@/lib/person-detail-data.mjs';
import {personKeyForCredit} from '@/lib/catalog-people.mjs';
import type {JsonObject} from '@/lib/core';
import {personPagesEnabled} from '@/lib/person-api';
import type {CreditPart} from '@/lib/creator-credit-data.mjs';

export function CreditName({name,personKey,parts}:{name:string;personKey?:string|null;parts?:CreditPart[]}){
 if(parts)return <>{parts.map((part,i)=>part.personKey&&personPagesEnabled()?<Link className="person-name" key={i} href={'/people/'+part.personKey}>{part.text}</Link>:<span key={i}>{part.text}</span>)}</>;
 const key=personKey===undefined?personKeyForCredit(name):personKey;return key&&personPagesEnabled()?<Link className="person-name" href={'/people/'+key}>{name}</Link>:<>{name}</>;
}
export function SingerNames({detail}:{detail:JsonObject}){
 const enabled=personPagesEnabled();return <>{singerCreditParts(detail).map((part,i)=>part.personKey&&enabled?<Link className="person-name" key={i} href={'/people/'+part.personKey}>{part.text}</Link>:<span key={i}>{part.text}</span>)}</>;
}
