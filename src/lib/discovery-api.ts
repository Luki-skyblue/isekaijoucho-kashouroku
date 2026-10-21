import 'server-only';
import {publicCatalogEnabled,publicDiscovery} from './public-catalog';
import {privateSnapshotEnabled,privateDiscovery} from './private-snapshot';

export async function getDiscovery(query:{category?:string;page?:number}){
 if(publicCatalogEnabled())return publicDiscovery(query);
 if(privateSnapshotEnabled())return privateDiscovery(query);
 return null;
}
