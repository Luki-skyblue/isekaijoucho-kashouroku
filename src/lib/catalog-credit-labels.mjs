// Search duties and source wording are separate. Only reviewed synonyms are
// grouped; composite roles and unknown credits keep their exact meaning.
import {isCoverSongType} from './catalog-song-classification.mjs';
// Unknown roles keep their source wording and can be indexed without a schema edit.
const labels={vocal:'歌唱',artist:'名義',lyricist:'作詞',composer:'作曲',arranger:'編曲',remixer:'リミックス',original_lyricist:'原曲の作詞',original_composer:'原曲の作曲',original_arranger:'原曲の編曲',original_concept:'原案'};
export const CREDIT_ROLE_GROUPS=[
 {id:'illustration',label:'イラスト',aliases:['Illustration','Illust','Illustrator','Illusutration','イラスト','イラストレーション','絵']},
 {id:'mix',label:'ミックス',aliases:['Mix','Mixing','Mixed','Mixed by','Mixing Engineer','ミックス','ミックスエンジニア']},
 {id:'mastering',label:'マスタリング',aliases:['Mastering','Mastered','Mastered by','Mst','Mastaring','マスタリング']},
 {id:'video',label:'映像',aliases:['Movie','Video','映像','映像制作']},
 {id:'director',label:'監督・ディレクション',aliases:['Director','Direction','Dir','監督','ディレクション','Music Video Director','Director（Music Video）','Movie - Director']},
 {id:'animation',label:'アニメーション',aliases:['Animation','アニメーション']},
 {id:'motion_graphics',label:'モーショングラフィックス',aliases:['Motion Graphics','MotionGraphics','モーショングラフィックス']},
 {id:'motion_edit',label:'モーション編集',aliases:['Motion Edit','Motion Editor','MotionEdit','モーションエディット']},
 {id:'title_design',label:'タイトルデザイン',aliases:['Title Design','タイトルデザイン']},
 {id:'title_lyric_design',label:'タイトル・歌詞デザイン',aliases:['Title & Lyric Design','Title & Lyrics Design','Title & Lylics Design','Title and Lyric Design','Title , Lyric Design']},
 {id:'typography',label:'タイポグラフィ',aliases:['Typography','Typo Design','タイポグラフィ','タイポデザイン']},
 {id:'guitar',label:'ギター',aliases:['Guitar','ギター']},
 {id:'bass',label:'ベース',aliases:['Bass','ベース']},
 {id:'piano',label:'ピアノ',aliases:['Piano','ピアノ']},
 {id:'violin',label:'バイオリン',aliases:['Violin','バイオリン','ヴァイオリン']},
 {id:'strings',label:'ストリングス',aliases:['Strings','ストリングス']},
 {id:'producer',label:'プロデューサー',aliases:['Producer','プロデューサー','Movie - Producer']},
 {id:'executive_producer',label:'エグゼクティブプロデューサー',aliases:['Executive Producer','エグゼクティブプロデューサー']},
 {id:'production_manager',label:'プロダクションマネージャー',aliases:['Production Manager','プロダクションマネージャー']},
];
const aliasKey=value=>value.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g,' ');
const roleGroups=new Map(),aliases=new Map();
for(const group of CREDIT_ROLE_GROUPS){roleGroups.set(group.id,group);for(const name of [group.id,...group.aliases]){
 const key=aliasKey(name);if(aliases.has(key)&&aliases.get(key)!==group.id)throw new Error('Ambiguous credit-role alias');aliases.set(key,group.id);
}}
export function canonicalCreditRole(role){
 if(typeof role!=='string')return '';
 if(role.startsWith('video:'))return 'video:'+canonicalCreditRole(role.slice(6));
 return aliases.get(aliasKey(role))??role;
}
/** Use this for detailed provenance. Do not translate a quoted media role. */
export function creditRoleSourceLabel(role){return labels[role]??role;}
export function creditRoleSearchTerms(role){
 const id=canonicalCreditRole(role),base=id.startsWith('video:')?id.slice(6):id,group=roleGroups.get(base);
 return [...new Set([role,id,creditRoleLabel(id),...(group?.aliases??[])])];
}
const order=['vocal','lyricist','composer','arranger','original_lyricist','original_composer','original_arranger'];
// The writer of a covered work is distinct from someone writing for this
// particular version. Preserve explicit version credits and the raw DB role.
export function songCreditRole(detail,credit){return isCoverSongType(detail?.legacySongType)&&['lyricist','composer'].includes(credit.role)&&['work','original'].includes(credit.scope)?'original_'+credit.role:credit.role;}
export function creditRoleLabel(role){const id=canonicalCreditRole(role);return id.startsWith('video:')?`${creditRoleLabel(id.slice(6))}（動画）`:labels[id]??roleGroups.get(id)?.label??role;}
export function orderedCreditRoles(roles){return [...new Set([...roles].map(canonicalCreditRole))].sort((a,b)=>(order.includes(a)?order.indexOf(a):order.length)-(order.includes(b)?order.indexOf(b):order.length)||creditRoleLabel(a).localeCompare(creditRoleLabel(b),'ja'));}
