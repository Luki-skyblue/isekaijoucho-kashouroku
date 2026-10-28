'use client';

import { useEffect, useState } from 'react';

type Draft = {category:string; target:string; detail:string; references:string};
const KEY = 'kashouroku-contribution-draft-v1';
const EMPTY:Draft = {category:'楽曲・歌唱', target:'', detail:'', references:''};
const CATEGORIES = ['楽曲・歌唱','歌唱者・クレジット','LIVE・セットリスト','商品・収録内容','動画・公開情報','誤記・その他'] as const;
function isDraft(x:unknown):x is Draft {
  if(!x || typeof x !== 'object') return false;
  const d=x as Record<string,unknown>;
  return CATEGORIES.includes(d.category as typeof CATEGORIES[number]) && typeof d.target==='string' && d.target.length<=160 && typeof d.detail==='string' && d.detail.length<=3000 && typeof d.references==='string' && d.references.length<=1500;
}
export function composeContribution(d:Draft):string {
 return ['【ヰ世界情緒 歌唱録：情報提供】',`種別：${d.category}`,`対象：${d.target.trim()}`,'','内容：',d.detail.trim(),'','出典・手がかり：',d.references.trim()||'（未記入）'].join('\n');
}
export function ContributionDraft({recipient}:{recipient:string|null}) {
 const [draft,setDraft]=useState<Draft>(EMPTY);
 const [ready,setReady]=useState(false);
 const [copyMessage,setCopyMessage]=useState('');
 useEffect(()=>{try{const stored=window.localStorage.getItem(KEY);if(stored){const value:unknown=JSON.parse(stored);if(isDraft(value))setDraft(value);}}catch{/* Storage is optional */}setReady(true);},[]);
 useEffect(()=>{if(!ready)return;try{window.localStorage.setItem(KEY,JSON.stringify(draft));}catch{/* Storage is optional */}},[draft,ready]);
 const patch=(name:keyof Draft,value:string)=>{setDraft(old=>({...old,[name]:value}));setCopyMessage('');};
 const valid=!!draft.target.trim() && !!draft.detail.trim();
 const body=composeContribution(draft);
 // Email client URLs have practical length limits. Never truncate user content silently.
 const emailHref=recipient && valid ? `mailto:${recipient}?subject=${encodeURIComponent('【ヰ世界情緒 歌唱録】情報提供：'+draft.category)}&body=${encodeURIComponent(body)}` : null;
 const mailtoAvailable=!!emailHref && emailHref.length<=1750;
 async function copyDraft(){
  if(!valid)return;
  try{await navigator.clipboard.writeText(body);setCopyMessage('原稿をコピーしました。送信は行っていません。');}
  catch{setCopyMessage('コピーできませんでした。下の確認欄から文章を選択してコピーしてください。');}
 }
 function clearDraft(){setDraft(EMPTY);setCopyMessage('入力内容をクリアしました。');try{window.localStorage.removeItem(KEY);}catch{/* Optional */}}
 return <section className="panel contribution-panel" aria-label="情報提供の入力">
  <h2>内容を入力</h2>
  <div className="contribution-fields">
   <label htmlFor="contribution-type">種類</label>
   <select id="contribution-type" value={draft.category} onChange={e=>patch('category',e.target.value)}>{CATEGORIES.map(v=><option key={v} value={v}>{v}</option>)}</select>
   <label htmlFor="contribution-target">対象の曲名・公演名など <span aria-hidden="true">*</span></label>
   <input id="contribution-target" required maxLength={160} value={draft.target} onChange={e=>patch('target',e.target.value)} placeholder="例：楽曲名、LIVE名など" />
   <label htmlFor="contribution-detail">提供内容・訂正案 <span aria-hidden="true">*</span></label>
   <textarea id="contribution-detail" required maxLength={3000} rows={6} value={draft.detail} onChange={e=>patch('detail',e.target.value)} placeholder="どの情報について、何を確認・訂正できるか" />
   <label htmlFor="contribution-reference">出典・手がかり（任意）</label>
   <textarea id="contribution-reference" maxLength={1500} rows={3} value={draft.references} onChange={e=>patch('references',e.target.value)} placeholder="例：動画のURL、○月ごろの配信、アルバムの歌詞カードなど" />
  </div>
  <p className="muted tiny">入力内容はこのブラウザに下書き保存されます。共有端末では利用後に「下書きを削除」してください。</p>
  <div className="contribution-actions">
   {mailtoAvailable && <a className="contribution-primary" href={emailHref!}>メールアプリで作成 ↗</a>}
   <button type="button" className={mailtoAvailable?'contribution-secondary':'contribution-primary'} onClick={copyDraft} disabled={!valid}>原稿をコピー</button>
   <button type="button" className="contribution-secondary" onClick={clearDraft}>下書きを削除</button>
  </div>
  {recipient && valid && !mailtoAvailable && <p className="muted tiny">本文が長いためメールアプリへの一括入力は無効です。「原稿をコピー」で内容を保存し、メールへ貼り付けてください。</p>}
  {copyMessage && <p role="status" className="contribution-status">{copyMessage}</p>}
  {valid && <details className="contribution-preview"><summary>作成した原稿を確認・手動コピー</summary><textarea readOnly aria-label="作成した情報提供文" value={body} rows={10} onFocus={e=>e.currentTarget.select()} /></details>}
 </section>;
}
