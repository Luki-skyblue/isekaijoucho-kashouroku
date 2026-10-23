import Link from 'next/link';
import {notFound} from 'next/navigation';
import {rpc} from '@/lib/api';
import {asArray,displayDate,num,str,validId,JsonObject,rpcDetailPage,numberOfPages,safeExternalUrl} from '@/lib/core';
import {Breadcrumb} from '@/components/ui';
import {RecordArtwork} from '@/components/record-artwork';
import {eventArtworkForEvent} from '@/lib/catalog-artwork.mjs';
import {isLiveSupplement,liveSessionLabel,liveCoverageNote,liveProgramPosition,type LiveDisplayContext} from '@/lib/live-detail-data.mjs';
import {publicCatalogEnabled,publicLiveDisplayContext} from '@/lib/public-catalog';
import {privateSnapshotEnabled,privateLiveDisplayContext} from '@/lib/private-snapshot';
import '@/components/live-detail.css';
const OCCURRENCES_PER_PAGE=50;
const PROGRAM_ITEMS_PER_PAGE=100;
export default async function EventDetail({params,searchParams}:{params:Promise<{eventId:string}>;searchParams:Promise<{occurrencePage?:string;programPage?:string;programOccurrence?:string}>}){
 const {eventId}=await params;if(!validId(eventId))notFound();
 const query=await searchParams;
 const occurrencePage=rpcDetailPage(query.occurrencePage,OCCURRENCES_PER_PAGE);
 const event=await rpc('kashouroku_v3_event',{p_event_id:eventId,p_limit:OCCURRENCES_PER_PAGE,p_offset:(occurrencePage-1)*OCCURRENCES_PER_PAGE});if(!event)notFound();
 const context=publicCatalogEnabled()?publicLiveDisplayContext(eventId):privateSnapshotEnabled()?await privateLiveDisplayContext(eventId):null;
 const occurrences=asArray(event.occurrences);
 const activeOccurrence=validId(query.programOccurrence??'')?query.programOccurrence:'';
 const requestedProgramPage=rpcDetailPage(query.programPage,PROGRAM_ITEMS_PER_PAGE);
 const programs=await Promise.all(occurrences.map(o=>{
  const occurrenceId=str(o.occurrenceId);
  const page=activeOccurrence===occurrenceId?requestedProgramPage:1;
  return rpc('kashouroku_v3_event_program',{p_occurrence_id:occurrenceId,p_limit:PROGRAM_ITEMS_PER_PAGE,p_offset:(page-1)*PROGRAM_ITEMS_PER_PAGE});
 }));
 const sessions=occurrences.map((o,i)=>({occurrence:o,program:programs[i],page:activeOccurrence===str(o.occurrenceId)?requestedProgramPage:1}));
 const main=sessions.filter(x=>!isLiveSupplement(x.occurrence)),supplements=sessions.filter(x=>isLiveSupplement(x.occurrence));
 const dates=context?.dates??[...new Set(main.map(x=>str(x.occurrence.officialDate)).filter(Boolean))].sort();
 const cast=context?.performers??asArray(event.eventCast).filter(c=>c.scope==='event'&&c.role==='performer'&&c.castStatus==='confirmed_present');
 const venues=[...new Set(main.map(x=>str(x.occurrence.venueName)).filter(Boolean))];
 const artwork=eventArtworkForEvent(event),official=safeExternalUrl(artwork?.sourceUrl),title=str(event.title)||'公演名未登録';
 const total=main.reduce((count,x)=>count+num(x.program?.totalItems),0);
 return <article className="live-detail-page">
  <Breadcrumb parts={[{label:'LIVE一覧',href:'/lives'},{label:title}]}/>
  <header className="live-detail-heading"><div className="live-detail-art"><RecordArtwork url={artwork?.imageUrl??null}/></div><div className="live-detail-copy"><p className="eyebrow">{context?.billingLabel??'LIVE / EVENT'}</p><h1>{title}</h1>{official&&<a className="live-detail-official" href={official} target="_blank" rel="noopener noreferrer">公式情報 ↗</a>}</div></header>
  <dl className="live-detail-facts">
   <div><dt>開催日</dt><dd>{dates.length?dates.map(d=>displayDate(d)).join('・'):<Missing/>}</dd></div>
   <div><dt>会場</dt><dd>{venues.length?venues.join('・'):<Missing/>}</dd></div>
   <div><dt>出演</dt><dd>{cast.length?cast.map((c,i)=><span key={str(c.entityId)||i}>{i>0?'・':''}{context&&str(c.personKey)?<Link className="person-name" href={'/people/'+str(c.personKey)}>{str(c.name)}</Link>:str(c.name)}</span>):<Missing/>}</dd></div>
  </dl>
  <section className="live-detail-section" id="event-occurrences" aria-labelledby="live-setlist-heading">
   <div className="live-detail-section-title"><h2 id="live-setlist-heading">セットリスト</h2>{total>0&&<span className="live-detail-count" aria-label={`${total}演目`}>{total}</span>}</div>
   {main.length?main.map(x=><SessionView key={str(x.occurrence.occurrenceId)} {...x} eventId={eventId} occurrencePage={occurrencePage} context={context} showHeading={main.length>1||!!liveSessionLabel(x.occurrence)}/>):<Missing/>}
   {supplements.length>0&&<section className="live-detail-supplements" aria-labelledby="live-supplements-heading"><h2 id="live-supplements-heading">再配信・特典</h2>{supplements.map(x=><SessionView key={str(x.occurrence.occurrenceId)} {...x} eventId={eventId} occurrencePage={occurrencePage} context={context} showHeading/>)}</section>}
   <EventOccurrencePager eventId={eventId} page={occurrencePage} pages={numberOfPages(num(event.totalOccurrences),OCCURRENCES_PER_PAGE)}/>
  </section>
 </article>;
}
function Missing(){return <span className="live-detail-missing">準備中</span>;}
function SessionView({occurrence,program,page,eventId,occurrencePage,context,showHeading}:{occurrence:JsonObject;program:JsonObject|null;page:number;eventId:string;occurrencePage:number;context:LiveDisplayContext|null;showHeading:boolean}){
 const items=asArray(program?.items),note=liveCoverageNote(occurrence.programCoverageScope),label=liveSessionLabel(occurrence);
 return <section className="live-detail-session" id={`occ-${str(occurrence.occurrenceId)}`}>
  {showHeading&&<h3>{label||displayDate(occurrence.officialDate,'日付未確認')}</h3>}
  {showHeading&&label&&str(occurrence.officialDate)&&<p className="live-detail-session-date">{displayDate(occurrence.officialDate)}</p>}
  {items.length>0&&note&&<p className="live-detail-coverage">{note}</p>}
  {items.length?<ol className="live-detail-setlist">{items.map((item,i)=>{
   const target=context?.programLinks[str(item.programItemId)],vocals=context?.programVocals[str(item.programItemId)],title=str(item.rawLabel)||'名称未登録';
   const endRoll=str(item.itemKind)==='end_roll'&&!/エンドロール|（ED）|\(ED\)/i.test(title);
   return <li className={'live-detail-program-row'+(vocals?.targetVocal==='absent'?' live-detail-other-vocals':'')} key={str(item.programItemId)||i}><span className="live-detail-position" aria-hidden="true">{liveProgramPosition(item)}</span><span className="live-detail-program-title">{target?<Link className="live-detail-song-link" href={'/songs/'+target.entryId}>{title}</Link>:title}{vocals&&<span className="live-detail-program-vocals"><span aria-hidden="true"> / </span><span className="sr-only">　歌唱：</span>{vocals.displayCredit}</span>}</span>{endRoll&&<span className="live-detail-program-tag">エンドロール</span>}</li>;
  })}</ol>:num(program?.totalItems)>0?<p className="live-detail-missing">このページに項目がありません。</p>:<Missing/>}
  <ProgramPager eventId={eventId} occurrenceId={str(occurrence.occurrenceId)} occurrencePage={occurrencePage} page={page} pages={numberOfPages(num(program?.totalItems),PROGRAM_ITEMS_PER_PAGE)}/>
 </section>;
}
function EventOccurrencePager({eventId,page,pages}:{eventId:string;page:number;pages:number}){
 if(pages<=1)return null;
 const link=(p:number)=>`/lives/${encodeURIComponent(eventId)}?occurrencePage=${p}#event-occurrences`;
 return <nav className="pages" aria-label="公演日程のページ送り">
  {page>1&&<Link href={link(page-1)}>← 前のページ</Link>}
  <span>{page} / {pages} ページ</span>
  {page<pages&&<Link href={link(page+1)}>次のページ →</Link>}
 </nav>;
}
function ProgramPager({eventId,occurrenceId,occurrencePage,page,pages}:{eventId:string;occurrenceId:string;occurrencePage:number;page:number;pages:number}){
 if(pages<=1 || !validId(occurrenceId))return null;
 const link=(p:number)=>`/lives/${encodeURIComponent(eventId)}?occurrencePage=${occurrencePage}&programOccurrence=${encodeURIComponent(occurrenceId)}&programPage=${p}#occ-${encodeURIComponent(occurrenceId)}`;
 return <nav className="pages" aria-label="セットリストのページ送り">
  {page>1&&<Link href={link(page-1)}>← 前のページ</Link>}
  <span>{page} / {pages} ページ</span>
  {page<pages&&<Link href={link(page+1)}>次のページ →</Link>}
 </nav>;
}
