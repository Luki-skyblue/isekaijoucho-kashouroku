import {PAGE_LABELS} from '@/lib/ui-copy.mjs';
import type {Metadata} from 'next';
import {Breadcrumb,Heading} from '@/components/ui';
import {ContributionDraft} from '@/components/contribution-draft';
import {configuredFeedbackContact} from '@/lib/feedback-contact.mjs';
import '@/components/info-pages.css';

export const metadata:Metadata={title:PAGE_LABELS.contribute,description:'ヰ世界情緒 歌唱録への情報提供、訂正、感想・要望や不具合の連絡。',robots:{index:false,follow:true}};
export default function Contribute(){
 const {email:recipient,formUrl}=configuredFeedbackContact();
 return <article className="info-page">
  <Breadcrumb parts={[{label:PAGE_LABELS.contribute}]}/><Heading title={PAGE_LABELS.contribute}/>
  <p className="info-intro">情報提供や訂正のほか、感想・要望・不具合などもお寄せください。</p>
  {formUrl&&<dl className="info-states" aria-label="フォームの入力項目">
   <div><dt>内容</dt><dd>必須</dd></div>
   <div><dt>対象・出典・手がかり</dt><dd>任意。URLでも言葉でも構いません。</dd></div>
   <div><dt>返信先</dt><dd>任意。返信を希望する場合だけ。</dd></div>
  </dl>}
  <p>出典が分からなくても、内容だけで投稿できます。</p>
  <p className="info-small">例：「先月の配信で『○○』を歌っていたと思います。」<br/>「スマホで文字をもう少し大きくできるとうれしいです。」</p>
  {formUrl?<p><a className="contribution-action" href={formUrl} target="_blank" rel="noopener noreferrer">情報提供・訂正フォームを開く ↗</a></p>:<>
   {recipient?<div className="info-contact"><p>下の入力欄で文章を作り、メールアプリから送信できます。</p><a href={'mailto:'+recipient}>{recipient}</a></div>:<p className="info-state">現在、送信先は未設定です。文章の作成・コピーのみ利用できます。サイトへの送信や運営者への通知は行われません。</p>}
   <ContributionDraft recipient={recipient}/>
  </>}
 </article>;
}
