import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getPersonDetail} from '@/lib/person-api';
import {personDetailHref} from '@/lib/person-detail-data.mjs';
import {pageNumber} from '@/lib/core';
import {RecordArtwork} from '@/components/record-artwork';
import {Breadcrumb} from '@/components/ui';
import './person-detail.css';

export async function generateMetadata({params}:{params:Promise<{personKey:string}>}){
 const person=await getPersonDetail((await params).personKey);
 return {title:person?.name??'人物'};
}
export default async function PersonDetail({params,searchParams}:{params:Promise<{personKey:string}>;searchParams:Promise<{page?:string;role?:string;billing?:string}>}){
 const key=(await params).personKey,query=await searchParams,person=await getPersonDetail(key,pageNumber(query.page),query.role,query.billing);
 if(!person)notFound();
 if(person.key!==key)redirect(personDetailHref(person.key,{page:person.page,role:person.role,billing:person.billing}));
 const href=(page:number)=>personDetailHref(person.key,{page,role:person.role,billing:person.billing});
 const projects=person.kindLabel==='キャラクター'?[...new Set(person.voiceActors?.flatMap(p=>p.context?[p.context]:[])??[])]:[];
 return <article className="person-detail-page">
  <Breadcrumb parts={[{label:'関係者検索',href:'/people'},{label:person.name}]}/>
  <header className="person-detail-heading"><h1>{person.name}</h1><p>{[person.kindLabel,...projects].join('・')}</p></header>
  {person.relationGroups.length>0&&<section className="person-relations" aria-labelledby="person-relations-title"><h2 id="person-relations-title">関連名義</h2><div className="person-relation-groups">{person.relationGroups.map(group=><section className="person-relation-group" key={group.id} aria-labelledby={'person-relation-'+group.id}>
   <h3 id={'person-relation-'+group.id}>{group.label}</h3>{group.items.length?<ul>{group.items.map(p=><li key={p.key+'|'+(p.context??'')}>{p.href?<Link href={p.href}>{p.name}<span aria-hidden="true"> ↗</span></Link>:<span>{p.name}</span>}</li>)}</ul>:<p className="muted">準備中</p>}
  </section>)}</div></section>}
  <section className="person-songs" aria-labelledby="person-songs-title"><h2 id="person-songs-title">関連楽曲 <span className="person-detail-count">{person.total}</span></h2>
  {person.billingTabs.length>0&&<nav className="person-role-tabs person-billing-tabs" aria-label="名義で絞り込む">{person.billingTabs.map(tab=><Link key={tab.id} href={personDetailHref(person.key,{billing:tab.id,role:person.role})} aria-current={person.billing===tab.id?'page':undefined}>{tab.label}<small>{tab.count}</small></Link>)}</nav>}
  {person.roleTabs.length>2&&<nav className="person-role-tabs" aria-label="担当で絞り込む">{person.roleTabs.map(tab=><Link key={tab.id} href={personDetailHref(person.key,{role:tab.id,billing:person.billing})} aria-current={person.role===tab.id?'page':undefined}>{tab.label}<small>{tab.count}</small></Link>)}</nav>}
   {person.items.length?<div className="records records-list">{person.items.map(song=><Link className="record" key={song.entryId} href={song.href}>
    <RecordArtwork url={song.thumbnailUrl} urls={song.thumbnailUrls}/>
    <span className="record-copy"><span className="record-title">{song.title}</span><span className="record-meta">{song.displayCredit}</span><span className="person-detail-song-roles">{song.roles.join('・')}</span></span>
    <span className="record-arrow" aria-hidden="true">↗</span>
   </Link>)}</div>:<p className="muted">見つかっていません。</p>}
  {person.pages>1&&<nav className="pages" aria-label="関連楽曲のページ送り">{person.page>1&&<Link href={href(person.page-1)}>← 前のページ</Link>}<span>{person.page} / {person.pages} ページ</span>{person.page<person.pages&&<Link href={href(person.page+1)}>次のページ →</Link>}</nav>}
  </section>
 </article>;
}
