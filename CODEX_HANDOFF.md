# ヰ世界情緒 歌唱録: Codex 引継ぎ

## 現在の状態

- Next.js 16.2.4 / App Router / TypeScript / Tailwind CSS / Supabase
- 現在のブランチは `main`
- `origin/main` の最新コミットは `2b171be Improve manage editing workflows`
- その後の変更はまだ未コミット・未 push
- 通常の編集では `npm run dev` を起動したままにし、保存時の自動更新で確認する
- `.next` を削除して `build` した場合は、古い dev server が壊れることがあるため、dev server を終了してから再起動する

## 今回の未 push 変更

### 管理画面の概要ページ

- `/_manage/songs/[id]` を追加
- `/_manage/releases/[id]` を追加
- 一覧の `EDIT` ボタンを `管理` に変更し、直接フォームではなく概要ページへ遷移するようにした
- 概要ページから必要な編集先へ進む構成
- 楽曲概要: 基本情報、確認状態、初出、原曲・制作者、関連リンク件数、配信リリース件数、グループ情報
- リリース概要: 親作品、個別形態、収録曲件数、同一作品の形態一覧

### 既存の管理画面改修

- 共通管理ナビゲーション: `ManageNavigation.tsx`
- 共通保存フォームガード: `ManageFormGuard.tsx`
- 管理画面共通エラー: `error.tsx`
- 楽曲・リリース一覧の検索
- リリース一覧の親作品ごとの折りたたみ表示
- 楽曲編集の折りたたみセクション、セル変更時の強調、セクション保存
- リンク・配信リリースの折りたたみ
- 未保存変更の離脱警告
- 管理画面から公開楽曲ページを開いた場合の「管理画面へ戻る」導線

## 次回まず確認すること

1. `git status --short`
2. `git diff --check`
3. `npx eslint .`
4. `.next` の既知衝突を避けてクリーンな `npm run build`
5. dev server を再起動して主要 URL を確認

主要確認 URL:

- `http://localhost:3000/_manage`
- `http://localhost:3000/_manage/songs`
- `http://localhost:3000/_manage/songs/366`
- `http://localhost:3000/_manage/songs/366/edit`
- `http://localhost:3000/_manage/songs/1/links`
- `http://localhost:3000/_manage/songs/1/digital-releases`
- `http://localhost:3000/_manage/releases`
- `http://localhost:3000/_manage/releases/1`
- `http://localhost:3000/_manage/releases/1/edit`

## 今後の UX 方針

最終的には、公開ページに近い閲覧表示を基本にして、各項目の横に鉛筆アイコンを置き、押した項目だけ編集モードにする。

現在のセル強調・セクション保存・概要ページは、その最終形へ移行するための前段である。

編集画面では次を重視する:

- 何を編集しているかを常に明示する
- 楽曲本体、関連リンク、配信リリース、バージョンを混同させない
- 親作品と子形態の関係、変更時の影響範囲を見せる
- 変更した箇所だけ目立たせる
- 保存せずに移動しそうなとき警告する
- 保存処理や既存 URL はできるだけ維持する

## 状態表示の方針

- UI 表示は `確認済み / 要確認 / 未確認 / 情報募集中 / 未設定`
- DB の既存値 `confirmed / uncertain / unverified / wanted` は当面維持
- 空欄を自動で `確認済み` にしない
- 将来的に出典がある場合の確認状態自動判定を検討する
- 状態は入力欄と同格にせず、将来は見出し横の小さなアイコン・短いラベルへ寄せる

## 保留事項

- 歌詞も将来的には管理対象として検討。ただし著作物のため、掲載範囲・保存方法・権利上の扱いは要確認。現時点では実装しない
- 公開ページの検索・絞り込み UI は項目が密集すると見づらいため、将来的に折りたたみ・段階表示へ改善
- `/creators` と `/sources` は公開側に準備中ページとして実装済み
- `/updates` はまずホームに小さく載せる案。独立ページは後回し
- `/artists` は `/creators` と役割を整理してから検討
- `/works` は `/releases` の親作品構造で当面対応
- `/tags` は検索・絞り込みへ統合する案
- `/requests` は独立ページにせず、ホームの情報提供導線に限定する案
- Live 用 DB、物理 timeline テーブル、複雑な検索インデックスはまだ確定しない

## セキュリティ対応済み

- 管理 Server Action に認証ガード
- 管理 URL メタデータ取得の SSRF 対策
- localhost / プライベート IP 拒否
- リダイレクト拒否、HTML 種別・1MB 上限
- 管理セッションを期限付き HMAC に変更
- 管理画面で保存する URL を `http/https` に限定

## push のルール

- ユーザーがローカルで使用感を確認して OK を出してから push
- 勝手に push しない
- push 前に lint / clean build / git diff を確認
- 管理画面の大きな変更は、小さな単位で実装してローカル確認を挟む
