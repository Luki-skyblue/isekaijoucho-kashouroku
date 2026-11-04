'use client';
import {NAME_FIELDS} from '@/lib/ui-copy.mjs';

import {useMemo,useState} from 'react';
import {CatalogHelp} from '@/components/catalog-help';
import {MAIN_SINGERS,SINGERS,CATEGORIES,DEFAULT_CATALOG_SORT,type ParsedCatalogQuery,type SingerChoice} from '@/lib/catalog-list-params';
import {catalogNameMatches} from '@/lib/catalog-name-search.mjs';
import type {SingerMatch,CatalogCategory} from '@/lib/catalog-entry-api';
import {CATALOG_SOURCE_OPTIONS,type CatalogSourceKind} from '@/lib/catalog-source-options.mjs';
import {readFirstRange,validFirstDate} from '@/lib/catalog-advanced-query.mjs';
import type {CreditFilterChoices} from '@/lib/person-detail-data.mjs';

/** Draft filter state is local to this form. Only form submit changes the URL
 * and server-side results; applied tags remain sourced from the URL.
 */
export function CatalogFilterFields({query,choices=SINGERS,titleSearch=false,sourceSearch=false,creditChoices}:{query:ParsedCatalogQuery;choices?:ReadonlyArray<SingerChoice>;titleSearch?:boolean;sourceSearch?:boolean;creditChoices?:CreditFilterChoices}){
 const [chosen,setChosen]=useState<string[]>(query.singerIds);
 const [match,setMatch]=useState<SingerMatch>(query.singerMatch);
 const [kinds,setKinds]=useState<CatalogCategory[]>(query.kinds);
 const [sources,setSources]=useState<CatalogSourceKind[]>(query.sourceKinds??[]);
 const [lookup,setLookup]=useState('');
 const [creator,setCreator]=useState(query.creatorKey??''),[creditRole,setCreditRole]=useState(query.creditRole??'');
 const [firstFrom,setFirstFrom]=useState(query.firstFrom??''),[firstTo,setFirstTo]=useState(query.firstTo??'');
 const [creatorLookup,setCreatorLookup]=useState('');
 const selectedCreator=creditChoices?.people.find(p=>p.key===creator);
 const creatorOptions=creditChoices?.people.filter(p=>p.key===creator||catalogNameMatches(p,creatorLookup)||p.jointLabels.some(label=>catalogNameMatches({name:label},creatorLookup)&&catalogNameMatches({name:creatorLookup},label)))??[];
 const roleOptions=creditChoices?.roles.filter(r=>!selectedCreator||selectedCreator.roles.includes(r.id)||r.id===creditRole)??[];
 const dateError=readFirstRange(firstFrom,firstTo).dateError;
 const mainIds=new Set<string>(MAIN_SINGERS.map(s=>s.id)),main=choices.filter(s=>mainIds.has(s.id));
 const otherChoices=choices.filter(s=>!mainIds.has(s.id)),others=otherChoices.filter(s=>chosen.includes(s.id));
 const groupNames=[...new Set(otherChoices.map(s=>s.group??'その他の歌唱者'))];
 const groups=groupNames.map(label=>({label,members:otherChoices.filter(s=>(s.group??'その他の歌唱者')===label&&catalogNameMatches(s,lookup))})).filter(g=>g.members.length);
 const dirty=useMemo(()=>{
  const same=(a:readonly string[],b:readonly string[])=>a.length===b.length&&a.every(x=>b.includes(x));
  return !same(chosen,query.singerIds)||match!==query.singerMatch||!same(kinds,query.kinds)||!same(sources,query.sourceKinds??[])||creator!==(query.creatorKey??'')||creditRole!==(query.creditRole??'')||firstFrom!==(query.firstFrom??'')||firstTo!==(query.firstTo??'');
 },[chosen,kinds,sources,match,creator,creditRole,firstFrom,firstTo,query]);
 const toggleSinger=(id:string,checked:boolean)=>setChosen(old=>checked?old.includes(id)||old.length>=20?old:[...old,id]:old.filter(x=>x!==id));
 const toggleKind=(id:CatalogCategory,checked:boolean)=>setKinds(old=>checked?old.includes(id)?old:[...old,id]:old.filter(x=>x!==id));
 const toggleSource=(id:CatalogSourceKind,checked:boolean)=>setSources(old=>checked?old.includes(id)?old:[...old,id]:old.filter(x=>x!==id));
 const clearSelection=()=>{setChosen([]);setKinds([]);setSources([]);setMatch('any');setLookup('');setCreator('');setCreditRole('');setFirstFrom('');setFirstTo('');setCreatorLookup('');};
 return <form method="get" action="/songs" className="catalog-filter-fields">
  {titleSearch?<label className="search-detail-title">{NAME_FIELDS.song}<input type="search" name="q" defaultValue={query.q} maxLength={100} placeholder="楽曲名・メドレーの構成曲名"/></label>:query.q&&<input type="hidden" name="q" value={query.q}/>}
  <input type="hidden" name="view" value={query.view}/>
  {query.sort!==DEFAULT_CATALOG_SORT&&<input type="hidden" name="sort" value={query.sort}/>}
  {chosen.map(id=><input key={id} type="hidden" name="singer" value={id}/>)}
  <input type="hidden" name="singerMatch" value={match}/>
  {kinds.map(id=><input key={id} type="hidden" name="type" value={id}/>)}
  {sources.map(id=><input key={id} type="hidden" name="source" value={id}/>)}
  {creator&&<input type="hidden" name="creator" value={creator}/>}{creditRole&&<input type="hidden" name="creditRole" value={creditRole}/>}
  {(!sourceSearch||!creditChoices)&&<>{firstFrom&&<input type="hidden" name="firstFrom" value={firstFrom}/>}{firstTo&&<input type="hidden" name="firstTo" value={firstTo}/>}</>}
  <fieldset className="catalog-filter-group catalog-singer-set">
   <legend>歌唱者</legend>
   <CatalogHelp label="歌唱者フィルターの説明" href="/guide#singer-filters">
    <strong>4つの一致条件</strong>
    <p>完全一致：選択した人だけが全員参加</p>
    <p>いずれかを含む：選択した人のうち1人以上が参加</p>
    <p>全員を含む：選択した全員が参加（他の人がいても可）</p>
    <p>のみから構成：選択した人の一部だけでも可。他の人がいない曲</p>
    <p>歌唱者集合に未解決部分がある曲は「完全一致」「のみから構成」の対象外です。</p>
   </CatalogHelp>
   <div className="catalog-singer-options">{main.map(s=><label key={s.id}>
    <input type="checkbox" checked={chosen.includes(s.id)} disabled={!chosen.includes(s.id)&&chosen.length>=20} onChange={e=>toggleSinger(s.id,e.target.checked)}/>{s.name}
   </label>)}</div>
   <div className="catalog-more-picker">
    <details className="catalog-more-details">
     <summary>その他の歌唱者を選ぶ <span aria-hidden="true">⌄</span></summary>
     <div className="catalog-more-popover">
      <label className="catalog-other-search-label" htmlFor="catalog-other-singer-search">歌唱者を探す</label>
      <input id="catalog-other-singer-search" type="search" value={lookup} onChange={e=>setLookup(e.target.value)} placeholder="名前・別名で検索" autoComplete="off"/>
      <div className="catalog-other-results">
       {groups.map(group=>{
        return <div className="catalog-other-group" key={group.label}>
         <p>{group.label}</p>
         {group.members.map(s=><label key={s.id} className="catalog-other-choice">
          <input type="checkbox" checked={chosen.includes(s.id)} disabled={!chosen.includes(s.id)&&chosen.length>=20} onChange={e=>toggleSinger(s.id,e.target.checked)}/>{s.name}
         </label>)}
        </div>;
       })}
       {groups.length===0&&
        <p className="catalog-other-empty">候補がありません。</p>}
      </div>
     </div>
    </details>
    {others.length>0&&<p className="catalog-draft-singers"><span>選択中：</span>{others.map(s=><span className="catalog-draft-name" key={s.id}>{s.name}</span>)}</p>}
   </div>
   {chosen.length>=20&&<p className="catalog-filter-help">一度に20名まで選択できます。</p>}
   <div className="catalog-match-line"><label htmlFor="catalog-singer-match">選択した歌唱者：</label>
    <select id="catalog-singer-match" value={match} onChange={e=>setMatch(e.target.value as SingerMatch)}>
     <option value="only">完全一致</option>
     <option value="any">いずれかを含む</option>
     <option value="contains">全員を含む</option>
     <option value="subset">のみから構成</option>
    </select>
   </div>
  </fieldset>
  <fieldset className="catalog-filter-group catalog-category-set">
   <legend>楽曲区分</legend>
   <CatalogHelp label="楽曲区分の説明" href="/guide#categories">
    <strong>区分の組み合わせ</strong>
    <p>複数チェックすると、いずれかに当てはまる曲を表示します（OR）。歌唱者や曲名とはさらに絞り込みます（AND）。</p>
    <p>メンバーカバーには「ソロ」も含みます。</p>
   </CatalogHelp>
   <div className="catalog-category-options">{CATEGORIES.filter(x=>x.id!=='medley').map(x=><label key={x.id}>
    <input type="checkbox" checked={kinds.includes(x.id)} onChange={e=>toggleKind(x.id,e.target.checked)}/>{x.label}
   </label>)}</div>
   <p className="catalog-filter-help">複数選択はOR検索。未選択なら全件表示。</p>
  </fieldset>
  {sourceSearch&&<fieldset className="catalog-filter-group catalog-source-set">
   <legend>公開・収録先</legend>
   <CatalogHelp label="公開・収録先の説明" href="/guide#source-filters">
    <strong>登録されている公開・収録先</strong>
    <p>複数選択はいずれかに当てはまる曲。歌唱者・楽曲区分・曲名とは、さらに絞り込みます。</p>
    <p>LIVE・配信は披露の記録です。動画や商品が残っていること、全編を聴けることとは別です。</p>
   </CatalogHelp>
   <div className="catalog-category-options">{CATALOG_SOURCE_OPTIONS.map(o=><label key={o.id}>
    <input type="checkbox" checked={sources.includes(o.id)} onChange={e=>toggleSource(o.id,e.target.checked)}/>{o.label}
   </label>)}</div>
   <p className="catalog-filter-help">複数選択はOR検索。未選択なら全件表示。</p>
  </fieldset>}
  {sourceSearch&&creditChoices&&<>
   <fieldset className="catalog-filter-group catalog-credit-set">
    <legend>制作クレジット</legend>
    <CatalogHelp label="制作クレジットの説明" href="/guide#credit-date-filters">
     <strong>担当者と、その人の担当で絞り込む</strong>
     <p>「作曲」と「原曲の作曲」は別の条件です。担当者だけ、担当だけでも検索できます。</p>
    </CatalogHelp>
    <div className="catalog-credit-controls">
     <div className="catalog-credit-person"><label htmlFor="catalog-creator-lookup">担当者<input id="catalog-creator-lookup" type="search" value={creatorLookup} onChange={e=>setCreatorLookup(e.target.value)} placeholder="名前・別名で候補を絞る" autoComplete="off"/></label>
      <label className="sr-only" htmlFor="catalog-creator-select">担当者を選ぶ</label><select id="catalog-creator-select" value={creator} required={!!creatorLookup&&!creator} onChange={e=>setCreator(e.target.value)}>
       <option value="">指定なし</option>{creator&&!selectedCreator&&<option value={creator}>指定した名義（未登録）</option>}{creatorOptions.map(p=><option key={p.key} value={p.key}>{p.name}</option>)}
      </select>
      {creatorLookup&&!creator&&<p className="catalog-filter-help">候補から担当者を選択してください。</p>}
     </div>
     <label>担当<select value={creditRole} onChange={e=>setCreditRole(e.target.value)}>
      <option value="">すべての担当</option>{creditRole&&!roleOptions.some(r=>r.id===creditRole)&&<option value={creditRole}>指定した担当（未登録）</option>}
      {[{id:'music',label:'楽曲制作'},{id:'cover_source',label:'カバー原曲'},{id:'production',label:'動画・音源制作'}].map(group=>{const roles=roleOptions.filter(r=>r.category===group.id);return roles.length?<optgroup key={group.id} label={group.label}>{roles.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</optgroup>:null;})}
     </select></label>
    </div>
   </fieldset>
   <fieldset className="catalog-filter-group catalog-date-set">
    <legend>初出</legend>
    <div className="catalog-date-controls"><label>開始<input type="date" name="firstFrom" value={firstFrom} max={validFirstDate(firstTo)?firstTo:undefined} aria-invalid={!!dateError} onChange={e=>setFirstFrom(e.target.value)}/></label><label>終了<input type="date" name="firstTo" value={firstTo} min={validFirstDate(firstFrom)?firstFrom:undefined} aria-invalid={!!dateError} onChange={e=>setFirstTo(e.target.value)}/></label></div>
    {dateError&&<p className="catalog-filter-error" role="alert">{dateError}</p>}
   </fieldset>
  </>}
  <div className="catalog-filter-actions">
   <button type="submit" disabled={!!dateError}>{titleSearch?'検索':'適用'}</button>
   <button type="button" className="catalog-filter-clear" onClick={clearSelection}>選択をクリア</button>
   {dirty&&<span className="catalog-filter-pending" role="status">未適用の変更あり<small>「{titleSearch?'検索':'適用'}」で結果に反映</small></span>}
  </div>
 </form>;
}
