import type {PrivateModel} from './private-read-model.mjs';
export function createPublicRelease(rows:unknown[],options?:{releaseId?:string;createdAt?:string;catalogId?:string|null;liveCandidates?:unknown;sourceSha256?:string}):unknown[];
export function validatePublicRelease(rows:unknown):PrivateModel;
export function readPublicRelease(path:string,expectedSha256?:string):{rows:unknown[];bytes:Buffer;sha256:string;model:PrivateModel};
export function publicReleaseDiff(before:unknown[]|null,after:unknown[]):Record<string,{added:string[];removed:string[];changed:string[]}>;
export function publicExternalUrl(value:unknown):string|null;
