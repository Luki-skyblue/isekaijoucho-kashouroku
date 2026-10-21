import Link from 'next/link';
import {notFound} from 'next/navigation';
import {rpc} from '@/lib/api';
import {asArray,displayDate,num,str,validId,JsonObject,rpcDetailPage,numberOfPages} from '@/lib/core';
import {Breadcrumb} from '@/components/ui';
import {RecordArtwork} from '@/components/record-artwork';
import {groupReleaseItems,releaseKindLabel,releaseMediaLabel,releaseLinks,releaseTrackPosition,releaseDuration,type ReleaseDisplayContext} from '@/lib/release-detail-data.mjs';
import {publicCatalogEnabled,publicReleaseDisplayContext} from '@/lib/public-catalog';
import {privateSnapshotEnabled,privateReleaseDisplayContext} from '@/lib/private-snapshot';
import '@/components/release-detail.css';

const ITEMS_PER_PAGE=100;
export default async function ReleaseDetail({params,searchParams}:{params:Promise<{familyId:string}>;searchParams:Promise<{itemsPage?:string}>}){
 const {familyId}=await params;if(!validId(familyId))notFound();
 const itemsPage=rpcDetailPage((await searchParams).itemsPage,ITEMS_PER_PAGE);
 const release=await rpc('kashouroku_v3_release_family',{p_family_id:familyId,p_limit:ITEMS_PER_PAGE,p_offset:(itemsPage-1)*ITEMS_PER_PAGE});if(!release)notFound();
 const context=publicCatalogEnabled()?publicReleaseDisplayContext(familyId):privateSnapshotEnabled()?await privateReleaseDisplayContext(familyId):null;
 const editions=asArray(release.editions),components=asArray(release.components),items=asArray(release.items),groups=groupReleaseItems(release,items),links=releaseLinks(release);
 const title=str(release.title)||'作品名未登録',total=num(release.totalItems),images=context?.artwork.map(x=>x.imageUrl)??[];
 const dates=[...new Set(editions.map(e=>str(e.releaseDate)).filter(Boolean))];
 const formats=[...new Set(components.map(c=>releaseMediaLabel(c.componentKind)).filter((x):x is string=>!!x))];
 if(!formats.length&&editions.some(e=>e.kind==='digital'))formats.push('配信');
 const names=editions.map(e=>str(e.name)).filter(n=>n&&n!=='digital'),catalog=editions.filter(e=>str(e.catalogNumber));
 return <article className="release-detail-page">
  <Breadcrumb parts={[{label:'収録作品',href:'/releases'},{label:title}]}/>
  <header className="release-detail-heading">
   <div className="release-detail-art"><RecordArtwork url={images[0]??null} urls={images}/></div>
   <div className="release-detail-copy">{releaseKindLabel(release.releaseKind)&&<p className="release-detail-kind">{releaseKindLabel(release.releaseKind)}</p>}<h1>{title}</h1></div>
  </header>
  <dl className="release-detail-facts">
   <div><dt>発売日</dt><dd>{dates.length===1&&editions.every(e=>str(e.releaseDate))?displayDate(dates[0]):dates.length?editions.map((e,i)=><span className="release-detail-fact-value" key={str(e.editionId)||i}>{editions.length>1&&str(e.name)&&<span>{str(e.name)} · </span>}{str(e.releaseDate)?displayDate(e.releaseDate):<Missing/>}</span>):<Missing/>}</dd></div>
   <div><dt>形態</dt><dd>{formats.length?formats.join('・'):<Missing/>}</dd></div>
   {editions.length>1&&names.length>0&&<div><dt>バリエーション</dt><dd>{names.join('・')}</dd></div>}
   {catalog.length>0&&<div><dt>品番</dt><dd>{catalog.map((e,i)=><span className="release-detail-fact-value" key={str(e.editionId)||i}>{editions.length>1&&str(e.name)&&str(e.name)+' · '}{str(e.catalogNumber)}</span>)}</dd></div>}
  </dl>
  {links.length>0&&<nav className="release-detail-links" aria-label="関連ページ">{links.map(link=><a key={link.url+link.label} href={link.url} target="_blank" rel="noopener noreferrer nofollow">{link.label} ↗</a>)}</nav>}
  <section className="release-detail-section" id="release-tracks" aria-labelledby="release-content-heading">
   <div className="release-detail-section-title"><h2 id="release-content-heading">収録内容</h2>{total>0&&<span className="release-detail-count" aria-label={total+'件'}>{total}</span>}</div>
   {items.length===0&&total>0?<p className="release-detail-missing">このページに項目がありません。</p>:groups.length?groups.map(group=>{
    const shared=groups.length===1&&group.items.length===total&&['cd','audio_disc','audio_program'].includes(group.componentKind??'')?context?.sharedTracklistLabel:null;
    const label=[shared||group.editionName,groups.length>1?group.label:null].filter(Boolean).join(' · ');
    return <section className="release-detail-disc" key={group.key}>{label&&<h3>{label}</h3>}{group.items.length?<ol className="release-detail-tracks">{group.items.map((item,i)=><Track key={str(item.itemId)||i} item={item} context={context}/>)}</ol>:<Missing/>}</section>;
   }):<Missing/>}
   <DetailPager href={'/releases/'+encodeURIComponent(familyId)} param="itemsPage" page={itemsPage} pages={numberOfPages(num(release.totalItems),ITEMS_PER_PAGE)} anchor="release-tracks"/>
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
function DetailPager({href,param,page,pages,anchor}:{href:string;param:string;page:number;pages:number;anchor:string}){
 if(pages<=1)return null;
 const link=(p:number)=>`${href}?${param}=${p}#${anchor}`;
 return <nav className="pages" aria-label="収録トラックのページ送り">
  {page>1&&<Link href={link(page-1)}>← 前の100件</Link>}
  <span>{page} / {pages} ページ</span>
  {page<pages&&<Link href={link(page+1)}>次の100件 →</Link>}
 </nav>;
}
