// Both directions use the same explicit recording relation. Shared songs,
// titles and event-series membership do not establish a recorded release.
const arr=value=>Array.isArray(value)?value:[];
const text=value=>typeof value==='string'?value.trim():'';
const editionNames=new Map([['regular','通常版'],['special_box_first_press','初回限定BOX'],['digital','配信']]);
const editionName=edition=>editionNames.get(edition?.name)||text(edition?.name);
function relations(model,familyId){
 const release=model.releases?.get(familyId)?.detail;
 if(!release||release.familyId!==familyId||!text(release.title))return [];
 return arr(release.eventRelations).flatMap(relation=>{
  if(relation.relationType!=='documents_event'||!['family','edition'].includes(relation.releaseScope))return [];
  const edition=relation.releaseScope==='edition'?arr(release.editions).find(e=>e.editionId===relation.releaseEditionId):null;
  if((relation.releaseScope==='edition'&&!edition)||(relation.releaseScope==='family'&&relation.releaseEditionId))return [];
  const event=model.events?.get(relation.eventId);
  if(!event||event.detail.eventId!==relation.eventId||!text(event.detail.title))return [];
  const occurrence=relation.eventOccurrenceId?arr(event.occurrences).find(o=>o.occurrenceId===relation.eventOccurrenceId):null;
  if(relation.eventOccurrenceId&&!occurrence)return [];
  return [{release,event,edition,occurrence}];
 });
}
export function recordedEventsForRelease(model,familyId,{editionId=null}={}){
 const links=new Map();
 for(const {event,edition,occurrence}of relations(model,familyId)){
  if(editionId&&edition&&edition.editionId!==editionId)continue;
  const eventId=event.detail.eventId,occurrenceId=occurrence?.occurrenceId??null;
  const href='/lives/'+encodeURIComponent(eventId)+(occurrenceId?'#occ-'+encodeURIComponent(occurrenceId):'');
  if(!links.has(href))links.set(href,{eventId,occurrenceId,title:event.detail.title,href});
 }
 return [...links.values()];
}
export function recordingsForEvent(model,eventId){
 const links=new Map();
 for(const [familyId]of model.releases??[]){
  const rows=relations(model,familyId).filter(row=>row.event.detail.eventId===eventId);
  // A family-wide relation already includes its editions; show one product.
  const selected=rows.some(row=>!row.edition)?rows.filter(row=>!row.edition):rows;
  for(const {release,edition}of selected){
   const editionId=edition?.editionId??null;
   const href='/releases/'+encodeURIComponent(familyId)+(editionId?'?edition='+encodeURIComponent(editionId):'');
   const name=editionName(edition);
   if(!links.has(href))links.set(href,{familyId,editionId,title:release.title+(editionId&&name?' · '+name:''),href});
  }
 }
 return [...links.values()];
}
