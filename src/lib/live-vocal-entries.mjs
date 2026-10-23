// Publication metadata for two sourced vocal forms. This never manufactures
// entries: an actual DB entry must match work, title, raw credit and every singer.
import registry from './catalog-live-vocal-entries.json' with {type:'json'};
import {artworkEntryMatches} from './catalog-artwork.mjs';
export const LIVE_VOCAL_ENTRY_RECORDS=registry.records;
export function liveVocalRecordsForEntry(entry,records=LIVE_VOCAL_ENTRY_RECORDS){
 return records.filter(r=>r.status==='active'&&entry?.detail?.displayCredit===r.match.displayCredit&&
  artworkEntryMatches(entry,{...r.match,entryId:entry.detail.entryId}));
}
export function liveVocalTargetForRow(model,row){
 if(!row.vocalEntryKey)return null;
 const matches=[...model.entries.values()].filter(e=>liveVocalRecordsForEntry(e).some(r=>r.key===row.vocalEntryKey&&r.match.title===row.rawLabel&&r.match.displayCredit===row.displayCredit));
 return matches.length===1?{entryId:matches[0].detail.entryId,title:matches[0].detail.title}:null;
}
