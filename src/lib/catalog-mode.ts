import 'server-only';
import {publicCatalogEnabled} from './public-catalog';
/** Deliberate deployment gate: never switch because some drafts have been published. */
export function useCatalogEntryIndex():boolean {
 return publicCatalogEnabled() || process.env.SONG_INDEX_MODE === 'entries';
}
