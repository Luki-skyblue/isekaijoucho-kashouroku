'use client';

import {useMemo,useState} from 'react';
import {CatalogHelp} from '@/components/catalog-help';
import {MAIN_SINGERS,OTHER_SINGER_GROUPS,OTHER_SINGERS,CATEGORIES,type ParsedCatalogQuery} from '@/lib/catalog-list-params';
import type {SingerMatch,CatalogCategory} from '@/lib/catalog-entry-api';

/** Draft filter state is local to this form. Only form submit changes the URL
 * and server-side results; applied tags remain sourced from the URL.
 */
export function CatalogFilterFields({query}:{query:ParsedCatalogQuery}){
 const [chosen,setChosen]=useState<string[]>(query.singerIds);
 const [match,setMatch]=useState<SingerMatch>(query.singerMatch);
 const [kinds,setKinds]=useState<CatalogCategory[]>(query.kinds);
 const [lookup,setLookup]=useState('');
 const others=OTHER_SINGERS.filter(s=>chosen.includes(s.id));
 const dirty=useMemo(()=>{
  const same=(a:readonly string[],b:readonly string[])=>a.length===b.length&&a.every(x=>b.includes(x));
  return !same(chosen,query.singerIds)||match!==query.singerMatch||!same(kinds,query.kinds);
 },[chosen,kinds,match,query.singerIds,query.kinds,query.singerMatch]);
 const toggleSinger=(id:string,checked:boolean)=>setChosen(old=>checked?old.includes(id)?old:[...old,id]:old.filter(x=>x!==id));
 const toggleKind=(id:CatalogCategory,checked:boolean)=>setKinds(old=>checked?old.includes(id)?old:[...old,id]:old.filter(x=>x!==id));
 const clearSelection=()=>{setChosen([]);setKinds([]);setMatch('any');setLookup('');};
 return <form method="get" action="/songs" className="catalog-filter-fields">
  {query.q&&<input type="hidden" name="q" value={query.q}/>}
  <input type="hidden" name="view" value={query.view}/>
  {query.sort==='title_desc'&&<input type="hidden" name="sort" value="title_desc"/>}
  {chosen.map(id=><input key={id} type="hidden" name="singer" value={id}/>)}
  <input type="hidden" name="singerMatch" value={match}/>
  {kinds.map(id=><input key={id} type="hidden" name="type" value={id}/>)}
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
   <div className="catalog-singer-options">{MAIN_SINGERS.map(s=><label key={s.id}>
    <input type="checkbox" checked={chosen.includes(s.id)} onChange={e=>toggleSinger(s.id,e.target.checked)}/>{s.name}
   </label>)}</div>
   <div className="catalog-more-picker">
    <details className="catalog-more-details">
     <summary>その他の歌唱者を選ぶ <span aria-hidden="true">⌄</span></summary>
     <div className="catalog-more-popover">
      <label className="catalog-other-search-label" htmlFor="catalog-other-singer-search">歌唱者を探す</label>
      <input id="catalog-other-singer-search" type="search" value={lookup} onChange={e=>setLookup(e.target.value)} placeholder="名前で検索" autoComplete="off"/>
      <div className="catalog-other-results">
       {OTHER_SINGER_GROUPS.map(group=>{
        const matching=group.members.filter(s=>s.name.toLocaleLowerCase().includes(lookup.trim().toLocaleLowerCase()));
        return matching.length?<div className="catalog-other-group" key={group.label}>
         <p>{group.label}</p>
         {matching.map(s=><label key={s.id} className="catalog-other-choice">
          <input type="checkbox" checked={chosen.includes(s.id)} onChange={e=>toggleSinger(s.id,e.target.checked)}/>{s.name}
         </label>)}
        </div>:null;
       })}
       {OTHER_SINGER_GROUPS.every(g=>g.members.every(s=>!s.name.toLocaleLowerCase().includes(lookup.trim().toLocaleLowerCase())))&&
        <p className="catalog-other-empty">候補がありません。</p>}
      </div>
     </div>
    </details>
    {others.length>0&&<p className="catalog-draft-singers"><span>選択中：</span>{others.map(s=><span className="catalog-draft-name" key={s.id}>{s.name}</span>)}</p>}
   </div>
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
   </CatalogHelp>
   <div className="catalog-category-options">{CATEGORIES.filter(x=>x.id!=='medley').map(x=><label key={x.id}>
    <input type="checkbox" checked={kinds.includes(x.id)} onChange={e=>toggleKind(x.id,e.target.checked)}/>{x.label}
   </label>)}</div>
   <p className="catalog-filter-help">複数選択はOR検索。未選択なら全件表示。</p>
  </fieldset>
  <div className="catalog-filter-actions">
   <button type="submit">適用</button>
   <button type="button" className="catalog-filter-clear" onClick={clearSelection}>選択をクリア</button>
   {dirty&&<span className="catalog-filter-pending" role="status">未適用の変更あり<small>「適用」で結果に反映</small></span>}
  </div>
 </form>;
}
