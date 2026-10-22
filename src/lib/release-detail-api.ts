import 'server-only';
import {rpc} from './api';
import {asArray,num,numberOfPages} from './core';
import {publicCatalogEnabled,publicReleaseDetail} from './public-catalog';
import {privateSnapshotEnabled,privateReleaseDetail} from './private-snapshot';
import {groupReleaseItems,releaseLinks,type ReleaseDetailQuery,type ReleaseDetailView} from './release-detail-data.mjs';

export async function getReleaseDetail(familyId:string,query:ReleaseDetailQuery):Promise<ReleaseDetailView|null>{
 if(publicCatalogEnabled())return publicReleaseDetail(familyId,query);
 if(privateSnapshotEnabled())return privateReleaseDetail(familyId,query);
 // The legacy live RPC has no edition filter. Retain its existing paging
 // instead of filtering a partial page or sending an unsupported DB argument.
 const limit=100,page=query.page??1;
 const release=await rpc('kashouroku_v3_release_family',{p_family_id:familyId,p_limit:limit,p_offset:(page-1)*limit});
 if(!release)return null;
 return {release,context:null,editions:asArray(release.editions),selectedEdition:null,components:asArray(release.components),groups:groupReleaseItems(release,asArray(release.items)),total:num(release.totalItems),page,pages:numberOfPages(num(release.totalItems),limit),artwork:[],links:releaseLinks(release)};
}
