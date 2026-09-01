# データ運用ルール

この文書は、人間が確定したデータ運用ルールの仕様書です。今後、新しい「人間確定ルール」が決まった場合はこの文書へ追記し、既存ルールとの整合を確認してからデータや実装へ反映します。

## Song version分離

- 同じ歌唱者構成なら、LIVE ARRANGE・ライブアレンジ差だけでは別song/versionにしない。
- ただし、以下の場合は別versionにする。
  1. 公式が明確に「○○ ver.」等として別version扱いしている。
  2. 歌唱者構成が変わっている。
- `feat.` / `×` / `with` / `&` / 名義順だけの差は、それだけでは別versionの理由にしない。
- キャラクター名義と本人名義など、実質的歌唱者が同一の場合も原則として分けない。
- 判断不能な場合は自動決定せず、人間確認へ回す。

## Historical origin / metadata reference

- `song_group_origins`のhistorical originは、最初に披露・公開された日時や媒体ではなく、そのwork / version系統の歴史的な起点となるworkまたはversionを表す。
- 初披露・初公開・初フル公開は、引き続き`songs.first_*` / `songs.first_full_*`で管理する。historical originへ日時上の初出という意味を混ぜない。
- DB内に起点となるexact versionが存在する場合は`origin_kind = internal_song`とし、同じsong groupの`songs.id`を`origin_song_id`へ記録する。
- 起点となるworkがDB外にある場合は、DB内versionをoriginに見立てず、`origin_kind = external_preexisting`として外部workを記録する。
- `metadata_reference_song_id`はmetadataの比較・継承に使う同一group内の基準versionであり、historical originとは別概念である。外部originを持つgroupでもDB内versionをmetadata referenceにできる。
- legacyの`base_song_id`は破壊的に削除しないが、historical originまたはmetadata referenceのsource of truthとして新たに利用しない。

## LIVE setlist canonicalization / raw provenance

- WIKIWIKIはLIVE情報の有力なingestion / fact extraction sourceとして利用するが、canonicalな事実そのものとはみなさない。
- 正式曲名、exact song/versionの同一性、メドレー・mashup等の演目構造、実際の披露単位は、公式情報・公式商品・出演者本人の発言・信頼できるライブレポート等のより強い根拠がある場合、それらを総合してcanonical dataとして決定する。
- WIKIWIKI由来のraw title、credit、行粒度およびsource provenanceは、canonical dataを整理・統合する場合も可能な限り保持し、後から追跡できるようにする。

## tie_up

- `tie_up`には、そのsongs行が表す歌唱/version自体のタイアップだけを記録する。
- cover曲に原曲のタイアップを転記しない。
- cover版自体が別途タイアップに起用された場合のみ記録する。

## discovery_category

`discovery_category`は「現在、新規ユーザーがそのsongs行が表す歌唱/versionをどの媒体からフルで取得または視聴できるか」を表す。

複数条件に該当する場合は、原則として以下の上位カテゴリを優先する。

1. `isekai_official`
   - ヰ世界情緒公式YouTubeで無料フル視聴可能。
2. `vwp_official`
   - `isekai_official`ではないが、V.W.P公式YouTubeで無料フル視聴可能。
3. `other_channel`
   - 上記2つではないが、その他のYouTubeチャンネルで無料フル視聴可能。
4. `cd_album`
   - 上記の無料フルYouTubeがなく、exact song/versionの非LIVE公式フル音源が商用リリースとして利用可能。
   - CD、album、digital single / album、有料ダウンロード、subscription streamingを含む。
   - LIVE CD、LIVE album、LIVE Blu-ray / DVD、デジタル配信されたLIVE音源は含めない。
5. `live_event`
   - 上記に該当せず、LIVE・イベントでのみ披露されたもの。
6. `other`
   - いずれにも該当しないもの。

補足：

- Trailer、digest、Shorts、一部分のみ視聴可能な動画はYouTubeカテゴリに含めない。
- メンバー限定・有料YouTubeも、YouTubeカテゴリに含めない。
- ライブで披露された歌唱versionが、後からLIVE CD、LIVE Blu-ray / DVD、デジタル配信されたLIVE音源、LIVEアルバムで視聴可能になっても、`discovery_category = live_event`を維持する。
- LIVE由来の音源は`cd_album`へ分類しない。
- 後から上位媒体で無料フル公開された場合、categoryは変わり得る。
- 特殊事例は自動決定せず、人間判断へ回す。

