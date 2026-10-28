// One read-only index of real release families and registered external products.
// Classification happens before search/pagination and shares the home predicate.
import {isLiveRelease,releaseKindLabel,releaseMediaLabel,releaseListArtworkFromModel} from './release-detail-data.mjs';
import {registeredSongSourcesForEntry,songReleasesForEntry} from './song-detail-data.mjs';
import {rankArtworkCandidates} from './catalog-artwork.mjs';
import {catalogNameMatches} from './catalog-name-search.mjs';
import {releaseTitleMatches} from './catalog-title-search.mjs';

const arr=x=>Array.isArray(x)?x:[],text=x=>typeof x==='string'?x.trim():'';
const compare=(a,b)=>a<b?-1:a>b?1:0;
const categories=[{id:'music',label:'リリース'},{id:'live',label:'LIVE音源・映像'}];
function day(value,precision){
 if(precision&&precision!=='date'||typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const parsed=new Date(value+'T00:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value?value:null;
}
function rowsFromModel(model,options){
 const rows=[];
 for(const {detail}of model.releases.values()){
  const editions=arr(detail.editions),dates=editions.map(e=>day(e.releaseDate,e.datePrecision)).filter(Boolean).sort();
  const digital=editions.length>0&&editions.every(e=>e.kind==='digital');
  const media=[...new Set(arr(detail.components).map(c=>releaseMediaLabel(c.componentKind)).filter(Boolean))];
  rows.push({key:detail.familyId,familyId:detail.familyId,title:detail.title,href:'/releases/'+detail.familyId,external:false,
   category:isLiveRelease(detail)?'live':'music',date:dates[0]??null,
   kindLabel:digital&&detail.releaseKind==='single'?'配信シングル':releaseKindLabel(detail.releaseKind)||media.join('・')||null});
 }
 const externalUrls=new Set();
 for(const entry of model.entries.values()){
  if(!registeredSongSourcesForEntry(entry,options.sourceRecords).some(r=>r.kind==='digital_single'))continue;
  // The song adapter owns identity guards, retirement and canonical hand-off.
  for(const product of songReleasesForEntry(entry,model.works.get(entry.detail.primaryWorkId)??{},undefined,options.sourceRecords)){
   if(!product.externalUrl||externalUrls.has(product.externalUrl))continue;
   externalUrls.add(product.externalUrl);
   const artwork=rankArtworkCandidates([{kind:'digital_single',imageUrl:product.imageUrl,sourceUrl:product.imageSourceUrl}]);
   rows.push({key:product.releaseItemId,familyId:null,title:product.family.title,href:product.externalUrl,external:true,
    category:'music',date:day(product.edition?.releaseDate),kindLabel:'配信シングル',
    thumbnailUrl:artwork[0]?.imageUrl??null,thumbnailUrls:artwork.map(x=>x.imageUrl)});
  }
 }
 // Retain the title order of the existing directory; never sort by DB insertion.
 return rows.sort((a,b)=>compare(a.title,b.title)||compare(a.key,b.key));
}
export function releaseListFromModel(model,query={},options={}){
 const category=query.category==='live'?'live':'music',term=text(query.term).slice(0,100),limit=24;
 const matches=rowsFromModel(model,options).filter(row=>!term||(row.external?catalogNameMatches({name:row.title},term):releaseTitleMatches(model,model.releases.get(row.familyId)?.detail??row,term)));
 const selected=matches.filter(row=>row.category===category),pages=Math.max(1,Math.ceil(selected.length/limit));
 const requested=Number.isSafeInteger(query.page)&&query.page>0?query.page:1,page=Math.min(requested,pages);
 const items=selected.slice((page-1)*limit,page*limit).map(row=>row.external?row:releaseListArtworkFromModel(model,{items:[row]}).items[0]);
 return {category,term,page,pages,limit,total:selected.length,categories:categories.map(c=>({...c,count:matches.filter(row=>row.category===c.id).length})),items};
}
export function releaseListHref({category='music',term='',page=1,view='list'}={}){
 const query=new URLSearchParams();
 if(category==='live')query.set('category','live');
 if(term)query.set('q',term);
 if(view==='grid')query.set('view','grid');
 if(page>1)query.set('page',String(page));
 return '/releases'+(query.size?'?'+query.toString():'');
}
