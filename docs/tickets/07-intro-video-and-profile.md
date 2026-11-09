# #07 自己紹介動画アップロード・プロフィール編集

## 概要
`profile-edit.html` で、デモ用タレント本人の自己紹介文・スキルの編集と、自己紹介動画の選択・検証・プレビュー・登録・差し替え・削除を実装する。
動画は IndexedDB に保存する。

- 対象要件：T-09 / T-11 / 6.7（全体）
- 依存：#02, #03, #04, #05（詳細ページの動画表示と連携）

## 作成・編集するファイル
| ファイル | 内容 |
|---|---|
| `js/lib/video-store.js` | IndexedDB（DB `stagelink` / ストア `videos`）の保存・取得・削除 |
| `js/lib/video-validation.js` | 形式・サイズ・長さのチェック（純粋関数） |
| `js/components/video-uploader.js` | ファイル選択・ドラッグ＆ドロップ・プレビュー・登録UI |
| `js/pages/profile-edit.js` | ページ初期化、プロフィール編集フォーム |
| `css/pages/profile-edit.css` | ページ固有スタイル（ドロップ領域など、トークンのみ使用） |
| `profile-edit.html` | `<main>` 内のマークアップ |
| `tests/video-validation.test.mjs` / `tests/video-store.test.mjs` | テスト |

**編集しないファイル**：共通ベース（`page-base.html` 骨格・`reset.css`・`variables.css`・`base.css`）

## 実装タスク

### アクセス制御
- [ ] タレントロール以外では「タレントに切り替えると編集できます」と表示し、フォームを出さない

### プロフィール編集（T-11）
- [ ] 自己紹介文・スキルタグの編集 → `saveProfile`、保存時にトースト

### 動画アップロード（T-09）
- [ ] `<input type="file" accept="video/mp4,video/webm,video/quicktime">` ＋ドラッグ＆ドロップ領域（キーボードでも選択可能）
- [ ] 選択直後のチェック（上限値はすべて定数化）
  | 項目 | 条件 | エラー文 |
  |---|---|---|
  | 形式 | MP4／WebM／MOV | 「対応している形式は MP4・WebM・MOV です」 |
  | サイズ | 50MB以下 | 「ファイルサイズは50MBまでです（選択：72MB）」 |
  | 長さ | 60秒以内（`loadedmetadata` の `duration`） | 「動画は60秒以内にしてください（選択：1分24秒）」 |
  | 読込失敗 | — | 「この動画は読み込めませんでした。別のファイルでお試しください」 |
- [ ] NGならその場でエラー表示（`aria-live`）し、登録ボタンを無効化
- [ ] OKなら `URL.createObjectURL` で `<video controls>` プレビュー
- [ ] 一言説明（任意・40文字以内）、「公開に同意する」（必須）
- [ ] 登録 → IndexedDBに保存 → トースト「動画を登録しました」
- [ ] 登録済みなら「差し替え」「削除」を表示。削除は確認ダイアログ（#02 `modal.js`）
- [ ] 1人1本：登録済みの状態で新規登録すると差し替えになる

### 後片付け・例外
- [ ] プレビューのオブジェクトURLを差し替え時・`pagehide` 時に `URL.revokeObjectURL`
- [ ] IndexedDBが使えない環境ではセッション中のみ表示し「このブラウザでは動画を保存できません」と案内
- [ ] `video-store.js` の全操作を `try/catch`、失敗時もページを壊さない

## テスト（先に書く）
- [ ] `video-validation`：形式OK/NG、50MBちょうど/超過、60秒ちょうど/超過、エラー文に実際の値が入る
- [ ] `video-store`：保存→取得→削除の往復（`fake-indexeddb` 等の外部ライブラリは使わず、IndexedDBのラッパーを差し替え可能にしてテストする）
- [ ] IndexedDB非対応時に「保存不可」状態が返る

## 完了条件
- [ ] チェック・プレビュー・登録・差し替え・削除ができ、リロード後もタレント詳細（#05）に表示される（フェーズ5の完了条件）
- [ ] 75MBや90秒の動画で具体的なエラー文が出て、登録できない
- [ ] `node --test "tests/**/*.test.mjs"` が通る、コンソールエラーなし
