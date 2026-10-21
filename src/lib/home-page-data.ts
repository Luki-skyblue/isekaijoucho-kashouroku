import 'server-only';
import {privateSnapshotEnabled,privateHomeRecent} from './private-snapshot';
import {publicCatalogEnabled,publicHomeRecent} from './public-catalog';
import type {HomeRecent} from './home-recent-data.mjs';

export async function homePageData():Promise<HomeRecent>{
 if(privateSnapshotEnabled())return privateHomeRecent();
 if(publicCatalogEnabled())return publicHomeRecent();
 return {songs:[],releases:[],liveReleases:[]};
}
