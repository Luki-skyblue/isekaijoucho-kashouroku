'use client';
import {useState} from 'react';

/** Try the same ranked candidates as the detail, then retain the placeholder. */
export function RecordArtwork({url,urls=[]}:{url:string|null;urls?:string[]}){
 const [failed,setFailed]=useState<string[]>([]),current=[...new Set([url,...urls])].find((candidate):candidate is string=>!!candidate&&!failed.includes(candidate));
 // SSR images can fail before hydration attaches onError; the ref catches it.
 const markFailed=()=>{if(current)setFailed(previous=>previous.includes(current)?previous:[...previous,current]);};
 return <span className="record-cover" aria-hidden="true"><span className="record-cover-glyph">♪</span>
  {current&&<img src={current} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" ref={image=>{if(image?.complete&&image.naturalWidth===0)markFailed();}} onError={markFailed}/>}
 </span>;
}
