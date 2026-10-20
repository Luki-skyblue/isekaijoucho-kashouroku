/** G7v2 boundary adapter. No visibility/draft parameter is ever sent by the site. */
import type {CatalogListFilters, CatalogCategory, SingerMatch} from './catalog-entry-api';

const matchMode:Record<SingerMatch,'any'|'all'|'exact'|'subset'> = {
  any:'any', contains:'all', only:'exact', subset:'subset',
};
const validKinds=new Set<CatalogCategory>(['original','cover','collaboration','variant','medley']);
export function catalogV2Params(filters:CatalogListFilters){
  const ids=filters.singerIds??[];
  const kinds=filters.selectedKinds??[];
  const limit=filters.limit??24;
  const offset=filters.offset??0;
  if(!Array.isArray(ids)||ids.length>20 || !ids.every(x=>typeof x==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x)))
    throw new Error('Invalid singer IDs');
  if(!Array.isArray(kinds) || kinds.some(k=>!validKinds.has(k)) || kinds.length!==new Set(kinds).size)
    throw new Error('Invalid catalog categories');
  if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>100000)
    throw new Error('Invalid pagination');
  const singerMatch=filters.singerMatch??'any';
  if(!(singerMatch in matchMode))throw new Error('Invalid singer match');
  const sort=filters.sort??'title_asc';
  if(sort!=='title_asc'&&sort!=='title_desc')throw new Error('Invalid sort');
  return {
    p_search:(filters.search??'').trim().slice(0,100)||null,
    p_singer_ids:ids.length?ids:null,
    p_singer_match:matchMode[singerMatch],
    p_legacy_song_types:kinds.length?kinds:null,
    p_sort:sort,
    p_limit:limit,
    p_offset:offset,
  };
}
