import {displayDate} from '@/lib/core';
import {INFO_STATES} from '@/lib/ui-copy.mjs';

/** The same title / billing / date + format order on home and both release lists. */
export function ReleaseCardText({title,displayCredit,date,kindLabel,upcoming=false,external=false,home=false}:{
 title:string;displayCredit?:string|null;date:string|null;kindLabel?:string|null;upcoming?:boolean;external?:boolean;home?:boolean;
}){
 return <span className={home?'home-recent-copy':'record-copy'}>
  <strong className={home?'home-recent-title':'record-title'}>{title}</strong>
  <span className={home?'home-recent-credit':'record-credit'}>{displayCredit||'名義：'+INFO_STATES.pending}</span>
  <span className={home?'home-recent-meta':'record-meta record-release-meta'}>
   {date?<time dateTime={date} aria-label={'発売日 '+displayDate(date)}>{displayDate(date)}</time>:<span>{'発売日：'+INFO_STATES.pending}</span>}
   {kindLabel&&<span>{kindLabel}</span>}
   {upcoming&&<span>発売予定</span>}
   {external&&<span>配信先</span>}
  </span>
 </span>;
}
