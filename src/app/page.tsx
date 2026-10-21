import Link from 'next/link';
import '@/components/home-page.css';

export default function Home() {
 return <div className="home-page">
  <section className="home-cover" aria-labelledby="home-title">
   <div className="home-cover-art" aria-hidden="true"/>
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
 </div>;
}
