import Link from 'next/link';
import {notFound} from 'next/navigation';
import {asArray,displayDate,str,validId,JsonObject,rpcDetailPage} from '@/lib/core';
import {Breadcrumb} from '@/components/ui';
import {RecordArtwork} from '@/components/record-artwork';
import {releaseKindLabel,releaseMediaLabel,releaseTrackPosition,releaseDuration,releaseEditionName,releaseDetailHref,type ReleaseDisplayContext} from '@/lib/release-detail-data.mjs';
import {getReleaseDetail} from '@/lib/release-detail-api';
import type {Metadata} from 'next';
import {safeListReturnTo,withListReturnTo} from '@/lib/catalog-navigation';
import '@/components/release-detail.css';

const ITEMS_PER_PAGE=100;
export async function generateMetadata({params}:{params:Promise<{familyId:string}>}):Promise<Metadata>{
 const {familyId}=await params;if(!validId(familyId))return {};
 const view=await getReleaseDetail(familyId,{});return view?{title:str(view.release.title)||'収録作品'}:{};
}
export default async function ReleaseDetail({params,searchParams}:{params:Promise<{familyId:string}>;searchParams:Promise<{itemsPage?:string;edition?:string;from?:string}>}){
 const {familyId}=await params;if(!validId(familyId))notFound();
 const query=await searchParams,itemsPage=rpcDetailPage(query.itemsPage,ITEMS_PER_PAGE),returnTo=safeListReturnTo(query.from,'/releases');
 const editionHref=(editionId?:string)=>withListReturnTo(releaseDetailHref(familyId,{editionId} ),'/releases',returnTo);
 const view=await getReleaseDetail(familyId,{editionId:typeof query.edition==='string'?query.edition:null,page:itemsPage});if(!view)notFound();
 const {release,context,editions,selectedEdition,components,groups,total,links}=view,activeEditions=selectedEdition?[selectedEdition]:editions;
 const title=str(release.title)||'作品名未登録',images=view.artwork.map(x=>x.imageUrl);
 const dates=[...new Set(activeEditions.map(e=>str(e.releaseDate)).filter(Boolean))];
 const formats=[...new Set(components.map(c=>releaseMediaLabel(c.componentKind)).filter((x):x is string=>!!x))];
 const knownMedia=activeEditions.map(e=>str(e.mediaLabel)).filter(Boolean);if(knownMedia.length){formats.splice(0,formats.length,...new Set(knownMedia));}
 if(!formats.length&&activeEditions.some(e=>e.kind==='digital'))formats.push('配信');
 const catalog=activeEditions.filter(e=>str(e.catalogNumber)),inclusions=selectedEdition&&Array.isArray(selectedEdition.inclusionLabels)?selectedEdition.inclusionLabels.filter((x):x is string=>typeof x==='string'):[];
 return <article className="release-detail-page">
  <Breadcrumb parts={[{label:returnTo?'検索結果に戻る':'収録作品',href:returnTo??'/releases'},{label:title}]}/>
  <header className="release-detail-heading">
   <div className="release-detail-art"><RecordArtwork key={str(selectedEdition?.editionId)||'all'} url={images[0]??null} urls={images}/></div>
   <div className="release-detail-copy">{releaseKindLabel(release.releaseKind)&&<p className="release-detail-kind">{releaseKindLabel(release.releaseKind)}</p>}<h1>{title}</h1>
    {context&&editions.length>1&&<nav className="release-edition-tabs" aria-label="商品版の切替">
     <Link href={editionHref()} scroll={false} aria-current={!selectedEdition?'page':undefined}>すべて</Link>
     {editions.map(e=><Link key={str(e.editionId)} href={editionHref(str(e.editionId))} scroll={false} aria-current={selectedEdition?.editionId===e.editionId?'page':undefined}>{releaseEditionName(e)}</Link>)}
    </nav>}
   </div>
  </header>
  <dl className="release-detail-facts">
   <div><dt>発売日</dt><dd>{dates.length===1&&activeEditions.every(e=>str(e.releaseDate))?displayDate(dates[0]):dates.length?activeEditions.map((e,i)=><span className="release-detail-fact-value" key={str(e.editionId)||i}>{!selectedEdition&&editions.length>1&&<span>{releaseEditionName(e)} · </span>}{str(e.releaseDate)?displayDate(e.releaseDate):<Missing/>}</span>):<Missing/>}</dd></div>
   <div><dt>形態</dt><dd>{formats.length?formats.join('・'):<Missing/>}</dd></div>
   {catalog.length>0&&<div><dt>品番</dt><dd>{catalog.map((e,i)=><span className="release-detail-fact-value" key={str(e.editionId)||i}>{!selectedEdition&&editions.length>1&&releaseEditionName(e)+' · '}{str(e.catalogNumber)}</span>)}</dd></div>}
   {inclusions.length>0&&<div><dt>付属品</dt><dd><ul className="release-detail-inclusions">{inclusions.map((label,i)=><li key={i}>{label}</li>)}</ul></dd></div>}
   {view.recordedEvents.length>0&&<div><dt>収録公演</dt><dd><ul className="release-detail-events">{view.recordedEvents.map(event=><li key={event.href}><Link href={event.href}>{event.title}</Link></li>)}</ul></dd></div>}
  </dl>
  {links.length>0&&<nav className="release-detail-links" aria-label="関連ページ">{links.map(link=><a key={link.url+link.label} href={link.url} target="_blank" rel="noopener noreferrer nofollow">{link.label} ↗</a>)}</nav>}
  <section className="release-detail-section" id="release-tracks" aria-labelledby="release-content-heading">
   <div className="release-detail-section-title"><h2 id="release-content-heading">収録内容</h2>{total>0&&<span className="release-detail-count" aria-label={total+'件'}>{total}</span>}</div>
   {view.contentNote&&<p className="release-detail-missing">{view.contentNote}</p>}
   {groups.length?groups.map(group=>{
    const label=[group.key==='shared'||!selectedEdition?group.editionName:null,groups.length>1?group.label:null].filter(Boolean).join(' · ');
    return <section className="release-detail-disc" key={group.key}>{label&&<h3>{label}</h3>}{group.items.length?<ol className="release-detail-tracks">{group.items.map((item,i)=><Track key={str(item.itemId)||i} item={item} context={context}/>)}</ol>:<Missing/>}</section>;
   }):<Missing/>}
   <DetailPager familyId={familyId} editionId={str(selectedEdition?.editionId)||null} page={view.page} pages={view.pages} returnTo={returnTo}/>
  </section>
 </article>;
}
function Missing(){return <span className="release-detail-missing">準備中</span>;}
function Track({item,context}:{item:JsonObject;context:ReleaseDisplayContext|null}){
 const target=context?.itemLinks[str(item.itemId)],title=str(item.rawTitle),duration=releaseDuration(item.durationMs),parts=asArray(item.subparts);
 return <li className="release-detail-track">
  <span className="release-detail-position">{releaseTrackPosition(item)}</span>
  <div className="release-detail-track-copy"><span className="release-detail-track-title">{title?target?<Link href={'/songs/'+target.entryId}>{title}</Link>:title:<Missing/>}</span>
   {parts.length>0&&<details className="release-detail-parts"><summary>内訳</summary><ol>{parts.map((p,i)=><li key={str(p.partId)||i}>{str(p.rawLabel)||<Missing/>}</li>)}</ol></details>}
  </div>
  {duration&&<span className="release-detail-duration">{duration}</span>}
 </li>;
}

/** A small server-only pager keeps release item order defined by the RPC. */
function DetailPager({familyId,editionId,page,pages,returnTo}:{familyId:string;editionId:string|null;page:number;pages:number;returnTo:string|null}){
 if(pages<=1)return null;
 const link=(p:number)=>withListReturnTo(releaseDetailHref(familyId,{editionId,page:p}),'/releases',returnTo)+'#release-tracks';
 return <nav className="pages" aria-label="収録トラックのページ送り">
  {page>1&&<Link href={link(page-1)}>← 前の100件</Link>}
  <span>{page} / {pages} ページ</span>
  {page<pages&&<Link href={link(page+1)}>次の100件 →</Link>}
 </nav>;
}
