# チケット一覧（StageLink）

要件定義書（`要件定義書.md`）を、開発しやすい順に10チケットへ分割したもの。
上から順に着手する前提で番号を振っている。

| # | チケット | 主な要件ID | 依存 |
|---|---|---|---|
| [#01](./01-design-system.md) | デザインシステム（トークン・ベースCSS・共通HTML骨格） | 3.3 / 3.5 / 5.3 | なし |
| [#02](./02-common-ui-components.md) | 共通UIコンポーネント | 3.3 / 3.4 / 3.5 | #01 |
| [#03](./03-page-layouts.md) | ページレイアウト（ヘッダー・フッター・レイアウトパターン・全HTML） | C-05 / 4.3 / 5.1 | #01, #02 |
| [#04](./04-data-and-logic.md) | データ・ロジック層（架空データ・storage・utils・filters・matching・validation） | 4.4〜4.7 / 6.4 / 6.5 | #01 |
| [#05](./05-talents.md) | タレント一覧・検索・詳細（動画表示を含む） | T-01 / T-02 / T-10 / B-02 | #02, #03, #04 |
| [#06](./06-jobs-and-apply.md) | 案件一覧・検索・詳細・応募 | T-03 / T-04 / T-05 / T-08 | #02, #03, #04 |
| [#07](./07-intro-video-and-profile.md) | 自己紹介動画アップロード・プロフィール編集 | T-09 / T-11 / 6.7 | #02, #03, #04, #05 |
| [#08](./08-mypage-and-company.md) | マイページ・スカウト・案件掲載・おすすめ・デモリセット | T-06 / T-07 / B-01 / B-03 / B-04 / M-02 | #05, #06, #07 |
| [#09](./09-contact-form.md) | お問い合わせフォーム（入力・確認・完了） | C-02 / 2.5 | #02, #03, #04 |
| [#10](./10-top-static-and-release.md) | トップ・静的ページ・仕上げ・公開 | C-01 / C-03 / C-04 / C-06 / C-07 / 7章 | #01〜#09 |

---

## 全チケット共通ルール

### 技術スタックの読み替え
要件定義書 4.1 で「HTML／CSS／JavaScriptのみ（Tailwind・フレームワーク不使用）」と決まっているため、
UI設計ルールは次のように読み替えて適用する。

| 指示上の概念 | 本プロジェクトでの対応物 |
|---|---|
| Tailwind設定（テーマ） | `css/variables.css`（デザイントークン＝CSS変数） |
| `globals.css` | `css/reset.css` + `css/base.css` + `css/utilities.css` |
| `bg-background` / `text-foreground` 等 | `css/utilities.css` のトークン連動ユーティリティクラス、または `var(--color-background)` 等 |
| RootLayout（`app/layout.tsx`） | **共通ベース**：`docs/templates/page-base.html` の骨格（`<html lang="ja">`・`<head>`・フォント読込・トークンCSS読込・`<body>`）と `reset.css` / `variables.css` / `base.css` |
| 各ページの `layout.tsx` | `css/layouts/*.css`（レイアウトパターン）＋ `js/components/header.js` / `footer.js` / `sidebar.js` |

### 共通ベース（RootLayout相当）は編集しない
- #01 で作成した共通ベースは **#02 以降のチケットでは編集対象にしない**。
- ページ固有の見た目・レイアウトは `css/layouts/*.css` / `css/pages/*.css` / `js/components/*` 側で実装する。
- トークンの追加が必要になった場合は、作業を止めてデザインシステムの変更として相談する（チケット内で勝手に足さない）。

### 色の扱い
- 背景色・文字色・枠線色は **必ずセマンティックトークン** を使う（`var(--color-background)` / `.bg-background` / `.text-foreground` など）。
- 生のHEX値・`rgb()` の直書きは **`css/variables.css` の中だけ** 許可。それ以外のCSS・JS・HTMLでは禁止。
- `gray-100` のような色名＋段階の場当たり的なクラス・変数（`--gray-500` 等）は作らない・使わない。

### 開発の進め方
- TDD：ロジック（`js/lib/*`）はテスト（`tests/*.test.mjs`、`node --test "tests/**/*.test.mjs"`）を先に書く。
- `innerHTML` にユーザー入力を入れない（`textContent` または `utils.js` のエスケープ関数を通す）。
- JSは ES Modules、`const` / `let` のみ。1ファイル200行超で分割を検討。
- CSSクラスは BEM 風（`talent-card__name`）。
- 完了時にブラウザコンソールでエラーが出ていないことを確認する。
