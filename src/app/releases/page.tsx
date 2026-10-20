import type { Metadata } from 'next';
import {rpc} from '@/lib/api';
import {asArray,num,pageNumber,pageOffset,searchTerm,viewMode} from '@/lib/core';
import {ListPage} from '@/components/ui';
export const metadata: Metadata = {title:'リリース・商品',description:'ヰ世界情緒に関連するCD・映像商品などの収録記録。'};
export default async function Releases({searchParams}:{searchParams:Promise<{q?:string;page?:string;view?:string}>}){
 const query=await searchParams,page=pageNumber(query.page),term=searchTerm(query.q),limit=24;
 const data=await rpc('kashouroku_v3_release_families',{p_search:term||null,p_limit:limit,p_offset:pageOffset(page,limit)});
 return <ListPage heading="収録作品" items={asArray(data?.items)} total={num(data?.total)} term={term} page={page} limit={limit} view={viewMode(query.view)} kind="release"/>;
}
