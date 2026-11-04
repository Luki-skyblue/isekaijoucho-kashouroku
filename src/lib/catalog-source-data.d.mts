import type {PrivateModel} from './private-read-model.mjs';
import type {DiscoveryRoute} from './discovery-data.mjs';
import type {CatalogSourceKind} from './catalog-source-options.mjs';
export function sourceKindsForRoutes(routes:DiscoveryRoute[]):CatalogSourceKind[];
export function sourceKindsForEntry(model:PrivateModel,entryId:string):CatalogSourceKind[];
