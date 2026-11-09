# #03 ページレイアウト（ヘッダー・フッター・レイアウトパターン・全HTML）

## 概要
ヘッダー（ナビ＋デモ用ロール切替）、フッター（デモ表示）、ページの種類ごとのレイアウトパターンを作り、
全HTMLを空の状態で用意する。
Next.js の「各ページ用 `layout.tsx`」に当たるものとして、レイアウトは `css/layouts/*.css` にパターンごとに分ける。
**共通ベース（RootLayout相当：`page-base.html` の骨格・`reset.css`・`variables.css`・`base.css`）は編集しない。**

- 対象要件：C-05 ロール切替 / 3.1 画面一覧 / 3.4 モバイルファースト / 4.3 共通パーツ / 5.1 デモ表示
- 依存：#01, #02

## 作成・編集するファイル
| ファイル | 内容 |
|---|---|
| `js/components/header.js` | ロゴ、グローバルナビ、ロール切替（ゲスト／タレント／企業）、モバイルメニュー |
| `js/components/footer.js` | フッターリンク、デモサイト注記 |
| `js/components/sidebar.js` | 一覧ページの検索フィルター枠（モバイルではボトムシート） |
| `js/common.js` | 全ページ共通の初期化（ヘッダー・フッター描画） |
| `css/layouts/site.css` | ヘッダー・フッター・`<main>` の基本配置 |
| `css/layouts/list.css` | 一覧系：サイドバー（フィルター）＋カードグリッド |
| `css/layouts/detail.css` | 詳細系：メディア（写真・動画）＋情報の2カラム |
| `css/layouts/form.css` | フォーム系：中央寄せ1カラム、ステップ表示 |
| `css/layouts/dashboard.css` | マイページ：タブ／セクション切替 |
| `css/layouts/static.css` | 静的ページ：読みやすい本文幅 |
| 全HTML（下表） | `page-base.html` をコピーし、使うレイアウトCSSを `<head>` に追加。`<main>` は見出しのみ |
| `tests/header.test.mjs` | ロール切替・ナビ表示のテスト |

### ページとレイアウトの対応
| レイアウト | ページ |
|---|---|
| `list.css` | `talents.html` / `jobs.html` |
| `detail.css` | `talent.html` / `job.html` |
| `form.css` | `profile-edit.html` / `job-new.html` / `contact.html` / `contact-confirm.html` / `contact-complete.html` |
| `dashboard.css` | `mypage.html` |
| `static.css` | `about.html` / `faq.html` / `terms.html` / `privacy.html` / `404.html` |
| `site.css` のみ | `index.html`（トップは #10 で `pages/top.css` を追加） |

**編集しないファイル**：`css/reset.css` / `css/variables.css` / `css/base.css` / `docs/templates/page-base.html`

## 実装タスク
- [ ] 全16ページのHTMLを作成（骨格は `page-base.html` のまま、`<title>` と `<main>` 内見出し、レイアウトCSSの追加のみ）
- [ ] ヘッダー：`<header>` + `<nav aria-label="グローバル">`、現在ページに `aria-current="page"`
- [ ] ロール切替：`<select>` または ラジオボタン、変更で `storage.js` の `setRole()` を呼び（#04で実装。先にインターフェースだけ仮置き）、`role-change` カスタムイベントを発火
- [ ] ロールでナビ項目を出し分け（企業：案件掲載／タレント：プロフィール編集）
- [ ] モバイル（〜640px）ではハンバーガーメニュー、`aria-expanded` 同期
- [ ] フッター：「これはデモサイトです。掲載情報はすべて架空です。アップロードした動画はこのブラウザ内にのみ保存され、外部には送信されません」を全ページに表示
- [ ] 一覧レイアウト：1024px以上でサイドバー常時表示、640px以下でボトムシート化（#02 の `bottom-sheet.js` を使用）
- [ ] 色はセマンティックトークン／ユーティリティのみ（ヘッダー背景 `--color-background`、境界線 `--color-border` など）

## テスト（先に書く）
- [ ] ロールが `company` のときだけナビに「案件掲載」が出る
- [ ] ロールが `talent` のときだけ「プロフィール編集」が出る
- [ ] 現在ページのナビリンクに `aria-current="page"` が付く
- [ ] フッターにデモ注記の文言が含まれる

## 完了条件
- [ ] Live Server で全16ページが開き、ヘッダー・フッターが表示される（フェーズ1の完了条件）
- [ ] ロールを切り替えるとリロード後も保持され、ナビが変わる
- [ ] 375px / 1440px でヘッダー・レイアウトが崩れない
- [ ] 共通ベースのファイルに差分が無い
