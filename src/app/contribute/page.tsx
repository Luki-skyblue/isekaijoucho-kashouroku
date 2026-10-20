import type { Metadata } from 'next';
import { Breadcrumb, Heading, Panel } from '@/components/ui';
import { ContributionDraft } from '@/components/contribution-draft';
import {configuredFeedbackContact} from '@/lib/feedback-contact.mjs';

export const metadata: Metadata = {
  title: '情報提供',
  description: 'ヰ世界情緒 歌唱録への情報提供・訂正内容を整理するためのページ。送信先の設定状況を明示します。',
  robots: { index: false, follow: true },
};

export default function Contribute() {
  const {email:recipient,formUrl}=configuredFeedbackContact();
  return <>
    <Breadcrumb parts={[{label:'情報提供'}]} />
    <Heading eyebrow="SUBMIT INFO" title="情報提供・訂正" description="曲・歌唱・LIVE・商品の情報を、出典とともに整理できます。" />
    <Panel title="このページの受付状況">
      {formUrl ? <><p>情報提供・訂正はGoogleフォームで受け付けています。対象と内容、分かる範囲で根拠をお知らせください。回答内容は一般には公開しません。</p><p><a className="contribution-action" href={formUrl} target="_blank" rel="noopener noreferrer">情報提供・訂正フォームを開く ↗</a></p></> : recipient ? <p>メールアプリでの情報提供に対応しています。実際の送信はメールアプリで行われます。サイトは入力内容をサーバーへ保存しません。</p> :
        <p>現在、情報提供の送信先は未設定です。下のフォームで文章を作成・コピーできますが、<strong>サイトへの送信や運営者への通知は行われません。</strong> 送信先が確認できるまで受付済みとは扱いません。</p>}
      <p className="muted tiny">根拠となる公式ページなどのURLがあれば添えてください。未確認の提供情報は、そのまま確定データには採用しません。パスワード、住所、電話番号などの個人情報は記入しないでください。</p>
    </Panel>
    {!formUrl&&<ContributionDraft recipient={recipient} />}
  </>;
}
