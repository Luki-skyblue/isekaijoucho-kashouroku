import Link from 'next/link';
import type {Metadata} from 'next';
import {Breadcrumb,Heading} from '@/components/ui';
import {useCatalogEntryIndex} from '@/lib/catalog-mode';
import {privateSnapshotEnabled} from '@/lib/private-snapshot';
import {publicCatalogEnabled} from '@/lib/public-catalog';
import '@/components/info-pages.css';

export const metadata:Metadata={title:'使い方',description:'楽曲・LIVE・収録作品の探し方と、表示の読み方。'};
export default function Guide(){
 const newCatalog=useCatalogEntryIndex(),liveFilters=privateSnapshotEnabled()||publicCatalogEnabled();
 return <article className="info-page">
  <Breadcrumb parts={[{label:'使い方'}]}/><Heading title="使い方"/>
  <section id="search" className="info-section">
   <h2>楽曲を探す</h2>
   <p><Link href="/songs">楽曲一覧</Link>で曲名を入力し、「検索」を押します。メドレーは、構成曲の名前でも探せます。</p>
   <p><Link href="/discover">公開・収録先から探す</Link>では、YouTubeチャンネル・CDや配信・LIVEから楽曲を辿れます。</p>
   {newCatalog?<div id="singer-filters"><h3>歌唱者・楽曲区分</h3>
    <p><Link href="/search?target=songs">詳細検索</Link>で歌唱者や楽曲区分を選び、「検索」を押します。</p>
    <div className="info-table-wrap"><table className="info-table"><thead><tr><th scope="col">歌唱者の条件</th><th scope="col">対象</th></tr></thead><tbody>
     <tr><th scope="row">完全一致</th><td>選んだ人全員が歌い、他の歌唱者はいない</td></tr>
     <tr><th scope="row">いずれかを含む</th><td>選んだ人のうち、1人以上が歌う</td></tr>
     <tr><th scope="row">全員を含む</th><td>選んだ人全員が歌う。他の歌唱者がいてもよい</td></tr>
     <tr><th scope="row">のみから構成</th><td>選んだ人だけで歌う。全員が参加していなくてもよい</td></tr>
    </tbody></table></div>
    <p className="info-small">例：ヰ世界情緒と春猿火を選ぶと、「完全一致」は2人のデュエット。「のみから構成」はそれぞれのソロも対象です。</p>
    <details className="info-details"><summary>条件を詳しく見る</summary><p>登録されている歌唱者候補を S、選んだ歌唱者を Q とすると、完全一致は S = Q、いずれかを含むは S ∩ Q ≠ ∅、全員を含むは Q ⊆ S、のみから構成は S ⊆ Q です。</p><p>合成音声・音楽的同位体も歌唱者に含みます。歌唱者の組み合わせが調査中の記録は、「完全一致」「のみから構成」の対象にならない場合があります。</p></details>
    <p id="categories">楽曲区分を複数選んだ場合は、いずれかに当てはまる曲が対象です。</p>
    <p>メンバーカバーは原曲の一部メンバーによる歌唱で、1人ならソロです。メンバーカバーで絞るとソロも含みます。コラボカバーは原曲の一部メンバーと別の歌唱者による共演です。</p>
    <p>「選択をクリア」は入力中の条件を空にします。検索結果の条件を外すには、条件タグか「すべて解除」を使います。</p>
   </div>:<p className="info-state">歌唱者・楽曲区分による絞り込みは準備中です。</p>}
   <p>並べ替えとリスト・グリッド表示は、選ぶとすぐに反映されます。</p>
   <p id="variants">歌唱者などが異なる記録は、楽曲詳細の「別バージョン」で確認できます。</p>
  </section>
  <section id="live-filters" className="info-section"><h2>LIVEを探す</h2>
   <p><Link href="/lives">LIVE一覧</Link>から、公演ごとのセットリストを確認できます。</p>
   {liveFilters&&<><p><Link href="/search?target=lives">詳細検索</Link>では、公演名義・出演者・ワンマンなどの区分を組み合わせて探せます。</p><p>開催日順は、初回の開催日が基準です。</p></>}
   <p className="info-small">絞り込みは登録済みの情報が対象です。公演の出演者が、全曲を歌っているとは限りません。</p>
  </section>
  <section id="records" className="info-section"><h2>収録作品を見る</h2><p><Link href="/releases">収録作品</Link>で、CD・配信・映像作品などの発売情報や収録内容を確認できます。リンクになっている曲名から、楽曲詳細へ移動できます。</p></section>
  <section id="evidence" className="info-section"><h2>表示の読み方</h2>
   <dl className="info-states"><div><dt>準備中</dt><dd>情報を整理中、または表示機能を準備している項目です。</dd></div><div><dt>見つかっていません。</dt><dd>調査した範囲で情報を確認できなかった項目です。</dd></div></dl>
   <p id="contribute">誤記や未掲載の情報は<Link href="/contribute">情報提供・訂正</Link>からお知らせください。</p>
  </section>
 </article>;
}
