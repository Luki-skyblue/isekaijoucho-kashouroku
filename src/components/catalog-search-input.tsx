/** Search applies on submit; the applied search tag is the single explicit clear action.
 * Do not navigate when an in-progress draft becomes empty.
 */
export function CatalogSearchInput({query}:{query:string}){
 return <input key={query} name="q" type="text" aria-label="楽曲名を入力" placeholder="楽曲名を入力" maxLength={100} defaultValue={query}/>;
}
