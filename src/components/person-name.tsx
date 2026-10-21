import Link from 'next/link';
import {creditNameKey,singerCreditParts} from '@/lib/person-detail-data.mjs';
import type {JsonObject} from '@/lib/core';
import {personPagesEnabled} from '@/lib/person-api';

export function CreditName({name}:{name:string}){
 const key=creditNameKey(name);return key&&personPagesEnabled()?<Link className="person-name" href={'/people/'+key}>{name}</Link>:<>{name}</>;
}
export function SingerNames({detail}:{detail:JsonObject}){
 const enabled=personPagesEnabled();return <>{singerCreditParts(detail).map((part,i)=>part.personKey&&enabled?<Link className="person-name" key={i} href={'/people/'+part.personKey}>{part.text}</Link>:<span key={i}>{part.text}</span>)}</>;
}
