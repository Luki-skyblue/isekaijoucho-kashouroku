export type CatalogSourceKind='youtube'|'x'|'release'|'live_release'|'live'|'stream'|'other';
export const CATALOG_SOURCE_OPTIONS:ReadonlyArray<{id:CatalogSourceKind;label:string}>;
export function readCatalogSources(value:unknown):CatalogSourceKind[];
