'use client';

import {useState} from 'react';
import {CatalogHelp} from '@/components/catalog-help';
import {LIVE_FORMATS,type LiveFormat,type LiveArtist,type ParsedLiveQuery} from '@/lib/live-list-params';

export function LiveFilterFields({query,artists,titleSearch=false}:{query:ParsedLiveQuery;artists:LiveArtist[];titleSearch?:boolean}) {
 const [chosen,setChosen]=useState(query.artistIds),[scope,setScope]=useState(query.artistScope),[match,setMatch]=useState(query.artistMatch);
 const [formats,setFormats]=useState(query.formats),[lookup,setLookup]=useState('');
 const same=(a:string[],b:string[])=>a.length===b.length&&a.every(x=>b.includes(x));
 const dirty=!same(chosen,query.artistIds)||scope!==query.artistScope||match!==query.artistMatch||!same(formats,query.formats);
 const mainNames=['ヰ世界情緒','V.W.P','花譜','理芽','春猿火','幸祜'];
 const main=mainNames.flatMap(name=>artists.filter(a=>a.name===name)),others=artists.filter(a=>!mainNames.includes(a.name));
 const visible=others.filter(a=>a.name.toLocaleLowerCase().includes(lookup.trim().toLocaleLowerCase()));
 const toggle=(id:string,checked:boolean)=>setChosen(old=>checked?[...new Set([...old,id])]:old.filter(x=>x!==id));
 const toggleFormat=(id:LiveFormat,checked:boolean)=>setFormats(old=>checked?[...new Set([...old,id])]:old.filter(x=>x!==id));
 return <form action="/lives" method="get" className="catalog-filter-fields">
  {titleSearch?<label className="search-detail-title">公演名<input type="search" name="q" defaultValue={query.q} maxLength={100}/></label>:query.q&&<input type="hidden" name="q" value={query.q}/>}
  <input type="hidden" name="view" value={query.view}/><input type="hidden" name="sort" value={query.sort}/>
  <input type="hidden" name="artistScope" value={scope}/><input type="hidden" name="artistMatch" value={match}/>
  {chosen.map(id=><input key={id} type="hidden" name="artist" value={id}/>)}
  {formats.map(kind=><input key={kind} type="hidden" name="type" value={kind}/>)}
  <fieldset className="catalog-filter-group catalog-singer-set"><legend>アーティスト</legend>
   <CatalogHelp label="LIVEのアーティスト選択の説明" href="/guide#live-filters"><strong>公演名義と出演者</strong>
    <p>公演名義：「誰の公演か」で探します。ヰ世界情緒のワンマンとV.W.Pのワンマンを分けて探せます。</p>
    <p>出演者：ゲストを含む出演記録で探します。V.W.P名義と個々の出演者は別に扱います。</p>
    <p>「全員」は同じ公演のどこかに全員の記録がある条件です。同じ開催回・曲への共演を意味しません。</p>
   </CatalogHelp>
   <div className="catalog-match-line"><label htmlFor="live-artist-scope">探し方：</label><select id="live-artist-scope" value={scope} onChange={e=>setScope(e.target.value as typeof scope)}>
    <option value="billing">公演名義で探す</option><option value="appearance">出演者で探す（ゲスト含む）</option>
   </select></div>
   <div className="catalog-singer-options">{main.map(a=><label key={a.entityId}><input type="checkbox" checked={chosen.includes(a.entityId)} onChange={e=>toggle(a.entityId,e.target.checked)}/>{a.name}</label>)}</div>
   {others.length>0&&<div className="catalog-more-picker"><details className="catalog-more-details"><summary>その他のアーティストを選ぶ <span aria-hidden="true">⌄</span></summary><div className="catalog-more-popover">
    <label className="catalog-other-search-label" htmlFor="live-artist-search">アーティストを探す</label><input id="live-artist-search" type="search" value={lookup} onChange={e=>setLookup(e.target.value)} placeholder="名前で検索" autoComplete="off"/>
    <div className="catalog-other-results">{visible.map(a=><label key={a.entityId} className="catalog-other-choice"><input type="checkbox" checked={chosen.includes(a.entityId)} onChange={e=>toggle(a.entityId,e.target.checked)}/>{a.name}</label>)}{!visible.length&&<p className="catalog-other-empty">候補がありません。</p>}</div>
   </div></details>{chosen.filter(id=>!main.some(a=>a.entityId===id)).length>0&&<p className="catalog-draft-singers"><span>選択中：</span>{chosen.filter(id=>!main.some(a=>a.entityId===id)).map(id=><span className="catalog-draft-name" key={id}>{artists.find(a=>a.entityId===id)?.name??'登録のないアーティスト'}</span>)}</p>}</div>}
   <div className="catalog-match-line"><label htmlFor="live-artist-match">選択したアーティスト：</label><select id="live-artist-match" value={match} onChange={e=>setMatch(e.target.value as typeof match)}><option value="any">いずれかを含む</option><option value="all">全員を含む</option></select></div>
  </fieldset>
  <fieldset className="catalog-filter-group catalog-category-set"><legend>公演区分</legend>
   <div className="catalog-category-options">{LIVE_FORMATS.map(f=><label key={f.id}><input type="checkbox" checked={formats.includes(f.id)} onChange={e=>toggleFormat(f.id,e.target.checked)}/>{f.label}</label>)}</div>
   <p className="catalog-filter-help">複数選択はいずれかに該当。未選択なら区分では絞り込みません。未分類は順次整備します。</p>
  </fieldset>
  <div className="catalog-filter-actions"><button type="submit">{titleSearch?'検索':'適用'}</button><button type="button" className="catalog-filter-clear" onClick={()=>{setChosen([]);setFormats([]);setMatch('any');setLookup('');}}>選択をクリア</button>{dirty&&<span className="catalog-filter-pending" role="status">未適用の変更あり<small>「{titleSearch?'検索':'適用'}」で結果に反映</small></span>}</div>
 </form>;
}
