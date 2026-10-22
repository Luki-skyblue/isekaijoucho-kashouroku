import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {getPeopleList} from '@/lib/person-api';
import {peopleListHref} from '@/lib/person-detail-data.mjs';
import {pageNumber,searchTerm} from '@/lib/core';
import {Breadcrumb,Heading} from '@/components/ui';
import './people.css';

export const metadata:Metadata={title:'関係者一覧'};
export default async function People({searchParams}:{searchParams:Promise<{category?:string;q?:string;page?:string}>}){
 const query=await searchParams,data=await getPeopleList({category:query.category,term:searchTerm(query.q),page:pageNumber(query.page)});
 if(!data)notFound();
 const href=(overrides:{category?:string;page?:number}={})=>peopleListHref({category:data.category,term:data.term,page:data.page,...overrides});
 return <article className="people-list-page">
  <Breadcrumb parts={[{label:'関係者一覧'}]}/><Heading title="関係者一覧"/>
  <nav className="people-list-tabs" aria-label="関係者の分類">{data.categories.map(c=><Link key={c.id} href={href({category:c.id,page:1})} aria-current={c.id===data.category?'page':undefined}>{c.label}<small>{c.count}</small></Link>)}</nav>
  <form className="search" method="get" action="/people"><div className="search-line"><input type="search" name="q" defaultValue={data.term} maxLength={100} aria-label="名前を入力" placeholder="名前・別名で検索"/><button type="submit">検索</button></div><input type="hidden" name="category" value={data.category}/></form>
  <p className="toolbar-hint">{data.total}件</p>
  {data.items.length?<div className="people-list">{data.items.map(person=><Link key={person.key} className="people-list-person" href={'/people/'+person.key}><span><strong>{person.name}</strong><small>{person.roles.join('・')}</small></span><span aria-hidden="true">↗</span></Link>)}</div>:<p className="empty">該当する名前がありません。</p>}
  {data.pages>1&&<nav className="pages" aria-label="ページ送り">{data.page>1&&<Link href={href({page:data.page-1})}>← 前のページ</Link>}<span>{data.page} / {data.pages} ページ</span>{data.page<data.pages&&<Link href={href({page:data.page+1})}>次のページ →</Link>}</nav>}
 </article>;
}
