// Keep each existing list's query vocabulary. Switching search targets carries
// only the text query; e.g. a LIVE type must never become a song category.
export const SEARCH_TARGETS=[
 {id:'songs',label:'楽曲',path:'/songs'},
 {id:'lives',label:'LIVE',path:'/lives'},
 {id:'releases',label:'収録作品',path:'/releases'},
 {id:'people',label:'関係者',path:'/people'},
];
export const searchTarget=value=>SEARCH_TARGETS.some(t=>t.id===value)?value:'songs';
export function detailSearchHref(listHref){
 const [path,query='']=String(listHref).split('?'),target=SEARCH_TARGETS.find(t=>t.path===path);
 const params=new URLSearchParams(query);params.delete('page');params.set('target',target?.id??'songs');
 return '/search?'+params.toString();
}
export function searchTargetHref(target,term=''){
 const params=new URLSearchParams({target:searchTarget(target)});
 if(term)params.set('q',term);
 return '/search?'+params.toString();
}
