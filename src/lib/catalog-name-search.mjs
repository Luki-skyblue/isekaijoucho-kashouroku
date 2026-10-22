// Search normalization never establishes identity or alters the credit text.
const normalize=value=>(typeof value==='string'?value:'').normalize('NFKC').toLocaleLowerCase('ja').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
export function catalogNameMatches(choice,term){const q=normalize(term).trim();return [choice.name,...(choice.aliases??[])].some(name=>normalize(name).includes(q));}
