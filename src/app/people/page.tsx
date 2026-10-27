import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {getPeopleList} from '@/lib/person-api';
import {peopleListHref,personDetailHref} from '@/lib/person-detail-data.mjs';
import {pageNumber,searchTerm} from '@/lib/core';
import {Breadcrumb,Heading} from '@/components/ui';
import {detailSearchHref} from '@/lib/search-navigation.mjs';
import './people.css';

export const metadata:Metadata={title:'関係者検索'};
export default async function People({searchParams}:{searchParams:Promise<{category?:string;kind?:string;q?:string;role?:string;page?:string}>}){
 const query=await searchParams,data=await getPeopleList({category:query.category,kind:query.kind,term:searchTerm(query.q),role:query.role,page:pageNumber(query.page)});
 if(!data)notFound();
 const href=(overrides:{category?:string;kind?:string;role?:string;page?:number}={})=>peopleListHref({category:data.category,kind:data.kind,term:data.term,role:data.role,page:data.page,...overrides});
 const appliedRole=data.roleOptions.find(r=>r.id===data.role)?.label;
 return <article className="people-list-page">
  <Breadcrumb parts={[{label:'関係者検索'}]}/><Heading title="関係者検索"/>
  <nav className="people-list-tabs" aria-label="関わり方">{data.categories.map(c=><Link key={c.id} href={href({category:c.id,role:'all',page:1})} scroll={false} aria-current={c.id===data.category?'page':undefined}>{c.label}<small>{c.count}</small></Link>)}</nav>
  <form key={data.category+'|'+data.kind+'|'+data.term+'|'+data.role} className="search people-list-search" method="get" action="/people"><div className="search-line"><input type="search" name="q" defaultValue={data.term} maxLength={100} aria-label="名前を入力" placeholder="名前・別名で検索"/>{['music','production'].includes(data.category)&&<label className="people-list-role">担当<select name="role" defaultValue={data.role}>{data.roleOptions.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>}<button type="submit">検索</button><Link className="search-detail-link" href={detailSearchHref(href())}>詳細検索</Link></div><input type="hidden" name="category" value={data.category}/>{data.kind==='group'&&<input type="hidden" name="kind" value="group"/>}{!['music','production'].includes(data.category)&&data.role!=='all'&&<input type="hidden" name="role" value={data.role}/>}</form>
  {data.kind==='group'&&<div className="catalog-applied"><Link className="catalog-applied-tag" href={href({kind:'all',page:1})}>グループ<span aria-hidden="true">×</span></Link></div>}
  {data.role!=='all'&&<div className="catalog-applied" aria-label="適用中の条件"><span className="catalog-applied-heading">適用中</span><Link className="catalog-applied-tag" href={href({role:'all',page:1})} aria-label={`担当：${appliedRole}を解除`}>担当：{appliedRole}<span aria-hidden="true">×</span></Link></div>}
  <p className="toolbar-hint">{data.total}件{data.category!=='vocal'?'・関連楽曲の多い順':''}</p>
  {data.items.length?<div className="people-list">{data.items.map(person=><Link key={person.key} className="people-list-person" href={personDetailHref(person.key,{role:data.role})}><span><strong><span>{person.name}</span>{person.type==='group'&&<small>グループ</small>}<small>{person.songCount}曲</small></strong><small>{person.roles.join('・')}</small></span><span aria-hidden="true">↗</span></Link>)}</div>:<><p className="empty">該当する名前がありません。</p>{data.suggestions.length>0&&<p className="people-list-suggestions">もしかして：{data.suggestions.map(person=><Link key={person.key} href={personDetailHref(person.key)}>{person.name}（{person.categoryLabel}）</Link>)}</p>}</>}
  {data.pages>1&&<nav className="pages" aria-label="ページ送り">{data.page>1&&<Link href={href({page:data.page-1})}>← 前のページ</Link>}<span>{data.page} / {data.pages} ページ</span>{data.page<data.pages&&<Link href={href({page:data.page+1})}>次のページ →</Link>}</nav>}
 </article>;
}
