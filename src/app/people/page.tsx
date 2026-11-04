import {sitePageMetadata} from '@/lib/page-metadata';
import {PAGE_LABELS,NAME_FIELDS,EMPTY_RESULTS} from '@/lib/ui-copy.mjs';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getPeopleList} from '@/lib/person-api';
import {peopleListHref,personDetailHref,PEOPLE_SORTS,type PeopleListQuery,type PeopleListData} from '@/lib/person-detail-data.mjs';
import {pageNumber,searchTerm} from '@/lib/core';
import {Breadcrumb,Heading} from '@/components/ui';
import {detailSearchHref} from '@/lib/search-navigation.mjs';
import {withListReturnTo} from '@/lib/catalog-navigation';
import {ListSearchForm} from '@/components/list-search-form';
import {ListSort} from '@/components/list-sort';
import './people.css';

function AppliedInputs({data,search=false,sort=false}:{data:PeopleListData;search?:boolean;sort?:boolean}){
 return <>{search&&data.term&&<input type="hidden" name="q" value={data.term}/>}<input type="hidden" name="category" value={data.category}/>
  {data.kind==='group'&&<input type="hidden" name="kind" value="group"/>}{data.role!=='all'&&<input type="hidden" name="role" value={data.role}/>}
  {sort&&data.sort!=='related_desc'&&<input type="hidden" name="sort" value={data.sort}/>}{data.view==='grid'&&<input type="hidden" name="view" value="grid"/>}</>;
}
export function generateMetadata(){return sitePageMetadata('/people',PAGE_LABELS.people,{description:'ヰ世界情緒の歌唱共演者、楽曲制作やカバー原曲の関係者を探す。'});}
export default async function People({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams,one=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
 const data=await getPeopleList({category:one(query.category),kind:one(query.kind),term:searchTerm(one(query.q)),role:one(query.role),page:pageNumber(one(query.page)),sort:one(query.sort),view:one(query.view)});
 if(!data)notFound();
 const href=(overrides:PeopleListQuery={})=>peopleListHref({category:data.category,kind:data.kind,term:data.term,role:data.role,page:data.page,sort:data.sort,view:data.view,...overrides});
 const detailHref=(key:string,role?:string)=>withListReturnTo(personDetailHref(key,{role}),'/people',href());
 const appliedRole=data.roleOptions.find(r=>r.id===data.role)?.label;
 const conditions=[...(data.term?[{key:'search',label:'検索：'+data.term,href:href({term:'',page:1})}]:[]),...(data.kind==='group'?[{key:'group',label:'グループ',href:href({kind:'all',page:1})}]:[]),...(data.role!=='all'?[{key:'role',label:'担当：'+appliedRole,href:href({role:'all',page:1})}]:[])];
 return <article className="people-list-page">
  <Breadcrumb parts={[{label:PAGE_LABELS.people}]}/><Heading title={PAGE_LABELS.people}/>
  <nav className="people-list-tabs" aria-label="関わり方">{data.categories.map(c=><Link key={c.id} href={href({category:c.id,role:'all',page:1})} scroll={false} aria-current={c.id===data.category?'page':undefined}>{c.label}<small>{c.count}</small></Link>)}</nav>
  <ListSearchForm action="/people" searchValue={data.term} resetKey={href()}><div className="search-line"><input id="q" type="search" name="q" defaultValue={data.term} maxLength={100} aria-label={NAME_FIELDS.person+'を入力'} placeholder={NAME_FIELDS.person+'を入力'}/><button type="submit">検索</button><Link className="search-detail-link" href={detailSearchHref(href())}>{PAGE_LABELS.search}</Link></div><AppliedInputs data={data} sort/></ListSearchForm>
  {conditions.length>0&&<div className="catalog-applied" aria-label="適用中の条件"><span className="catalog-applied-heading">適用中</span><div className="catalog-applied-tags">{conditions.map(c=><Link key={c.key} className="catalog-applied-tag" href={c.href} aria-label={c.label+'を解除'}>{c.label}<span aria-hidden="true">×</span></Link>)}<Link className="catalog-applied-reset" href={href({term:'',kind:'all',role:'all',page:1})}>すべて解除</Link></div></div>}
  <div className="list-toolbar"><p className="toolbar-hint">{data.total}件</p><div className="catalog-toolbar-controls">
   <ListSort id="people-sort" action="/people" value={data.sort} options={PEOPLE_SORTS.map(s=>({value:s.id,label:s.label,href:href({sort:s.id,page:1})}))}><AppliedInputs data={data} search/></ListSort>
   <nav className="view-switch" aria-label="一覧の表示形式"><span>VIEW</span>{(['list','grid'] as const).map(view=><Link key={view} href={href({view})} aria-current={data.view===view?'page':undefined}>{view==='list'?'リスト':'グリッド'}</Link>)}</nav>
  </div></div>
  {data.items.length?<div className={'records records-'+data.view+' people-records'}>{data.items.map(person=><Link key={person.key} className="record people-record" href={detailHref(person.key,data.role)}><span className="record-copy"><span className="record-title">{person.name}</span><span className="record-meta">{person.type==='group'?'グループ · ':''}{person.songCount}曲</span><span className="record-meta">{(person.roles.length>3?[...person.roles.slice(0,2),'ほか']:person.roles).join('・')}</span></span><span className="record-arrow" aria-hidden="true">↗</span></Link>)}</div>:<><p className="empty">{EMPTY_RESULTS.people}</p>{data.suggestions.length>0&&<p className="people-list-suggestions">もしかして：{data.suggestions.map(person=><Link key={person.key} href={detailHref(person.key)}>{person.name}（{person.categoryLabel}）</Link>)}</p>}</>}
  {data.pages>1&&<nav className="pages" aria-label="ページ送り">{data.page>1&&<Link href={href({page:data.page-1})}>← 前のページ</Link>}<span>{data.page} / {data.pages} ページ</span>{data.page<data.pages&&<Link href={href({page:data.page+1})}>次のページ →</Link>}</nav>}
 </article>;
}
