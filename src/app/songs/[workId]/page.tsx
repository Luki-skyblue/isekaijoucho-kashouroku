import Link from 'next/link';
import {useCatalogEntryIndex} from '@/lib/catalog-mode';
import {localCatalogReviewEnabled} from '@/lib/catalog-local-review';
import {getCatalogSongDetail,getCatalogSongWork} from '@/lib/catalog-song-api';
import {CatalogSongDetail,CatalogSongWorkChoices} from '@/components/song-detail';
import {notFound,permanentRedirect,redirect} from 'next/navigation';
import {safeCatalogReturnTo,catalogEntryHref} from '@/lib/catalog-navigation';
import {publicCatalogEnabled,publicLegacySongTarget} from '@/lib/public-catalog';
import {rpc} from '@/lib/api';
import {asArray,asObject,confirmedSongFullFromProgram,displayDate,evidenceLabel,exactSingers,mediaGroups,num,pageNumber,safeExternalUrl,recordingDate,relatedRenditionParticipants,str,textOr,validId,JsonObject} from '@/lib/core';
import {Breadcrumb,Chip,Empty,Heading,Panel} from '@/components/ui';

export default async function SongDetail({params,searchParams}:{params:Promise<{workId:string}>;searchParams:Promise<{historyPage?:string;tab?:string;from?:string}>}){
 const query=await searchParams,returnTo=safeCatalogReturnTo(query.from),historyPage=pageNumber(query.historyPage),initialTab=['info','videos','history','releases','versions'].includes(query.tab??'')?query.tab:historyPage>1?'history':'info';
 const {workId}=await params;
 if(publicCatalogEnabled()&&/^[1-9]\d{0,8}$/.test(workId)){
  const target=publicLegacySongTarget(Number(workId));if(target)permanentRedirect(catalogEntryHref(target,returnTo));
 }
 if(!validId(workId))notFound();
 if(useCatalogEntryIndex()) {
  const song=await getCatalogSongDetail(workId);
  if(song)return <>{localCatalogReviewEnabled()&&<p className="catalog-review-warning">開発用・ローカル候補レビュー</p>}<CatalogSongDetail song={song} initialTab={initialTab} returnTo={returnTo}/></>;
  const work=await getCatalogSongWork(workId);
  // A later vocal form may make this work URL ambiguous, so do not cache a
  // permanent redirect to today's sole entry.
  if(work?.entries.length===1)redirect(catalogEntryHref(work.entries[0].entryId,returnTo));
  if(work)return <CatalogSongWorkChoices work={work} returnTo={returnTo}/>;
  notFound();
 }
 const [work,renditions,media,releases,sources]=await Promise.all([
  rpc('kashouroku_v3_work',{p_work_id:workId}),
  rpc('kashouroku_v3_work_renditions',{p_work_id:workId,p_limit:50,p_offset:0}),
  rpc('kashouroku_v3_work_media',{p_work_id:workId,p_limit:50,p_offset:0}),
  rpc('kashouroku_v3_work_releases',{p_work_id:workId,p_limit:50,p_offset:0}),
  rpc('kashouroku_v3_work_sources',{p_work_id:workId,p_limit:50,p_offset:0})]);
 if(!work)notFound();
 const versions=asArray(work.versions),credits=asArray(work.workCredits),parts=asArray(renditions?.items),medias=mediaGroups(media?.items),products=asArray(releases?.items),related=asArray(sources?.items);
 return <><Breadcrumb parts={[{label:"楽曲一覧",href:"/songs"},{label:textOr(work.title)}]}/><Heading eyebrow="SONG / WORK" title={textOr(work.title)} description="版・歌唱記録・媒体を区別した作品ページ"/>
 <div className="data-note">現在表示しているのは登録済みの記録です。未確認の歌唱者・フル・録音日を推測して補いません。</div>
 <Panel title={`バージョン（${versions.length}件）`}>{versions.length?<div className="stack">{versions.map((v,i)=><div key={str(v.id)||i} className="subrecord"><strong>{textOr(v.officialTitle || v.label,'名称未登録')}</strong><p className="muted tiny">{str(v.kind)}・{str(v.labelBasis)==='editorial'?'便宜的な分類名':'登録された名称'}</p></div>)}</div>:<Empty>安定したversionの登録はありません。歌唱履歴がないという意味ではありません。</Empty>}</Panel>
 <Panel title="作詞・作曲など">{credits.length?<div className="stack">{credits.map((c,i)=><div className="metadata-line" key={i}><strong>{textOr(c.role,'役割未登録')}</strong><span>{textOr(c.name)}</span></div>)}</div>:<Empty>クレジットは未登録です。</Empty>}</Panel>
 <Panel title={`歌唱・録音履歴（${num(renditions?.total)}件）`}>{parts.length?<div className="stack">{parts.map((p,i)=><RenditionRow key={str(p.renditionPartId)||i} part={p}/>)}</div>:<Empty>個別歌唱・録音の紐付けは未登録です。未歌唱であることは意味しません。</Empty>}{num(renditions?.total)>parts.length&&<p className="muted tiny">先頭{parts.length}件のみ表示しています。続きの閲覧は後続UIで実装します。</p>}</Panel>
 <Panel title={`動画・映像など（${num(media?.total)}件）`}>{medias.length?<div className="stack">{medias.map((m,i)=><MediaRow key={str(m.mediaId)||i} media={m}/>)}</div>:<Empty>この作品に明示的に紐付く媒体は未登録です。</Empty>}{num(media?.total)>medias.length&&<p className="muted tiny">先頭{medias.length}件のみ表示しています。</p>}</Panel>
 <Panel title={`収録作品（直接同定 ${num(releases?.total)}件）`}>{products.length?<div className="stack">{products.map((p,i)=>{const family=asObject(p.family),edition=asObject(p.edition);return <div className="subrecord" key={str(p.releaseItemId)||i}><strong><Link href={`/releases/${encodeURIComponent(str(family.familyId))}`}>{textOr(family.title)}</Link></strong><p className="muted tiny">{textOr(edition.editionName,'edition未登録')} ・ Track {num(p.trackNumber)||'?' }・印字名: {textOr(p.rawTrackTitle)}</p></div>})}</div>:<Empty>明示的に作品へ結び付いた収録itemは未登録です。LIVE商品などの間接的な収録が存在しないとは限りません。</Empty>}{num(releases?.total)>products.length&&<p className="muted tiny">先頭{products.length}件のみ表示しています。</p>}</Panel>
 <Panel title={`関連資料（${num(sources?.total)}件）`}>{related.length?<div className="stack">{related.map((s,i)=><div className="subrecord" key={`${str(s.sourceId)}-${str(s.relationScope)}-${i}`}><strong>{textOr(s.title)}</strong><p className="muted tiny">資料種別: {textOr(s.sourceKind)} ・関連範囲: {textOr(s.relationScope)} ・{textOr(s.publisher,'発行元未登録')}</p><p className="muted tiny">これは関連資料であり、個別事実の確認済み判定ではありません。URLは審査中です。</p></div>)}</div>:<Empty>公開できる関連資料メタデータは未登録です。</Empty>}{num(sources?.total)>related.length&&<p className="muted tiny">先頭{related.length}件のみ表示しています。</p>}</Panel>
 </>;
}
function RenditionRow({part:p}:{part:JsonObject}){
 const singers=exactSingers(p),wide=relatedRenditionParticipants(p),programs=asArray(p.programAssociations);
 return <article className="subrecord"><div className="row-top"><strong>{textOr(p.renditionRawLabel || p.partRawLabel || p.realizationKind,'個別歌唱の記録')}</strong><Chip>{evidenceLabel(p.completeness)}</Chip></div>
 <p className="muted tiny">録音・歌唱日: {recordingDate(p)}　/　種別: {textOr(p.renditionKind,'未登録')}{p.renditionContainsMultipleWorks===true?'　/　複数作品を含むrendition':''}</p>
 {singers.length>0&&<p className="tiny">曲別の歌唱者: {singers.map(x=>textOr(x.name)).join('、')}</p>}
 {wide.length>0&&<p className="tiny muted">rendition全体の参加者（曲別の確証ではありません）: {wide.map(x=>textOr(x.name)).join('、')}</p>}
 {programs.length>0&&<div className="tiny"><strong>公演プログラムとの関連</strong>{programs.map((a,i)=><div key={str(a.linkId)||i} className="association">{validId(str(a.eventId))?<Link href={`/lives/${encodeURIComponent(str(a.eventId))}`}>{textOr(a.eventTitle)}</Link>:textOr(a.eventTitle)} / {displayDate(a.eventOfficialDate)} <span className="muted">（renditionへの関連・曲別歌唱の確証ではありません）</span>{confirmedSongFullFromProgram(a)?' フル歌唱確認':''}</div>)}</div>}
 </article>;
}
function MediaRow({media:m}:{media:JsonObject}){
 const pubs=asArray(m.publications),links=asArray(m.associations);
 return <article className="subrecord"><div className="row-top"><strong>{textOr(m.canonicalTitle,'タイトル未登録')}</strong><Chip>{textOr(m.mediaKind,'媒体種別未登録')}</Chip></div>
 {pubs.map((r,i)=><div className="tiny" key={str(r.resourceId)||i}>公開日: {displayDate(r.publishedOn)} / 公式性: {textOr(r.officiality,'未確認')} / 現在の公開状況: {textOr(r.availability,'未確認')}{safeExternalUrl(r.url)&&<p><a href={safeExternalUrl(r.url)!} target="_blank" rel="noopener noreferrer nofollow">媒体ページを開く ↗</a></p>}</div>)}
 <div className="muted tiny">関連リンク: {links.length}件。完全性: {links.map(a=>evidenceLabel(a.linkCompleteness)).join(' / ')||'未確認'}（各リンクの判定であり、作品全体のfullを保証しません）</div>
 </article>;
}
