import 'server-only';
import {publicCatalogEnabled,publicPersonDetail,publicSingerChoices,publicPeopleList} from './public-catalog';
import {privateSnapshotEnabled,privatePersonDetail,privateSingerChoices,privatePeopleList} from './private-snapshot';
import {validPersonKey,type PeopleListQuery} from './person-detail-data.mjs';
import {SINGERS} from './catalog-list-params';

export function personPagesEnabled(){return publicCatalogEnabled()||privateSnapshotEnabled();}
export async function getCatalogSingerChoices(){
 if(publicCatalogEnabled())return publicSingerChoices();
 if(privateSnapshotEnabled())return privateSingerChoices();
 return SINGERS;
}
export async function getPeopleList(query:PeopleListQuery){
 if(publicCatalogEnabled())return publicPeopleList(query);
 if(privateSnapshotEnabled())return privatePeopleList(query);
 return null;
}
export async function getPersonDetail(key:string,page=1,role='all',billing='all'){
 if(!validPersonKey(key))return null;
 if(publicCatalogEnabled())return publicPersonDetail(key,page,role,billing);
 if(privateSnapshotEnabled())return privatePersonDetail(key,page,role,billing);
 return null;
}
