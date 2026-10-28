// Presentation search only. These names never merge identities, change singing
// credits or infer translations. Recording aliases require an explicit relation.
import {catalogNameMatches} from './catalog-name-search.mjs';
import {recordedEventsForRelease,recordingsForEvent} from './live-release-links.mjs';
const arr=value=>Array.isArray(value)?value:[];
export function workSearchTitles(detail){
 return [detail?.title,detail?.titleKana,...arr(detail?.localizedTitles).map(t=>t.title)].filter(t=>typeof t==='string'&&t.trim());
}
export function releaseTitleMatches(model,detail,term){
 const events=recordedEventsForRelease(model,detail?.familyId);
 const aliases=[...workSearchTitles(detail),...events.flatMap(event=>[event.title,...workSearchTitles(model.events?.get(event.eventId)?.detail)])];
 return catalogNameMatches({name:detail?.title??'',aliases},term);
}
export function eventTitleMatches(model,eventId,title,term){
 const recordings=recordingsForEvent(model,eventId);
 const aliases=[...workSearchTitles(model.events?.get(eventId)?.detail),...recordings.flatMap(recording=>[recording.title,...workSearchTitles(model.releases?.get(recording.familyId)?.detail)])];
 return catalogNameMatches({name:typeof title==='string'?title:'',aliases},term);
}
