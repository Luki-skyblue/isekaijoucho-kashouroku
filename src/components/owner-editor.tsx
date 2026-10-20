'use client';

import {useEffect,useId,useRef,useState} from 'react';
import {createOwnerBrowserClient,ownerJournalKey,readOwnerJournal,prepareOwnerJournal,submitOwnerJournal} from '@/lib/catalog-owner-browser.mjs';
import type {Choice,ChoiceKind,ChoiceRequest,Journal,OwnerClient,OwnerRequest,Snapshot} from '@/lib/catalog-owner-browser.mjs';
import styles from './owner-editor.module.css';

const messages:Record<string,string>={
  OWNER_AUTH_REQUIRED:'管理用の起動画面から開き直してください。入力と保存控えはこのPCに残っています。',
  OWNER_SESSION_EXPIRED:'起動の有効時間が終了しました。起動し直してから同じ保存控えで続けてください。',
  OWNER_CONFIG_MISSING:'接続設定が不足しています。管理画面の起動設定を確認してください。',
  OWNER_KEY_REQUIRED:'サーバー側の接続キーを確認してください。キーをこの画面やChatへ貼り付けないでください。',
  OWNER_DISABLED:'管理画面の起動を確認してください。',OWNER_FORBIDDEN:'管理画面を127.0.0.1の起動先から開き直してください。',
  STALE_REVISION:'読み込み後に対象が変更されています。最新の変更前を読み直して確認してください。',
  DRAFT_REQUIRED:'この対象は草稿ではないため、この画面では変更できません。',ENTRY_NOT_FOUND:'対象が見つかりません。名前から選び直してください。',
  INVALID_REQUEST:'入力を確認してください。文字数、URL、空欄、歌唱者の選択を見直してください。',
  BUSY_RETRY_SAME_OPERATION:'ほかの保存処理中です。少し待ってから同じ内容で再確認してください。',
  LOCAL_SAVE_BLOCKED:'このブラウザーに保存控えを残せないため、DBへの保存を中止しました。ブラウザーの保存設定を確認してください。',
  LOCAL_JOURNAL_INVALID:'保存控えを読み取れないため、新しい保存を止めています。ブラウザーのデータを削除せずChatへ相談してください。',
  SAVE_BLOCKED_REVIEW_REQUIRED:'データの状態を確認する必要があります。入力を保持したままChatへ相談してください。'
};
function message(error:unknown){const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';return messages[code]??'処理結果を確認できませんでした。入力を保持して、表示された案内に従ってください。';}
const label=(x:Choice)=>x.title??x.name??x.label??'名称未登録';
type Mode='new'|'existing'|'edit';
type Fields={workTitle:string;displayTitle:string;sortTitle:string;rawCredit:string;unresolved:string;complete:boolean;reason:string;url:string;note:string};
const empty:Fields={workTitle:'',displayTitle:'',sortTitle:'',rawCredit:'',unresolved:'',complete:false,reason:'',url:'',note:''};
const record=(x:unknown)=>(x&&typeof x==='object'?x:{}) as Record<string,unknown>;

function NamePicker({client,kind,title,onSelect,work,disabled=false}:{client:OwnerClient|null;kind:ChoiceKind;title:string;onSelect:(choice:Choice)=>void;work?:Choice|null;disabled?:boolean}){
  const [query,setQuery]=useState(''),[items,setItems]=useState<Choice[]>([]),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
  const generation=useRef(0),mounted=useRef(true);
  const inputId=useId();
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
  async function search(more=false){
    if(!client||busy)return;const current=++generation.current;setBusy(true);setStatus('検索中…');
    const input:ChoiceRequest={schemaVersion:1,kind,query,workId:kind==='version'?work?.id??null:null,
      workRevision:kind==='version'?work?.revision??null:null,cursor:more?cursor:null};
    try{const response=await client.choices(input);if(!mounted.current||current!==generation.current)return;
      setItems(old=>more?[...old,...response.items]:response.items);setCursor(response.nextCursor);setStatus(response.items.length?'候補から選んでください。':'該当する候補はありません。');
    }catch(error){if(mounted.current&&current===generation.current)setStatus(message(error));}
    finally{if(mounted.current&&current===generation.current)setBusy(false);}
  }
  return <div className={styles.picker}>
    <label htmlFor={inputId}>{title}</label><span className={styles.searchLine}><input id={inputId} value={query} maxLength={200} disabled={disabled} onChange={e=>{generation.current++;setBusy(false);setQuery(e.target.value);setItems([]);setCursor(null);setStatus('');}}
      onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void search();}}}/><button type="button" disabled={!client||busy||disabled} onClick={()=>void search()}>検索</button></span>
    <p className={styles.hint} role="status">{status}</p>
    <ul className={styles.choices}>{items.map(x=><li key={x.id}><button type="button" disabled={disabled||busy} onClick={()=>onSelect(x)}>
      <strong>{label(x)}</strong><small>{kind==='entry'?[x.workTitle,x.entryKind==='medley'?'メドレー':'歌唱形態'].filter(Boolean).join(' · '):kind==='version'?(x.labelBasis==='editorial'?'編集上の版名':'公式の版名'):x.entityType==='voicebank'?'音声ライブラリ':''} <span>識別：{x.id.slice(-8)}</span></small>
      {kind==='entry'&&x.vocalHints&&x.vocalHints.length>0&&<small>歌唱者の登録情報（抜粋）{x.vocalHints.map((hint,i)=><span key={i}> / {hint}</span>)}</small>}
    </button></li>)}</ul>
    {cursor&&<button type="button" disabled={busy||disabled} onClick={()=>void search(true)}>続きを表示</button>}
  </div>;
}