## Reference source

- reference sourceは、AI / Human verificationやavailability確認に利用した外部根拠のmetadataである。
- ページ全文、HTML全文、動画そのもの、画像等は保存しない。
- URL、title、publisher / channel、source type、分かる場合のpublished date、checked date、short noteを保存する。
- source typeの代表例は`official_site`、`official_youtube`、`official_store`、`label`、`media`、`wiki`、`community`、`social`、`music_credit_db`、`other`とするが、DB vocabularyは固定しない。
- 同一sourceは複数のfield checkやavailability根拠から共有してよい。
- URLは可能な範囲で正規化する。YouTubeの短縮URLと`watch?v=`は統一し、`utm_*`等の明らかなtracking parameterは除外する。YouTube timestampはrelation側のlocatorへ保存する。
- 一般サイトの意味を持つquery parameterは、根拠なく削除しない。

## Availability

- availabilityは必ずexact `songs.id` / versionに紐づける。原曲側の公開状況をcover versionへ流用しない。
- availabilityは「現在、新規ユーザーがそのexact versionをどう取得または視聴できるか」を表す。`is_current = true`は、記録した経路を通じて現在新規に取得またはアクセスできることを意味する。過去に公開・販売されていたが現在アクセスまたは購入できないものは、historical availabilityとして`is_current = false`にする。
- `is_current = false`は、既に所有する物理媒体を再生できないという意味ではない。過去の物理releaseの存在はrelease情報およびhistorical availabilityとして保持する。
- ライブで披露された事実だけではavailabilityを作らない。過去の披露歴は`live_setlist_entries`をsource of truthとする。
- 現在アクセス可能なLIVE動画、LIVE音源、LIVE CD、LIVE Blu-ray等がある場合だけ、`content_type = live`のavailabilityを記録する。
- provider tableは当面作らず、availabilityの`provider`と`provider_scope`で記録する。`provider_scope`の意味ある初期値は`isekai_official`、`vwp_official`、`other`である。

## Release / edition / component

- `release_groups`はrelease work / familyを表す。例：創生、色彩。
- `releases`はedition / packageを表す。例：創生α、創生β。tracklistのauthoritative scopeは必ずこのedition単位とする。
- `release_components`は一つのedition/packageを構成する媒体・discを表す。例：CD Disc 1、CD Disc 2、Blu-ray、DVD、digital。媒体は`medium`へ記録する。
- `release_items`はcomponent内のtrack/itemを表し、exact `songs.id`を`song_id`へ紐付ける。収録曲がcatalog外、instrumental、未照合等の場合は`song_id = NULL`を許容し、release上の`track_title` / `track_artist`をraw値として保持する。
- 同一trackが複数editionに収録される場合も、edition/componentごとに別の`release_items`を持つ。edition間で一つのitemを共有しない。
- legacyの`release_items.release_group_id`は互換用に保持できるが、edition tracklistを取得・編集・表示する基準には使わない。`release_id`と、backfill後は`release_component_id`をauthoritativeとする。
- `release_kind`は作品・packageの種別（例：`single`、`ep`、`album`、`compilation`、`live_album`、`video_release`、`other`）であり、媒体とは分ける。`release_type`は既存互換の混在fieldとして当面維持する。
- releaseは、いつ何の商品・作品として出たかという永続的なhistorical factである。販売終了していても削除しない。availabilityは、そのexact versionを現在新規に取得・アクセスできるかという別の事実として管理する。
- LIVE CD、LIVE Blu-ray / DVD、LIVE album、デジタルLIVE音源もhistorical releaseとして登録できる。ただしavailabilityと`discovery_category`のLIVE由来ルールは引き続き別に適用する。
- ユーザー向けnavigationの`links`、事実の根拠である`reference_sources`、releaseのofficial/product pageは責務が異なる。同じURLが複数に存在してよく、無理にURL tableを統合しない。
- edition/packageに複数のofficial/product/evidence URLが必要になった場合は、`release_sources`で`reference_sources`を再利用する。navigation linkを必要に応じて後から別途追加できる。
- `release_items`は、release component内に存在するtrack/itemの一出現を表す。`songs.id`はそのitemのnullable relationであり、item identityそのものではない。
- 同じexact `songs.id`は、同一release/packageの別component、CDとBlu-ray、Disc 1とDisc 2、または実商品上必要な複数trackへ複数回出現できる。song identityをrelease itemの一意性制約に使わない。
- release/component/track positionとsong relationは別概念である。positionが十分確定しているcomponent itemだけは、component内で同じpositionを重複登録しない。componentまたはpositionが未確定のlegacy itemは、推測で一意制約の対象にしない。

