import Link from 'next/link';
import {RecordArtwork} from './record-artwork';
import type {CatalogEntryCard} from '@/lib/catalog-entry-api';
import {asArray,asObject,displayDate,explicitThumbnail,num,str,textOr,validId,JsonObject} from '@/lib/core';
import {Breadcrumb,Heading,Panel,Empty} from '@/components/ui';
import {CATALOG_SORTS,DEFAULT_CATALOG_SORT,SINGERS,catalogHref,activeCatalogConditions,ParsedCatalogQuery,type SingerChoice} from '@/lib/catalog-list-params';
import {CatalogSearchInput} from '@/components/catalog-search-input';
import {ListSort} from '@/components/list-sort';
import {detailSearchHref} from '@/lib/search-navigation.mjs';
import {catalogEntryHref} from '@/lib/catalog-navigation';

const CATEGORY:Record<string,string>={original:'オリジナル',cover:'カバー',collaboration:'コラボ',variant:'その他'};
export function CatalogIndex({items,total,query,limit,singerChoices=SINGERS}: {items:CatalogEntryCard[];total:number;query:ParsedCatalogQuery;limit:number;singerChoices?:ReadonlyArray<SingerChoice>}){
 const pages=Math.ceil(total/limit),conditions=activeCatalogConditions(query,singerChoices),returnTo=catalogHref(query);
 return <><Breadcrumb parts={[{label:'楽曲一覧'}]}/><Heading title="楽曲一覧"/>
 <form className="search" action="/songs" method="get">
  <div className="search-line"><CatalogSearchInput query={query.q}/><button type="submit">検索</button><Link className="search-detail-link" href={detailSearchHref(catalogHref(query))}>詳細検索</Link></div>
  {query.singerIds.map(id=><input key={id} type="hidden" name="singer" value={id}/>)}
  {query.singerIds.length>0&&<input type="hidden" name="singerMatch" value={query.singerMatch}/>}
  {query.kinds.map(kind=><input key={kind} type="hidden" name="type" value={kind}/>)}
  {query.sort!==DEFAULT_CATALOG_SORT&&<input type="hidden" name="sort" value={query.sort}/>}
  {query.view==='grid'&&<input type="hidden" name="view" value="grid"/>}
 </form>
 {conditions.length>0&&<div className="catalog-applied" aria-label="適用中の条件"><span className="catalog-applied-heading">適用中</span><div className="catalog-applied-tags">{conditions.map(c=><Link key={c.key} href={c.href} className="catalog-applied-tag" aria-label={`${c.label}を解除`}>{c.label}<span aria-hidden="true">×</span></Link>)}<Link className="catalog-applied-reset" href={catalogHref({...query,q:'',singerIds:[],singerMatch:'any',kinds:[],page:1})}>すべて解除</Link></div></div>}
 <div className="list-toolbar"><p className="toolbar-hint">{total}件</p><div className="catalog-toolbar-controls"><ListSort id="catalog-sort" action="/songs" value={query.sort} options={CATALOG_SORTS.map(s=>({value:s.id,label:s.label,href:catalogHref(query,{sort:s.id,page:1})}))}>
  {query.q&&<input type="hidden" name="q" value={query.q}/>}
  {query.singerIds.map(id=><input key={id} type="hidden" name="singer" value={id}/>)}
  {query.singerIds.length>0&&<input type="hidden" name="singerMatch" value={query.singerMatch}/>}
  {query.kinds.map(kind=><input key={kind} type="hidden" name="type" value={kind}/>)}
  <input type="hidden" name="view" value={query.view}/>
 </ListSort><nav className="view-switch" aria-label="一覧の表示形式"><span>VIEW</span><Link href={catalogHref(query,{view:'list'})} aria-current={query.view==='list'?'page':undefined}>リスト</Link><Link href={catalogHref(query,{view:'grid'})} aria-current={query.view==='grid'?'page':undefined}>グリッド</Link></nav></div></div>
 {items.length?<div className={`records records-${query.view}`}>{items.map(x=><Link className="record" href={catalogEntryHref(x.entryId,returnTo)} key={x.entryId}>
 <RecordArtwork url={explicitThumbnail({...x})} urls={x.thumbnailUrls}/>
 <span className="record-copy"><span className="record-title">{x.title}</span>{x.displayCredit&&<span className="record-meta">{x.displayCredit}</span>}{query.sort.startsWith('first_')&&<span className="record-meta">初出：{x.firstAppearanceDate?displayDate(x.firstAppearanceDate):'準備中'}</span>}{x.kind==='medley'&&<span className="catalog-meta-kind">メドレー</span>}</span>
 <span className="record-arrow" aria-hidden="true">↗</span></Link>)}</div>:<Empty>条件に該当する楽曲はありません。</Empty>}
 {pages>1&&<nav className="pages" aria-label="ページ送り">{query.page>1&&<Link href={catalogHref(query,{page:query.page-1})}>← 前のページ</Link>}<span>{query.page} / {pages} ページ</span>{query.page<pages&&<Link href={catalogHref(query,{page:query.page+1})}>次のページ →</Link>}</nav>}
 </>;
}
function variationText(v:JsonObject):string{
 const value=str(v.value);const semitone=v.semitoneOffset;
 return (str(v.kind)||'種類未登録')+(value?`：${value}`:'')+(typeof semitone==='number'?`（${semitone>0?'+':''}${semitone}半音）`:'');
}
export function CatalogEntryDetail({detail,comparison,history,historyPage=1}:{detail:JsonObject;comparison:JsonObject|null;history:JsonObject|null;historyPage?:number}){
 const title=textOr(detail.title),kind=str(detail.kind);
 const siblings=asArray(detail.relatedVariants),parts=asArray(detail.medleySegments),medleys=asArray(detail.containingMedleys),singers=asArray(detail.singers),variations=asArray(detail.variations),compareEntries=asArray(asObject(comparison).entries);
 const matches=asArray(asObject(history).items);
 const historyTotal=num(asObject(history).total),historyPages=Math.ceil(historyTotal/50);
 const historyHref=(page:number)=>`/songs/${encodeURIComponent(str(detail.entryId))}${page===1?'':`?historyPage=${page}`}#song-history`;
 const direct=matches.filter(p=>str(p.matchBasis)!=='same_version_only'),sameVersion=matches.filter(p=>str(p.matchBasis)==='same_version_only');
 return <><Breadcrumb parts={[{label:'楽曲一覧',href:'/songs'},{label:title}]}/><Heading title={title}/>
 {str(detail.displayCredit)&&<p className="catalog-primary-credit">{str(detail.displayCredit)}</p>}
 {kind==='medley'&&<p className="catalog-muted-small">メドレー</p>}
 {(detail.legacySongType || singers.length>0 || variations.length>0)&&<Panel title="基本情報"><dl className="catalog-fact-list">
  {str(detail.legacySongType) !== '' && <><dt>楽曲区分</dt><dd>{CATEGORY[str(detail.legacySongType)]||str(detail.legacySongType)}</dd></>}
  {singers.length>0&&<><dt>歌唱者候補</dt><dd>{singers.map(s=>textOr(s.name)).join('・')}</dd></>}
  {str(detail.editorialOriginLabel)&&<><dt>識別用表記</dt><dd>{str(detail.editorialOriginLabel)}<small className="catalog-origin-caveat">旧目録由来の識別名です。公式バージョン名や公演との個別対応を確定したものではありません。</small></dd></>}
  {variations.length>0&&<><dt>バリエーション</dt><dd>{variations.map(variationText).join(' / ')}</dd></>}
  </dl></Panel>}
 {siblings.length>0&&<Panel title="同じ曲の別バージョン・歌唱"><div className="catalog-related">{siblings.map(s=><Link href={`/songs/${encodeURIComponent(str(s.entryId))}`} key={str(s.entryId)}><span><strong>{textOr(s.title)}</strong>{str(s.displayCredit) !== '' && <small>{str(s.displayCredit)}</small>}</span><span aria-hidden="true">↗</span></Link>)}</div>
 {compareEntries.length>1&&<details className="catalog-comparison"><summary>比較表を見る <span aria-hidden="true">⌄</span></summary><div className="catalog-compare-scroll"><table><thead><tr><th scope="col">項目</th>{compareEntries.map(s=><th scope="col" key={str(s.entryId)}>{str(s.entryId)===str(detail.entryId)?title:<Link href={`/songs/${encodeURIComponent(str(s.entryId))}`}>{textOr(s.title)}</Link>}</th>)}</tr></thead><tbody><tr><th scope="row">歌唱名義</th>{compareEntries.map(s=><td key={str(s.entryId)}>{textOr(s.displayCredit,'未登録')}</td>)}</tr><tr><th scope="row">歌唱者候補</th>{compareEntries.map(s=><td key={str(s.entryId)}>{Array.isArray(s.singers)&&s.singers.length?s.singers.filter((v):v is string=>typeof v==='string').join('・'):'—'}</td>)}</tr><tr><th scope="row">確認されている違い</th>{compareEntries.map(s=><td key={str(s.entryId)}>{asArray(s.variations).length?asArray(s.variations).map(variationText).join(' / '):'—'}</td>)}</tr></tbody></table></div></details>}</Panel>}
 {parts.length>0&&<Panel title="メドレーの構成"><ol className="catalog-segments">{parts.map((p,i)=><li key={`${str(p.workId)}-${i}`}><Link href={`/songs/${encodeURIComponent(str(p.workId))}`}>{textOr(p.rawLabel||p.workTitle)}</Link></li>)}</ol><p className="muted tiny">構成曲の作品ページへ移動します。個別歌唱者は推測しません。</p></Panel>}
 {medleys.length>0&&<Panel title="この曲を含むメドレー"><div className="catalog-related">{medleys.map(m=><Link href={`/songs/${encodeURIComponent(str(m.entryId))}`} key={str(m.entryId)}><strong>{textOr(m.title)}</strong><span aria-hidden="true">↗</span></Link>)}</div></Panel>}
 {history&&<Panel id="song-history" title={`歌唱・録音との関連（${num(history.renditionCount)}記録／${num(history.total)}部分）`}>
 <p className="muted tiny">同じ版の記録には、歌唱者が未照合のものも含まれます。</p>
 {direct.length>0&&<><h3 className="catalog-history-subheading">旧記録・構成曲から直接対応する記録</h3><div className="stack">{direct.map(p=><HistoryAssociationRow key={str(p.renditionPartId)} record={p}/>)}</div></>}
 {sameVersion.length>0&&<><h3 className="catalog-history-subheading">同じバージョンの披露候補</h3><div className="stack">{sameVersion.map(p=><HistoryAssociationRow key={str(p.renditionPartId)} record={p}/>)}</div></>}
 {matches.length===0&&<Empty>この目録項目に直接対応する歌唱記録はまだ見つかっていません。作品全体には別の歌唱記録が存在する可能性があります。</Empty>}
 {historyPages>0&&historyPage>historyPages&&<p className="muted tiny">指定された履歴ページは範囲外です。<Link href={historyHref(1)}>最初の履歴へ戻る</Link></p>}
 {historyPages>1&&historyPage<=historyPages&&<nav className="pages" aria-label="歌唱履歴のページ送り">{historyPage>1&&<Link href={historyHref(historyPage-1)}>← 前の履歴</Link>}<span>{historyPage} / {historyPages} ページ</span>{historyPage<historyPages&&<Link href={historyHref(historyPage+1)}>次の履歴 →</Link>}</nav>}
 {kind==='song_variant'&&num(history.workPartCount)>num(history.total)&&<p className="muted tiny">この作品には、ここに表示されない別の歌唱記録もあります。下の作品全体の記録から確認できます。</p>}
 </Panel>}
 </>;
}

