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
// Official event key visuals, frozen to an exact event ID and title.
// Shared 2DAYS artwork does not combine its two event records. Provenance:
// docs/evidence/live-artwork-first-batch-2026-10-21.json.
// Unconfirmed same-version-only singing is not representative-image evidence.
export const EVENT_ARTWORK_RECORDS=[
 {
  "eventId": "46baac7f-6805-5b22-99d9-ffc30722c20c",
  "title": "Anima",
  "officialDate": "2021-10-23",
  "imageUrl": "/artwork/lives/anima-1.webp",
  "sourceUrl": "https://www.zan-live.com/ja/live/detail/10131"
 },
 {
  "eventId": "f8160fea-7cdd-5fca-b8d5-8f8435c1ce47",
  "title": "Anima II -神椿市参番街-",
  "officialDate": "2023-06-18",
  "imageUrl": "/artwork/lives/anima-2.webp",
  "sourceUrl": "https://kamitsubaki.jp/event/2023/06/18/2015/"
 },
 {
  "eventId": "42fc7c7e-5831-574c-824c-4be2a36d7003",
  "title": "Anima III",
  "officialDate": "2024-08-07",
  "imageUrl": "/artwork/lives/anima-3.webp",
  "sourceUrl": "https://kamitsubaki.jp/event/2024/08/07/3340/"
 },
 {
  "eventId": "0611ff4a-469b-5af4-bfe1-056787bf9949",
  "title": "parallel canvas",
  "officialDate": "2023-04-15",
  "imageUrl": "/artwork/lives/parallel-canvas-1.webp",
  "sourceUrl": "https://kamitsubaki.jp/news/2023/04/08/1932/"
 },
 {
  "eventId": "dd35d775-2d2f-5aa1-9870-adf9f2461e12",
  "title": "parallel canvas II",
  "officialDate": "2023-10-28",
  "imageUrl": "/artwork/lives/parallel-canvas-2.webp",
  "sourceUrl": "https://kamitsubaki.jp/news/2023/10/10/2692/"
 },
 {
  "eventId": "d96600d8-95d6-5fe6-b4e2-20108b159dfd",
  "title": "キャンディライブ",
  "officialDate": "2020-12-26",
  "imageUrl": "/artwork/lives/candy-1.webp",
  "sourceUrl": "https://kamitsubaki.jp/news/2020/12/09/288/"
 },
 {
  "eventId": "deef722f-00d2-5da9-86c7-0f64d702d158",
  "title": "キャンディライブ 2",
  "officialDate": "2023-01-14",
  "imageUrl": "/artwork/lives/candy-2.webp",
  "sourceUrl": "https://kamitsubaki.jp/news/2022/12/11/1754/"
 },
 {
  "eventId": "7d7da6a4-a5c4-59b2-99c6-0c4f64437ae8",
  "title": "キャンディライブ 3",
  "officialDate": "2025-10-11",
  "imageUrl": "/artwork/lives/candy-3.webp",
  "sourceUrl": "https://kamitsubaki.jp/news/2025/09/23/8572/"
 },
 {
  "eventId": "71888a14-c1e8-572e-ad40-c8d26a17c083",
  "title": "Collection Bouquet",
  "officialDate": "2024-12-08",
  "imageUrl": "/artwork/lives/collection-bouquet.webp",
  "sourceUrl": "https://kamitsubaki.jp/news/2024/11/19/5153/"
 },
 {
  "eventId": "1a07e996-9531-528a-a736-14134451f2f5",
  "title": "Singularity Live vol.1",
  "officialDate": "2022-07-17",
  "imageUrl": "/artwork/lives/singularity-1.webp",
  "sourceUrl": "https://kamitsubaki.jp/news/2022/07/01/1469/"
 },
 {
  "eventId": "a802e69d-ebac-5898-8316-ed03504314e8",
  "title": "Singularity Live Vol.4",
  "officialDate": "2025-11-03",
  "imageUrl": "/artwork/lives/singularity-4.webp",
  "sourceUrl": "https://kamitsubaki.jp/news/2025/07/27/8073/"
 },
 {
  "eventId": "9d1cfc23-1fbb-5602-959d-557676eb2a98",
  "title": "KAMITSUBAKI FES '25 OUR ONE-DAY WAR",
  "officialDate": "2025-11-02",
  "imageUrl": "/artwork/lives/kamitsubaki-fes-25.webp",
  "sourceUrl": "https://kamitsubaki.jp/news/2025/07/27/8073/"
 },
 {
  "eventId": "b18e8c59-b853-5d3d-96ec-dc2462d133bb",
  "title": "KAMITSUBAKI FES '24 THE DAY THE EARTH STOOD STILL",
  "officialDate": "2024-08-08",
  "imageUrl": "/artwork/lives/kamitsubaki-fes-24.webp",
  "sourceUrl": "https://kamitsubaki.jp/event/2024/08/07/3340/"
 },
 {
  "eventId": "51eab8f7-0f89-54b4-bbc4-c55744895410",
  "title": "現象",
  "officialDate": "2022-04-16",
  "imageUrl": "/artwork/lives/phenomenon-1.webp",
  "sourceUrl": "https://kamitsubaki.jp/event/2022/04/16/1109/"
 },
 {
  "eventId": "e19c28f8-2f6b-509e-8005-4861c513a3c6",
  "title": "現象II -魔女拡成-",
  "officialDate": "2024-01-13",
  "imageUrl": "/artwork/lives/phenomenon-2.webp",
  "sourceUrl": "https://www.zan-live.com/live/detail/10353"
 },
 {
  "eventId": "b397f523-88e5-53d1-82c9-5554ee3e1085",
  "title": "現象II(再)",
  "officialDate": "2024-11-02",
  "imageUrl": "/artwork/lives/phenomenon-2-re.webp",
  "sourceUrl": "https://kamitsubaki.jp/news/2024/08/13/3722/"
 },
 {
  "eventId": "a0034689-cb31-5372-9d03-9f99be938547",
  "title": "V.W.P 3rd ONE-MAN LIVE「現象III -神椿市探訪中-」",
  "officialDate": "2025-03-27",
  "imageUrl": "/artwork/lives/phenomenon-3.webp",
  "sourceUrl": "https://kamitsubaki.jp/event/2025/03/27/5752/"
 },
 {
  "eventId": "9f2df3ca-0532-52d4-a7e4-8658716eb44a",
  "title": "現象IV -反転運命-",
  "officialDate": "2026-02-28",
  "imageUrl": "/artwork/lives/phenomenon-4.webp",
  "sourceUrl": "https://kamitsubaki.jp/news/2025/09/27/8615/"
 },
 {
  "eventId": "f2a2a2a5-9d19-5452-acb4-94a6b50fb096",
  "title": "Flower Closet",
  "officialDate": "2026-05-01",
  "imageUrl": "/artwork/lives/isekaijoucho-2days.webp",
  "sourceUrl": "https://kamitsubaki.jp/event/2026/05/01/9272/",
  "imageScope": "shared_campaign"
 },
 {
  "eventId": "79744844-4e1f-58a3-93f8-1d8e85cbb8eb",
  "title": "Anima Re:birth",
  "officialDate": "2026-05-02",
  "imageUrl": "/artwork/lives/isekaijoucho-2days.webp",
  "sourceUrl": "https://kamitsubaki.jp/event/2026/05/01/9272/",
  "imageScope": "shared_campaign"
 }
];