export function OwnerEditor({project}:{project:string}){
  const [client,setClient]=useState<OwnerClient|null>(null),[step,setStep]=useState(1),[mode,setMode]=useState<Mode>('new');
  const [work,setWork]=useState<Choice|null>(null),[version,setVersion]=useState<Choice|null>(null),[entry,setEntry]=useState<Choice|null>(null);
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[singers,setSingers]=useState<Choice[]>([]),[fields,setFields]=useState<Fields>(empty);
  const [journal,setJournal]=useState<Journal|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[fatal,setFatal]=useState(false);
  const initialized=useRef(false),saving=useRef(false),focus=useRef<HTMLHeadingElement>(null);
  const key=ownerJournalKey(project);
  const persist=(j:Journal)=>window.localStorage.setItem(key,JSON.stringify(j));
  function restore(j:Journal){
    const request=j.request,creation=j.action==='create',w=record(request.work),v=record(w.version),e=record(creation?request.entry:request.patch),voc=record(request.vocal),evidence=record(request.evidence);
    setMode(creation?(w.mode==='new'?'new':'existing'):'edit');setSnapshot(j.before);
    setEntry(j.before?{id:j.before.id,title:j.before.displayTitle}:null);
    setWork(creation&&w.mode==='existing'?{id:String(w.id),revision:Number(w.revision),title:j.summary.work}:null);
    setVersion(w.version?{id:String(v.id),revision:Number(v.revision),label:j.summary.version}:null);
    setSingers(Array.isArray(voc.memberIds)?voc.memberIds.map((id,i)=>({id:String(id),name:j.summary.singers[i]??'選択済みの歌唱者'})):[]);
    setFields({workTitle:String(w.title??''),displayTitle:String(e.displayTitle??''),sortTitle:String(e.sortTitle??''),rawCredit:String(voc.rawCredit??''),
      unresolved:Array.isArray(voc.unresolvedTokens)?voc.unresolvedTokens.join('\n'):'',complete:voc.setComplete===true,
      reason:String(request.reason??''),url:String(evidence.url??''),note:String(evidence.note??'')});
  }
  useEffect(()=>{
    if(initialized.current)return;initialized.current=true;
    const token=new URLSearchParams(window.location.hash.slice(1)).get('owner')??'';
    window.history.replaceState(window.history.state,'',window.location.pathname);
    if(/^[a-f0-9]{64}$/.test(token))setClient(createOwnerBrowserClient({token}));else setError(messages.OWNER_AUTH_REQUIRED);
    try{const saved=readOwnerJournal(window.localStorage.getItem(key),project);if(saved){setJournal(saved);restore(saved);setStep(3);}}
    catch(e){setError(message(e));setFatal(true);}
  // Bootstrap runs once; neither the token nor the client is persisted.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key,project]);
  useEffect(()=>{
    const changed=(event:StorageEvent)=>{if(event.key===key||event.key===null){setError('別のタブで編集が進んでいます。保存を止めました。管理画面を開き直して最新の控えを読み込んでください。');setFatal(true);}};
    window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
  },[key]);
  useEffect(()=>{focus.current?.focus();},[step]);
  function patch<K extends keyof Fields>(name:K,value:Fields[K]){setFields(old=>({...old,[name]:value}));setError('');}
  async function chooseTarget(){
    if(!client||busy||fatal)return;setError('');setBusy(true);
    try{
      if(mode==='edit'){
        if(!entry)return;const fresh=await client.get(entry.id);setSnapshot(fresh);
        setFields(old=>({...old,displayTitle:fresh.displayTitle,sortTitle:fresh.sortTitle??''}));
      }else if(mode==='existing'&&!work)return;
      else if(mode==='existing')setFields(old=>({...old,displayTitle:old.displayTitle||work?.title||''}));
      setStep(2);
    }catch(e){setError(message(e));}finally{setBusy(false);}
  }
  function confirm(){
    try{
      const common={schemaVersion:1,operationId:crypto.randomUUID(),reason:fields.reason,evidence:{url:fields.url||null,note:fields.note}};
      const request:OwnerRequest=mode==='edit'?{...common,entryId:snapshot?.id,baseRevision:snapshot?.revision,patch:{displayTitle:fields.displayTitle,sortTitle:fields.sortTitle||null}}:
        {...common,work:mode==='new'?{mode:'new',title:fields.workTitle,sortTitle:null}:{mode:'existing',id:work?.id,revision:work?.revision,version:version?{id:version.id,revision:version.revision}:null},
          entry:{displayTitle:fields.displayTitle,sortTitle:fields.sortTitle||null},vocal:{rawCredit:fields.rawCredit||null,memberIds:singers.map(s=>s.id),unresolvedTokens:fields.unresolved.split(/\r?\n/).filter(Boolean),setComplete:fields.complete}};
      const next=prepareOwnerJournal(project,mode==='edit'?'save':'create',request,{before:mode==='edit'?snapshot:null,
        summary:{work:mode==='new'?fields.workTitle:work?.title??'',version:version?.label??'版不明',singers:singers.map(s=>s.name??'名称未登録')}});
      try{persist(next);}catch{setError(messages.LOCAL_SAVE_BLOCKED);return;}
      setJournal(next);setError('');setStep(3);
    }catch(e){setError(message(e));}
  }
  async function save(){
    if(!journal||!client||saving.current||fatal)return;saving.current=true;setBusy(true);setError('');
    try{const outcome=await submitOwnerJournal(client,journal,persist);setJournal(outcome.journal);if(outcome.error)setError(message(outcome.error));}
    catch(e){setError(message(e));}
    finally{saving.current=false;setBusy(false);}
  }
  async function back(){
    if(!journal||journal.phase==='uncertain'||busy)return;
    try{
      if(journal.phase==='failed'&&journal.action==='save'&&client){const fresh=await client.get(String(journal.request.entryId));setSnapshot(fresh);}
      window.localStorage.removeItem(key);setJournal(null);setError('');
      if(journal.phase==='failed'&&journal.action==='create'&&mode==='existing'){setWork(null);setVersion(null);setStep(1);}else setStep(2);
    }catch(e){setError(message(e));}
  }
  function reset(){try{window.localStorage.removeItem(key);setJournal(null);setFields(empty);setWork(null);setVersion(null);setEntry(null);setSnapshot(null);setSingers([]);setMode('new');setError('');setStep(1);}catch{setError(messages.LOCAL_SAVE_BLOCKED);}}
  const locked=busy||fatal||!client;
  const request=journal?.request,after=record(journal?.action==='create'?request?.entry:request?.patch),evidence=record(request?.evidence),vocal=record(request?.vocal);
  return <section className={styles.editor} aria-label="草稿の管理">
    <header className="page-heading"><p className="eyebrow">OWNER · DRAFTS</p><h1>草稿の管理</h1><p className="muted">追加・訂正を草稿として保存します。一般公開は別に行います。</p><p className={styles.hint}>接続先：{project}</p></header>
    <ol className={styles.steps} aria-label="入力の手順">{['対象を選ぶ','情報を入力','確認・草稿保存'].map((name,i)=><li key={name} aria-current={step===i+1?'step':undefined}><span>{i+1}</span>{name}</li>)}</ol>
    <p className={styles.hint}>確認画面へ進むと、入力の控えをこのPCのブラウザーに残します。共有端末では保存完了後に「次の編集へ」で控えを削除してください。</p>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {step===1&&<div className={styles.panel}><h2 ref={focus} tabIndex={-1}>1. 対象を選ぶ</h2>
      <fieldset disabled={locked}><legend>行いたいこと</legend>{([['new','新しい作品を追加'],['existing','登録済み作品に歌唱形態を追加'],['edit','登録済み草稿の表示名を訂正']] as const).map(([value,name])=><label className={styles.radio} key={value}><input type="radio" name="owner-mode" value={value} checked={mode===value} onChange={()=>{setMode(value);setError('');}}/>{name}</label>)}</fieldset>
      {mode==='existing'&&<><NamePicker client={client} kind="work" title="作品名で探す" disabled={locked} onSelect={x=>{setWork(x);setVersion(null);}}/>{work&&<p>選択した作品：<strong>{work.title}</strong></p>}</>}
      {mode==='edit'&&<><NamePicker client={client} kind="entry" title="訂正する草稿を名前で探す" disabled={locked} onSelect={setEntry}/>{entry&&<p>訂正する草稿：<strong>{entry.title}</strong></p>}<p className={styles.hint}>現在は表示名と並べ替え用表記の訂正に対応しています。</p></>}
      <div className={styles.actions}><button type="button" className={styles.primary} disabled={locked||(mode==='existing'&&!work)||(mode==='edit'&&!entry)} onClick={()=>void chooseTarget()}>入力へ進む</button></div>
    </div>}
    {step===2&&<form className={styles.panel} onSubmit={e=>{e.preventDefault();confirm();}}><h2 ref={focus} tabIndex={-1}>2. 情報を入力</h2><fieldset disabled={locked}>
      {mode==='new'&&<label>作品名 <span>必須</span><input required maxLength={500} value={fields.workTitle} onChange={e=>{const value=e.target.value;setFields(old=>({...old,workTitle:value,displayTitle:!old.displayTitle||old.displayTitle===old.workTitle?value:old.displayTitle}));}}/></label>}
      {mode==='existing'&&<><p>作品：<strong>{work?.title}</strong></p><p>選択した版：{version?.label??'版不明のまま'}</p>
        <NamePicker key={work?.id} client={client} kind="version" work={work} title="版を選ぶ（不明なら選択不要）" disabled={locked} onSelect={setVersion}/>{version&&<button type="button" onClick={()=>setVersion(null)}>版を未選択に戻す</button>}</>}
      <label>歌唱録の表示名 <span>必須</span><input required maxLength={500} value={fields.displayTitle} onChange={e=>patch('displayTitle',e.target.value)}/></label>
      <label>並べ替え用表記（任意）<input maxLength={500} value={fields.sortTitle} onChange={e=>patch('sortTitle',e.target.value)}/></label>
      {mode!=='edit'&&<><div><p>歌唱者</p><ul className={styles.selected}>{singers.map(s=><li key={s.id}>{s.name}<button type="button" aria-label={`${s.name}を選択から外す`} onClick={()=>setSingers(old=>old.filter(x=>x.id!==s.id))}>×</button></li>)}</ul>
        <NamePicker client={client} kind="singer" title="登録済みの歌唱者を探す" disabled={locked} onSelect={x=>setSingers(old=>old.some(s=>s.id===x.id)?old:[...old,x])}/></div>
        <label>出典の歌唱者表記（任意）<textarea rows={2} maxLength={2000} value={fields.rawCredit} onChange={e=>patch('rawCredit',e.target.value)}/></label>
        <label>まだ対応づけられない名義（1行に1名義）<textarea rows={2} maxLength={32000} value={fields.unresolved} onChange={e=>patch('unresolved',e.target.value)}/></label>
        <label className={styles.radio}><input type="checkbox" checked={fields.complete} onChange={e=>patch('complete',e.target.checked)}/>歌唱者の候補は、選択したメンバーで全員</label>
        <p className={styles.hint}>グループ名からメンバーを自動追加しません。候補が全員揃っていることと、歌唱事実を確認済みであることは別です。</p></>}
      <label>出典URL {mode!=='edit'&&<span>必須</span>}<input type="url" required={mode!=='edit'} maxLength={4096} value={fields.url} onChange={e=>patch('url',e.target.value)} placeholder="https://…"/></label>
      <label>出典の箇所・確認できた範囲 <span>必須</span><textarea required rows={3} maxLength={2000} value={fields.note} onChange={e=>patch('note',e.target.value)} placeholder="例：動画の概要欄。歌唱者は表記どおり、公開日は未確認。"/></label>
      <label>追加・訂正の理由 <span>必須</span><textarea required rows={2} maxLength={1000} value={fields.reason} onChange={e=>patch('reason',e.target.value)}/></label>
      <p className={styles.hint}>ここでは日付や楽曲区分を推測で補いません。入力した出典や歌唱者は未確認情報として保存します。</p>
    </fieldset><div className={styles.actions}><button type="button" disabled={locked} onClick={()=>{setStep(1);setError('');}}>対象選択へ戻る</button><button type="submit" className={styles.primary} disabled={locked}>内容を確認する</button></div></form>}
    {step===3&&journal&&<div className={styles.panel}><h2 ref={focus} tabIndex={-1}>{journal.phase==='saved'?'草稿を保存しました':'3. 確認して草稿保存'}</h2>
      {journal.phase==='saved'?<><p role="status"><strong>{journal.receipt?.after.displayTitle}</strong>を草稿として保存しました。一般公開はしていません。</p><button type="button" className={styles.primary} disabled={locked} onClick={reset}>次の編集へ</button></>:
      <><dl className={styles.review}>
        <dt>操作</dt><dd>{journal.action==='save'?'草稿の表示名を訂正':'歌唱形態を追加'}</dd>
        {journal.action==='create'&&<><dt>作品・版</dt><dd>{journal.summary.work} · {journal.summary.version}</dd></>}
        {journal.before&&<><dt>変更前の表示名</dt><dd>{journal.before.displayTitle}</dd><dt>変更前の並べ替え用表記</dt><dd>{journal.before.sortTitle??'未指定'}</dd></>}
        <dt>{journal.before?'変更後の表示名':'表示名'}</dt><dd>{String(after.displayTitle)}</dd><dt>並べ替え用表記</dt><dd>{String(after.sortTitle??'未指定')}</dd>
        {journal.action==='create'&&<><dt>歌唱者の候補</dt><dd>{journal.summary.singers.join('・')||'未選択'}{Array.isArray(vocal.unresolvedTokens)&&vocal.unresolvedTokens.length>0&&<p>未解決：{vocal.unresolvedTokens.join('・')}</p>}<p>原表記：{String(vocal.rawCredit??'未指定')} · 候補の全員確認：{vocal.setComplete?'全員を入力':'未完了'}</p></dd></>}
        <dt>出典URL</dt><dd>{String(evidence.url??'未指定')}</dd><dt>出典の箇所・範囲</dt><dd>{String(evidence.note)}</dd><dt>理由</dt><dd>{String(request?.reason)}</dd>
      </dl><p className={styles.hint}>最後のボタンでDBへ草稿保存します。掲載承認や事実の確認済みにはしません。</p>
      {journal.phase==='uncertain'&&<div role="status"><p className={styles.error}>保存済みか確認できていません。同じ保存控えを保持しています。</p><p>下のボタンで、未保存なら同じ内容を保存し、保存済みなら元の結果を取得します。</p><details><summary>相談用の保存控えを表示</summary><textarea readOnly rows={7} aria-label="相談用の保存控え" value={JSON.stringify(journal,null,2)}/></details></div>}
      <div className={styles.actions}>{journal.phase!=='uncertain'&&<button type="button" disabled={locked} onClick={()=>void back()}>{journal.phase==='failed'?'変更前・対象を読み直して編集':'入力へ戻る'}</button>}
        <button type="button" className={styles.primary} disabled={locked} onClick={()=>void save()}>{busy?'保存結果を確認中…':journal.phase==='uncertain'?'同じ内容で保存結果を確認':'草稿保存'}</button></div></>}
    </div>}
    <noscript><p>管理画面の入力・確認にはJavaScriptが必要です。</p></noscript>
  </section>;
}
