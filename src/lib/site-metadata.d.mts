import type {Metadata} from 'next';
export const SITE_ORIGIN:string;
export const SITE_TITLE:string;
export const SITE_DESCRIPTION:string;
export const SHARE_IMAGE:{url:string;width:number;height:number;alt:string};
export type PageMetadataOptions={description?:string;index?:boolean;privateView?:boolean};
export function pageMetadata(path:string,title?:string,options?:PageMetadataOptions):Metadata;
