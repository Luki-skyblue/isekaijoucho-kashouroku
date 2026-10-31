import {NAME_FIELDS} from '@/lib/ui-copy.mjs';
/** Search applies on submit; the applied search tag is the single explicit clear action.
 * Do not navigate when an in-progress draft becomes empty.
 */
export function CatalogSearchInput({query}:{query:string}){
 return <input key={query} name="q" type="text" aria-label={NAME_FIELDS.song+'を入力'} placeholder={NAME_FIELDS.song+'を入力'} maxLength={100} defaultValue={query}/>;
}
