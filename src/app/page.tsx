import Link from 'next/link';

/* Home presentation follows the original site's Sunflower cover and archivist tone.
 * Source image: old repo public/home-themes/sunflower/hero.webp.
 * No fictitious RECENT / STATUS values are generated: those sections need a dedicated read model. */
export default function Home() {
  return <div className="home-page">
    <section className="home-cover">
      <div className="home-cover-art" aria-hidden="true" />
      <div className="home-cover-haze" aria-hidden="true" />
      <div className="shell home-cover-inner">
        <p className="home-kicker">非公式データベース</p>
        <h1>ヰ世界情緒<br />歌唱録</h1>
        <div className="home-gold-line" aria-hidden="true" />
        <p className="home-intro">ヰ世界情緒さんの歌唱楽曲・関連リンク・ライブセットリストなどを整理する、ファンによる非公式データベースです。</p>
        <p className="home-disclaimer">KAMITSUBAKI STUDIO、ヰ世界情緒さん本人、および関係各社とは関係ありません。</p>
        <div className="home-buttons">
          <Link className="primary-link" href="/songs">楽曲一覧を見る <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </section>
    <div className="home-content"><div className="shell">
      <section aria-labelledby="archive-nav-title">
        <p className="home-section-label">EXPLORE THE ARCHIVE</p>
        <h2 className="home-section-title" id="archive-nav-title">記録を辿る</h2>
        <div className="home-entries">
          <Link className="home-entry" href="/lives"><span>01 / LIVE</span><h2>ライブ・セットリスト</h2><p>公演、曲順、出演情報を区別して辿る。</p></Link>
          <Link className="home-entry" href="/releases"><span>02 / RELEASES</span><h2>リリース</h2><p>CD・Blu-ray・配信作品とその収録内容を調べる。</p></Link>
          <Link className="home-entry" href="/about"><span>03 / INFORMATION</span><h2>このサイトについて</h2><p>歌唱録の方針、資料の扱い、非公式であること。</p></Link>
          <Link className="home-entry" href="/contribute"><span>04 / SUBMIT INFO</span><h2>情報提供・訂正</h2><p>誤記や未掲載の情報を、出典とともにお知らせください。</p></Link>
        </div>
      </section>
      <section className="home-note"><h2>NOTICE</h2><div><p>歌唱録は非公式ファンデータベースです。作品は未確認の項目があっても掲載し、歌唱者・初フル・録音日等を根拠なく確定させません。</p><p>旧サイトのRECENT・STATUSは準備中です。情報提供・訂正は、専用ページに記載した方法でお知らせください。</p></div></section>
    </div></div>
  </div>;
}
