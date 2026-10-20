import Link from 'next/link';
import {Panel,Empty} from '@/components/ui';
import {asArray,asObject,displayDate,mediaGroups,num,safeExternalUrl,str,textOr,validId,JsonObject} from '@/lib/core';

const ROLES:Record<string,string> = {lyricist:'作詞',composer:'作曲',arranger:'編曲'};
const SCOPES:Record<string,string> = {work:'作品の制作情報',version:'該当バージョンの制作情報',original:'原曲の制作情報'};

/** CatalogEntry identity and work-wide links are deliberately separate.
 * A work-wide video, product or credit DOES NOT establish that a specific singer
 * configuration was recorded/released in it. No title-based media matching.
 */
export function CatalogWorkContext({credits,media,releases,primaryWorkId}:{
 credits:JsonObject|null;media:JsonObject|null;releases:JsonObject|null;primaryWorkId:string;
}){
 const rawCredits=asArray(asObject(credits).credits);
 const groupedCredits=['work','version','original'].map(scope=>({scope,items:rawCredits.filter(c=>str(c.scope)===scope)})).filter(group=>group.items.length>0);
 const videos=mediaGroups(asObject(media).items);
 const products=asArray(asObject(releases).items);
 return <>
  <Panel title="作詞・作曲・編曲">
   {groupedCredits.length?groupedCredits.map(group=><div className="catalog-context-group" key={group.scope}>
    <h3 className="catalog-context-subheading">{SCOPES[group.scope]}</h3>
    <dl className="catalog-fact-list">{group.items.map((c,i)=><div className="catalog-credit-pair" key={`${str(c.role)}-${str(c.name)}-${i}`}>
     <dt>{ROLES[str(c.role)]||textOr(c.role)}</dt><dd>{textOr(c.name)}</dd>
    </div>)}</dl>
   </div>):<Empty>登録された制作クレジットはまだありません。</Empty>}
   {rawCredits.some(c=>str(c.basis)==='legacy')&&<p className="muted tiny">旧目録から引き継いだ参考情報を含みます。</p>}
  </Panel>
  <Panel title={`関連する動画・映像（作品単位・${num(asObject(media).total)}件）`}>
   {videos.length?<div className="stack">{videos.map((m,i)=><div className="subrecord" key={str(m.mediaId)||i}>
    <strong>{textOr(m.canonicalTitle,'名称未登録')}</strong>
    <p className="muted tiny">{textOr(m.mediaKind,'媒体種別未登録')}</p>
    {asArray(m.publications).map((pub,j)=>{
      const url=safeExternalUrl(pub.url);
      return <div className="tiny catalog-media-pub" key={str(pub.resourceId)||j}>
       {str(pub.publishedOn)&&<span>公開日：{displayDate(pub.publishedOn)}　</span>}
       {url&&<a href={url} target="_blank" rel="noopener noreferrer nofollow">公開ページを開く ↗</a>}
      </div>;
    })}
   </div>)}</div>:<Empty>作品への明示的な媒体リンクはまだありません。</Empty>}
   {num(asObject(media).total)>videos.length&&<p className="muted tiny">先頭{videos.length}件を表示中。残りは作品全体のページで確認できます。</p>}
   <p className="muted tiny">作品全体への関連です。このバージョン・歌唱者による収録とは限りません。</p>
  </Panel>
  <Panel title={`収録作品（作品への直接リンク・${num(asObject(releases).total)}件）`}>
   {products.length?<div className="stack">{products.map((p,i)=>{
      const family=asObject(p.family),edition=asObject(p.edition);
      const id=str(family.familyId), name=textOr(family.title);
      return <div className="subrecord" key={str(p.releaseItemId)||i}>
       <strong>{validId(id)?<Link href={`/releases/${encodeURIComponent(id)}`}>{name} ↗</Link>:name}</strong>
       <p className="muted tiny">{str(edition.editionName)}{num(p.trackNumber)>0?` ／ Track ${num(p.trackNumber)}`:''}{str(p.rawTrackTitle)?` ／ ${str(p.rawTrackTitle)}`:''}</p>
      </div>;
   })}</div>:<Empty>作品への直接的な商品収録リンクはまだありません。</Empty>}
   {num(asObject(releases).total)>products.length&&<p className="muted tiny">先頭{products.length}件を表示中。残りは作品全体のページで確認できます。</p>}
   <p className="muted tiny">作品単位の収録情報です。個別の歌唱形態との一致は保証しません。</p>
  </Panel>
  {validId(primaryWorkId)&&<p className="catalog-context-back"><Link href={`/songs/${encodeURIComponent(primaryWorkId)}`}>作品全体の履歴・資料を見る ↗</Link></p>}
 </>;
}
