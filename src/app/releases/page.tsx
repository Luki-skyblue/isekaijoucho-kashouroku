import Link from 'next/link';
import type { Metadata } from 'next';
import {rpc} from '@/lib/api';
import {asArray,num,pageNumber,pageOffset,searchTerm,viewMode,displayDate} from '@/lib/core';
import {getReleaseList} from '@/lib/release-list-api';
import {releaseListHref} from '@/lib/release-list-data.mjs';
import {homeToday} from '@/lib/home-recent-data.mjs';
import {Breadcrumb,Heading,ListPage} from '@/components/ui';
import {RecordArtwork} from '@/components/record-artwork';
import {detailSearchHref} from '@/lib/search-navigation.mjs';
import {withListReturnTo} from '@/lib/catalog-navigation';
import './releases.css';

export const metadata: Metadata = {title:'収録作品',description:'ヰ世界情緒に関連するリリースとLIVE音源・映像。'};
export default async function Releases({searchParams}:{searchParams:Promise<{q?:string;page?:string;view?:string;category?:string}>}){
 const query=await searchParams,page=pageNumber(query.page),term=searchTerm(query.q),view=viewMode(query.view),limit=24;
 const data=await getReleaseList({category:query.category,term,page});
 if(!data){
  // Preserve the older RPC-only reader without fetching every detail over HTTP.
  const result=await rpc('kashouroku_v3_release_families',{p_search:term||null,p_limit:limit,p_offset:pageOffset(page,limit)});
  return <ListPage heading="収録作品" items={asArray(result?.items)} total={num(result?.total)} term={term} page={page} limit={limit} view={view} kind="release"/>;
 }
 const today=homeToday();
 const href=(overrides:{category?:string;page?:number;view?:'list'|'grid'}={})=>releaseListHref({category:data.category,term,page:data.page,view,...overrides});
 const alternateCategory=data.term&&data.total===0?data.categories.find(category=>category.id!==data.category&&category.count>0):undefined;
 return <article className="release-list-page">
  <Breadcrumb parts={[{label:'収録作品'}]}/><Heading title="収録作品"/>
  <nav className="release-list-categories" aria-label="収録作品の分類">{data.categories.map(category=><Link key={category.id} href={href({category:category.id,page:1})} aria-current={category.id===data.category?'page':undefined}>{category.label}<small>{category.count}</small></Link>)}</nav>
  <form className="search" method="get" action="/releases">
   <div className="search-line"><input id="q" type="search" name="q" defaultValue={term} maxLength={100} aria-label="作品名を入力" placeholder="作品名を入力"/><button type="submit">検索</button><Link className="search-detail-link" href={detailSearchHref(href())}>詳細検索</Link></div>
   <input name="category" type="hidden" value={data.category}/><input name="view" type="hidden" value={view}/>
  </form>
  <div className="list-toolbar"><p className="toolbar-hint">{data.total}件</p>
   <nav className="view-switch" aria-label="一覧の表示形式"><span>VIEW</span>{(['list','grid'] as const).map(mode=><Link key={mode} href={href({view:mode})} aria-current={view===mode?'page':undefined}>{mode==='list'?'リスト':'グリッド'}</Link>)}</nav>
  </div>
  {data.items.length?<div className={'records records-'+view}>{data.items.map(item=>{
   const content=<><RecordArtwork url={item.thumbnailUrl} urls={item.thumbnailUrls}/><span className="record-copy"><span className="record-title">{item.title}</span><span className="record-meta">{[item.kindLabel,item.date?displayDate(item.date):'発売日未確認',item.date&&item.date>today?'発売予定':null,item.external?'配信先':null].filter(Boolean).join(' · ')}</span></span><span className="record-arrow" aria-hidden="true">↗</span></>;
   return item.external?<a className="record" key={item.key} href={item.href} target="_blank" rel="noopener noreferrer">{content}</a>:<Link className="record" key={item.key} href={withListReturnTo(item.href,'/releases',href())}>{content}</Link>;
  })}</div>:<p className="empty">{alternateCategory?<Link href={href({category:alternateCategory.id,page:1})}>{alternateCategory.label}に{alternateCategory.count}件あります<span aria-hidden="true"> →</span></Link>:'該当する作品がありません。'}</p>}
  {data.pages>1&&<nav className="pages" aria-label="ページ送り">{data.page>1&&<Link href={href({page:data.page-1})}>← 前のページ</Link>}<span>{data.page} / {data.pages} ページ</span>{data.page<data.pages&&<Link href={href({page:data.page+1})}>次のページ →</Link>}</nav>}
 </article>;
}
