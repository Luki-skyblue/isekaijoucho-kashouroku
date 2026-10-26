// Work URLs are navigation aliases, never evidence that one vocal form is the
// performance in a medley. Keep every registered choice when it is ambiguous.
export function catalogSongWorkFromModel(model,workId){
 const work=model.works.get(workId);if(!work)return null;
 const entries=[...model.entries.values()].filter(e=>e.detail.kind!=='medley'&&e.detail.primaryWorkId===workId)
  .map(e=>({entryId:e.detail.entryId,title:e.detail.title,displayCredit:e.detail.displayCredit||''}))
  .sort((a,b)=>a.title.localeCompare(b.title,'ja')||a.displayCredit.localeCompare(b.displayCredit,'ja')||a.entryId.localeCompare(b.entryId));
 return {title:work.detail.title||entries[0]?.title||'楽曲',entries};
}
