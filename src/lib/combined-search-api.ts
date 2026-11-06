import 'server-only';
import {publicCatalogEnabled,publicCombinedSearch} from './public-catalog';
import {privateSnapshotEnabled,privateCombinedSearch} from './private-snapshot';
export async function getCombinedSearch(query:Record<string,string|string[]|undefined>){
 if(publicCatalogEnabled())return publicCombinedSearch(query);
 if(privateSnapshotEnabled())return privateCombinedSearch(query);
 return null;
}
