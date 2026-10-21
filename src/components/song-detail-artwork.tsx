'use client';
import {useState} from 'react';

export function SongDetailArtwork({url,className='',eager=false}:{url:string|null;className?:string;eager?:boolean}){
 const [failed,setFailed]=useState<string|null>(null),show=!!url&&failed!==url;
 return <span className={'song-detail-image '+className+(show?'':' song-detail-no-image')} role={show?undefined:'img'} aria-label={show?undefined:'画像なし'}>
  {show?<img src={url} alt="" loading={eager?'eager':'lazy'} decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(url)}/>:<span>NO IMAGE</span>}
 </span>;
}
