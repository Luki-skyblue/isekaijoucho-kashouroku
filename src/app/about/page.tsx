import {sitePageMetadata} from '@/lib/page-metadata';
import {PAGE_LABELS} from '@/lib/ui-copy.mjs';
import Link from 'next/link';
import {Breadcrumb,Heading} from '@/components/ui';
import '@/components/info-pages.css';

export function generateMetadata(){return sitePageMetadata('/about',PAGE_LABELS.about,{description:'ヰ世界情緒 歌唱録の掲載内容と連絡先。'});}
export default function About(){
 return <article className="info-page">
  <Breadcrumb parts={[{label:PAGE_LABELS.about}]}/>
  <Heading title={PAGE_LABELS.about}/>
  <div className="info-intro"><p>ヰ世界情緒さんのオリジナル曲・カバー曲・共演曲や、関連するLIVE・収録作品をまとめた非公式ファンサイトです。</p><p>ヰ世界情緒さん本人、KAMITSUBAKI STUDIOおよび関係各社による運営・監修ではありません。</p></div>
  <section className="info-section"><h2>ご利用について</h2><p>サイトの閲覧は無料で、会員登録は不要です。リンク先のサービスには、有料のものや、公開・販売が終了したものもあります。</p></section>
  <section className="info-section"><h2>掲載情報について</h2><p>公式サイトや動画の概要欄などを参照し、情報の追加・訂正を行っています。未掲載の歌唱や未確認の項目もあります。最新の公演・発売・公開状況は、各公式案内をご確認ください。</p><p>探し方や表示の意味は<Link href="/guide">{PAGE_LABELS.guide}</Link>にまとめています。</p></section>
  <section className="info-section"><h2>掲載物と外部リンク</h2><p>画像などの掲載物に関する権利は、各権利者に帰属します。動画・音源の視聴は、リンク先のサービスをご利用ください。</p></section>
  <section className="info-section"><h2>ご連絡</h2><p>情報提供・訂正、感想・要望、不具合や掲載内容についてのご連絡は、<Link href="/contribute">{PAGE_LABELS.contribute}</Link>からお願いします。出典が分からない情報も送れます。</p></section>
 </article>;
}
