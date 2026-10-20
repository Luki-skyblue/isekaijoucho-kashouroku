import type { Metadata } from 'next';
import {rpc} from '@/lib/api';
import {asArray,num,pageNumber,pageOffset,searchTerm,viewMode} from '@/lib/core';
import {ListPage} from '@/components/ui';
import {useCatalogEntryIndex} from '@/lib/catalog-mode';
import {readCatalogQuery,CatalogQuery} from '@/lib/catalog-list-params';
import {listCatalogEntries} from '@/lib/catalog-entry-api';
import {CatalogIndex} from '@/components/catalog-entry-ui';
import {localCatalogReviewEnabled} from '@/lib/catalog-local-review';

export const metadata: Metadata = {title:'楽曲目録',description:'ヰ世界情緒の楽曲・歌唱情報、バージョン、関連資料を辿る非公式目録。'};
export default async function Songs({searchParams}:{searchParams:Promise<CatalogQuery>}){
 const query=await searchParams,limit=24;
 if (useCatalogEntryIndex()) {
  const filters=readCatalogQuery(query);
  const data=await listCatalogEntries({search:filters.q,singerIds:filters.singerIds,singerMatch:filters.singerMatch,selectedKinds:filters.kinds,sort:filters.sort,limit,offset:pageOffset(filters.page,limit)});
  // Safety net: if a deployment switches modes before ANY public entry exists,
  // do not replace the populated directory with an empty screen. This is NOT
  // a substitute for the publication/HTTP acceptance gate.
  if (data.total===0 && filters.page===1 && !filters.q && !filters.singerIds.length && !filters.kinds.length) {
   const old=await rpc('kashouroku_v3_works',{p_search:null,p_limit:limit,p_offset:0});
   if(num(old?.total)>0){
    console.warn('New catalog contains no published entries; displaying existing work index. Check SONG_INDEX_MODE and release gate.');
    return <ListPage heading="楽曲一覧" items={asArray(old?.items)} total={num(old?.total)} term="" page={1} limit={limit} view={filters.view} kind="work"/>;
   }
  }
  return <>{localCatalogReviewEnabled()&&<p className="catalog-review-warning">開発用・ローカル候補レビュー：433件は公開済み楽曲数ではありません。検索と画面構成のみ検証できます。歌唱履歴・制作クレジットの新API結果はこのモードでは表示しません。</p>}<CatalogIndex items={data.items} total={data.total} query={filters} limit={limit}/></>;
 }
 const page=pageNumber(query.page),term=searchTerm(query.q);
 const data=await rpc('kashouroku_v3_works',{p_search:term||null,p_limit:limit,p_offset:pageOffset(page,limit)});
 return <ListPage heading="楽曲一覧" items={asArray(data?.items)} total={num(data?.total)} term={term} page={page} limit={limit} view={viewMode(query.view)} kind="work"/>;
}
