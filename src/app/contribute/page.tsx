import type {Metadata} from 'next';
import {Breadcrumb,Heading} from '@/components/ui';
import {ContributionDraft} from '@/components/contribution-draft';
import {configuredFeedbackContact} from '@/lib/feedback-contact.mjs';
import '@/components/info-pages.css';

export const metadata:Metadata={title:'情報提供・訂正',description:'ヰ世界情緒 歌唱録への情報提供、訂正や掲載内容に関する連絡。',robots:{index:false,follow:true}};
export default function Contribute(){
 const {email:recipient,formUrl}=configuredFeedbackContact();
 return <article className="info-page">
  <Breadcrumb parts={[{label:'情報提供・訂正'}]}/><Heading title="情報提供・訂正"/>
  <p className="info-intro">追加情報や訂正内容を、分かる範囲でお知らせください。</p>
  <p>出典はURLでも、「配信で聴いた」「歌詞カードで見た」などの言葉でも構いません。出典が分からなくても投稿できます。</p>
  <p className="info-small">例：「先月の配信で『○○』を歌っていたと思います。」<br/>「『○○』の作詞は△△さんです。歌詞カードに載っています。」</p>
  {formUrl?<p><a className="contribution-action" href={formUrl} target="_blank" rel="noopener noreferrer">情報提供・訂正フォームを開く ↗</a></p>:<>
   {recipient?<div className="info-contact"><p>下の入力欄で文章を作り、メールアプリから送信できます。</p><a href={'mailto:'+recipient}>{recipient}</a></div>:<p className="info-state">現在、送信先は未設定です。文章の作成・コピーのみ利用できます。サイトへの送信や運営者への通知は行われません。</p>}
   <ContributionDraft recipient={recipient}/>
  </>}
 </article>;
}
