import 'server-only';
import {publicCatalogEnabled,publicReleaseList} from './public-catalog';
import {privateSnapshotEnabled,privateReleaseList} from './private-snapshot';
import type {ReleaseListQuery} from './release-list-data.mjs';

export async function getReleaseList(query:ReleaseListQuery){
 if(publicCatalogEnabled())return publicReleaseList(query);
 if(privateSnapshotEnabled())return privateReleaseList(query);
 return null;
}
