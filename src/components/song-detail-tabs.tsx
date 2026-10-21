'use client';
import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';

export function SongDetailTabs({tabs,initialTab='info'}:{tabs:Array<{id:string;label:string;count:number|null;content:ReactNode}>;initialTab?:string}){
 const [active,setActive]=useState(initialTab),anchor=useRef<HTMLDivElement>(null),bar=useRef<HTMLDivElement>(null),reset=useRef(false),buttons=useRef<Array<HTMLButtonElement|null>>([]);
 useEffect(()=>{const id=window.location.hash.slice(1);if(id==='song-history'||id==='history')setActive('history');},[]);
 useLayoutEffect(()=>{if(reset.current&&anchor.current){window.scrollTo({top:anchor.current.getBoundingClientRect().top+window.scrollY,behavior:'instant'});reset.current=false;}},[active]);
 function choose(id:string){reset.current=!!bar.current&&bar.current.getBoundingClientRect().top<=1;setActive(id);}
 return <><div ref={anchor} className="song-detail-tabs-anchor"/>
  <div className="song-detail-tabs" role="tablist" aria-label="楽曲の情報" ref={bar}>
   {tabs.map((tab,i)=><button key={tab.id} ref={el=>{buttons.current[i]=el;}} type="button" role="tab" id={'song-tab-'+tab.id} aria-controls={'song-panel-'+tab.id} aria-selected={active===tab.id} tabIndex={active===tab.id?0:-1} className="song-detail-tab" onClick={()=>choose(tab.id)} onKeyDown={event=>{
    let next:number|undefined;
    if(event.key==='ArrowRight')next=(i+1)%tabs.length;else if(event.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;
    if(next!==undefined){event.preventDefault();choose(tabs[next].id);buttons.current[next]?.focus({preventScroll:true});buttons.current[next]?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}
   }}>{tab.label}{tab.count!==null&&<span className="song-detail-count">{tab.count}</span>}</button>)}
  </div>
  <div className="song-detail-panels">{tabs.map(tab=><section id={'song-panel-'+tab.id} aria-labelledby={'song-tab-'+tab.id} key={tab.id} role="tabpanel" hidden={active!==tab.id} tabIndex={0} className="song-detail-tab-panel">{tab.content}</section>)}</div>
 </>;
}
