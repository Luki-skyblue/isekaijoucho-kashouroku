'use client';

import {useState,useTransition,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';

export type ListSortOption={value:string;label:string;href:string};

/** One ordering is active at a time. URL-derived value describes the rendered
 * results; a pending selection is shown as pending until navigation commits.
 */
export function ListSort({id,action,value,options,children}:{
 id:string;action:'/songs'|'/lives';value:string;options:ListSortOption[];children?:ReactNode;
}) {
 const router=useRouter(),[target,setTarget]=useState(value),[pending,startTransition]=useTransition();
 const applied=options.find(o=>o.value===value);
 return <form action={action} method="get" className="list-sort">
  <label htmlFor={id}>並べ替え</label>
  <span id={`${id}-help`} className="sr-only">選ぶと並び順を変更します。</span>
  <select id={id} name="sort" value={pending?target:value} aria-disabled={pending} aria-describedby={`${id}-help`} onChange={event=>{
   // Retain keyboard focus while blocking another sort during this transition.
   if(pending)return;
   const option=options.find(o=>o.value===event.target.value);
   if(!option||option.value===value)return;
   setTarget(option.value);
   startTransition(()=>router.push(option.href,{scroll:false}));
  }}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
  {children}
  <span className="list-sort-status" role="status" aria-live="polite" aria-atomic="true">{pending?`更新中（現在の表示：${applied?.label??''}）`:''}</span>
  <noscript><button type="submit">並べ替える</button></noscript>
 </form>;
}