## Full-song verification: release information collection

今後、exact song/versionをAIまたは人間が調査する際は、field verificationとavailabilityに加え、判明した範囲で次を同時に回収する。後から全曲を再調査しないため、確認できない値を推測で補完しない。

- release group / work title、edition/package、release kind、component / medium
- release date、catalog / product number、disc / track number、raw track title / artist credit
- exact song/versionとのrelation、artwork、official product / release page
- digital release、LIVE CD / Blu-ray / DVD / LIVE album、current availability、historical availability
- その事実を裏付けるreference source

## Verification queue

- 初期queueは、current valueがNULLではなく、そのcurrent valueに一致するAI / Human checkが存在しないfieldを対象とする。
- 対象は`title`、`song_type`、`artist_credit`、`discovery_category`、`first_*`、`first_full_*`、`original_*`、`tie_up`とする。
- status field単独はqueue対象にせず、本体fieldを確認する際に合わせて扱う。
- NULL値の検証queueは第二段階とする。

## AI / Human verification

- `confirmed` / `uncertain` / `unverified`等のstatusは「情報の確度」を表す。
- `ai` / `human`は「誰が確認したか」を表し、statusとは別軸である。
- 確認履歴は`song_field_checks`でfield単位に管理する。
- AIが実際に根拠を検証したcurrent valueだけをAI checkedにする。
- 人間が明示的に確認・判断した値だけをhuman checkedにする。
- songを編集しただけでは、自動的にhuman checkedにしない。編集と事実確認は別の操作として扱う。
- 値の変更後も旧checkは履歴として残すが、current checkとしては扱わない。
- NULLでも「調査してNULLと確認した」場合はcheckを記録できる。
- 単に未調査でNULLのfieldにはcheckを付けない。
- 公開情報だけでは判断不能、またはデータ仕様に解釈の余地がある場合は、勝手に決めず`NEEDS_HUMAN`とする。

## artist_credit

- ライブ固有の公式creditが明確なら、その表記を尊重する。
- ダンサー等の非歌唱参加者は`artist_credit`に含めない。
- 表記差だけで歌唱者構成を変えない。
- `×` / `・` / `with` / `&`等のdelimiter差だけでは、AI / Human verification conflictとして扱わない。

## original_artist / original_vocal

- `original_artist`には、原曲側のアーティスト／クレジット名義を記録する。
- 原曲の実際のメイン歌唱者が明確な場合、`original_vocal`にはその人物名を記録してよい。
- グループ／ユニットでの歌唱、または個人まで分解する必要が薄い場合、`original_vocal`には原曲の歌唱名義を記録してよい。
- 判断に意味のある曖昧さがある場合は、自動決定せず`NEEDS_HUMAN`とする。

## original_lyricist / original_composer

- 原典のクレジットが`Writer` / `Songwriter` / `Composition & Lyrics`等として作詞・作曲を分離せず共同表記され、信頼できる公開情報を調査しても分離できない場合、同じクレジット一覧を`original_lyricist`と`original_composer`の両方へ記録してよい。
- この記録は、クレジットされた全員が作詞・作曲の両方を担当したと断定するものではない。原典のsongwriterクレジットを、DB上の分離されたfieldへ保持するための運用である。

## first / first_full

- `first_date` / `first_source`は、そのsongs行が表す歌唱/versionの初出を記録する。
- 原曲発売日はcover版の`first_date`には入れない。
- `first_full_date` / `first_full_source`は、そのversionをフル尺で公開・披露したことを十分確認できる最初の日と媒体を記録する。
- 24時を超える深夜放送は、番組上の前日表記ではなく実際の翌暦日を`first_date`等に採用する。例：10月6日 24:55は10月7日。
- 単なるsetlist記載だけでは`first_full`を`confirmed`にしない。
- 公式フル動画、ライブ全編配信、全編映像商品、LIVE音源等で十分確認できる場合は使用できる。
