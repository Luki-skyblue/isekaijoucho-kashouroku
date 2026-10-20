import Link from 'next/link';
import {notFound} from 'next/navigation';
import {rpc} from '@/lib/api';
import {asArray,asObject,displayDate,num,str,textOr,validId,JsonObject,rpcDetailPage,numberOfPages} from '@/lib/core';
import {Breadcrumb,Empty,Heading,Panel,Chip} from '@/components/ui';
const OCCURRENCES_PER_PAGE=50;
const PROGRAM_ITEMS_PER_PAGE=100;
export default async function EventDetail({params,searchParams}:{params:Promise<{eventId:string}>;searchParams:Promise<{occurrencePage?:string;programPage?:string;programOccurrence?:string}>}){
 const {eventId}=await params;if(!validId(eventId))notFound();
 const query=await searchParams;
 const occurrencePage=rpcDetailPage(query.occurrencePage,OCCURRENCES_PER_PAGE);
 const event=await rpc('kashouroku_v3_event',{p_event_id:eventId,p_limit:OCCURRENCES_PER_PAGE,p_offset:(occurrencePage-1)*OCCURRENCES_PER_PAGE});if(!event)notFound();
 const occurrences=asArray(event.occurrences),cast=asArray(event.eventCast);
 const activeOccurrence=validId(query.programOccurrence??'')?query.programOccurrence:'';
 const requestedProgramPage=rpcDetailPage(query.programPage,PROGRAM_ITEMS_PER_PAGE);
 const programs=await Promise.all(occurrences.map(o=>{
  const occurrenceId=str(o.occurrenceId);
  const page=activeOccurrence===occurrenceId?requestedProgramPage:1;
  return rpc('kashouroku_v3_event_program',{p_occurrence_id:occurrenceId,p_limit:PROGRAM_ITEMS_PER_PAGE,p_offset:(page-1)*PROGRAM_ITEMS_PER_PAGE});
 }));
 return <><Breadcrumb parts={[{label:"LIVE一覧",href:"/lives"},{label:textOr(event.title)}]}/><Heading eyebrow="LIVE / EVENT" title={textOr(event.title)} description={`種別: ${textOr(event.eventKind)} ／ 状態: ${textOr(event.status)}`}/>
 <div className="data-note">出演者名簿はその公演への出演情報です。各演目の実歌唱者・フル歌唱を意味しません。</div>
 <Panel title={`公演出演者（${cast.length}）`}>{cast.length?<p>{cast.map(c=>textOr(c.name)).join('、')}</p>:<Empty>公演出演者は未登録です。</Empty>}</Panel>
 <Panel id="event-occurrences" title={`開催回とプログラム（${num(event.totalOccurrences)}回）`}>{occurrences.length?occurrences.map((o,i)=><div key={str(o.occurrenceId)||i} id={`occ-${str(o.occurrenceId)}`} className="occurrence"><h3>{textOr(o.sessionLabel,`開催回 ${i+1}`)} <Chip>{textOr(o.status)}</Chip></h3><p className="muted tiny">開催日: {displayDate(o.officialDate)} / 会場: {textOr(o.venueName)} / {num(o.programItemCount)}演目</p><ProgramView result={programs[i]} eventId={eventId} occurrencePage={occurrencePage} programPage={activeOccurrence===str(o.occurrenceId)?requestedProgramPage:1} /></div>):<Empty>開催回は未登録です。</Empty>}<EventOccurrencePager eventId={eventId} page={occurrencePage} pages={numberOfPages(num(event.totalOccurrences),OCCURRENCES_PER_PAGE)}/></Panel></>;
}
function ProgramView({result,eventId,occurrencePage,programPage}:{result:JsonObject|null;eventId:string;occurrencePage:number;programPage:number}){
 if(!result)return <Empty>この開催回のプログラムは未登録です。</Empty>;
 const items=asArray(result.items);
 return items.length || num(result.totalItems)>0 ? <div className="setlist">{items.length===0&&<Empty>このページに演目がありません。前のページをご確認ください。</Empty>}{items.map((x,i)=><div key={str(x.programItemId)||i} className="setlist-row"><span className="setlist-index">{num(x.sequenceNo)||'·'}</span><div><strong>{textOr(x.rawLabel,'名称未登録')}</strong><p className="muted tiny">{textOr(x.itemKind,'種別未登録')}{str(x.itemKind)==='end_roll'?'（end roll：新規歌唱ではありません）':''}</p>{asArray(x.associations).map((a,j)=>{const parts=asArray(a.renditionParts);return <div className="tiny association" key={str(a.linkId)||j}>{textOr(a.relationType)} / {textOr(a.targetKind)} / 完全性: {textOr(a.completeness,'未確認')}{parts.length>0&&<p className="muted tiny">リンク先rendition内の楽曲候補: {parts.map(p=>textOr(p.workTitle)).join('、')}（曲別歌唱・フルの確認ではありません）</p>}</div>})}</div></div>)}<ProgramPager eventId={eventId} occurrenceId={str(result.occurrenceId)} occurrencePage={occurrencePage} page={programPage} pages={numberOfPages(num(result.totalItems),PROGRAM_ITEMS_PER_PAGE)}/></div>:<Empty>演目は未登録です。未開催・予定段階の可能性もあります。</Empty>;
}

function EventOccurrencePager({eventId,page,pages}:{eventId:string;page:number;pages:number}){
 if(pages<=1)return null;
 const link=(p:number)=>`/lives/${encodeURIComponent(eventId)}?occurrencePage=${p}#event-occurrences`;
 return <nav className="pages" aria-label="開催回のページ送り">
  {page>1&&<Link href={link(page-1)}>← 前の開催回</Link>}
  <span>{page} / {pages} ページ</span>
  {page<pages&&<Link href={link(page+1)}>次の開催回 →</Link>}
 </nav>;
}
function ProgramPager({eventId,occurrenceId,occurrencePage,page,pages}:{eventId:string;occurrenceId:string;occurrencePage:number;page:number;pages:number}){
 if(pages<=1 || !validId(occurrenceId))return null;
 const link=(p:number)=>`/lives/${encodeURIComponent(eventId)}?occurrencePage=${occurrencePage}&programOccurrence=${encodeURIComponent(occurrenceId)}&programPage=${p}#occ-${encodeURIComponent(occurrenceId)}`;
 return <nav className="pages" aria-label="この開催回のセットリストのページ送り">
  {page>1&&<Link href={link(page-1)}>← 前の演目</Link>}
  <span>{page} / {pages} ページ</span>
  {page<pages&&<Link href={link(page+1)}>次の演目 →</Link>}
 </nav>;
}
