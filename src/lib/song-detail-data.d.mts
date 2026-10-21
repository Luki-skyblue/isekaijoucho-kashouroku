import type {JsonObject} from './core';
import type {PrivateModel,PrivateWork} from './private-read-model.mjs';
export type SongDetailData={
 detail:JsonObject;metadata:JsonObject;
 credits:Array<{role:string;value:string|null;review:JsonObject|null}>;
 originalArranger:string|null;
 artwork:{kind:string;imageUrl:string;sourceUrl:string}|null;listenUrl:string|null;
 videos:Array<{mediaId:string;url:string;title:string|null;kind:string|null;publishedOn:string|null;imageUrl:string|null;credits:Array<{role:string;name:string}>}>;
 releases:JsonObject[];
 lives:Array<{eventId:string;title:string;date:string|null;uncertain:boolean}>;
 hasUncertainLives:boolean;comparison:JsonObject|null;versionLabel:string|null;
};
export function youtubeId(value:unknown):string|null;
export function safeSongUrl(value:unknown):string|null;
export function missingSongText(review:unknown):string;
export function songMetadataForEntry(entry:JsonObject):JsonObject;
export function songArtworkForEntry(entry:JsonObject,work?:Partial<PrivateWork>):SongDetailData['artwork'];
export function buildSongDetail(entry:JsonObject,work?:Partial<PrivateWork>):SongDetailData|null;
export function songDetailFromModel(model:PrivateModel,entryId:string):SongDetailData|null;
