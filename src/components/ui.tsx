import Link from 'next/link';
import {RecordArtwork} from './record-artwork';
import {JsonObject,displayDate,num,str,textOr,numberOfPages,explicitThumbnail,ViewMode} from '@/lib/core';
import {liveCardLabel} from '@/lib/live-list-params';

export function Heading({eyebrow,title,description}:{eyebrow?:string;title:string;description?:string}){
 return <header className="page-heading">{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description&&<p className="muted">{description}</p>}</header>;
}
/** Single shared navigation hierarchy; final entry is the current page. */
export function Breadcrumb({parts}:{parts:Array<{label:string;href?:string}>}){
 return <nav className="breadcrumb" aria-label="パンくずリスト"><Link href="/">TOP</Link>
  {parts.map((part,i)=><span className="breadcrumb-part" key={`${part.label}-${i}`}>
    <span className="breadcrumb-separator" aria-hidden="true">/</span>
    {part.href?<Link href={part.href}>{part.label}</Link>:<span aria-current="page">{part.label}</span>}
  </span>)}
 </nav>;
}
export function Panel({title,children,id}:{title:string;children:React.ReactNode;id?:string}){return <section className="panel" id={id}><h2>{title}</h2>{children}</section>;}
export function Empty({children}:{children:React.ReactNode}){return <p className="empty">{children}</p>;}
export function Chip({children}:{children:React.ReactNode}){return <span className="chip">{children}</span>;}
/** Preserve query and view while paging. */
function listHref(path:string, term:string, page:number, view:ViewMode){
 const query = new URLSearchParams();
 if(term) query.set('q',term);
 if(view==='grid') query.set('view','grid');
 if(page>1) query.set('page',String(page));
 const qs=query.toString();
 return qs ? `${path}?${qs}` : path;
}
export function PageLinks({path,term='',page,total,limit=24,view='list'}:{path:string;term?:string;page:number;total:number;limit?:number;view?:ViewMode}){
 const pages=numberOfPages(total,limit); if(pages<2)return null;
 return <nav className="pages" aria-label="ページ送り">
 {page>1&&<Link href={listHref(path,term,page-1,view)}>← 前のページ</Link>}
 <span>{page} / {pages} ページ</span>
 {page<pages&&<Link href={listHref(path,term,page+1,view)}>次のページ →</Link>}
 </nav>;
}
function RecordThumbnail({x}:{x:JsonObject}){
 return <RecordArtwork url={explicitThumbnail(x)}/>;
}
export function SimpleList({items,kind,view='list'}:{items:JsonObject[];kind:'work'|'release'|'event';view?:ViewMode}){
 const id=(x:JsonObject)=>str(kind==='work'?x.id:kind==='event'?x.eventId:x.familyId);
 const href=(x:JsonObject)=>`${kind==='work'?'/songs':kind==='event'?'/lives':'/releases'}/${encodeURIComponent(id(x))}`;
 return <div className={`records records-${view}`}>
 {items.map(x=><Link className="record" key={id(x)} href={href(x)}>
   <RecordThumbnail x={x}/>
   <span className="record-copy"><span className="record-title">{textOr(x.title)}</span>{kind!=='work'&&<span className="record-meta">{kind==='event'?[liveCardLabel(x),displayDate(x.firstOfficialDate)].filter(Boolean).join(' · '):`edition ${num(x.editionCount)}件`}</span>}</span>
   <span className="record-arrow" aria-hidden="true">↗</span>
 </Link>)}
 </div>;
}
export function LabelValue({label,value}:{label:string;value:unknown}){return <div className="label-value"><dt>{label}</dt><dd>{textOr(value)}</dd></div>;}
export function RowMeta({rows}:{rows:JsonObject[]}){return <dl className="meta-grid">{rows.map((x,i)=><LabelValue key={i} label={str(x.label)} value={x.value}/>)}</dl>;}
export function ListPage({heading,items,total,kind,term,page,limit=24,view='list'}:{heading:string;items:JsonObject[];total:number;kind:'work'|'event'|'release';term:string;page:number;limit?:number;view?:ViewMode}){
 const path=kind==='work'?'/songs':kind==='event'?'/lives':'/releases';
 return <><Breadcrumb parts={[{label:heading}]}/><Heading title={heading}/>
 <form className="search" method="get" action={path}><div className="search-line"><input id="q" type="search" name="q" defaultValue={term} maxLength={100} aria-label={kind==='work'?'楽曲名を入力':kind==='event'?'公演名を入力':'商品名を入力'} placeholder={kind==='work'?'楽曲名を入力':kind==='event'?'公演名を入力':'商品名を入力'}/><button type="submit">検索</button></div><input name="view" type="hidden" value={view}/></form>
 <div className="list-toolbar">
  <p className="toolbar-hint">{total}件</p>
  <nav className="view-switch" aria-label="一覧の表示形式"><span>VIEW</span><Link href={listHref(path,term,page,'list')} aria-current={view==='list'?'page':undefined}>リスト</Link><Link href={listHref(path,term,page,'grid')} aria-current={view==='grid'?'page':undefined}>グリッド</Link></nav>
 </div>
 {items.length?<SimpleList items={items} kind={kind} view={view}/>:<Empty>該当する項目がありません。</Empty>}
 <PageLinks path={path} term={term} page={page} total={total} limit={limit} view={view}/></>;
}
