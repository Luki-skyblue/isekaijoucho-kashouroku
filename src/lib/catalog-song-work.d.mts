import type {PrivateModel} from './private-read-model.mjs';
export type CatalogSongWork={title:string;entries:Array<{entryId:string;title:string;displayCredit:string}>};
export function catalogSongWorkFromModel(model:PrivateModel,workId:string):CatalogSongWork|null;
