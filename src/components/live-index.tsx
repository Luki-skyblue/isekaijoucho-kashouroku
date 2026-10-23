import Link from 'next/link';
import {Breadcrumb,Heading,SimpleList,Empty} from '@/components/ui';
import {ListSort} from '@/components/list-sort';
import {detailSearchHref} from '@/lib/search-navigation.mjs';
import {LIVE_SORTS,liveHref,activeLiveConditions,type LiveArtist,type ParsedLiveQuery} from '@/lib/live-list-params';
import type {JsonObject} from '@/lib/core';

function AppliedInputs({query,search=true}:{query:ParsedLiveQuery;search?:boolean}) {
 return <>{search&&query.q&&<input type="hidden" name="q" value={query.q}/>}
  {query.artistIds.map(id=><input key={id} type="hidden" name="artist" value={id}/>)}
  <input type="hidden" name="artistScope" value={query.artistScope}/><input type="hidden" name="artistMatch" value={query.artistMatch}/>
  {query.formats.map(f=><input key={f} type="hidden" name="type" value={f}/>)}
  <input type="hidden" name="view" value={query.view}/></>;
}
export function LiveIndex({items,total,query,limit,artists,review}:{items:JsonObject[];total:number;query:ParsedLiveQuery;limit:number;artists:LiveArtist[];review:{id:string|null;applied:boolean;publicRelease?:boolean}}) {
 const tags=activeLiveConditions(query,artists),pages=Math.ceil(total/limit);
 return <><Breadcrumb parts={[{label:'LIVE・公演'}]}/><Heading title="LIVE・公演"/>
 <form className="search" action="/lives" method="get"><div className="search-line"><input key={query.q} type="text" name="q" defaultValue={query.q} maxLength={100} aria-label="公演名を入力" placeholder="公演名を入力"/><button type="submit">検索</button><Link className="search-detail-link" href={detailSearchHref(liveHref(query))}>詳細検索</Link></div><AppliedInputs query={query} search={false}/><input type="hidden" name="sort" value={query.sort}/></form>
 {tags.length>0&&<div className="catalog-applied" aria-label="適用中の条件"><span className="catalog-applied-heading">適用中</span><div className="catalog-applied-tags">{tags.map(c=><Link key={c.key} href={c.href} className="catalog-applied-tag" aria-label={`${c.label}を解除`}>{c.label}<span aria-hidden="true">×</span></Link>)}<Link className="catalog-applied-reset" href={liveHref(query,{q:'',artistIds:[],artistMatch:'any',formats:[],page:1})}>すべて解除</Link></div></div>}
 <div className="list-toolbar" data-live-review-id={review.id??undefined}><p className="toolbar-hint">{total}件</p><div className="catalog-toolbar-controls"><ListSort id="live-sort" action="/lives" value={query.sort} options={LIVE_SORTS.map(s=>({value:s.id,label:s.label,href:liveHref(query,{sort:s.id,page:1})}))}><AppliedInputs query={query}/></ListSort><nav className="view-switch" aria-label="一覧の表示形式"><span>VIEW</span><Link href={liveHref(query,{view:'list'})} aria-current={query.view==='list'?'page':undefined}>リスト</Link><Link href={liveHref(query,{view:'grid'})} aria-current={query.view==='grid'?'page':undefined}>グリッド</Link></nav></div></div>
 {items.length?<SimpleList items={items} kind="event" view={query.view}/>:<Empty>該当する項目がありません。</Empty>}
 {pages>1&&<nav className="pages" aria-label="ページ送り">{query.page>1&&<Link href={liveHref(query,{page:query.page-1})}>← 前のページ</Link>}<span>{query.page} / {pages} ページ</span>{query.page<pages&&<Link href={liveHref(query,{page:query.page+1})}>次のページ →</Link>}</nav>}
 </>;
}
