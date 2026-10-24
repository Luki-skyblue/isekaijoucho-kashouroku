import Link from 'next/link';
import {asArray,asObject,displayDate,str,validId,type JsonObject} from '@/lib/core';
import {missingSongText,safeSongUrl,songListenLabel,youtubeId,type SongDetailData} from '@/lib/song-detail-data.mjs';
import {SongDetailTabs} from './song-detail-tabs';
import {SongDetailArtwork} from './song-detail-artwork';
import {CreditName,SingerNames} from './person-name';
import {creditRoleLabel,songCreditRole} from '@/lib/catalog-credit-labels.mjs';
import './song-detail.css';

const CATEGORIES:Record<string,string>={original:'オリジナル',cover:'カバー',collaboration:'コラボ',variant:'その他'};
function Value({value,review}:{value:unknown;review?:unknown}){return typeof value==='string'&&value.trim()?<>{value}</>:<span className="song-detail-state">{missingSongText(review)}</span>;}
function Empty({review}:{review?:unknown}){return <p className="song-detail-empty song-detail-state">{missingSongText(review)}</p>;}
function First({value,review}:{value:unknown;review:unknown}){const first=asObject(value),text=[str(first.date)?displayDate(first.date,str(first.date)):'',str(first.label)].filter(Boolean).join(' · ');return <Value value={text} review={review}/>;}
function singerNames(value:unknown){return Array.isArray(value)?value.map(s=>typeof s==='string'?s:str(asObject(s).name)).filter(Boolean).join('・'):'';}
function variation(value:JsonObject){return str(value.value)||(typeof value.semitoneOffset==='number'?`${value.semitoneOffset>0?'+':''}${value.semitoneOffset}半音`:'');}

