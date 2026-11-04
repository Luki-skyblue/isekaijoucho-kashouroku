/** Share metadata uses the public origin, never a preview host or return URL. */
export const SITE_ORIGIN='https://isekaijoucho-kashouroku.vercel.app';
export const SITE_TITLE='ヰ世界情緒 歌唱録';
export const SITE_DESCRIPTION='ヰ世界情緒の楽曲、歌唱履歴、LIVE、動画、収録作品を辿る非公式データベース。';
export const SHARE_IMAGE={url:SITE_ORIGIN+'/share/site-card-v1.png',width:1200,height:630,alt:'ヰ世界情緒 歌唱録 — 非公式ファンサイト'};

export function pageMetadata(path,title=SITE_TITLE,{description=SITE_DESCRIPTION,index=true,privateView=false}={}){
 if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||/[\\\u0000-\u0020]/.test(path))throw new Error('Metadata path must be a local route');
 const url=new URL(path,SITE_ORIGIN);if(url.origin!==SITE_ORIGIN)throw new Error('Metadata origin changed');
 url.search='';url.hash='';
 const fullTitle=title===SITE_TITLE?SITE_TITLE:title+' | '+SITE_TITLE;
 return {
  title,description,
  ...(privateView?{robots:{index:false,follow:false}}:!index?{robots:{index:false,follow:true}}:{}),
  ...(!privateView?{alternates:{canonical:url.href}}:{}),
  openGraph:{type:'website',locale:'ja_JP',siteName:SITE_TITLE,title:fullTitle,description,
   ...(!privateView?{url:url.href}:{}),images:[{...SHARE_IMAGE}]},
  twitter:{card:'summary_large_image',title:fullTitle,description,images:[{url:SHARE_IMAGE.url,alt:SHARE_IMAGE.alt}]},
 };
}