/** A provenance link is not proof of any per-song singer set. */
function HistoryAssociationRow({record:r}:{record:JsonObject}){
 const events=asArray(r.relatedEvents);
 const mapped=str(r.matchBasis)!=='same_version_only';
 const type:Record<string,string>={
  studio_recording:'スタジオ録音',live_performance:'LIVE',social_performance:'SNS等',
  broadcast_performance:'番組',game_performance:'ゲーム',exhibition_performance:'展示',
  other:'その他',unknown:'種別未登録'
 };
 return <div className="subrecord catalog-history-row">
  <strong>{textOr(r.partLabel||r.renditionLabel,'歌唱・録音記録')}</strong>
  <p className="muted tiny">{type[str(r.renditionKind)]||textOr(r.renditionKind,'種別未登録')}
   {str(r.occurredOn)?` ／ ${displayDate(r.occurredOn)}`:''}
   {r.multiWork===true?' ／ 複数曲を含む演目':''}</p>
  <p className="muted tiny">{mapped?'旧データ・個別記録との対応':'同一versionへの紐付け'}
   {num(r.partVocalRows)>0?' ／ 曲別の参加記録あり（全員の確定は別）':''}</p>
  {events.length>0&&<p className="tiny">関連公演（renditionとの紐付け）：{events.map((ev,i)=><span key={`${str(ev.eventId)}-${i}`}>{i>0?'、':''}{validId(str(ev.eventId))?<Link href={`/lives/${encodeURIComponent(str(ev.eventId))}`}>{textOr(ev.title)}</Link>:textOr(ev.title)}</span>)}</p>}
 </div>;
}
