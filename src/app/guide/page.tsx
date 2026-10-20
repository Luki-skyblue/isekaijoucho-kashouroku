import Link from 'next/link';
import type {Metadata} from 'next';
import {Breadcrumb,Heading,Panel} from '@/components/ui';
import {useCatalogEntryIndex} from '@/lib/catalog-mode';
import {privateSnapshotEnabled} from '@/lib/private-snapshot';
import {publicCatalogEnabled} from '@/lib/public-catalog';

export const metadata:Metadata={title:'歌唱録ガイド',description:'楽曲目録の検索方法、歌唱者・メドレー・関連資料の扱いとサイトの使い方。'};
export default function Guide(){
 const newCatalog=useCatalogEntryIndex(),livePreview=privateSnapshotEnabled()||publicCatalogEnabled();
 return <>
  <Breadcrumb parts={[{label:'歌唱録ガイド'}]}/>
  <Heading eyebrow="GUIDE" title="歌唱録ガイド" description="探し方と、目録に書かれた情報の読み方。"/>
  {!newCatalog&&<p className="guide-preview-note">歌唱者の4条件検索などは新目録向けの機能です。現在の旧作品一覧モードでは、まだ利用できない場合があります。正式公開前のレビュー機能も含めて説明しています。</p>}
  <nav className="guide-toc" aria-label="ガイドの目次"><p>このページの内容</p><ol>
   <li><a href="#search">曲名を探す</a></li>
   <li><a href="#singer-filters">歌唱者で絞る</a></li>
   <li><a href="#categories">楽曲区分を選ぶ</a></li>
   <li><a href="#variants">同じ曲の別の歌唱</a></li>
   {livePreview&&<li><a href="#live-filters">LIVEを絞り込む</a></li>}
   <li><a href="#records">LIVE・商品・履歴</a></li>
   <li><a href="#evidence">掲載情報と出典</a></li>
   <li><a href="#contribute">情報提供・訂正</a></li>
  </ol></nav>
  <section id="search" className="guide-section"><Panel title="曲名を探す"><p>楽曲目録の検索欄に曲名を入れ、Enterまたは「検索」で確定します。適用中の「検索：○○」を解除すると、曲名検索だけを外せます。</p><p>「メドレー」と検索すると、タイトルにその語がなくても、メドレーとして登録された曲が見つかります。構成曲名で見つかるメドレーもあり、直接の曲名一致を先に表示します。</p><p>並べ替えは、メニューから順序を1つ選ぶと反映します。更新中は、その時点で表示している結果の並び順を示します。検索・絞り込み・表示形式を保ち、1ページ目から並べ直します。</p></Panel></section>
  <section id="singer-filters" className="guide-section"><Panel title="歌唱者で絞る"><p>歌唱者をチェックし、次の4条件を選択して「適用」を押します。選択した歌唱者の集合を Q、各目録行の歌唱者候補の集合を S とした場合の意味です。</p>
   <p>「選択をクリア」は、フォームの歌唱者・楽曲区分をすべて未選択にし、一致条件を初期値へ戻します。検索結果は「適用」を押すまで変わりません。適用中の条件を解除するには、結果の上にある「すべて解除」を使います。</p>
   <div className="guide-table-wrap"><table className="guide-table"><thead><tr><th scope="col">条件</th><th scope="col">一致する曲</th><th scope="col">集合条件</th></tr></thead><tbody>
    <tr><th scope="row">完全一致</th><td>選んだ人が全員参加、他の人はいない</td><td>S = Q</td></tr>
    <tr><th scope="row">いずれかを含む</th><td>選んだ人が1人以上参加</td><td>S ∩ Q ≠ ∅</td></tr>
    <tr><th scope="row">全員を含む</th><td>選んだ人全員が参加。他の歌唱者がいてもよい</td><td>Q ⊆ S</td></tr>
    <tr><th scope="row">のみから構成</th><td>選んだ人の一部だけが参加してもよい。他の人は参加しない</td><td>S ⊆ Q</td></tr>
   </tbody></table></div>
   <p>例：ヰ世界情緒と春猿火を選んだ「のみから構成」では、各ソロと2人のデュエットが対象です。「完全一致」では2人のデュエットだけになります。</p>
   <p className="guide-caveat">歌唱者は合成音声・音楽的同位体を含む歌声の参加者として扱います。グループ名義は通常の構成員へ展開しますが、公演ごとの欠席・代役など確認された例外を優先します。歌唱者候補に未解決名義が残る曲は、「完全一致」「のみから構成」の対象としません。検索結果は実歌唱者の検証完了を保証しません。</p>
  </Panel></section>
  <section id="categories" className="guide-section"><Panel title="楽曲区分を選ぶ"><p>オリジナル・カバー・コラボ・その他のチェックは、複数なら「いずれかに該当」（OR）です。未選択なら楽曲区分では絞り込みません。曲名・歌唱者の条件とは組み合わせて絞り込みます（AND）。</p><p>メドレーは原曲・カバー等とは異なる構成形式です。通常一覧にも掲載し、曲名検索「メドレー」などから探せます。</p></Panel></section>
  <section id="variants" className="guide-section"><Panel title="同じ曲の別の歌唱"><p>同じ作品でも、実際の歌唱者の組み合わせや、確認された音楽的形態が異なれば別の目録行になる場合があります。各行から詳細へ移動し、同作品の他の歌唱候補や比較表を確認できます。</p><p>公演名などによる識別表記は、公式のバージョン名とは限りません。確認できていないキー差・曲順・歌唱者を補って確定情報として表示しません。</p></Panel></section>
  {livePreview&&<section id="live-filters" className="guide-section"><Panel title="LIVEを絞り込む"><p>アーティストの「公演名義で探す」は、誰の公演かを指定します。「出演者で探す」はゲストを含む出演記録を対象にします。公演区分と組み合わせて、ヰ世界情緒のワンマンやV.W.Pのワンマンなどを探せます。</p><p>アーティストの複数選択は「いずれか」「全員」を選べます。公演区分の複数選択はいずれかに該当する公演が対象です。「全員」は同じ公演内の出演記録を調べるもので、同じ開催回・曲で共演した証明ではありません。</p><p>変更は「適用」で結果に反映します。「選択をクリア」はアーティスト・区分を未選択にし、一致条件を初期値に戻します。探し方は保持し、結果は適用まで変わりません。適用中の条件はタグか「すべて解除」で外せます。並べ替え・表示形式は維持します。</p><p>開催日順は初回開催日が基準です。再放送の日付へ読み替えません。公演名義・出演者・区分の情報は整備中で、絞り込みは登録済み情報が対象です。</p></Panel></section>}
  <section id="records" className="guide-section"><Panel title="LIVE・商品・歌唱履歴"><p><Link href="/lives">LIVE・セットリスト</Link>と<Link href="/releases">収録商品</Link>から関連情報を辿れます。目録行と履歴の直接対応と、同じ音楽的版であることだけから挙がる候補は区別します。</p><p>公演全体の出演者が、すべての演目に歌唱参加したとは限りません。CDの1トラックに曲やMCなど複数の項目が含まれる場合もあります。</p></Panel></section>
  <section id="evidence" className="guide-section"><Panel title="掲載情報と出典"><p>このサイトは非公式資料です。歌唱者・出典・制作情報に未確認の候補が含まれます。「関連資料が存在する」だけでは個々の事実が確認されたことにはなりません。</p><p>下書きの候補件数は公開済み楽曲数ではありません。調査中の資料を無条件に公開したり、推測で不足情報を補ったりしません。</p><p>プロジェクトの位置づけは<Link href="/about">このサイトについて</Link>もご覧ください。</p></Panel></section>
  <section id="contribute" className="guide-section"><Panel title="情報提供・訂正"><p>誤記や未掲載情報は<Link href="/contribute">情報提供・訂正</Link>で原稿を作成できます。受付方法は情報提供・訂正ページに表示します。フォームやメールアプリでの実際の送信を終えてから、送信済みとして扱ってください。</p></Panel></section>
 </>;
}
