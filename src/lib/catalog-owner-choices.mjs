// Shared owner-picker contract. No credentials, DOM, URL fetching or writes.
import {DraftError,isUuid} from './catalog-draft-contract.mjs';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,list)=>object(x)&&Object.keys(x).sort().join('|')===[...list].sort().join('|');
const revision=x=>Number.isSafeInteger(x)&&x>0;
const text=(x,max)=>typeof x==='string'&&[...x].length<=max&&!/[\u0000-\u001f\u007f]/.test(x);
const cursor=x=>x===null||(typeof x==='string'&&x.length<=65536&&/^oc1:(?:[0-9a-f]{2})+$/.test(x));
const label=x=>typeof x==='string'&&[...x].length>0&&[...x].length<=4000;
export function validateOwnerChoicesRequest(x){
  if(!keys(x,['schemaVersion','kind','query','workId','workRevision','cursor'])||x.schemaVersion!==1||
    !['work','version','singer','entry'].includes(x.kind)||!text(x.query,200)||!cursor(x.cursor)||
    (x.kind==='version'?(!isUuid(x.workId)||!revision(x.workRevision)):(x.workId!==null||x.workRevision!==null)))
    throw new DraftError('INVALID_REQUEST');
  return structuredClone(x);
}
export function validateOwnerChoicesResponse(x,request){
  const invalid=()=>{throw new DraftError('INVALID_CHOICES');};
  if(!object(x)||x.schemaVersion!==1||['kind','query','workId','workRevision'].some(k=>x[k]!==request[k])||
    !Array.isArray(x.items)||x.items.length>20||!cursor(x.nextCursor)||
    (x.nextCursor!==null&&(x.items.length!==20||x.nextCursor===request.cursor)))invalid();
  const ids=new Set();
  const items=x.items.map(item=>{
    if(!object(item)||!isUuid(item.id)||ids.has(item.id))invalid();
    ids.add(item.id);
    if(request.kind==='entry'){
      if(!label(item.title)||(item.sortTitle!==null&&(typeof item.sortTitle!=='string'||[...item.sortTitle].length>4000))||
        (item.workTitle!==null&&!label(item.workTitle))||!['song_variant','medley'].includes(item.entryKind)||
        !Array.isArray(item.vocalHints)||item.vocalHints.length>2||item.vocalHints.some(x=>typeof x!=='string'||[...x].length>400))invalid();
      return {id:item.id,title:item.title,sortTitle:item.sortTitle,workTitle:item.workTitle,entryKind:item.entryKind,vocalHints:[...item.vocalHints]};
    }
    if(!revision(item.revision))invalid();
    if(request.kind==='work'){
      if(!label(item.title)||(item.sortTitle!==null&&(typeof item.sortTitle!=='string'||[...item.sortTitle].length>4000)))invalid();
      return {id:item.id,title:item.title,sortTitle:item.sortTitle,revision:item.revision};
    }
    if(request.kind==='singer'){
      if(!label(item.name)||!['artist','voicebank'].includes(item.entityType))invalid();
      return {id:item.id,name:item.name,entityType:item.entityType,revision:item.revision};
    }
    if(!label(item.label)||!['editorial','official'].includes(item.labelBasis)||item.workId!==request.workId)invalid();
    return {id:item.id,label:item.label,labelBasis:item.labelBasis,workId:item.workId,revision:item.revision};
  });
  return {schemaVersion:1,kind:x.kind,query:x.query,workId:x.workId,workRevision:x.workRevision,items,nextCursor:x.nextCursor};
}