export function CatalogSongDetail({song,initialTab='info'}:{song:SongDetailData;initialTab?:string}){
 const {detail:d,metadata:m}=song,review=asObject(m.fieldReview),title=str(d.title),entryId=str(d.entryId),siblings=asArray(d.relatedVariants),compare=asArray(song.comparison?.entries);
 const singers=str(d.displayCredit)||singerNames(d.singers),segments=asArray(d.medleySegments),medleys=asArray(d.containingMedleys),variations=asArray(d.variations).map(variation).filter(Boolean);
 const firstReview=asObject(m.firstAppearanceReview),fullVisible=firstReview.coverage==='partial'&&firstReview.partialConfirmed===true;
 const originalAuthors=song.originalCredits.filter(c=>['lyricist','composer'].includes(c.role)&&!song.credits.some(row=>songCreditRole(d,row)==='original_'+c.role&&row.names.includes(c.name)));
 const originalInfo=d.legacySongType==='cover'&&(str(m.originalArtist)||str(m.originalVocal)||song.originalArranger||originalAuthors.length>0);
 const hero=song.artwork;
 const imageUrl=hero?.imageUrl??null,heroShape=hero&&(['mv','cover','live_mv','other_video'].includes(hero.kind)||(hero.kind==='manual'&&youtubeId(hero.sourceUrl)))?'video':'jacket';
 const info=<>
  <dl className="song-detail-facts">{str(m.artistCredit)&&<><dt>アーティスト</dt><dd>{str(m.artistCredit)}</dd></>}<dt>歌唱</dt><dd>{singers?<SingerNames detail={d}/>:<Value value={singers}/>}</dd><dt>楽曲区分</dt><dd><Value value={d.kind==='medley'?'メドレー':CATEGORIES[str(d.legacySongType)]}/></dd>
   <dt>初出</dt><dd><First value={m.firstAppearance} review={review.firstAppearance}/></dd>
   {fullVisible&&<><dt>初出（フル）</dt><dd><First value={m.firstFull} review={review.firstFull}/></dd></>}
   <dt>タイアップ</dt><dd><Value value={m.tieUp} review={review.tieUp}/></dd>
   {str(d.editorialOriginLabel)&&<><dt>バージョン名</dt><dd>{str(d.editorialOriginLabel)}</dd></>}
   {variations.length>0&&<><dt>バリエーション</dt><dd>{variations.join(' / ')}</dd></>}
  </dl>
  <div className="song-detail-credits"><dl className="song-detail-facts">{song.credits.map(c=><div className="song-detail-fact-pair" key={c.role}><dt>{creditRoleLabel(songCreditRole(d,c))}</dt><dd>{c.people.length?c.people.map((person,i)=><span key={person.name}>{i>0?'・':''}<CreditName name={person.name} personKey={person.personKey} parts={person.parts}/></span>):<Value value={c.value} review={c.review}/>}</dd></div>)}</dl></div>
  {originalInfo&&<div className="song-detail-original"><h2>原曲</h2><dl className="song-detail-facts">
   {str(m.originalArtist)&&<><dt>アーティスト</dt><dd>{str(m.originalArtist)}</dd></>}{str(m.originalVocal)&&<><dt>歌唱</dt><dd>{str(m.originalVocal)}</dd></>}{originalAuthors.map(c=><div className="song-detail-fact-pair" key={c.role+'|'+c.name}><dt>{creditRoleLabel(c.role)}</dt><dd><CreditName name={c.name} personKey={c.personKey} parts={c.parts}/></dd></div>)}{song.originalArranger&&<><dt>編曲</dt><dd><CreditName name={song.originalArranger} parts={song.originalArrangerCredit?.parts}/></dd></>}
  </dl></div>}
  {safeSongUrl(m.lyricsUrl)&&<dl className="song-detail-facts song-detail-lyrics"><dt>歌詞</dt><dd><a href={safeSongUrl(m.lyricsUrl)!} target="_blank" rel="noopener noreferrer">{new URL(str(m.lyricsUrl)).hostname==='piapro.jp'?'piaproで読む':'歌詞を見る'} ↗</a></dd></dl>}
  {segments.length>0&&<div className="song-detail-supplement"><h2>構成曲</h2><ol>{segments.map((segment,i)=><li key={str(segment.workId)+'-'+i}>{validId(str(segment.workId))?<Link href={'/songs/'+str(segment.workId)}>{str(segment.rawLabel||segment.workTitle)}</Link>:str(segment.rawLabel||segment.workTitle)}</li>)}</ol></div>}
  {medleys.length>0&&<div className="song-detail-supplement"><h2>この曲を含むメドレー</h2>{medleys.map(medley=><Link className="song-detail-version" key={str(medley.entryId)} href={'/songs/'+str(medley.entryId)}>{str(medley.title)}<span aria-hidden="true">↗</span></Link>)}</div>}
 </>;
 const videos=song.videos.length?<div className="song-detail-video-list">{song.videos.map(video=><article className="song-detail-video" key={video.mediaId+'|'+video.url}>
  <a className="song-detail-video-thumbnail" href={video.url} target="_blank" rel="noopener noreferrer" aria-label={(video.title||'動画')+'を開く'}><SongDetailArtwork url={video.imageUrl} className="song-detail-video-image"/><span className="song-detail-play" aria-hidden="true">▶</span></a>
  <div className="song-detail-video-copy"><a href={video.url} className="song-detail-video-title" target="_blank" rel="noopener noreferrer"><strong className={video.title?undefined:'song-detail-state'}>{video.title||'タイトル未取得'}</strong></a>
   <div className="song-detail-video-meta">{songListenLabel(video.url)==='Xで見る'&&<span>X</span>}<span className={video.kind&&video.kind!=='unknown'?undefined:'song-detail-state'}>{({music_video:'MV',cover_video:'歌ってみた',cover_duet_video:'歌ってみた',live_video:'LIVE映像',opening_video:'OP映像'} as Record<string,string>)[video.kind??'']||'種別未取得'}</span>{video.publishedOn?<time dateTime={video.publishedOn}>投稿日 {displayDate(video.publishedOn,video.publishedOn)}</time>:<span className="song-detail-state">投稿日未取得</span>}</div>
   {video.credits.length>0&&<details className="song-detail-video-credits"><summary>クレジット</summary><dl className="song-detail-facts">{video.credits.map((c,i)=><div className="song-detail-fact-pair" key={c.role+'|'+c.name+'|'+i}><dt>{creditRoleLabel(c.role)}</dt><dd><CreditName name={c.name} personKey={c.entityId} parts={c.parts}/></dd></div>)}</dl></details>}
  </div>
 </article>)}</div>:<Empty review={review.media}/>;
 const history=<>{song.hasUncertainLives&&<p className="song-detail-note">歌唱者の組合せが未確認の公演を含みます。</p>}{song.lives.length?<div>{song.lives.map(live=><Link className="song-detail-live" key={live.eventId+'|'+live.date} href={'/lives/'+live.eventId}><SongDetailArtwork url={live.imageUrl} className="song-detail-live-art"/><span className="song-detail-live-copy">{live.date&&<time dateTime={live.date}>{displayDate(live.date,live.date)}</time>}<strong>{live.title}</strong></span><span className="song-detail-arrow" aria-hidden="true">↗</span></Link>)}</div>:<Empty review={review.history}/>}</>;
 const releases=song.releases.length?<div>{song.releases.map(release=>{const family=asObject(release.family),edition=asObject(release.edition),external=safeSongUrl(release.externalUrl);return <Link className="song-detail-release" key={str(release.releaseItemId)} href={external??'/releases/'+str(family.familyId)} target={external?'_blank':undefined} rel={external?'noopener noreferrer':undefined}><SongDetailArtwork url={str(release.imageUrl)||null} className="song-detail-release-art"/><span className="song-detail-release-copy"><strong>{str(family.title)}</strong><span className="song-detail-release-meta">{[({single:'シングル',album:'アルバム',compilation:'コンピレーション'} as Record<string,string>)[str(family.releaseKind)],str(edition.releaseDate)?displayDate(edition.releaseDate):null].filter(Boolean).join(' · ')}</span><span className="song-detail-release-track">{[str(release.editionLabel),typeof release.trackNumber==='number'?`${release.trackNumber}曲目`:null].filter(Boolean).join(' · ')}</span></span><span className="song-detail-arrow" aria-hidden="true">↗</span></Link>;})}</div>:<Empty review={review.releases}/>;
 const differences=compare.some(v=>asArray(v.variations).some(x=>variation(x)));
 const versions=<>{siblings.length?siblings.map(sibling=><Link className="song-detail-version" key={str(sibling.entryId)} href={'/songs/'+str(sibling.entryId)}><span><strong>{str(sibling.title)}</strong><small><Value value={sibling.displayCredit}/></small></span><span className="song-detail-arrow" aria-hidden="true">↗</span></Link>):<Empty review={review.versions}/>}
  {compare.length>1&&<details className="song-detail-comparison"><summary>比較表を見る</summary><div className="song-detail-comparison-scroll" tabIndex={0} aria-label="別バージョンの比較"><table><caption className="song-detail-sr-only">別バージョンの比較</caption><thead><tr><th scope="col">楽曲</th><th scope="col">歌唱</th>{differences&&<th scope="col">違い</th>}</tr></thead><tbody>{compare.map(v=><tr key={str(v.entryId)} data-current={str(v.entryId)===entryId}><th scope="row">{str(v.entryId)===entryId?str(v.title):<Link href={'/songs/'+str(v.entryId)}>{str(v.title)}</Link>}</th><td><Value value={v.displayCredit||singerNames(v.singers)}/></td>{differences&&<td>{asArray(v.variations).map(variation).filter(Boolean).join(' / ')||'—'}</td>}</tr>)}</tbody></table></div></details>}
 </>;
 return <article className="song-detail-page" data-song-entry={entryId}>
  <Link className="song-detail-back" href="/songs">← 楽曲一覧</Link>
  <header className="song-detail-hero"><SongDetailArtwork url={imageUrl} urls={song.artworkCandidates.map(image=>image.imageUrl)} eager className={'song-detail-art song-detail-art-'+heroShape}/><div className="song-detail-heading">{str(m.titleKana)&&<p className="song-detail-kana">{str(m.titleKana)}</p>}<div className="song-detail-title-line"><h1>{title}</h1>{song.versionLabel&&<span className="song-detail-version-tag">{song.versionLabel}</span>}</div><p className="song-detail-singer">{singers?<SingerNames detail={d}/>:<Value value={singers}/>}</p>{song.listenUrl&&<a className="song-detail-primary" href={song.listenUrl} target="_blank" rel="noopener noreferrer">{song.videos.some(v=>v.url===song.listenUrl)?songListenLabel(song.listenUrl):'配信で聴く'} ↗</a>}</div></header>
  <SongDetailTabs key={entryId+'|'+initialTab} initialTab={initialTab} tabs={[{id:'info',label:'楽曲情報',count:null,content:info},{id:'videos',label:'関連動画',count:song.videos.length,content:videos},{id:'history',label:'披露歴',count:song.lives.length,content:history},{id:'releases',label:'収録作品',count:song.releases.length,content:releases},{id:'versions',label:'別バージョン',count:siblings.length,content:versions}]}/>
 </article>;
}
