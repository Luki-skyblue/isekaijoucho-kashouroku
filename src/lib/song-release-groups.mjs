// Presentation only: retain every recording row and group known product IDs.
// A matching title or external destination does not establish product identity.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function songReleaseGroups(releases=[]){
 const groups=[],products=new Map();
 for(const [index,release]of releases.entries()){
  const familyId=release?.family?.familyId,internal=typeof familyId==='string'&&uuid.test(familyId)&&!release.externalUrl;
  let group=internal?products.get(familyId):undefined;
  if(!group){group={key:internal?'family:'+familyId:'row:'+index,release,items:[]};groups.push(group);if(internal)products.set(familyId,group);}
  group.items.push(release);
 }
 return groups.map(group=>{
  const dates=group.items.map(item=>typeof item.edition?.releaseDate==='string'?item.edition.releaseDate:'');
  return {...group,releaseDate:dates[0]&&dates.every(date=>date===dates[0])?dates[0]:null};
 });
}
