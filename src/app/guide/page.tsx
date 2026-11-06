import {sitePageMetadata} from '@/lib/page-metadata';
import {PAGE_LABELS,INFO_STATES} from '@/lib/ui-copy.mjs';
import Link from 'next/link';
import {Breadcrumb,Heading} from '@/components/ui';
import {useCatalogEntryIndex} from '@/lib/catalog-mode';
import {privateSnapshotEnabled} from '@/lib/private-snapshot';
import {publicCatalogEnabled} from '@/lib/public-catalog';
import '@/components/info-pages.css';

export function generateMetadata(){return sitePageMetadata('/guide',PAGE_LABELS.guide,{description:'楽曲・LIVE・収録作品・関係者の探し方と、表示の読み方。'});}
export default function Guide(){
 const newCatalog=useCatalogEntryIndex(),liveFilters=privateSnapshotEnabled()||publicCatalogEnabled();
 return <article className="info-page">
  <Breadcrumb parts={[{label:PAGE_LABELS.guide}]}/><Heading title={PAGE_LABELS.guide}/>
  <section id="search" className="info-section">
   <h2>探す</h2>
   <div className="info-table-wrap"><table className="info-table"><thead><tr><th scope="col">ページ</th><th scope="col">できること</th></tr></thead><tbody>
    <tr><th scope="row"><Link href="/songs">{PAGE_LABELS.songs}</Link></th><td>曲名から探す</td></tr>
    <tr><th scope="row"><Link href="/lives">{PAGE_LABELS.lives}</Link></th><td>公演やセットリストを見る</td></tr>
    <tr><th scope="row"><Link href="/releases">{PAGE_LABELS.releases}</Link></th><td>CD・配信・映像作品の収録内容を見る</td></tr>
    <tr><th scope="row"><Link href="/people">{PAGE_LABELS.people}</Link></th><td>共演者や曲・動画の制作者から探す</td></tr>
   </tbody></table></div>
   <p>各一覧の検索欄で名前を入力し、「検索」を押します。楽曲一覧では、メドレーの構成曲名からも探せます。</p>
   <p>並べ替えとリスト・グリッド表示は、選ぶとすぐに反映されます。</p>
   <p>右上のメニューから、衣装テーマを切り替えられます。</p>
  </section>
  <section id="variants" className="info-section"><h2>楽曲の表示について</h2>
   <h3 id="first-appearance">初出</h3>
   <p>その歌唱を一部でも聴けたと、現在確認できている最も早い日です。カバーでは、原曲の発売日を指しません。より古い公開や披露が分かると更新します。</p>
   <p>初出が部分的な歌唱だと確認できた場合に、「初出（フル）」も表示します。この欄がないことだけでは、初出がフルかどうかは分かりません。</p>
   <h3>名義と歌唱者</h3>
   <p>曲名の下には、その歌唱の名義を表示しています。「Covered by」に続く名前は、カバー歌唱の名義です。実際の歌唱者は、楽曲詳細の「歌唱」で確認できます。</p>
   <p>カバーの作者には「原曲の作詞」「原曲の作曲」などの表記を使い、その歌唱や動画の制作担当と区別しています。</p>
   <h3>別バージョン</h3>
   <p>歌唱者やアレンジなどが違う歌唱は、別バージョンとして掲載しています。同じ曲名が複数並ぶことがあります。楽曲詳細の「別バージョン」から確認できます。</p>
   <p>関係者ページの「1曲・3バージョン」は、同じ曲の3つのバージョンを掲載しているという意味です。</p>
  </section>
  <section id="live-filters" className="info-section"><h2>LIVE・収録作品の見方</h2>
   <p>LIVEのセットリストでは、薄い文字はヰ世界情緒さんが歌っていないと確認できた演目です。公演の出演者全員が、すべての曲を歌っているとは限りません。</p>
   <p>開催日順は、初回の開催日が基準です。</p>
   <div id="records"><h3>収録作品</h3>
    <p>収録作品一覧では、通常のリリースと「LIVE音源・映像」を切り替えられます。α・βなど複数の版がある作品は、詳細ページで版を選べます。作品の全体像が分かるよう、参考の収録曲を薄い文字で載せる場合もあります。</p>
   </div>
   <p>リンクになっている曲名から楽曲詳細へ進めます。リンクのない曲は、未登録や対応関係が未確認の場合があります。</p>
  </section>
  <section id="evidence" className="info-section"><h2>情報が入っていない場合</h2>
   <dl className="info-states"><div><dt>{INFO_STATES.pending}</dt><dd>情報の確認・整理がまだ済んでいません。</dd></div><div><dt>{INFO_STATES.notFound}</dt><dd>調査した範囲では、情報を確認できませんでした。存在しないと断定する表示ではありません。</dd></div><div><dt>{INFO_STATES.notApplicable}</dt><dd>その項目が当てはまりません。</dd></div></dl>
   <p>「NO IMAGE」は、画像が未登録、または読み込めない場合の表示です。</p>
  </section>
  <section id="detailed-search" className="info-section"><h2>詳細検索</h2>
   <p>歌唱者・楽曲区分・公開や収録先などで絞り込む場合は、<Link href="/search">{PAGE_LABELS.search}</Link>をご利用ください。現在は整備中で、登録情報の不足により結果に漏れがある場合があります。</p>
   <p>見つからないときは条件を減らすか、各一覧の名前検索もお試しください。</p>
   <p>「公開・収録先」も検索条件の一つです。YouTube・CD・LIVEなどを、歌唱者や初出日と組み合わせられます。「すべてに一致」で絞り込み、「いずれかに一致」で候補を広げ、まとまりごとの除外もできます。入力した条件は「この条件で検索」を押すと適用されます。</p>
   {(newCatalog||liveFilters)&&<details className="info-details"><summary>絞り込み条件の説明</summary>
    {newCatalog&&<>
     <div id="singer-filters"><h3>歌唱者</h3>
      <div className="info-table-wrap"><table className="info-table"><thead><tr><th scope="col">条件</th><th scope="col">対象</th></tr></thead><tbody>
       <tr><th scope="row">この組合せのみ</th><td>選んだ人全員が歌い、他の歌唱者はいない</td></tr>
       <tr><th scope="row">いずれかを含む</th><td>選んだ人のうち、1人以上が歌う</td></tr>
       <tr><th scope="row">すべて含む</th><td>選んだ人全員が歌う。他の歌唱者がいてもよい</td></tr>
       <tr><th scope="row">この中の人だけ</th><td>選んだ人だけで歌う。全員が参加していなくてもよい</td></tr>
      </tbody></table></div>
      <p>例：ヰ世界情緒と春猿火を選ぶと、「完全一致」は2人のデュエット。「のみから構成」はそれぞれのソロも対象です。</p>
      <p>合成音声・音楽的同位体も歌唱者に含みます。歌唱者の組み合わせが調査中の記録は、「完全一致」「のみから構成」の対象にならない場合があります。</p>
     </div>
     <div id="categories"><h3>楽曲区分</h3><p>複数選ぶと、いずれかに当てはまる曲が対象です。メンバーカバーは原曲の一部メンバーによる歌唱で、1人ならソロです。メンバーカバーで絞るとソロも含みます。コラボカバーは原曲の一部メンバーと別の歌唱者による共演です。</p></div>
     <div id="source-filters"><h3>公開・収録先</h3><p>YouTube・X・CDや配信・LIVE音源や映像・披露されたLIVEや配信を選べます。複数選択はいずれかに当てはまる曲が対象で、歌唱者や曲名の条件と組み合わせられます。</p><p>披露記録があっても、現在視聴できる音源や映像があるとは限りません。</p></div>
     <div id="credit-date-filters"><h3>制作クレジット・初出</h3><p>担当者とその人の担当を組み合わせられます。「作曲」「原曲の作曲」や動画の担当は区別します。初出の開始・終了は片方だけでも指定でき、境界の日付を含みます。</p></div>
     <p>「選択をクリア」は入力中の条件を空にします。検索結果の条件を外すには、条件タグか「すべて解除」を使います。</p>
    </>}
    {liveFilters&&<p><Link href="/search?target=lives">LIVEの詳細検索</Link>では、公演名義・出演者・ワンマンなどの区分を組み合わせて探せます。</p>}
   </details>}
   {!newCatalog&&<p className="info-state">歌唱者・楽曲区分による絞り込みは準備中です。</p>}
  </section>
  <section id="contribute" className="info-section"><h2>間違いや不足を見つけたら</h2>
   <p><Link href="/contribute">{PAGE_LABELS.contribute}</Link>からお知らせください。出典が分からなくても、内容だけで送れます。感想や要望、不具合のご連絡も受け付けています。</p>
  </section>
 </article>;
}
