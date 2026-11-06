import Link from 'next/link';
import {sitePageMetadata} from '@/lib/page-metadata';
import {PAGE_LABELS} from '@/lib/ui-copy.mjs';
import {Breadcrumb,Heading} from '@/components/ui';
import {RecordArtwork} from '@/components/record-artwork';
import {CombinedSearchBuilder,CombinedSearchSort} from '@/components/combined-search-builder';
import {getCombinedSearch} from '@/lib/combined-search-api';
import {SEARCH_TARGETS} from '@/lib/search-navigation.mjs';
import {combinedSearchHref,conditionText,readCombinedSearch,emptySearchTree,type SearchNode} from '@/lib/combined-search-query.mjs';
import {listDetailHref} from '@/lib/catalog-navigation';
import {displayDate} from '@/lib/core';
import './search.css';

export function generateMetadata(){return sitePageMetadata('/search',PAGE_LABELS.search,{description:'楽曲、LIVE、収録作品、関係者の情報を組み合わせて検索。',index:false});}
function AppliedConditions({node,target,choices}:{node:SearchNode;target:string;choices:Parameters<typeof conditionText>[2]}){
 if(node.type==='rule')return <li>{conditionText(node,target,choices)}</li>;
 return <li className="search-applied-group"><span>{node.not?'除外：':''}{node.match==='all'?'すべてに一致':'いずれかに一致'}</span><ul>{node.children.map((child,i)=><AppliedConditions key={i} node={child} target={target} choices={choices}/>)}</ul></li>;
}
export default async function Search({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const raw=await searchParams,data=await getCombinedSearch(raw),query=data??readCombinedSearch(raw),target=query.target;
 const returnTo=combinedSearchHref({...query,tree:query.tree??emptySearchTree()}),path=SEARCH_TARGETS.find(t=>t.id===target)!.path as '/songs'|'/lives'|'/releases'|'/people';
 return <article className="search-detail-page"><Breadcrumb parts={[{label:PAGE_LABELS.search}]}/><Heading title={PAGE_LABELS.search}/>
  <p className="search-development-note">詳細検索は整備中です。登録情報の不足により、結果に漏れがある場合があります。</p>
  <nav className="search-targets" aria-label="検索する対象">{SEARCH_TARGETS.map(t=><Link key={t.id} href={t.id===target?returnTo:combinedSearchHref({target:t.id as typeof target})} aria-current={target===t.id?'page':undefined}>{t.label}</Link>)}</nav>
  {data?<><CombinedSearchBuilder query={query} choices={data.choices}/>
   <section id="search-results" className="combined-search-results" tabIndex={-1} aria-label="検索結果">
    {data.errors.length>0?<div className="search-errors" role="alert"><p>検索条件を適用できませんでした。</p><ul>{data.errors.map(error=><li key={error}>{error}</li>)}</ul><Link href={combinedSearchHref({target})}>条件をクリア</Link></div>:<>
     <div className="search-result-heading"><h2>検索結果 <span>{data.total}件</span></h2><span className="search-applied-label">{data.ruleCount?`${data.ruleCount}条件を適用中`:'絞り込みなし'}</span></div>
     {!!query.tree?.children.length&&<details className="search-applied"><summary>適用中の条件</summary><ul><AppliedConditions node={query.tree} target={target} choices={data.choices}/></ul></details>}
     <div className="search-result-toolbar"><CombinedSearchSort query={query}/><nav className="view-switch" aria-label="一覧の表示形式"><span>VIEW</span>{(['list','grid'] as const).map(view=><Link key={view} href={combinedSearchHref(query,{view})+'#search-results'} scroll={false} aria-current={query.view===view?'page':undefined}>{view==='list'?'リスト':'グリッド'}</Link>)}</nav></div>
     {data.items.length?<div className={`records records-${query.view} search-records ${target==='people'?'search-person-records':''}`}>{data.items.map(item=><Link key={item.id} className="record" href={item.external?item.href:listDetailHref(path,item.id,returnTo)} {...(item.external?{target:'_blank',rel:'noopener noreferrer'}:{})}>
      {target!=='people'&&<RecordArtwork url={item.imageUrl} urls={item.imageUrls}/>}
      <span className="record-copy">{target==='lives'&&item.subtitle&&<span className="record-eyebrow">{item.subtitle}</span>}<span className="record-title">{item.title}</span>{target!=='lives'&&item.subtitle&&<span className="record-credit">{item.subtitle}</span>}<span className="record-meta">{item.date&&<time dateTime={item.date}>{displayDate(item.date)}</time>}{item.meta&&!(target==='lives'&&item.subtitle.includes(item.meta))&&<span>{item.meta}</span>}{item.external&&<span>公式サイト ↗</span>}</span></span><span className="record-arrow" aria-hidden="true">↗</span>
     </Link>)}</div>:<p className="empty">条件に合う結果が見つかりません。条件を減らすか、「いずれかに一致」を試してください。</p>}
     {data.pages>1&&<nav className="pages" aria-label="検索結果のページ送り">{data.page>1&&<Link href={combinedSearchHref(query,{page:data.page-1})+'#search-results'}>← 前のページ</Link>}<span>{data.page} / {data.pages} ページ</span>{data.page<data.pages&&<Link href={combinedSearchHref(query,{page:data.page+1})+'#search-results'}>次のページ →</Link>}</nav>}
    </>}
   </section>
  </>:<p className="empty">詳細検索のデータを読み込めません。<Link href={path}>一覧から探す</Link></p>}
 </article>;
}
