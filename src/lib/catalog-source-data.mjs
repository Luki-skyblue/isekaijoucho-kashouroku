import {discoveryRoutesForEntry} from './discovery-data.mjs';
import {CATALOG_SOURCE_OPTIONS} from './catalog-source-options.mjs';

function xSource(route){
 try{if(['x.com','www.x.com','twitter.com','www.twitter.com'].includes(new URL(route.sourceUrl).hostname))return true;}catch{}
 const label=typeof route.label==='string'?route.label.normalize('NFKC').replace(/\s/g,'').toLowerCase():'';
 return /^(x|twitter(?:\(現x\))?)$/.test(label);
}
/** Every exact registered relation participates, not just Discover's primary.
 * A performance is not a playable video; a live CD is not a concert record.
 */
export function sourceKindsForRoutes(routes){
 const found=new Set();
 for(const route of Array.isArray(routes)?routes:[]){
  if(route?.exactEntry!==true)continue;
  if(route.kind==='youtube'){if(route.current!==false)found.add('youtube');continue;}
  if(route.kind==='release'){
   if(route.category==='live_event')found.add('live_release');
   else if(route.category==='cd_album')found.add('release');
   continue;
  }
  if(route.kind==='performance'){
   if(route.category==='live_event')found.add('live');
   else if(route.category==='stream_event')found.add('stream');
   continue;
  }
  if(route.kind==='origin_record'&&route.category==='cd_album'){found.add('release');continue;}
  if(route.category==='other'){found.add(xSource(route)?'x':'other');}
 }
 return CATALOG_SOURCE_OPTIONS.filter(o=>found.has(o.id)).map(o=>o.id);
}
// Loaded public/private models are immutable snapshots. A new snapshot gets
// a new cache; the index never writes facts or makes external requests.
const cache=new WeakMap();
export function sourceKindsForEntry(model,entryId){
 let index=cache.get(model);if(!index){index=new Map();cache.set(model,index);}
 if(!index.has(entryId))index.set(entryId,sourceKindsForRoutes(discoveryRoutesForEntry(model,entryId)));
 return [...index.get(entryId)];
}
