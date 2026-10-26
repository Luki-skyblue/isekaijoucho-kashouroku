import Link from 'next/link';
import type {Metadata} from 'next';
import {Breadcrumb,Heading} from '@/components/ui';
import {CatalogFilterFields} from '@/components/catalog-filter-fields';
import {LiveFilterFields} from '@/components/live-filter-fields';
import {readCatalogQuery} from '@/lib/catalog-list-params';
import {readLiveQuery,type LiveQuery} from '@/lib/live-list-params';
import {getCatalogSingerChoices,getPeopleList} from '@/lib/person-api';
import {privateSnapshotEnabled,privateLiveFilterOptions} from '@/lib/private-snapshot';
import {publicCatalogEnabled,publicLiveFilterOptions} from '@/lib/public-catalog';
import {searchTerm} from '@/lib/core';
import {SEARCH_TARGETS,searchTarget,searchTargetHref} from '@/lib/search-navigation.mjs';
import './search.css';

export const metadata:Metadata={title:'詳細検索'};
const one=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
export default async function Search({searchParams}:{searchParams:Promise<LiveQuery>}){
 const raw=await searchParams,target=searchTarget(one(raw.target)),term=searchTerm(one(raw.q));
 let fields;
 if(target==='songs'){
  const choices=await getCatalogSingerChoices(),query=readCatalogQuery({...raw,q:term,page:'1'},choices);
  fields=<><CatalogFilterFields key={JSON.stringify(query)} query={query} choices={choices} titleSearch/>
   <Link className="search-source-link" href="/discover">公開・収録先から探す →</Link></>;
 }else if(target==='lives'){
  const query=readLiveQuery({...raw,q:term,page:'1'});
  const options=publicCatalogEnabled()?publicLiveFilterOptions():privateSnapshotEnabled()?await privateLiveFilterOptions():null;
  fields=options?<LiveFilterFields key={JSON.stringify(query)} query={query} artists={options.artists} titleSearch/>:<NameSearch target="lives" term={term} label="公演名"/>;
 }else if(target==='people'){
  const data=await getPeopleList({category:one(raw.category),term,role:one(raw.role)});
  fields=<><nav className="search-subcategories" aria-label="関係者の分類">{data?.categories.map(c=><Link key={c.id} href={'/search?'+new URLSearchParams({target:'people',category:c.id,...(term?{q:term}:{})})} aria-current={data.category===c.id?'page':undefined}>{c.label}</Link>)}</nav>
  <form className="search-detail-form" action="/people" method="get">
   <label>名前<input type="search" name="q" defaultValue={term} maxLength={100} placeholder="名前・別名で検索"/></label>
   <input type="hidden" name="category" value={data?.category??'artists'}/>
   {data?.category==='creators'&&<label>担当<select name="role" defaultValue={data.role}>{data.roleOptions.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>}
   <button type="submit">検索</button>
  </form></>;
 }else{
  fields=<form className="search-detail-form" action="/releases" method="get">
   <label>作品名<input type="search" name="q" defaultValue={term} maxLength={100}/></label>
   <label>分類<select name="category" defaultValue={one(raw.category)==='live'?'live':'music'}><option value="music">リリース</option><option value="live">LIVE音源・映像</option></select></label>
   {one(raw.view)==='grid'&&<input type="hidden" name="view" value="grid"/>}
   <button type="submit">検索</button>
  </form>;
 }
 return <article className="search-detail-page"><Breadcrumb parts={[{label:'詳細検索'}]}/><Heading title="詳細検索"/>
  <p className="search-development-note">詳細検索は整備中です。登録情報の不足により、結果に漏れがある場合があります。</p>
  <nav className="search-targets" aria-label="検索する対象">{SEARCH_TARGETS.map(t=><Link key={t.id} href={searchTargetHref(t.id,term)} aria-current={target===t.id?'page':undefined}>{t.label}</Link>)}</nav>
  {fields}
 </article>;
}
function NameSearch({target,term,label}:{target:'lives';term:string;label:string}){
 return <form className="search-detail-form" action={'/'+target} method="get"><label>{label}<input type="search" name="q" defaultValue={term} maxLength={100}/></label><button type="submit">検索</button></form>;
}
