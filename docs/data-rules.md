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

## tie_up

- `tie_up`には、そのsongs行が表す歌唱/version自体のタイアップだけを記録する。
- cover曲に原曲のタイアップを転記しない。
- cover版自体が別途タイアップに起用された場合のみ記録する。

## discovery_category

`discovery_category`は「現在、そのsongs行が表す歌唱/versionをどの媒体からフルで聴けるか」を表す。

複数条件に該当する場合は、原則として以下の上位カテゴリを優先する。

1. `isekai_official`
   - ヰ世界情緒公式YouTubeで無料フル視聴可能。
2. `vwp_official`
   - `isekai_official`ではないが、V.W.P公式YouTubeで無料フル視聴可能。
3. `other_channel`
   - 上記2つではないが、その他のYouTubeチャンネルで無料フル視聴可能。
4. `cd_album`
   - YouTubeでは無料フル視聴できず、CD・アルバムの購入によって視聴可能。
   - LIVE円盤化はこのカテゴリに含めない。
5. `live_event`
   - 上記に該当せず、LIVE・イベントでのみ披露されたもの。
6. `other`
   - いずれにも該当しないもの。

補足：

- Trailer、digest、一部分のみ視聴可能な動画はYouTubeカテゴリに含めない。
- メンバー限定・有料YouTubeも、基本的にはYouTubeカテゴリに含めない。
- 後から上位媒体で無料フル公開された場合、categoryは変わり得る。
- 特殊事例は自動決定せず、人間判断へ回す。

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

## first / first_full

- `first_date` / `first_source`は、そのsongs行が表す歌唱/versionの初出を記録する。
- 原曲発売日はcover版の`first_date`には入れない。
- `first_full_date` / `first_full_source`は、そのversionをフル尺で公開・披露したことを十分確認できる最初の日と媒体を記録する。
- 単なるsetlist記載だけでは`first_full`を`confirmed`にしない。
- 公式フル動画、ライブ全編配信、全編映像商品、LIVE音源等で十分確認できる場合は使用できる。
