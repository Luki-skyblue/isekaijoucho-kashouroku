'use client';
import {useState} from 'react';

export function SongDetailArtwork({url,urls=[],className='',eager=false}:{url:string|null;urls?:string[];className?:string;eager?:boolean}){
 const [failed,setFailed]=useState<string[]>([]),current=[...new Set([url,...urls])].find((candidate):candidate is string=>!!candidate&&!failed.includes(candidate)),show=!!current;
 return <span className={'song-detail-image '+className+(show?'':' song-detail-no-image')} role={show?undefined:'img'} aria-label={show?undefined:'画像なし'}>
  {show?<img src={current} alt="" loading={eager?'eager':'lazy'} decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(previous=>[...previous,current!])}/>:<span>NO IMAGE</span>}
 </span>;
}
