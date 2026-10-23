import type {PrivateModel} from './private-read-model.mjs';
export type HomeSong={entryId:string;title:string;date:string;dateLabel:'初出'|'動画公開';sourceLabel:string;displayCredit:string;thumbnailUrl:string|null;thumbnailUrls:string[]};
export type HomeRelease={familyId:string;title:string;date:string;upcoming:boolean;kindLabel:string;thumbnailUrl:string|null;thumbnailUrls:string[]};
export type HomeRecent={songs:HomeSong[];releases:HomeRelease[]};
export function homeToday():string;
export function homeRecentFromModel(model:PrivateModel,options?:{today?:string}):HomeRecent;
