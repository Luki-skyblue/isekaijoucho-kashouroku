import Link from 'next/link';
import type { Metadata } from 'next';
import {Heading,Panel} from '@/components/ui';
import {publicCatalogEnabled} from '@/lib/public-catalog';
import {configuredFeedbackContact} from '@/lib/feedback-contact.mjs';
export const metadata: Metadata = {title:'このサイトについて',description:'ヰ世界情緒 歌唱録の方針、情報の出典、非公式サイトとしての掲載範囲。'};
export default function About(){const contact=configuredFeedbackContact();return <><Heading eyebrow="ABOUT" title="歌唱録について" description="このサイトはファン制作の非公式資料です。"/><Panel title="全楽曲の記録を目指して"><p>正式登録された作品は、クレジットや初フルが未確認でも検索・閲覧の対象にします。登録作品数は、完全な網羅性の証明ではありません。</p></Panel><Panel title="確定した事実と関連資料"><p>関連資料が存在することは、その資料によって個別の事実が証明されたことを意味しません。録音日・動画公開日・公演日は区別します。</p><p>関連資料のURLは個別審査が済むまで表示しません。研究メモ・未採用の調査候補は公開しません。</p></Panel><Panel title="情報提供・訂正"><p>歌唱内容やクレジットなどの誤りにお気付きの際は、<Link href="/contribute">情報提供・訂正ページ</Link>で根拠とともに原稿を作成できます。{contact.formUrl?'Googleフォームで受け付けています。':contact.email?'メールアプリから送信できます。':'現在、送信先の設定前は運営者への通知は行われません。'}</p></Panel>{!publicCatalogEnabled()&&<Panel title="プレビューの制限"><p>このバージョンは閲覧部分の試作です。旧サイトの絞り込み・情報提供の送信処理・旧URL対応などはまだ移植しきれておらず、旧サイトの切替には使用しません。</p></Panel>}</>}
