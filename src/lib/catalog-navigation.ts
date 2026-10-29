/** Safe internal return URL for catalog entry pages.
 * The return context is navigation state, never a database filter or redirect target.
 * Non-catalog paths, fragments, unexpected parameters and overly long inputs fail closed.
 */
type ListPath = '/songs' | '/lives' | '/releases' | '/people';
const RETURN_KEYS:Record<ListPath,Set<string>> = {
 '/songs':new Set(['q','page','view','singer','singerMatch','type','sort']),
 '/lives':new Set(['q','page','view','artist','artistScope','artistMatch','type','sort']),
 '/releases':new Set(['q','page','view','category','sort']),
 '/people':new Set(['q','page','category','kind','role']),
};

export function safeListReturnTo(value: unknown, path:ListPath): string | null {
 const live=path==='/lives';
 if (typeof value !== 'string' || value.length > (live?12000:4096) || !value.startsWith(path) || /[\u0000-\u001f]/.test(value)) return null;
 try {
  const url = new URL(value, 'https://catalog.invalid');
  if (url.origin !== 'https://catalog.invalid' || url.pathname !== path || url.hash) return null;
  const entries = Array.from(url.searchParams.entries());
  if (entries.length > (live?140:40) || entries.some(([key, v])=>!RETURN_KEYS[path].has(key) || v.length > 120)) return null;
  // Preserve validated query parameters, including repeated singer/type values.
  const search = url.searchParams.toString();
  return path + (search ? '?' + search : '');
 } catch {return null;}
}

export function safeCatalogReturnTo(value: unknown): string | null {
 return safeListReturnTo(value,'/songs');
}

/** Keep a validated list context through edition switches and detail paging. */
export function withListReturnTo(href:string, path:ListPath, returnTo?:string|null):string {
 const safe=safeListReturnTo(returnTo,path);if(!safe)return href;
 const url=new URL(href,'https://catalog.invalid');
 if(url.origin!=='https://catalog.invalid'||!url.pathname.startsWith(path+'/'))return href;
 url.searchParams.set('from',safe);return url.pathname+url.search+url.hash;
}

export function listDetailHref(path:ListPath,id:string,returnTo?:string|null):string {
 return withListReturnTo(`${path}/${encodeURIComponent(id)}`,path,returnTo);
}

export function catalogEntryHref(entryId: string, returnTo?: string | null): string {
 const safe = safeCatalogReturnTo(returnTo);
 return `/songs/${encodeURIComponent(entryId)}` + (safe ? `?from=${encodeURIComponent(safe)}` : '');
}
