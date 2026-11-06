'use client';
import {useEffect,useId,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {SEARCH_FIELDS,SEARCH_LIMITS,SEARCH_SORTS,fieldFor,operatorsFor,emptySearchRule,emptySearchTree,validateSearchTree,combinedSearchHref,type SearchChoices,type SearchNode,type SearchGroup,type SearchRule,type SearchTarget,type CombinedSearchQuery} from '@/lib/combined-search-query.mjs';

const identify=(node:SearchNode,prefix:string):SearchNode=>({...node,_id:prefix,...(node.type==='group'?{children:node.children.map((c,i)=>identify(c,`${prefix}-${i}`))}:{})});
const initialDraft=(tree:SearchGroup|null,target:SearchTarget)=>identify(tree?.children.length?tree:{...emptySearchTree(),children:[emptySearchRule(target)]},target) as SearchGroup;
const cleanDraft=(tree:SearchGroup)=>({...tree,children:tree.children.filter(c=>!(c.type==='rule'&&c.field==='keyword'&&c.op==='contains'&&typeof c.value==='string'&&!c.value.trim()))});
const serialized=(tree:SearchGroup,target:SearchTarget)=>JSON.stringify(validateSearchTree(cleanDraft(tree),target).tree??cleanDraft(tree),(_k,v)=>_k==='_id'?undefined:v);
// Native date/number edits may finish on blur. Submit the values actually in
// the form, even if a browser has not delivered its final change event yet.
function formRanges(node:SearchNode,target:SearchTarget,form:FormData):SearchNode{
 if(node.type==='group')return {...node,children:node.children.map(n=>formRanges(n,target,form))};
 const def=fieldFor(target,node.field);if(!['date','number'].includes(def?.kind??'')||['exists','missing'].includes(node.op))return node;
 return {...node,value:{from:String(form.get(`range-${node._id}-from`)??''),to:node.op==='between'?String(form.get(`range-${node._id}-to`)??''):''}};
}

function ChoicePicker({label,options,selected,onChange,single=false}:{label:string;options:SearchChoices[string];selected:string[];onChange:(ids:string[])=>void;single?:boolean}){
 const id=useId(),[filter,setFilter]=useState('');
 const normalize=(text:string)=>text.normalize('NFKC').toLocaleLowerCase('ja').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
 const normalized=normalize(filter).trim();
 const matching=options.filter(o=>!normalized||[o.label,...(o.aliases??[])].some(s=>normalize(s).includes(normalized)));
 const selectedLabels=selected.map(v=>options.find(o=>o.id===v)?.label??'登録情報にない選択');
 return <details className="search-choice"><summary><span>{selectedLabels.length?selectedLabels.slice(0,2).join('・')+(selectedLabels.length>2?` ほか${selectedLabels.length-2}件`:''):label+'を選択'}</span><span aria-hidden="true">⌄</span></summary>
  <div className="search-choice-panel"><label className="search-control-label" htmlFor={id}>候補を絞る<input id={id} type="search" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="名前・キーワード" autoComplete="off"/></label>
   <div className="search-choice-info"><span>{selected.length}件選択</span><button type="button" onClick={()=>onChange([])} disabled={!selected.length}>選択をクリア</button></div>
   <fieldset className="search-choice-options"><legend className="sr-only">{label}</legend>
    {single&&<label><input type="radio" name={id} checked={!selected.length} onChange={()=>onChange([])}/>指定なし</label>}
    {matching.map(o=><label key={o.id}><input type={single?'radio':'checkbox'} name={single?id:undefined} checked={selected.includes(o.id)} onChange={e=>onChange(single?[o.id]:e.target.checked?[...selected,o.id]:selected.filter(v=>v!==o.id))}/><span>{o.label}</span></label>)}
    {!matching.length&&<p className="search-help">候補が見つかりません。</p>}
   </fieldset>
  </div>
 </details>;
}
function RuleEditor({rule,target,choices,onChange,onRemove}:{rule:SearchRule;target:SearchTarget;choices:SearchChoices;onChange:(node:SearchRule)=>void;onRemove:()=>void}){
 const def=fieldFor(target,rule.field)??SEARCH_FIELDS[target][0],id=useId();
 const pair=typeof rule.value==='object'&&!Array.isArray(rule.value)?rule.value:null;
 const range=pair&&'from'in pair?pair:{from:'',to:''},credit=pair&&'person'in pair?pair:{person:'',role:''};
 const hasValue=!['exists','missing'].includes(rule.op);
 return <div className="search-rule">
  <div className="search-rule-fields"><label className="search-control-label" htmlFor={id+'-field'}>項目<select id={id+'-field'} value={def.id} onChange={e=>onChange({...emptySearchRule(target,e.target.value),_id:rule._id})}>{SEARCH_FIELDS[target].map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
   <label className="search-control-label" htmlFor={id+'-op'}>条件<select id={id+'-op'} value={rule.op} onChange={e=>onChange({...rule,op:e.target.value,value:rule.value??emptySearchRule(target,rule.field).value})}>{operatorsFor(def).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
  </div>
  {hasValue&&<div className="search-rule-value">
   {def.kind==='text'&&<label className="search-control-label" htmlFor={id+'-value'}>{def.label}<input id={id+'-value'} type="search" value={typeof rule.value==='string'?rule.value:''} maxLength={SEARCH_LIMITS.text} placeholder={def.id==='keyword'?'曲名・人名・作品名など':def.label+'を入力'} onChange={e=>onChange({...rule,value:e.target.value})}/></label>}
   {def.kind==='set'&&<ChoicePicker label={def.label} options={choices[def.choices!]??[]} selected={Array.isArray(rule.value)?rule.value:[]} onChange={value=>onChange({...rule,value})}/>}
   {def.kind==='credit'&&<div className="search-credit-pair"><ChoicePicker label="担当者" options={choices.creators??[]} selected={credit.person?[credit.person]:[]} single onChange={value=>onChange({...rule,value:{...credit,person:value[0]??''}})}/><ChoicePicker label="担当" options={choices.creditRoles??[]} selected={credit.role?[credit.role]:[]} single onChange={value=>onChange({...rule,value:{...credit,role:value[0]??''}})}/></div>}
   {(def.kind==='date'||def.kind==='number')&&<div className="search-range"><label className="search-control-label" htmlFor={id+'-from'}>{rule.op==='between'?'開始':def.label}<input id={id+'-from'} name={`range-${rule._id}-from`} type={def.kind==='date'?'date':'number'} min={def.kind==='number'?0:undefined} step={def.kind==='number'?1:undefined} value={range.from} onChange={e=>onChange({...rule,value:{...range,from:e.target.value}})}/></label>{rule.op==='between'&&<><span aria-hidden="true">〜</span><label className="search-control-label" htmlFor={id+'-to'}>終了<input id={id+'-to'} name={`range-${rule._id}-to`} type={def.kind==='date'?'date':'number'} min={def.kind==='number'?0:undefined} step={def.kind==='number'?1:undefined} value={range.to} onChange={e=>onChange({...rule,value:{...range,to:e.target.value}})}/></label></>}</div>}
  </div>}
  <button type="button" className="search-remove" aria-label={`${def.label}の条件を削除`} onClick={onRemove}>削除</button>
 </div>;
}
function GroupEditor({group,target,choices,onChange,onRemove,newId,depth=0}:{group:SearchGroup;target:SearchTarget;choices:SearchChoices;onChange:(node:SearchGroup)=>void;onRemove?:()=>void;newId:()=>string;depth?:number}){
 const id=useId();
 const replace=(index:number,node:SearchNode)=>onChange({...group,children:group.children.map((c,i)=>i===index?node:c)});
 return <fieldset className={'search-group'+(depth?' search-group-nested':'')}><legend>{depth?'条件のまとまり':'検索条件'}</legend>
  <div className="search-group-heading"><label className="search-match" htmlFor={id+'-match'}><span>この中の</span><select id={id+'-match'} value={group.match} onChange={e=>onChange({...group,match:e.target.value as 'all'|'any'})}><option value="all">すべてに一致</option><option value="any">いずれかに一致</option></select></label><label className="search-negate"><input type="checkbox" checked={group.not} onChange={e=>onChange({...group,not:e.target.checked})}/>一致するものを除外</label>{onRemove&&<button type="button" className="search-remove" onClick={onRemove}>まとまりを削除</button>}</div>
  <div className="search-group-children">{group.children.map((child,i)=>child.type==='group'?<GroupEditor key={child._id} group={child} target={target} choices={choices} depth={depth+1} newId={newId} onChange={n=>replace(i,n)} onRemove={()=>onChange({...group,children:group.children.filter((_,at)=>at!==i)})}/>:<RuleEditor key={child._id} rule={child} target={target} choices={choices} onChange={n=>replace(i,n)} onRemove={()=>onChange({...group,children:group.children.filter((_,at)=>at!==i)})}/>)}</div>
  <div className="search-add-actions"><button type="button" onClick={()=>onChange({...group,children:[...group.children,{...emptySearchRule(target,depth?'title':'keyword'),_id:newId()}]})}>＋ 条件を追加</button>{depth<SEARCH_LIMITS.depth-2&&<button type="button" onClick={()=>onChange({...group,children:[...group.children,{...emptySearchTree(),_id:newId(),children:[{...emptySearchRule(target,'title'),_id:newId()}]}]})}>＋ まとまりを追加</button>}</div>
 </fieldset>;
}
export function CombinedSearchBuilder({query,choices}:{query:CombinedSearchQuery;choices:SearchChoices}){
 const router=useRouter(),[pending,startTransition]=useTransition(),counter=useRef(0),newId=()=>`added-${++counter.current}`;
 const [draft,setDraft]=useState(()=>initialDraft(query.tree,query.target)),[errors,setErrors]=useState<string[]>([]),errorRef=useRef<HTMLDivElement>(null),submitted=useRef(false);
 const applied=JSON.stringify(query.tree),target=query.target;
 useEffect(()=>{setDraft(initialDraft(query.tree,target));setErrors([]);if(submitted.current){document.getElementById('search-results')?.focus({preventScroll:true});document.getElementById('search-results')?.scrollIntoView({behavior:'smooth',block:'start'});submitted.current=false;}},[applied,target]); // Sort/view/page changes keep an unapplied draft.
 const dirty=serialized(draft,target)!==JSON.stringify(query.tree??emptySearchTree());
 function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const current=formRanges(draft,target,new FormData(e.currentTarget)) as SearchGroup;setDraft(current);const checked=validateSearchTree(cleanDraft(current),target);if(checked.errors.length){setErrors(checked.errors);requestAnimationFrame(()=>errorRef.current?.focus());return;}
  try{const href=combinedSearchHref({...query,tree:checked.tree,page:1});setErrors([]);submitted.current=true;startTransition(()=>router.push(href,{scroll:false}));}catch(error){setErrors([error instanceof Error?error.message:'条件を確認してください。']);requestAnimationFrame(()=>errorRef.current?.focus());}
 }
 const quick=target==='songs'?[['source','公開・収録先'],['singer','歌唱者'],['credit','制作担当'],['first_date','初出日']]:[];
 return <form className="combined-search-form" onSubmit={submit} noValidate aria-busy={pending} inert={pending}>
  <p className="search-help">キーワードは曲名・人名・作品名など、登録されている情報から探します。</p>
  {errors.length>0&&<div className="search-errors" role="alert" ref={errorRef} tabIndex={-1}><p>条件を確認してください。</p><ul>{errors.map(x=><li key={x}>{x}</li>)}</ul></div>}
  <GroupEditor group={draft} target={target} choices={choices} onChange={setDraft} newId={newId}/>
  {quick.length>0&&<div className="search-quick"><span>条件を追加：</span>{quick.map(([field,label])=><button type="button" key={field} onClick={()=>setDraft(d=>({...d,children:[...d.children,{...emptySearchRule(target,field),_id:newId()}]}))}>{label}</button>)}</div>}
  <details className="search-help-details"><summary>条件の組み合わせ方</summary><p>「すべて」は条件を絞り込み、「いずれか」は候補を広げます。まとまりを追加すると、例えば「YouTubeかCD・配信にある」かつ「初出が2024年以降」のように組み合わせられます。</p><p>「含まない」や除外は、その項目に登録があるものが対象です。情報が空のものは「登録なし」で探せます。所属グループや別名義のクレジットは自動で合算しません。歌唱者の「この組合せのみ」「この中の人だけ」は、歌唱者全員を確認できている曲が対象です。</p><p>公開・収録先は登録情報による分類です。現在の視聴可否は未確認のものを含みます。</p></details>
  <div className="search-submit"><button type="submit" className="search-primary" disabled={pending}>{pending?'検索中…':'この条件で検索'}</button><button type="button" onClick={()=>{setDraft(initialDraft(emptySearchTree(),target));setErrors([]);}}>入力をクリア</button>{dirty&&<button type="button" onClick={()=>{setDraft(initialDraft(query.tree,target));setErrors([]);}}>適用中に戻す</button>}<span className="search-draft-status" role="status">{dirty?'未適用の変更があります':''}</span></div>
 </form>;
}
export function CombinedSearchSort({query}:{query:CombinedSearchQuery}){
 const router=useRouter(),[pending,startTransition]=useTransition(),id=useId();
 return <label className="search-result-sort" htmlFor={id}>並べ替え<select id={id} value={query.sort} disabled={pending} onChange={e=>startTransition(()=>router.push(combinedSearchHref(query,{sort:e.target.value,page:1})+'#search-results',{scroll:false}))}>{SEARCH_SORTS[query.target].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>;
}
