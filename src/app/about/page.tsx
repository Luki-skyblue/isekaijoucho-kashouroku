import Link from 'next/link';
import type {Metadata} from 'next';
import {Breadcrumb,Heading} from '@/components/ui';
import '@/components/info-pages.css';

export const metadata:Metadata={title:'このサイトについて',description:'ヰ世界情緒 歌唱録の掲載内容と連絡先。'};
export default function About(){
 return <article className="info-page">
  <Breadcrumb parts={[{label:'このサイトについて'}]}/>
  <Heading title="このサイトについて"/>
  <div className="info-intro"><p>ヰ世界情緒さんの歌唱楽曲、LIVE、収録作品をまとめた非公式ファンサイトです。</p><p>KAMITSUBAKI STUDIO、ヰ世界情緒さん本人および関係各社とは関係ありません。</p></div>
  <section className="info-section"><h2>掲載情報</h2><p>未確認・調査中の情報を含みます。新しい情報の追加や、内容の訂正を随時行っています。</p><p>探し方や表示の意味は<Link href="/guide">使い方</Link>をご覧ください。</p></section>
  <section className="info-section"><h2>掲載物の権利</h2><p>掲載している画像・楽曲・映像などの権利は、各権利者に帰属します。</p></section>
  <section className="info-section"><h2>情報提供・訂正</h2><p>誤記、未掲載の情報、掲載内容の削除に関するご連絡は、<Link href="/contribute">情報提供・訂正</Link>からお願いします。</p></section>
 </article>;
}
