// Shared, data-free query vocabulary. The browser builds a tree; the server
// validates and evaluates it. No expression is executed as JavaScript or SQL.
import {SEARCH_TARGETS,searchTarget} from './search-navigation.mjs';
import {CATALOG_SOURCE_OPTIONS} from './catalog-source-options.mjs';
import {validFirstDate,validCreatorKey,validCreditRole} from './catalog-advanced-query.mjs';
import {canonicalCreditRole} from './catalog-credit-labels.mjs';

export const SEARCH_LIMITS={nodes:96,rules:64,depth:7,values:24,text:160,json:6000,url:8000};
export const SOURCE_SEARCH_OPTIONS=[...CATALOG_SOURCE_OPTIONS,
 {id:'youtube_isekai',label:'ヰ世界情緒公式YouTube'},
 {id:'youtube_vwp',label:'V.W.P公式YouTube'},
 {id:'youtube_other',label:'その他のYouTubeチャンネル'},
];
const field=(id,label,kind,options={})=>({id,label,kind,...options});
const common=[field('keyword','キーワード','text'),field('title','曲名・読み','text')];
export const SEARCH_FIELDS={
 songs:[...common,field('singer','歌唱者','set',{choices:'singers',exact:true}),field('billing','歌唱名義','text'),
  field('song_kind','楽曲区分','set',{choices:'songKinds'}),field('credit','制作担当','credit'),
  field('first_date','初出日','date'),field('source','公開・収録先','set',{choices:'sources'}),
  field('release','収録作品','set',{choices:'releases'}),field('event','披露公演','set',{choices:'events'}),
  field('tie_up','タイアップ','text'),field('video_title','関連動画のタイトル','text'),field('video_kind','関連動画の種別','set',{choices:'videoKinds'})],
 lives:[field('keyword','キーワード','text'),field('title','公演名','text'),field('date','初回開催日','date'),
  field('artist','出演者','set',{choices:'artists'}),field('billing_artist','公演名義','set',{choices:'artists'}),
  field('live_format','公演の形態','set',{choices:'liveFormats'}),
  field('venue','会場','text'),field('song','披露曲','set',{choices:'songs'}),field('release','収録された作品','set',{choices:'releases'})],
 releases:[field('keyword','キーワード','text'),field('title','作品名','text'),field('billing','作品名義','text'),
  field('date','初回発売日','date'),field('release_category','分類','set',{choices:'releaseCategories'}),
  field('release_kind','作品の種類','set',{choices:'releaseKinds'}),field('media','媒体','set',{choices:'media'}),
  field('catalog_number','品番','text'),field('song','収録曲','set',{choices:'songs'}),field('event','収録公演','set',{choices:'events'})],
 people:[field('keyword','キーワード','text'),field('title','名前・別名','text'),
  field('involvement','関わり方','set',{choices:'involvements'}),field('person_kind','名義の種類','set',{choices:'personKinds'}),
  field('role','担当','set',{choices:'roles'}),field('related_count','関連楽曲数','number'),
  field('group','所属グループ','set',{choices:'groups'}),field('song','関連楽曲','set',{choices:'songs'})],
};
export const SEARCH_SORTS={
 songs:[['date_desc','初出：新しい順'],['date_asc','初出：古い順'],['title_asc','曲名：昇順'],['title_desc','曲名：降順']],
 lives:[['date_desc','開催日：新しい順'],['date_asc','開催日：古い順'],['title_asc','公演名：昇順'],['title_desc','公演名：降順']],
 releases:[['date_desc','発売日：新しい順'],['date_asc','発売日：古い順'],['title_asc','作品名：昇順'],['title_desc','作品名：降順']],
 people:[['related_desc','関連楽曲：多い順'],['related_asc','関連楽曲：少ない順'],['title_asc','名前：昇順'],['title_desc','名前：降順']],
};
const options={
 text:[['contains','含む'],['equals','一致する'],['not_contains','含まない']],
 set:[['any','いずれかを含む'],['all','すべて含む'],['none','含まない']],
 date:[['between','期間内'],['gte','以降'],['lte','以前']],
 number:[['eq','等しい'],['gte','以上'],['lte','以下'],['between','範囲内']],
 credit:[['matches','担当している'],['not_matches','担当していない']],
};
export function fieldFor(target,id){return SEARCH_FIELDS[searchTarget(target)].find(f=>f.id===id)??null;}
export function operatorsFor(def){return [...(options[def?.kind]??[]),...(def?.exact?[['only','この組合せのみ'],['subset','この中の人だけ']]:[]),['exists','登録あり'],['missing','登録なし']];}
export const emptySearchTree=()=>({type:'group',match:'all',not:false,children:[]});
export function emptySearchRule(target='songs',id='keyword'){
 const def=fieldFor(target,id)??SEARCH_FIELDS[searchTarget(target)][0];
 return {type:'rule',field:def.id,op:operatorsFor(def)[0][0],value:def.kind==='set'?[]:def.kind==='credit'?{person:'',role:''}:def.kind==='date'?{from:'',to:''}:def.kind==='number'?{from:'',to:''}:''};
}
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const clean=x=>typeof x==='string'&&!/[\u0000-\u001f\u007f]/.test(x)&&x.length<=SEARCH_LIMITS.text;
const integer=x=>typeof x==='string'&&/^\d{1,8}$/.test(x)&&Number.isSafeInteger(Number(x));
const one=value=>Array.isArray(value)?value[0]:value;
export function validateSearchTree(input,target='songs'){
 const errors=[];let nodes=0,rules=0;
 function read(node,depth,path){
  if(++nodes>SEARCH_LIMITS.nodes||depth>SEARCH_LIMITS.depth){if(!errors.includes('条件のまとまりが多すぎます。'))errors.push('条件のまとまりが多すぎます。');return null;}
  if(!plain(node)){errors.push(`${path}を読み込めません。`);return null;}
  if(node.type==='group'){
   if(!['all','any'].includes(node.match)||typeof node.not!=='boolean'||!Array.isArray(node.children)||node.children.length>SEARCH_LIMITS.rules){errors.push(`${path}の組み合わせを確認してください。`);return null;}
   if(depth>0&&!node.children.length){errors.push(`${path}に条件を追加するか、まとまりを削除してください。`);return null;}
   return {type:'group',match:depth===0&&!node.children.length?'all':node.match,not:node.not,children:node.children.map((n,i)=>read(n,depth+1,`${path}・${i+1}`)).filter(Boolean)};
  }
  if(node.type!=='rule'||++rules>SEARCH_LIMITS.rules){errors.push('検索条件が多すぎるか、読み込めません。');return null;}
  const def=fieldFor(target,node.field);
  if(!def||!operatorsFor(def).some(([op])=>op===node.op)){errors.push(`${path}の項目・比較方法を選び直してください。`);return null;}
  const label=`${path}（${def.label}）`,out={type:'rule',field:def.id,op:node.op};
  if(['exists','missing'].includes(node.op))return out;
  if(def.kind==='text'){
   if(!clean(node.value)||!node.value.trim()){errors.push(`${label}を入力するか、条件を削除してください。`);return null;}
   return {...out,value:node.value.trim()};
  }
  if(def.kind==='set'){
   if(!Array.isArray(node.value)||!node.value.length||node.value.length>SEARCH_LIMITS.values||node.value.some(v=>!clean(v)||!v.trim())){errors.push(`${label}を選択してください。`);return null;}
   return {...out,value:[...new Set(def.id==='role'?node.value.map(canonicalCreditRole):node.value)]};
  }
  if(def.kind==='credit'){
   if(!plain(node.value)||(!node.value.person&&!node.value.role)||(node.value.person&&!validCreatorKey(node.value.person))||(node.value.role&&!validCreditRole(node.value.role))){errors.push(`${label}の担当者か担当を選択してください。`);return null;}
   return {...out,value:{person:node.value.person??'',role:canonicalCreditRole(node.value.role??'')}};
  }
  if(!plain(node.value)){errors.push(`${label}を確認してください。`);return null;}
  const from=typeof node.value.from==='string'?node.value.from:'',to=typeof node.value.to==='string'?node.value.to:'';
  const valid=def.kind==='date'?validFirstDate:integer;
  if((from&&!valid(from))||(to&&!valid(to))||(!from&&!to)||node.op!=='between'&&!from||node.op==='between'&&from&&to&&(def.kind==='date'?from>to:Number(from)>Number(to))){errors.push(`${label}の値・開始と終了を確認してください。`);return null;}
  return {...out,value:{from,to:node.op==='between'?to:''}};
 }
 const tree=read(input,0,'条件');
 if(tree?.type!=='group')errors.push('条件全体の組み合わせを読み込めません。');
 if(tree&&!tree.children?.length&&tree.not)errors.push('除外する条件を指定してください。');
 return {tree:errors.length?null:tree,errors:[...new Set(errors)],ruleCount:rules};
}
const group=(match,children)=>({type:'group',match,not:false,children});
const rule=(field,op,value)=>({type:'rule',field,op,value});
const values=v=>Array.isArray(v)?v:typeof v==='string'?[v]:[];
export function legacySearchTree(raw,target='songs'){
 const children=[],term=one(raw.q);if(typeof term==='string'&&term.trim())children.push(rule('keyword','contains',term.trim().slice(0,SEARCH_LIMITS.text)));
 if(target==='songs'){
  const singers=values(raw.singer).filter(uuid);if(singers.length)children.push(rule('singer',({contains:'all',only:'only',subset:'subset',any:'any'})[one(raw.singerMatch)]??'all',singers));
  if(values(raw.type).length)children.push(rule('song_kind','any',values(raw.type)));
  if(values(raw.source).length)children.push(rule('source','any',values(raw.source)));
  if(one(raw.creator)||one(raw.creditRole))children.push(rule('credit','matches',{person:one(raw.creator)??'',role:one(raw.creditRole)??''}));
  if(one(raw.firstFrom)||one(raw.firstTo))children.push(rule('first_date','between',{from:one(raw.firstFrom)??'',to:one(raw.firstTo)??''}));
 }else if(target==='lives'){
  const artists=values(raw.artist).filter(uuid);if(artists.length)children.push(rule(one(raw.artistScope)==='billing'?'billing_artist':'artist',one(raw.artistMatch)==='all'?'all':'any',artists));
  if(values(raw.type).length)children.push(rule('live_format','any',values(raw.type)));
 }else if(target==='releases'){
  if(['music','live'].includes(one(raw.category)))children.push(rule('release_category','any',[one(raw.category)]));
 }else if(target==='people'){
  const category=one(raw.category);if(category&&category!=='all'&&category!=='groups')children.push(rule('involvement','any',[({artists:'vocal',creators:'music'})[category]??category]));
  if(one(raw.kind)==='group'||category==='groups')children.push(rule('person_kind','any',['group']));
  if(one(raw.role)&&one(raw.role)!=='all')children.push(rule('role','any',[one(raw.role)]));
 }
 return group('all',children);
}
export function readCombinedSearch(raw={}){
 const target=searchTarget(one(raw.target)),encoded=one(raw.where);let input,errors=[];
 if(one(raw.target)&&!SEARCH_TARGETS.some(t=>t.id===one(raw.target)))errors.push('検索する対象を選び直してください。');
 try{if(typeof encoded==='string'&&encoded){if(encoded.length>SEARCH_LIMITS.json)throw Error();input=JSON.parse(encoded);}else input=legacySearchTree(raw,target);}
 catch{errors.push('共有された検索条件を読み込めません。条件をクリアしてやり直してください。');}
 let checked=errors.length?{tree:null,errors,ruleCount:0}:validateSearchTree(input,target);
 if(checked.tree){try{combinedSearchHref({target,tree:checked.tree});}catch{checked={...checked,tree:null,errors:['検索条件が長すぎます。条件を少し減らしてください。']};}}
 const aliases={first_desc:'date_desc',first_asc:'date_asc',name_asc:'title_asc',name_desc:'title_desc'},sortValue=aliases[one(raw.sort)]??one(raw.sort);
 const sort=SEARCH_SORTS[target].some(([id])=>id===sortValue)?sortValue:SEARCH_SORTS[target][0][0];
 const page=Number(one(raw.page));
 return {target,...checked,sort,view:one(raw.view)==='grid'?'grid':'list',page:Number.isSafeInteger(page)&&page>0&&page<=10000?page:1};
}
export function combinedSearchHref(query,overrides={}){
 const q={...query,...overrides},target=searchTarget(q.target),p=new URLSearchParams({target});
 if(q.tree?.children?.length||q.tree?.not)p.set('where',JSON.stringify(q.tree));
 if(SEARCH_SORTS[target].some(([id])=>id===q.sort)&&q.sort!==SEARCH_SORTS[target][0][0])p.set('sort',q.sort);
 if(q.view==='grid')p.set('view','grid');if(q.page>1)p.set('page',String(q.page));
 const url='/search?'+p.toString();if(url.length>SEARCH_LIMITS.url)throw Error('検索条件が長すぎます。条件を少し減らしてください。');return url;
}
export function safeCombinedSearchReturnTo(value){
 if(typeof value!=='string'||value.length>SEARCH_LIMITS.url||!value.startsWith('/search')||/[\u0000-\u001f]/.test(value))return null;
 try{const u=new URL(value,'https://catalog.invalid');if(u.origin!=='https://catalog.invalid'||u.pathname!=='/search'||u.hash)return null;
  const allowed=new Set(['target','where','sort','view','page']),seen=new Set();for(const [k]of u.searchParams){if(!allowed.has(k)||seen.has(k))return null;seen.add(k);}
  const q=readCombinedSearch(Object.fromEntries(u.searchParams));return q.errors.length?null:combinedSearchHref(q);
 }catch{return null;}
}
export function discoverySearchHref(category){
 const mapping={isekai_official:['youtube_isekai'],vwp_official:['youtube_vwp'],other_channel:['youtube_other'],cd_album:['release'],live_event:['live','live_release'],stream_event:['stream'],other:['x','other']};
 const tree=group('all',category==='unclassified'?[{type:'rule',field:'source',op:'missing'}]:mapping[category]?[rule('source','any',mapping[category])]:[]);
 return combinedSearchHref({target:'songs',tree});
}
export function conditionText(node,target,choices={}){
 if(node.type==='group')return `${node.not?'除外：':''}${node.match==='all'?'すべて':'いずれか'}［${node.children.map(n=>conditionText(n,target,choices)).join(node.match==='all'?' ＋ ':' ／ ')}］`;
 const def=fieldFor(target,node.field);if(!def)return '';
 const op=operatorsFor(def).find(([id])=>id===node.op)?.[1]??'',value=node.value;
 let label=Array.isArray(value)?value.map(id=>choices[def.choices]?.find(o=>o.id===id)?.label??'登録情報にない選択').join('・'):typeof value==='string'?value:typeof value==='object'&&value?def.kind==='credit'?[choices.creators?.find(p=>p.id===value.person)?.label,choices.creditRoles?.find(p=>p.id===value.role)?.label].filter(Boolean).join(' / '):node.op==='between'?`${value.from||'指定なし'}〜${value.to||'指定なし'}`:value.from:'';
 return `${def.label}：${label?label+' · ':''}${op}`;
}
