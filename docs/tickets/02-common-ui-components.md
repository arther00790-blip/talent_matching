# #02 共通UIコンポーネント

## 概要
複数のページで使い回すUI部品（ボタン、カード、バッジ、フォーム、トースト、モーダル、スケルトン、空状態）を作る。
見た目は `css/components.css`、振る舞いは `js/components/*.js` に置く。

- 対象要件：3.3（カード・マイクロインタラクション・トースト）/ 3.4（スケルトン・空状態・ボトムシート）/ 3.5 / 4.2
- 依存：#01

## 作成・編集するファイル
| ファイル | 内容 |
|---|---|
| `css/components.css` | 全コンポーネントのスタイル（BEM風） |
| `js/components/toast.js` | トースト通知 |
| `js/components/modal.js` | `<dialog>` を使ったダイアログ（応募・確認用） |
| `js/components/bottom-sheet.js` | モバイル用の下から出るシート（検索フィルター用） |
| `js/components/talent-card.js` | タレントカード描画（▶「動画あり」バッジ対応） |
| `js/components/job-card.js` | 案件カード描画（相性バッジ枠を持つ） |
| `js/components/empty-state.js` | 空状態（文言＋次の行動ボタン） |
| `js/components/skeleton.js` | スケルトン表示 |
| `docs/components.html` | コンポーネント見本ページ（動作確認用） |
| `tests/components.test.mjs` | 描画関数のテスト（エスケープ確認など） |

**編集しないファイル**：`css/reset.css` / `css/variables.css` / `css/base.css` / `docs/templates/page-base.html`（共通ベース）

## 実装タスク

### CSS（`css/components.css`）
- [ ] **ボタン** `.button`：`--primary` / `--secondary` / `--outline` / `--ghost` / `--danger`、サイズ `--sm` / `--lg`、`disabled` 状態
- [ ] **カード** `.card`：`background: var(--color-card)`、`border-radius: var(--radius-lg)`、写真を主役にした比率、ホバーで `transform` + `--shadow-md`（`transition: var(--duration-fast)`）
- [ ] **バッジ** `.badge`：`--video`（▶ 動画あり）/ `--match-great`（相性◎）/ `--match-good`（相性○）/ ステータス用（応募済・選考中・採用・見送り）。**色だけで伝えずテキストを必ず併記**
- [ ] **フォーム** `.form-field`：`<label>`、入力欄、必須マーク、`.form-field__error`（`--color-danger`）、ヘルプテキスト
- [ ] **チップ／タグ** `.chip`：スキルタグ・選択可能フィルター
- [ ] **トースト** `.toast`：成功 / エラー / 情報
- [ ] **ダイアログ** `.dialog`：`::backdrop` に `--color-overlay`
- [ ] **ボトムシート** `.bottom-sheet`：640px以下で下からスライド、それ以上ではサイドに常時表示できる形
- [ ] **スケルトン** `.skeleton`：`--color-muted` ベースの点滅（`prefers-reduced-motion` で停止）
- [ ] **空状態** `.empty-state`
- [ ] 色はすべてセマンティックトークン経由。生HEX・`gray-*` 禁止

### JS（`js/components/*.js`）
- [ ] `showToast(message, { type })`：`role="status"` / `aria-live="polite"`、一定時間で自動消去（表示時間は定数化）
- [ ] `openModal({ title, content, onConfirm })`：`<dialog>` の `showModal()`、Escで閉じる、閉じたら呼び出し元へフォーカスを戻す
- [ ] `createBottomSheet(trigger, panel)`：開閉ボタンの `aria-expanded` 同期
- [ ] `renderTalentCard(talent)` / `renderJobCard(job, { matchScore })`：DOM APIまたはエスケープ済みテンプレートで生成。動画ありなら「▶ 動画あり」バッジ
- [ ] `renderEmptyState({ message, actionLabel, actionHref })` / `renderSkeleton(count)`

## テスト（先に書く）
- [ ] `renderTalentCard` に `<script>` を含む名前を渡しても、タグとして解釈されない
- [ ] `introVideo` があるときだけ「動画あり」バッジが出る
- [ ] `renderJobCard` で `matchScore` 70以上→「相性◎」、50〜69→「相性○」、49以下→バッジ無し

## 完了条件
- [ ] `docs/components.html` で全コンポーネントの見た目と動作を確認できる
- [ ] キーボードだけでダイアログ・ボトムシートを開閉できる
- [ ] `node --test "tests/**/*.test.mjs"` が通る
- [ ] `components.css` に生HEX値・`gray-*` が無い
