/** Safe internal return URL for catalog entry pages.
 * The return context is navigation state, never a database filter or redirect target.
 * Non-catalog paths, fragments, unexpected parameters and overly long inputs fail closed.
 */
const RETURN_KEYS = new Set(['q','page','view','singer','singerMatch','type','sort']);
const MAX_RETURN_LENGTH = 1800;

export function safeCatalogReturnTo(value: unknown): string | null {
 if (typeof value !== 'string' || value.length > MAX_RETURN_LENGTH || !value.startsWith('/songs') || /[\u0000-\u001f]/.test(value)) return null;
 try {
  const url = new URL(value, 'https://catalog.invalid');
  if (url.origin !== 'https://catalog.invalid' || url.pathname !== '/songs' || url.hash) return null;
  const entries = Array.from(url.searchParams.entries());
  if (entries.length > 28 || entries.some(([key, v])=>!RETURN_KEYS.has(key) || v.length > 120)) return null;
  // Preserve validated query parameters, including repeated singer/type values.
  const search = url.searchParams.toString();
  return '/songs' + (search ? '?' + search : '');
 } catch {return null;}
}

export function catalogEntryHref(entryId: string, returnTo?: string | null): string {
 const safe = safeCatalogReturnTo(returnTo);
 return `/songs/${encodeURIComponent(entryId)}` + (safe ? `?from=${encodeURIComponent(safe)}` : '');
}
