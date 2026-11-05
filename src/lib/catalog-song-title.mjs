// A saved editorial version label can distinguish otherwise identical titles.
// History rows and debut labels never supply a version name here.
const text=value=>typeof value==='string'?value.trim():'';
const norm=value=>value.normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase('ja');
export function songDisplayTitle(detail){
 const title=text(detail?.title),origin=text(detail?.editorialOriginLabel);
 if(!title||!origin||/[（(].*\bver\.?\s*[)）]\s*$/i.test(title))return title;
 const fullLabel=origin.startsWith(title+' (')||origin.startsWith(title+'（');
 const label=text(fullLabel?origin.slice(title.length).trim().slice(1,-1):origin).replace(/(?:^|\s+)ver\.?\s*$/i,'').trim();
 if(!label||norm(title).includes(norm(label)))return title;
 return `${title} (${label} ver.)`;
}
