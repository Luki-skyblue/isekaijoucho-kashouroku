import 'server-only';
import type {Metadata} from 'next';
import {pageMetadata,SITE_ORIGIN,SITE_TITLE,type PageMetadataOptions} from './site-metadata.mjs';
import {privateSnapshotEnabled} from './private-snapshot';
import {localCatalogReviewEnabled} from './catalog-local-review';

export function sitePageMetadata(path:string,title?:string,options:Omit<PageMetadataOptions,'privateView'>={}):Metadata{
 return pageMetadata(path,title,{...options,privateView:privateSnapshotEnabled()||localCatalogReviewEnabled()});
}
export function rootMetadata():Metadata{
 // Canonical belongs to each page; do not inherit the TOP URL into 404/owner.
 const {alternates:_,...metadata}=sitePageMetadata('/');
 return {...metadata,metadataBase:new URL(SITE_ORIGIN),title:{default:SITE_TITLE,template:'%s | '+SITE_TITLE}};
}
export function missingPageMetadata():Metadata{return {robots:{index:false,follow:false}};}
