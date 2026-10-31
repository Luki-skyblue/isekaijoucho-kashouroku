const text=value=>typeof value==='string'?value.trim():'';

// A show billing is distinct from its guests or the singers of one programme item.
export function liveHeading(item){
 const official=text(item?.officialBillingLabel);
 if(official)return official;
 const names=[...new Set((Array.isArray(item?.billingArtists)?item.billingArtists:[]).map(a=>text(a?.name)).filter(Boolean))];
 const format=text(item?.liveFormat)||text(item?.eventKind);
 const kind=format==='one_man'?'ONE-MAN LIVE':format==='festival'?'フェス':'';
 return [names.join('・'),kind].filter(Boolean).join(' ');
}
