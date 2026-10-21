'use client';
import {useState} from 'react';

/** Try the same ranked candidates as the detail, then retain the placeholder. */
export function RecordArtwork({url,urls=[]}:{url:string|null;urls?:string[]}){
 const [failed,setFailed]=useState<string[]>([]),current=[...new Set([url,...urls])].find((candidate):candidate is string=>!!candidate&&!failed.includes(candidate));
 return <span className="record-cover" aria-hidden="true"><span className="record-cover-glyph">♪</span>
  {current&&<img src={current} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(previous=>[...previous,current])}/>}
 </span>;
}
