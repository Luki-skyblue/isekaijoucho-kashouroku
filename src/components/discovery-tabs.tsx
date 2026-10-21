'use client';

import Link from 'next/link';
import {useEffect,useRef} from 'react';

// These tabs navigate between URL-addressable lists. Native links retain normal
// browser history and keyboard behaviour; they are not an ARIA tabpanel widget.
export function DiscoveryTabs({categories,selected}:{categories:Array<{id:string;label:string;count:number}>;selected:string}){
 const nav=useRef<HTMLElement>(null);
 useEffect(()=>{
  const container=nav.current,active=container?.querySelector<HTMLElement>('[aria-current=page]');
  if(!container||!active)return;
  const keepVisible=()=>{
   const bounds=container.getBoundingClientRect(),tab=active.getBoundingClientRect();
   if(tab.left<bounds.left)container.scrollLeft-=bounds.left-tab.left;
   else if(tab.right>bounds.right)container.scrollLeft+=tab.right-bounds.right;
  };
  keepVisible();
  // Font loads and viewport changes can move the active tab after navigation.
  const resize=new ResizeObserver(keepVisible);
  resize.observe(container);for(const tab of container.children)resize.observe(tab);
  return ()=>resize.disconnect();
 },[selected]);
 return <nav ref={nav} className="discovery-categories" aria-label="公開・収録先">{categories.filter(c=>c.id!=='unclassified'||c.count>0).map(c=><Link key={c.id} className={c.id==='unclassified'?'discovery-unclassified':undefined} href={'/discover?category='+c.id} scroll={false} aria-current={c.id===selected?'page':undefined}><span>{c.label}</span><small>{c.count}</small></Link>)}</nav>;
}
