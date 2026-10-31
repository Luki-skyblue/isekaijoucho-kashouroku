// Shared interface wording. Official titles, credited names and stored facts
// are not translated or rewritten through this module.
export const PAGE_LABELS=Object.freeze({
 songs:'楽曲一覧',
 lives:'LIVE一覧',
 releases:'収録作品',
 people:'関係者検索',
 search:'詳細検索',
 discover:'公開・収録先から探す',
 guide:'使い方',
 about:'このサイトについて',
 contribute:'情報提供・訂正',
});

export const NAME_FIELDS=Object.freeze({song:'楽曲名',live:'公演名',release:'作品名',person:'名前・別名'});

export const INFO_STATES=Object.freeze({pending:'準備中',notFound:'見つかっていません。',notApplicable:'該当なし'});

// An empty search result is not a finding that research found no information.
export const EMPTY_RESULTS=Object.freeze({
 songs:'該当する楽曲がありません。',
 lives:'該当する公演がありません。',
 releases:'該当する作品がありません。',
 people:'該当する関係者がありません。',
});
