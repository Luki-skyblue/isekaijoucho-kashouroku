import {PAGE_LABELS} from '@/lib/ui-copy.mjs';
import type { Metadata } from 'next';
import {rpc} from '@/lib/api';
import {asArray,num,pageNumber,pageOffset,searchTerm,viewMode} from '@/lib/core';
import {ListPage} from '@/components/ui';
import {privateSnapshotEnabled,privateLiveList,privateLiveFilterOptions} from '@/lib/private-snapshot';
import {readLiveQuery,type LiveQuery} from '@/lib/live-list-params';
import {LiveIndex} from '@/components/live-index';
import {publicCatalogEnabled,publicLiveList,publicLiveFilterOptions} from '@/lib/public-catalog';
export const metadata: Metadata = {title:PAGE_LABELS.lives,description:'ヰ世界情緒のLIVE情報とセットリスト。'};
export default async function Lives({searchParams}:{searchParams:Promise<LiveQuery>}){
 const query=await searchParams,limit=24;
 if(privateSnapshotEnabled()||publicCatalogEnabled()) {
  const list=privateSnapshotEnabled()?privateLiveList:publicLiveList;
  const optionsFor=privateSnapshotEnabled()?privateLiveFilterOptions:publicLiveFilterOptions;
  const filters=readLiveQuery(query);
  const [data,options]=await Promise.all([list({search:filters.q,
   ...(filters.artistScope==='billing'?{billingIds:filters.artistIds}:{castIds:filters.artistIds}),
   castMatch:filters.artistMatch,formats:filters.formats,sort:filters.sort,dateBasis:'first',limit,offset:pageOffset(filters.page,limit)}),optionsFor()]);
  return <LiveIndex items={data.items} total={data.total} query={filters} limit={limit} artists={options.artists} review={options.review}/>;
 }
 const one=(x:string|string[]|undefined)=>Array.isArray(x)?x[0]:x;
 const page=pageNumber(one(query.page)),term=searchTerm(one(query.q));
 const data=await rpc('kashouroku_v3_events',{p_search:term||null,p_limit:limit,p_offset:pageOffset(page,limit)});
 return <ListPage heading={PAGE_LABELS.lives} items={asArray(data?.items)} total={num(data?.total)} term={term} page={page} limit={limit} view={viewMode(one(query.view))} kind="event"/>;
}
