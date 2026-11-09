# #01 デザインシステム（トークン・ベースCSS・共通HTML骨格）

## 概要
サイト全体の見た目の基盤を作る。色・余白・角丸・影・フォントなどを **デザイントークン（CSS変数）** として一元管理し、
全ページ共通の HTML 骨格（RootLayout 相当）を確定させる。
このチケットで作る「共通ベース」は、以降のチケットでは編集しない。

- 対象要件：3.3 デザイン指針 / 3.5 アクセシビリティ / 5.3 開発ルール（色・余白はCSS変数）
- 依存：なし

## 作成・編集するファイル
| ファイル | 内容 |
|---|---|
| `css/reset.css` | モダンなリセット（box-sizing、margin除去、画像のブロック化、`prefers-reduced-motion` 対応） |
| `css/variables.css` | デザイントークン（下記）。**生のHEX値を書いてよい唯一のファイル** |
| `css/base.css` | `html` / `body` / 見出し / リンク / フォーカスリングなど要素レベルの基本スタイル |
| `css/utilities.css` | トークン連動のユーティリティクラス（`.bg-background` など） |
| `docs/templates/page-base.html` | 全ページ共通のHTML骨格（RootLayout相当） |
| `docs/design-tokens.md` | トークン一覧と使い分けの説明 |

> 既存のルート直下の空ファイル `index.html` / `style.css` / `script.js` は、ユーザー確認のうえ削除済み（`index.html` は #03 で作り直す）。

## 実装タスク

### 1. デザイントークン（`css/variables.css`）
- [ ] **プリミティブ**（ここだけで使う生の値）：`--palette-coral-500: #FF7A59`、`--palette-navy-900: #1E2A44`、白、および各色の明暗段階
- [ ] **セマンティックカラー**（他ファイルはこちらだけを参照する）
  | トークン | 用途 |
  |---|---|
  | `--color-background` / `--color-foreground` | ページ背景 / 本文文字 |
  | `--color-card` / `--color-card-foreground` | カード背景 / カード内文字 |
  | `--color-muted` / `--color-muted-foreground` | 控えめな背景 / 補足テキスト |
  | `--color-primary` / `--color-primary-foreground` | メイン（コーラル）/ その上の文字 |
  | `--color-secondary` / `--color-secondary-foreground` | サブ（ネイビー）/ その上の文字 |
  | `--color-accent` / `--color-accent-foreground` | ホバー・選択状態 |
  | `--color-border` / `--color-input` / `--color-ring` | 枠線 / 入力欄枠 / フォーカスリング |
  | `--color-success` / `--color-warning` / `--color-danger` / `--color-info`（各 `-foreground` 付き） | ステータス・トースト・エラー |
  | `--color-overlay` | モーダル・ボトムシート背面 |
- [ ] **余白**：`--space-1`〜`--space-16`（4px基準のスケール）
- [ ] **角丸**：`--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-full`（カードは大きめ＝`--radius-lg`）
- [ ] **影**：`--shadow-sm` / `--shadow-md` / `--shadow-lg`（ホバー浮き上がり用）
- [ ] **タイポグラフィ**：`--font-family-base`（`"Noto Sans JP", sans-serif`）、`--font-size-xs`〜`--font-size-3xl`、`--line-height-*`、`--font-weight-*`
- [ ] **モーション**：`--duration-fast` / `--duration-normal`、`--easing-standard`
- [ ] **レイヤー**：`--z-header` / `--z-sheet` / `--z-modal` / `--z-toast`
- [ ] **レイアウト**：`--container-max`、`--header-height`
- [ ] ブレークポイント（640px / 1024px）はCSS変数をメディアクエリで使えないため、`variables.css` 冒頭のコメントに定数として明記する

### 2. ベーススタイル（`css/base.css`）
- [ ] `body` に `background-color: var(--color-background); color: var(--color-foreground); font-family: var(--font-family-base);`
- [ ] 見出し・段落・リンクのデフォルト
- [ ] `:focus-visible` に `--color-ring` を使ったフォーカスリング（キーボード操作の可視化）
- [ ] `.visually-hidden`（スクリーンリーダー用テキスト）

### 3. ユーティリティ（`css/utilities.css`）
- [ ] 色：`.bg-background` `.bg-card` `.bg-muted` `.bg-primary` `.bg-secondary` / `.text-foreground` `.text-muted-foreground` `.text-primary` など、**セマンティックトークンと1対1**
- [ ] レイアウト補助：`.container`、`.stack`（縦方向の余白）、`.cluster`（横並び＋折返し）
- [ ] `gray-*` のような段階色クラスは作らない

### 4. 共通HTML骨格（`docs/templates/page-base.html`）＝ RootLayout相当
- [ ] `<html lang="ja">`、`<meta charset>`、`<meta name="viewport">`
- [ ] Google Fonts（Noto Sans JP）の `<link rel="preconnect">` と `<link>`
- [ ] CSS読み込み順：`reset.css` → `variables.css` → `base.css` → `utilities.css` →（#02）`components.css` →（#03）`layouts/*.css` → `pages/*.css`
- [ ] `<body class="bg-background text-foreground">`、`<div id="site-header">`、`<main id="main">`、`<div id="site-footer">`、スキップリンク
- [ ] 共通JS → ページJSの順で `<script type="module">` を読み込む枠
- [ ] 骨格の先頭コメントに「このブロックは編集しない。ページ固有の内容は `<main>` 内と `pages/*.css` / `pages/*.js` に書く」と理由を書く

## 完了条件
- [ ] `page-base.html` を Live Server で開くと、Noto Sans JP・背景色・文字色がトークン経由で表示される
- [ ] `variables.css` 以外に生のHEX値・`rgb()` が無い（`grep -rE "#[0-9A-Fa-f]{3,8}\b|rgb\(" css --exclude=variables.css` が0件）
- [ ] 本文とメインカラー上の文字がWCAG AAのコントラスト比（4.5:1）を満たす
- [ ] `docs/design-tokens.md` にトークン一覧と「どの場面でどれを使うか」が書かれている
