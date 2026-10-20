import Link from 'next/link';
import {notFound} from 'next/navigation';
import {rpc} from '@/lib/api';
import {asArray,asObject,displayDate,num,safeExternalUrl,str,textOr,validId,JsonObject,rpcDetailPage,numberOfPages} from '@/lib/core';
import {Breadcrumb,Chip,Empty,Heading,Panel} from '@/components/ui';
const ITEMS_PER_PAGE=100;
export default async function ReleaseDetail({params,searchParams}:{params:Promise<{familyId:string}>;searchParams:Promise<{itemsPage?:string}>}){
 const {familyId}=await params;if(!validId(familyId))notFound();
 const itemsPage=rpcDetailPage((await searchParams).itemsPage,ITEMS_PER_PAGE);
 const release=await rpc('kashouroku_v3_release_family',{p_family_id:familyId,p_limit:ITEMS_PER_PAGE,p_offset:(itemsPage-1)*ITEMS_PER_PAGE});if(!release)notFound();
 const editions=asArray(release.editions),components=asArray(release.components),items=asArray(release.items),resources=asArray(release.resources);
 return <><Breadcrumb parts={[{label:"リリース一覧",href:"/releases"},{label:textOr(release.title)}]}/><Heading eyebrow="RELEASE / FAMILY" title={textOr(release.title)} description={`種別: ${textOr(release.releaseKind)} ・ edition ${num(release.totalEditions)}件`}/>
 <div className="data-note">印字タイトルと正規化された楽曲IDは別に保持しています。LIVE収録のリンクはそれだけでフル歌唱の証明にはなりません。</div>
 <Panel title="商品エディション">{editions.length?<div className="stack">{editions.map((ed,i)=><article key={str(ed.editionId)||i} className="subrecord"><strong>{textOr(ed.name,'edition名称未登録')}</strong><p className="muted tiny">形態: {textOr(ed.kind)} / 発売: {displayDate(ed.releaseDate)} / 状態: {textOr(ed.status)}</p></article>)}</div>:<Empty>エディションは未登録です。</Empty>}</Panel>
 <Panel id="release-tracks" title={`収録トラック（${num(release.totalItems)}件）`}>{items.length?<div className="stack">{items.map((item,i)=>{const component=components.find(c=>str(c.componentId)===str(item.componentId));const links=asArray(item.associations),subparts=asArray(item.subparts);return <article className="subrecord" key={str(item.itemId)||i}><div className="row-top"><strong>{textOr(item.rawTitle,'印字タイトル未登録')}</strong><Chip>Track {textOr(item.rawPosition,String(num(item.sequenceNo)||'?'))}</Chip></div><p className="muted tiny">{textOr(component?.rawLabel,textOr(component?.componentKind,'収録媒体未登録'))} / 種別: {textOr(item.itemKind)}</p>{subparts.length>0&&<p className="tiny">トラック内の区間: {subparts.map(p=>textOr(p.rawLabel)).join(' / ')}</p>}{links.length>0?<div className="tiny muted">{links.map((a,j)=><p key={str(a.linkId)||j}>{textOr(a.targetKind)}との関係: {textOr(a.relationType)} / 完全性: {textOr(a.completeness,'未確認')}{str(a.targetKind)==='work'&&validId(str(a.workId))?<>{' '}<Link href={`/songs/${encodeURIComponent(str(a.workId))}`}>登録作品を見る ↗</Link></>:null}{str(a.targetKind)==='program_item'?'（曲単位のfullは未確認）':''}</p>)}</div>:<p className="tiny muted">曲との明示的な同定リンクは未登録</p>}</article>})}</div>:<Empty>収録トラックは未登録です。</Empty>}<DetailPager href={`/releases/${encodeURIComponent(familyId)}`} param="itemsPage" page={itemsPage} pages={numberOfPages(num(release.totalItems),ITEMS_PER_PAGE)} anchor="release-tracks" /></Panel>
 <Panel title="関連ページ・販売情報">{resources.length?<div className="stack">{resources.map((r,i)=>{const url=safeExternalUrl(r.url);return <p key={str(r.resourceId)||i}>{url?<a href={url} target="_blank" rel="noopener noreferrer nofollow">{textOr(r.resourceKind,'商品ページ')} ↗</a>:textOr(r.resourceKind,'URL未登録')} <span className="muted tiny">{textOr(r.officiality,'公式性未確認')}・現在の入手可否: {textOr(r.availability,'未確認')}</span></p>})}</div>:<Empty>関連ページは未登録です。</Empty>}</Panel></>;
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
