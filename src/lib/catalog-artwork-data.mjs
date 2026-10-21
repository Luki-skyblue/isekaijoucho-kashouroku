// Curated entry-level artwork. Public URLs only; provenance is kept with each
// candidate. A shared work title does not authorize reuse for another entry.
const singer='81a01233-230e-50a8-a309-11275c794cd0';
const mv=id=>({kind:'mv',imageUrl:`https://img.youtube.com/vi/${id}/hqdefault.jpg`,sourceUrl:`https://www.youtube.com/watch?v=${id}`});
export const ARTWORK_RECORDS=[
 {entryId:'5ea0b6b3-53e4-446a-b7f3-0bcfd829889a',primaryWorkId:'d106e67d-72e0-4b5e-b382-77e9fce47507',singerIds:[singer],title:'風の名前',candidates:[
  {kind:'digital_single',date:'2026-10-13',imageUrl:'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/03/2b/59/032b5950-1344-08f8-4e5d-be2ad3cafd35/4550795527801_cover.png/600x600bb.jpg',sourceUrl:'https://music.apple.com/jp/album/6821958199'},
  mv('R0b-kJSwUxY')]},
 {entryId:'28e3b945-e49b-4e12-94ca-12f0a8718021',primaryWorkId:'9101f61f-ceff-5335-a1ed-1f7d4de78d98',singerIds:[singer],title:'とめどなき白情',candidates:[mv('e0ZfB1o-Msw')]},
 {entryId:'912cf6d0-0f06-4112-9bba-0b1333895122',primaryWorkId:'5dd5d31d-4b77-5259-b5b9-d4828d4c1098',singerIds:[singer],title:'シリウスの心臓',candidates:[mv('UKZt1vq8bKI')]},
 {entryId:'ffe9cbc0-27b8-48c2-8631-7ad4562f9a47',primaryWorkId:'078d4b75-9ac7-5f5a-8701-a50ef78a70d0',singerIds:[singer],title:'ハイドレンジア',candidates:[mv('lqTS5eaEhbI')]}
];

// Registered product images: {familyId,editionId,imageUrl,sourceUrl}.
// Used only after that edition is matched to the entry's actual vocal version.
export const RELEASE_ARTWORK_RECORDS=[];
// Registered event images: {eventId,title,imageUrl,sourceUrl}.
// Unconfirmed same-version-only performance candidates are not image evidence.
export const EVENT_ARTWORK_RECORDS=[];
