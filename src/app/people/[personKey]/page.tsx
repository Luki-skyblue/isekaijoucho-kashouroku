import {PAGE_LABELS,INFO_STATES,EMPTY_RESULTS} from '@/lib/ui-copy.mjs';
import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getPersonDetail} from '@/lib/person-api';
import {personDetailHref} from '@/lib/person-detail-data.mjs';
import {pageNumber} from '@/lib/core';
import {RecordArtwork} from '@/components/record-artwork';
import {Breadcrumb} from '@/components/ui';
import {safeListReturnTo,withListReturnTo} from '@/lib/catalog-navigation';
import './person-detail.css';

export async function generateMetadata({params}:{params:Promise<{personKey:string}>}){
 const person=await getPersonDetail((await params).personKey);
 return {title:person?.name??'関係者'};
}
export default async function PersonDetail({params,searchParams}:{params:Promise<{personKey:string}>;searchParams:Promise<{page?:string;role?:string;billing?:string;from?:string}>}){
 const key=(await params).personKey,query=await searchParams,person=await getPersonDetail(key,pageNumber(query.page),query.role,query.billing);
 if(!person)notFound();
 const returnTo=safeListReturnTo(query.from,'/people');
 const href=(overrides:{page?:number;role?:string;billing?:string}={})=>withListReturnTo(personDetailHref(person.key,{role:person.role,billing:person.billing,...overrides}),'/people',returnTo);
 if(person.key!==key)redirect(href({page:person.page}));
 const projects=person.kindLabel==='キャラクター'?[...new Set(person.voiceActors?.flatMap(p=>p.context?[p.context]:[])??[])]:[];
 return <article className="person-detail-page">
  <Breadcrumb parts={[{label:returnTo?'検索結果に戻る':PAGE_LABELS.people,href:returnTo??'/people'},{label:person.name}]}/>
  <header className="person-detail-heading"><h1>{person.name}</h1><p>{[person.kindLabel,...projects].join('・')}</p></header>
  {person.relationGroups.length>0&&<section className="person-relations" aria-labelledby="person-relations-title"><h2 id="person-relations-title">関連名義</h2><div className="person-relation-groups">{person.relationGroups.map(group=><section className="person-relation-group" key={group.id} aria-labelledby={'person-relation-'+group.id}>
   <h3 id={'person-relation-'+group.id}>{group.label}</h3>{group.items.length?<ul>{group.items.map(p=><li key={p.key+'|'+(p.context??'')}>{p.href?<Link href={withListReturnTo(p.href,'/people',returnTo)}>{p.name}<span aria-hidden="true"> ↗</span></Link>:<span>{p.name}</span>}</li>)}</ul>:<p className="muted">{INFO_STATES.pending}</p>}
  </section>)}</div></section>}
  <section className="person-songs" aria-labelledby="person-songs-title"><h2 id="person-songs-title">関連楽曲 <span className="person-detail-count">{person.songCount}曲{person.variantCount>person.songCount&&<>・{person.variantCount}バージョン</>}</span></h2>
  {person.billingTabs.length>0&&<nav className="person-role-tabs person-billing-tabs" aria-label="名義で絞り込む">{person.billingTabs.map(tab=><Link key={tab.id} href={href({billing:tab.id})} scroll={false} aria-current={person.billing===tab.id?'page':undefined}>{tab.label}<small aria-label={`${tab.count}曲`}>{tab.count}</small></Link>)}</nav>}
  {person.roleTabs.length>2&&<nav className="person-role-tabs" aria-label="担当で絞り込む">{person.roleTabs.map(tab=><Link key={tab.id} href={href({role:tab.id})} scroll={false} aria-current={person.role===tab.id?'page':undefined}>{tab.label}<small aria-label={`${tab.count}曲`}>{tab.count}</small></Link>)}</nav>}
   {person.items.length?<div className="records records-list">{person.items.map(song=><Link className="record" key={song.entryId} href={song.href}>
    <RecordArtwork url={song.thumbnailUrl} urls={song.thumbnailUrls}/>
    <span className="record-copy"><span className="record-title">{song.title}</span><span className="record-meta">{song.displayCredit}</span><span className="person-detail-song-roles">{song.roles.join('・')}</span></span>
    <span className="record-arrow" aria-hidden="true">↗</span>
   </Link>)}</div>:<p className="muted">{EMPTY_RESULTS.songs}</p>}
  {person.pages>1&&<nav className="pages" aria-label="関連楽曲のページ送り">{person.page>1&&<Link href={href({page:person.page-1})}>← 前のページ</Link>}<span>{person.page} / {person.pages} ページ</span>{person.page<person.pages&&<Link href={href({page:person.page+1})}>次のページ →</Link>}</nav>}
  </section>
 </article>;
}
