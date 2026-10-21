import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getPersonDetail} from '@/lib/person-api';
import {pageNumber} from '@/lib/core';
import {RecordArtwork} from '@/components/record-artwork';
import {Breadcrumb} from '@/components/ui';
import './person-detail.css';

export async function generateMetadata({params}:{params:Promise<{personKey:string}>}){
 const person=await getPersonDetail((await params).personKey);
 return {title:person?.name??'人物'};
}
export default async function PersonDetail({params,searchParams}:{params:Promise<{personKey:string}>;searchParams:Promise<{page?:string}>}){
 const person=await getPersonDetail((await params).personKey,pageNumber((await searchParams).page));
 if(!person)notFound();
 const href=(page:number)=>`/people/${person.key}${page>1?'?page='+page:''}`;
 return <article className="person-detail-page">
  <Breadcrumb parts={[{label:'楽曲一覧',href:'/songs'},{label:person.name}]}/>
  <header className="person-detail-heading"><h1>{person.name}</h1><p>{person.roles.join('・')}</p></header>
  <section aria-labelledby="person-songs-title"><h2 id="person-songs-title">関連楽曲 <span className="person-detail-count">{person.total}</span></h2>
   <div className="records records-list">{person.items.map(song=><Link className="record" key={song.entryId} href={'/songs/'+song.entryId}>
    <RecordArtwork url={song.thumbnailUrl} urls={song.thumbnailUrls}/>
    <span className="record-copy"><span className="record-title">{song.title}</span><span className="record-meta">{song.displayCredit}</span><span className="person-detail-song-roles">{song.roles.join('・')}</span></span>
    <span className="record-arrow" aria-hidden="true">↗</span>
   </Link>)}</div>
  </section>
  {person.pages>1&&<nav className="pages" aria-label="関連楽曲のページ送り">{person.page>1&&<Link href={href(person.page-1)}>← 前のページ</Link>}<span>{person.page} / {person.pages} ページ</span>{person.page<person.pages&&<Link href={href(person.page+1)}>次のページ →</Link>}</nav>}
 </article>;
}
