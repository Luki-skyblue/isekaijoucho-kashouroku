// Owner-requested spelling correction, backed by the original artist's MV and
// label biography. Read/public projections change; the owner export stays intact.
const entryId='73a09ef2-ae91-48d0-92c7-46be298ab381',workId='2002b2a2-b69e-5435-9765-2dcc9cd44bfd';
const before='贖罪!! ロリ神レクイエム☆',after='粛聖!! ロリ神レクイエム☆';
const fields=new Set(['title','sortTitle','workTitle','rawLabel']);
export function correctedLegacyTargetTitle(target){
 return target?.entryId===entryId&&target?.primaryWorkId===workId&&target?.title===before?after:target?.title;
}
function applies(model){
 const entry=model.entries.get(entryId);
 return entry?.detail?.primaryWorkId===workId&&[before,after].includes(entry.detail.title)&&
  entry.singerIds?.length===1&&entry.singerIds[0]==='81a01233-230e-50a8-a309-11275c794cd0'&&!entry.detail.variations?.length;
}
function visit(value,scoped=false){
  if(!value||typeof value!=='object')return value;
  if(value instanceof Map){const rows=[...value].map(([key,row])=>[key,visit(row)]);return rows.some(([key,row])=>row!==value.get(key))?new Map(rows):value;}
  if(Array.isArray(value)){const rows=value.map(row=>visit(row,scoped));return rows.some((row,i)=>row!==value[i])?rows:value;}
  scoped=scoped||value.entryId===entryId||value.primaryWorkId===workId||value.workId===workId||value.id===workId;
  let out=value;
  for(const [key,old]of Object.entries(value)){
   const next=scoped&&fields.has(key)&&old===before?after:visit(old,scoped);
   if(next!==old){if(out===value)out={...value};out[key]=next;}
  }
  return out;
}
export function applyCatalogTitleCorrections(model){return applies(model)?visit(model):model;}
export function correctCatalogTitleProjection(payload,model){return applies(model)?visit(payload):payload;}
