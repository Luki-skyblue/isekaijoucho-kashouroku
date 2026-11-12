// Reviewed spelling corrections. Read/public projections change; the owner
// export and the frozen legacy evidence stay intact. Later owner edits win.
const corrections=[
 {entryId:'73a09ef2-ae91-48d0-92c7-46be298ab381',workId:'2002b2a2-b69e-5435-9765-2dcc9cd44bfd',before:'贖罪!! ロリ神レクイエム☆',after:'粛聖!! ロリ神レクイエム☆'},
 {entryId:'4a16dd69-4669-4153-ada3-69022daa452b',workId:'98af1dd6-03cf-5a2c-8c19-1ad95e604e4a',before:'Paradisus-Paradoxm',after:'Paradisus-Paradoxum'},
];
const fields=new Set(['title','sortTitle','workTitle','rawLabel']);
export function correctedLegacyTargetTitle(target){
 const correction=corrections.find(r=>target?.entryId===r.entryId&&target?.primaryWorkId===r.workId&&target?.title===r.before);
 return correction?.after??target?.title;
}
function applies(model,{entryId,workId,before,after}){
 const entry=model.entries.get(entryId);
 return entry?.detail?.primaryWorkId===workId&&[before,after].includes(entry.detail.title)&&
  entry.singerIds?.length===1&&entry.singerIds[0]==='81a01233-230e-50a8-a309-11275c794cd0'&&!entry.detail.variations?.length;
}
function visit(value,correction,scoped=false){
  if(!value||typeof value!=='object')return value;
  if(value instanceof Map){const rows=[...value].map(([key,row])=>[key,visit(row,correction)]);return rows.some(([key,row])=>row!==value.get(key))?new Map(rows):value;}
  if(Array.isArray(value)){const rows=value.map(row=>visit(row,correction,scoped));return rows.some((row,i)=>row!==value[i])?rows:value;}
  const {entryId,workId,before,after}=correction;
  scoped=scoped||value.entryId===entryId||value.primaryWorkId===workId||value.workId===workId||value.id===workId;
  let out=value;
  for(const [key,old]of Object.entries(value)){
   const next=scoped&&fields.has(key)&&old===before?after:visit(old,correction,scoped);
   if(next!==old){if(out===value)out={...value};out[key]=next;}
  }
  return out;
}
export function applyCatalogTitleCorrections(model){return corrections.reduce((out,r)=>applies(model,r)?visit(out,r):out,model);}
export function correctCatalogTitleProjection(payload,model){return corrections.reduce((out,r)=>applies(model,r)?visit(out,r):out,payload);}
