// Presentation only. A public programme/entry link is not a full-song or
// singer-verification assertion. Keep the original rows and their scope intact.
const arr=x=>Array.isArray(x)?x:[];
const extraLabels={special_rebroadcast:'再配信',special_distribution_bonus:'配信特典'};
export const isLiveSupplement=occurrence=>Object.hasOwn(extraLabels,occurrence?.sessionLabel??'');
export function liveSessionLabel(occurrence){
 const label=occurrence?.sessionLabel;
 return Object.hasOwn(extraLabels,label??'')?extraLabels[label]:(typeof label==='string'?label.trim():'');
}
export function liveCoverageNote(scope){
 return scope==='partial_program'?'セットリストは一部のみ掲載しています。':scope==='target_artist_segment'?'一部の出演者のセットリストを掲載しています。':null;
}
export function liveProgramPosition(item){
 const raw=typeof item?.rawPosition==='string'?item.rawPosition.trim():'';
 // Legacy printed numbers can overlap after instrumental items were inserted.
 // Use the programme order for numeric positions; keep explicit EN/MC labels.
 if(raw&&!/^\d+$/.test(raw))return raw;
 return Number.isSafeInteger(item?.sequenceNo)&&item.sequenceNo>0?String(item.sequenceNo).padStart(2,'0'):raw||'—';
}
export function liveDisplayContextFromModel(model,eventId){
 const event=model.events.get(eventId);if(!event)return null;
 const f=event.filterMetadata??{},names=[...new Set(arr(f.billingArtists).map(x=>x.name).filter(Boolean))];
 const format=f.format??event.detail.eventKind,formatName=format==='one_man'?'ONE-MAN LIVE':format==='festival'?'フェス':'';
 const eligible=(rows,scope)=>arr(rows).filter(c=>c.scope===scope&&c.role==='performer'&&c.castStatus==='confirmed_present'&&c.entityId&&c.name);
 const cast=[...eligible(event.detail.eventCast,'event'),...eligible(f.castAdditions,'event'),...arr(event.occurrences).flatMap(o=>eligible(o.occurrenceCast,'occurrence'))];
 const performers=[...new Map(cast.map(c=>[c.entityId,{entityId:c.entityId,name:c.name}])).values()];
 const dates=[...new Set(arr(event.occurrences).filter(o=>!isLiveSupplement(o)).map(o=>o.officialDate).filter(Boolean))].sort();
 const programLinks={};
 for(const program of arr(event.programs))for(const item of arr(program.items)){
  if(item.itemKind!=='rendition')continue;
  const targets=new Set();
  for(const association of arr(item.associations)){
   if(!association.renditionId||association.targetKind!=='rendition')continue;
   const multi=arr(association.renditionParts).length>1;
   for(const [id,entry]of model.entries){
    if(multi&&entry.detail.kind!=='medley')continue;
    const linked=arr(entry.detail.linkedRenditions).some(r=>r.renditionId===association.renditionId);
    const direct=arr(entry.history).some(h=>h.renditionId===association.renditionId&&
     ['explicit_part','legacy_rendition'].includes(h.matchBasis)&&h.multiWork!==true&&
     arr(h.relatedEvents).some(e=>e.eventId===eventId));
    if(linked||direct)targets.add(id);
   }
  }
  // Ambiguous or same-version-only candidates remain readable plain text.
  if(targets.size===1){const entryId=[...targets][0],e=model.entries.get(entryId);
   programLinks[item.programItemId]={entryId,title:e.detail.title};}
 }
 return {billingLabel:[names.join('・'),formatName].filter(Boolean).join(' ')||null,dates,performers,programLinks};
}
