// Catalogue terminology agreed on 2026-10-30. These labels describe singer
// relationships; they do not establish authorship, a new recording or an alias.
export const SONG_CLASSIFICATION_RULE='singer-set-v1';
export const SONG_TYPE_LABELS=Object.freeze({original:'オリジナル',cover:'カバー',collaboration:'コラボ',member_cover:'メンバーカバー',solo:'ソロ',collaboration_cover:'コラボカバー',variant:'その他'});
export const SONG_TYPES=Object.freeze(Object.keys(SONG_TYPE_LABELS));
export const SONG_CATEGORIES=Object.freeze([...SONG_TYPES,'medley']);
export const songTypeLabel=type=>SONG_TYPE_LABELS[type]??'';
export const isCoverSongType=type=>['cover','member_cover','solo','collaboration_cover'].includes(type);
export const formatSongTitleCredit=(credit,type,kind)=>credit&&kind!=='medley'&&isCoverSongType(type)&&!/^covered\s+by\b/i.test(credit.trim())?'Covered by '+credit:credit;
export const songTypeMatchesCategory=(type,category)=>type===category||(category==='member_cover'&&type==='solo');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ids=value=>Array.isArray(value)&&value.length>0&&value.every(id=>typeof id==='string'&&uuid.test(id))?[...new Set(value.map(id=>id.toLowerCase()))].sort():null;

/** Complete, nonempty sets only. Missing data is never an empty singer set. */
export function inferSongClassification({originalSingerIds,singerIds,originalSetComplete=false,singerSetComplete=false}={}){
 if(originalSetComplete!==true||singerSetComplete!==true)return null;
 const original=ids(originalSingerIds),current=ids(singerIds);if(!original||!current)return null;
 const r=new Set(original),s=new Set(current),shared=current.filter(id=>r.has(id)).length;
 let type,subtype=null,relation;
 if(shared===0){type='cover';relation='disjoint';}
 else if(shared===s.size&&shared===r.size){type='original';relation='same';}
 else if(shared===s.size){type='member_cover';subtype=s.size===1?'solo':null;relation='original_members_only';}
 else if(shared===r.size){type='collaboration';relation='all_original_with_others';}
 else{type='collaboration_cover';relation='some_original_with_others';}
 return {type,subtype,category:subtype??type,relation,ruleVersion:SONG_CLASSIFICATION_RULE,originalSingerIds:original,singerIds:current};
}

/** Preserve explicit assignments. Opting into automatic mode does not erase
 * official source assignments, and an evidence conflict is not a fallback. */
export function resolveSongClassification({setting,legacyType,sourcedTypes=[],originalSingerIds,singerIds,originalSetComplete,singerSetComplete}={}){
 const automatic=inferSongClassification({originalSingerIds,singerIds,originalSetComplete,singerSetComplete});
 const result=(category,source,reason=null)=>({type:category==='solo'?'member_cover':category,subtype:category==='solo'?'solo':null,category,source,ruleVersion:SONG_CLASSIFICATION_RULE,relation:automatic?.relation??null,automaticCandidate:automatic?.category??null,reason,
  basis:automatic?{originalSingerIds:automatic.originalSingerIds,singerIds:automatic.singerIds}:null});
 if(setting?.mode==='manual'){
  const type=setting.type==='member_cover'&&setting.subtype==='solo'?'solo':setting.type;
  return SONG_TYPES.includes(type)?result(type,'manual'):result(null,'unresolved','invalid_manual_type');
 }
 if(setting?.mode!=='automatic'&&legacyType!==null&&legacyType!==undefined&&legacyType!=='')return SONG_TYPES.includes(legacyType)?result(legacyType,'legacy'):result(null,'unresolved','invalid_existing_type');
 const sourced=[...new Set(sourcedTypes.filter(type=>SONG_TYPES.includes(type)))];
 if(sourced.length>1)return result(null,'unresolved','conflicting_source_types');
 if(sourced.length===1)return result(sourced[0],'sourced');
 return automatic?result(automatic.category,'automatic'):result(null,'unresolved','incomplete_singer_sets');
}
