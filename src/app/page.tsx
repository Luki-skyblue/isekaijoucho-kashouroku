import Link from 'next/link';
import {homePageData} from '@/lib/home-page-data';
import {displayDate} from '@/lib/core';
import {RecordArtwork} from '@/components/record-artwork';
import '@/components/home-page.css';

export const dynamic='force-dynamic';

export default async function Home() {
 const recent=await homePageData();
 return <div className="home-page">
  <section className="home-cover" aria-labelledby="home-title">
   {['sunflower','nemophila','anemone'].map(theme=><img key={theme} className="home-cover-art" data-home-theme={theme} src={'/home-themes/'+theme+'/hero.webp'} width={1672} height={941} alt="" aria-hidden="true" loading={theme==='sunflower'?'eager':'lazy'} fetchPriority={theme==='sunflower'?'high':'auto'}/>)}
   <div className="home-cover-haze" aria-hidden="true"/>
   <div className="shell home-cover-inner">
    <p className="home-kicker">非公式ファンサイト</p>
    <h1 id="home-title">ヰ世界情緒<br/>歌唱録</h1>
    <nav className="home-nav" aria-label="掲載情報を探す">
     <Link href="/songs">楽曲一覧 <span aria-hidden="true">→</span></Link>
     <Link href="/lives">LIVE一覧 <span aria-hidden="true">→</span></Link>
     <Link href="/releases">収録作品 <span aria-hidden="true">→</span></Link>
    </nav>
   </div>
  </section>
  <div className="shell home-recent">
   <section className="home-recent-section" aria-labelledby="home-songs-title">
    <div className="home-recent-heading"><h2 id="home-songs-title">最近の楽曲</h2><Link href="/songs">楽曲一覧 <span aria-hidden="true">→</span></Link></div>
    {recent.songs.length?<div className="home-recent-list">{recent.songs.map(song=><Link className="home-recent-item home-recent-song" href={'/songs/'+song.entryId} key={song.entryId}>
     <RecordArtwork url={song.thumbnailUrl} urls={song.thumbnailUrls}/>
     <span className="home-recent-copy"><strong className="home-recent-title">{song.title}</strong><span className="home-recent-credit">{song.displayCredit||'名義未確認'}</span><span className="home-recent-meta"><time dateTime={song.date} aria-label={'初出 '+displayDate(song.date)}>{displayDate(song.date)}</time>{song.sourceLabel&&<span>{song.sourceLabel}</span>}</span></span>
    </Link>)}</div>:<p className="home-recent-empty">準備中</p>}
   </section>
   <section className="home-recent-section" aria-labelledby="home-releases-title">
    <div className="home-recent-heading"><h2 id="home-releases-title">最近のリリース</h2><Link href="/releases">収録作品 <span aria-hidden="true">→</span></Link></div>
    {recent.releases.length?<div className="home-recent-list">{recent.releases.map(release=><Link className="home-recent-item home-recent-release" href={'/releases/'+release.familyId} key={release.familyId}>
     <RecordArtwork url={release.thumbnailUrl} urls={release.thumbnailUrls}/>
     <span className="home-recent-copy"><strong className="home-recent-title">{release.title}</strong><span className="home-recent-credit">{release.displayCredit||'名義未確認'}</span><span className="home-recent-meta"><time dateTime={release.date} aria-label={'発売日 '+displayDate(release.date)}>{displayDate(release.date)}</time>{release.kindLabel&&<span>{release.kindLabel}</span>}{release.upcoming&&<span>発売予定</span>}</span></span>
    </Link>)}</div>:<p className="home-recent-empty">準備中</p>}
   </section>
  </div>
 </div>;
}
