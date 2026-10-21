// Store image sources, never a frozen per-song selection. All surfaces derive
// ordered candidates from current catalogue relationships on each read.
// Update the JSON through tools/update-catalog-artwork.mjs; no selector edits.
import registry from './catalog-artwork-data.json' with {type:'json'};
export const ARTWORK_RECORDS=registry.entries;
export const RELEASE_ARTWORK_RECORDS=registry.releases;
export const EVENT_ARTWORK_RECORDS=registry.events;
