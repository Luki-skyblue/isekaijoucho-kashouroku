/** Pure data/UI logic. No DB, Node, Next or DOM dependency. */
export type JsonObject = Record<string, unknown>;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function asObject(value: unknown): JsonObject { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}; }
export function asArray(value: unknown): JsonObject[] { return Array.isArray(value) ? value.map(asObject) : []; }
export function str(value: unknown): string { return typeof value === 'string' ? value : ''; }
export function textOr(value: unknown, alternative = '未登録'): string { return str(value).trim() || alternative; }
export function num(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
export function validId(value: string): boolean { return UUID_RE.test(value); }
export function pageNumber(raw: string | undefined): number {
 const n = Number(raw ?? '1'); return Number.isSafeInteger(n) && n > 0 && n <= 200 ? n : 1;
}
/** Keep detail pagination inside the public RPC p_offset <= 10000 contract. */
export function rpcDetailPage(raw: string | undefined, limit: number): number {
 if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) return 1;
 return Math.min(pageNumber(raw), Math.floor(10000 / limit) + 1);
}
export function searchTerm(raw: string | undefined): string { return (raw ?? '').trim().slice(0,100); }
export function pageOffset(page: number, limit: number): number { return (page - 1) * limit; }
export function numberOfPages(total: number, limit: number): number { return Math.ceil(Math.max(0,total)/limit); }
export function evidenceLabel(value: unknown): string {
 switch(value) { case 'full': return 'フル確認'; case 'partial': return '一部'; case 'unknown': case null: case undefined: return '未確認'; default: return '記録値: ' + str(value); }
}
export function displayDate(date: unknown, fallback = '日付未確認'): string {
 const s = str(date); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.replaceAll('-', '/') : fallback;
}
/** Deliberately never derive audio recording date from the publication date. */
export function recordingDate(part: JsonObject): string { return displayDate(part.occurredOn); }
/** Only assertions scoped to a particular rendition_part can be shown as exact singers. */
export function exactSingers(part: JsonObject): JsonObject[] { return asArray(part.exactPartParticipants).filter(x => str(x.role) === 'vocal'); }
export function relatedRenditionParticipants(part: JsonObject): JsonObject[] { return asArray(part.renditionWideParticipants); }
/** A release/program link never establishes that a whole work was sung in full. */
export function confirmedSongFullFromProgram(_association: JsonObject): boolean { return false; }
export function mediaGroups(items: unknown): JsonObject[] {
 // Expected one row per mediaId from RPC; guard accidentally duplicated items.
 const seen = new Set<string>();return asArray(items).filter(m=>{const id=str(m.mediaId); if(!id||seen.has(id))return false;seen.add(id);return true;});
}
export function safeExternalUrl(value: unknown): string | null {
 if(typeof value !== 'string' || value.length > 2048 || /[\s\\]/.test(value)) return null;
 try { const u=new URL(value); if (!['https:','http:'].includes(u.protocol) || u.username || u.password) return null; return u.toString(); }catch{return null;}
}
export function isEmptyKnownResult(value: unknown): boolean {return value!==null && typeof value==='object' && Array.isArray(asObject(value).items) && asArray(asObject(value).items).length===0;}

/** View selection is a presentation preference, not a query about canonical data. */
export type ViewMode = 'list' | 'grid';
export function viewMode(raw: string | undefined): ViewMode { return raw === 'grid' ? 'grid' : 'list'; }
/** Do not infer artwork from a title, provenance source, or media link. Only explicit public API fields. */
export function explicitThumbnail(record: JsonObject): string | null {
  const candidate = safeExternalUrl(record.thumbnailUrl ?? record.coverImageUrl);
  return candidate?.startsWith('https://') ? candidate : null;
}
