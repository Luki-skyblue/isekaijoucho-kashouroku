import 'server-only';
import {publicCatalogEnabled,publicPersonDetail} from './public-catalog';
import {privateSnapshotEnabled,privatePersonDetail} from './private-snapshot';
import {validPersonKey} from './person-detail-data.mjs';

export function personPagesEnabled(){return publicCatalogEnabled()||privateSnapshotEnabled();}
export async function getPersonDetail(key:string,page=1){
 if(!validPersonKey(key))return null;
 if(publicCatalogEnabled())return publicPersonDetail(key,page);
 if(privateSnapshotEnabled())return privatePersonDetail(key,page);
 return null;
}
