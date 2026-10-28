import type {JsonObject} from './core';
export type SongReleaseGroup={key:string;release:JsonObject;items:JsonObject[];releaseDate:string|null};
export function songReleaseGroups(releases?:JsonObject[]):SongReleaseGroup[];
