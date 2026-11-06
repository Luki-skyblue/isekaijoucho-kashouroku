// Preserve old bookmarks while keeping one search interface.
import {redirect} from 'next/navigation';
import {discoverySearchHref} from '@/lib/combined-search-query.mjs';
export default async function Discover({searchParams}:{searchParams:Promise<{category?:string}>}){
 const query=await searchParams;
 redirect(discoverySearchHref(query.category));
}
