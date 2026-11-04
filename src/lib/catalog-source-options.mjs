/** Public query vocabulary. Keep this module free of catalog/server data. */
export const CATALOG_SOURCE_OPTIONS=[
 {id:'youtube',label:'YouTube'},
 {id:'x',label:'X'},
 {id:'release',label:'CD・配信'},
 {id:'live_release',label:'LIVE音源・映像'},
 {id:'live',label:'LIVEで披露'},
 {id:'stream',label:'配信・歌枠'},
 {id:'other',label:'その他'},
];
export function readCatalogSources(value){
 const requested=Array.isArray(value)?value:typeof value==='string'?[value]:[];
 return CATALOG_SOURCE_OPTIONS.filter(o=>requested.includes(o.id)).map(o=>o.id);
}
