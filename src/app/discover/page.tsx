import Link from 'next/link';
import type {Metadata} from 'next';
import {getDiscovery} from '@/lib/discovery-api';
import {pageNumber} from '@/lib/core';
import {Breadcrumb,Heading} from '@/components/ui';
import {RecordArtwork} from '@/components/record-artwork';
import {DiscoveryTabs} from '@/components/discovery-tabs';
import './discovery.css';

export const metadata:Metadata={title:'公開・収録先から探す'};
export default async function Discover({searchParams}:{searchParams:Promise<{category?:string;page?:string}>}){
 const query=await searchParams,data=await getDiscovery({category:query.category,page:pageNumber(query.page)});
 const href=(category:string,page=1)=>'/discover?'+new URLSearchParams({category,...(page>1?{page:String(page)}:{})});
 return <article className="discovery-page">
  <Breadcrumb parts={[{label:'公開・収録先'}]}/><Heading title="公開・収録先から探す"/>
  <p className="discovery-note">登録された公開・収録先で分類しています。現在の視聴可否は未確認の情報を含みます。</p>
  {data?<>
   <DiscoveryTabs categories={data.categories} selected={data.category}/>
   <div className="list-toolbar"><p className="toolbar-hint">{data.total}件</p></div>
   {data.items.length?<div className="records records-list">{data.items.map(song=><Link className="record" key={song.entryId} href={'/songs/'+song.entryId}>
    <RecordArtwork url={song.thumbnailUrl} urls={song.thumbnailUrls}/><span className="record-copy"><span className="record-title">{song.title}</span><span className="record-meta">{[song.displayCredit,song.sourceLabel].filter(Boolean).join(' · ')}</span></span><span className="record-arrow" aria-hidden="true">↗</span>
   </Link>)}</div>:<p className="empty">この分類に該当する楽曲はありません。</p>}
   {data.pages>1&&<nav className="pages" aria-label="楽曲のページ送り">{data.page>1&&<Link href={href(data.category,data.page-1)}>← 前のページ</Link>}<span>{data.page} / {data.pages} ページ</span>{data.page<data.pages&&<Link href={href(data.category,data.page+1)}>次のページ →</Link>}</nav>}
  </>:<p className="empty">準備中</p>}
 </article>;
}
