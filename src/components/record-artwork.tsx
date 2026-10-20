'use client';
import {useState} from 'react';

/** Retain the existing placeholder if an external image becomes unavailable. */
export function RecordArtwork({url}:{url:string|null}){
 const [failedUrl,setFailedUrl]=useState<string|null>(null);
 return <span className="record-cover" aria-hidden="true"><span className="record-cover-glyph">♪</span>
  {url&&failedUrl!==url&&<img src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailedUrl(url)}/>}
 </span>;
}
