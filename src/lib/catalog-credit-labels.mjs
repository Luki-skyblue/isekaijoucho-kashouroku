// Known display labels are conveniences, not a closed credit-role taxonomy.
import {isCoverSongType} from './catalog-song-classification.mjs';
// Unknown roles keep their source wording and can be indexed without a schema edit.
const labels={vocal:'歌唱',artist:'名義',lyricist:'作詞',composer:'作曲',arranger:'編曲',original_lyricist:'原曲の作詞',original_composer:'原曲の作曲',original_arranger:'原曲の編曲',original_concept:'原案'};
const order=['vocal','lyricist','composer','arranger','original_lyricist','original_composer','original_arranger'];
// The writer of a covered work is distinct from someone writing for this
// particular version. Preserve explicit version credits and the raw DB role.
export function songCreditRole(detail,credit){return isCoverSongType(detail?.legacySongType)&&['lyricist','composer'].includes(credit.role)&&['work','original'].includes(credit.scope)?'original_'+credit.role:credit.role;}
export function creditRoleLabel(role){return role.startsWith('video:')?`${creditRoleLabel(role.slice(6))}（動画）`:labels[role]??role;}
export function orderedCreditRoles(roles){return [...new Set(roles)].sort((a,b)=>(order.includes(a)?order.indexOf(a):order.length)-(order.includes(b)?order.indexOf(b):order.length)||a.localeCompare(b,'ja'));}
