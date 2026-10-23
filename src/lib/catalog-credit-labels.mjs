// Known display labels are conveniences, not a closed credit-role taxonomy.
// Unknown roles keep their source wording and can be indexed without a schema edit.
const labels={vocal:'歌唱',artist:'名義',lyricist:'作詞',composer:'作曲',arranger:'編曲',original_arranger:'原曲の編曲',original_concept:'原案'};
const order=['vocal','lyricist','composer','arranger','original_arranger'];
export function creditRoleLabel(role){return role.startsWith('video:')?`${creditRoleLabel(role.slice(6))}（動画）`:labels[role]??role;}
export function orderedCreditRoles(roles){return [...new Set(roles)].sort((a,b)=>(order.includes(a)?order.indexOf(a):order.length)-(order.includes(b)?order.indexOf(b):order.length)||a.localeCompare(b,'ja'));}
