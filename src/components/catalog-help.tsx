import Link from 'next/link';
import type {ReactNode} from 'react';
/** Accessible click/tap help without JS, with a deep-link to the permanent guide. */
export function CatalogHelp({label,href,children}:{label:string;href:string;children:ReactNode}){
 return <details className="catalog-mini-help">
  <summary aria-label={label} title={label}>?</summary>
  <div className="catalog-mini-help-content">
   {children}
   <Link href={href}>詳しい説明を読む ↗</Link>
  </div>
 </details>;
}
