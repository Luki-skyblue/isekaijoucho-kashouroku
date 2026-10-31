import {PAGE_LABELS} from '@/lib/ui-copy.mjs';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist_Mono, Noto_Sans_JP, Noto_Serif_JP } from 'next/font/google';
import SiteControls from '@/components/site-controls';
import {privateSnapshotEnabled,privateSnapshotInfo} from '@/lib/private-snapshot';
import {publicCatalogEnabled,publicCatalogInfo} from '@/lib/public-catalog';
import './globals.css';

const notoSans = Noto_Sans_JP({ variable: '--font-noto-sans-jp', subsets: ['latin'], weight: ['400', '500', '600', '700'] });
const notoSerif = Noto_Serif_JP({ variable: '--font-noto-serif-jp', subsets: ['latin'], weight: ['400', '500', '600', '700'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'ヰ世界情緒 歌唱録', template: '%s | ヰ世界情緒 歌唱録' },
  description: 'ヰ世界情緒の楽曲、歌唱履歴、LIVE、動画、収録作品を辿る非公式データベース。',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const review=privateSnapshotEnabled()?await privateSnapshotInfo():null;
  const release=!review&&publicCatalogEnabled()?publicCatalogInfo():null;
  return <html lang="ja"><body data-release-id={release?.releaseId} className={`${notoSans.variable} ${notoSerif.variable} ${geistMono.variable}`}>
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand"><small>UNOFFICIAL DATABASE</small><span className="brand-name">ヰ世界情緒 歌唱録</span></Link>
        <SiteControls />
      </div>
    </header>
    <main className="shell main">{review&&<p className="catalog-review-warning" data-export-id={review.exportId}>開発用・実DBスナップショット：未公開候補を含む私有レビューです。一般公開していません。</p>}{children}</main>
    <footer className="site-footer"><div className="shell footer-grid">
      <p>非公式ファンサイト</p>
      <nav className="footer-links" aria-label="サイトの案内"><Link href="/about">{PAGE_LABELS.about}</Link><Link href="/guide">{PAGE_LABELS.guide}</Link><Link href="/contribute">{PAGE_LABELS.contribute}</Link></nav>
    </div></footer>
  </body></html>;
}
