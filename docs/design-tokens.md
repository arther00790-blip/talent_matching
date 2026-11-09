# デザイントークン（StageLink）

色・余白・角丸・影・フォントなどの値は、すべて `css/variables.css` の CSS 変数で一元管理する。
見本は `docs/design-tokens-preview.html` を Live Server で開くと確認できる。

## 基本ルール

- **生の HEX 値・`rgb()` を書いてよいのは `css/variables.css` だけ**。他の CSS / HTML / JS では、必ずセマンティックトークン（`var(--color-*)`）かユーティリティクラス（`.bg-*` / `.text-*`）を使う。
- `--palette-*`（プリミティブ）は `variables.css` の中でしか参照しない。用途ではなく「色そのもの」の名前なので、直接使うと、あとで用途ごとに色を変えられなくなるため。
- 「色名＋段階」のクラスや変数（例：`gray-500`）は作らない。「少し薄い文字」が欲しいときは `--color-muted-foreground` を使う。
- トークンを追加したいときは作業を止めて相談する（デザインシステムの変更として扱う）。
- 検証：`node --test "tests/**/*.test.mjs"` で、色の直書きとコントラスト比を自動チェックする。

## ブレークポイント

CSS 変数はメディアクエリの条件に使えないため、次の値を定数として使う（モバイルファースト＝`min-width`）。

| 名前 | 条件 | 想定 |
|---|---|---|
| （既定） | 〜639px | スマホ |
| sm | `@media (min-width: 640px)` | タブレット縦〜 |
| lg | `@media (min-width: 1024px)` | PC |

## カラー

### プリミティブ（`variables.css` 内でのみ使用）

| 変数 | 値 | メモ |
|---|---|---|
| `--palette-white` | `#FFFFFF` | |
| `--palette-coral-50` | `#FFFAF7` | ページ背景（ほんのり暖かい白） |
| `--palette-coral-100` | `#FFE8E0` | ホバー・選択の淡い面 |
| `--palette-coral-500` | `#FF7A59` | **ブランドのコーラル**（装飾用） |
| `--palette-coral-600` | `#C9401F` | 操作用コーラル（ボタン地・リンク） |
| `--palette-coral-700` | `#9E3418` | 操作用コーラルのホバー |
| `--palette-navy-50` | `#F4F5F8` | 控えめな面 |
| `--palette-navy-100` | `#E3E6EC` | 区切り線 |
| `--palette-navy-300` | `#7D879B` | 入力欄の枠 |
| `--palette-navy-500` | `#5A6478` | 補足テキスト |
| `--palette-navy-800` | `#2E3D5E` | ネイビーのホバー（最も暗い段なので少し明るくする） |
| `--palette-navy-900` | `#1E2A44` | **ブランドのネイビー**（本文） |
| `--palette-green-700` | `#1E7A46` | 成功 |
| `--palette-amber-400` | `#FFB020` | 警告 |
| `--palette-red-700` | `#B42335` | エラー |
| `--palette-red-800` | `#8F1C2A` | エラー色のホバー |
| `--palette-blue-700` | `#2563B8` | お知らせ |

### セマンティックカラー（他ファイルはこちらを使う）

| トークン | 参照先 | どこで使うか | ユーティリティ |
|---|---|---|---|
| `--color-background` / `--color-foreground` | coral-50 / navy-900 | ページ全体の背景と本文 | `.bg-background` / `.text-foreground` |
| `--color-card` / `--color-card-foreground` | white / navy-900 | タレントカード・案件カード・フォームの面 | `.bg-card` / `.text-card-foreground` |
| `--color-muted` / `--color-muted-foreground` | navy-50 / navy-500 | 控えめな背景（フィルター欄・スケルトン）/ 日付・件数・注記などの補足テキスト | `.bg-muted` / `.text-muted-foreground` |
| `--color-primary` / `--color-primary-foreground` | coral-600 / white | 主要ボタン（応募する・検索する）、リンク文字、強調文字 | `.bg-primary` / `.text-primary` |
| `--color-primary-hover` | coral-700 | primary のボタン・リンクのホバー | — |
| `--color-brand` / `--color-brand-foreground` | coral-500 / navy-900 | ヒーローの装飾、バッジ、イラスト的な面など **ブランド色を見せたい面**（ボタンには使わない） | `.bg-brand` |
| `--color-secondary` / `--color-secondary-foreground` | navy-900 / white | サブボタン、フッター、企業向けの導線 | `.bg-secondary` / `.text-secondary` |
| `--color-secondary-hover` | navy-800 | secondary ボタンのホバー | — |
| `--color-accent` / `--color-accent-foreground` | coral-100 / navy-900 | ホバー時の面、選択中のタブ・チップ | `.bg-accent` |
| `--color-border` | navy-100 | カードの枠、区切り線（装飾的な線） | `.border` |
| `--color-input` | navy-300 | 入力欄・セレクトの枠（操作できる部品の境界） | `.border-input` |
| `--color-ring` | coral-600 | `:focus-visible` のフォーカスリング | — |
| `--color-success` / `-foreground` | green-700 / white | 応募完了トースト、成功メッセージ | `.bg-success` / `.text-success` |
| `--color-warning` / `-foreground` | amber-400 / **navy-900** | 注意喚起（未入力・期限間近） | `.bg-warning` |
| `--color-danger` / `-foreground` | red-700 / white | 入力エラー、削除ボタン | `.bg-danger` / `.text-danger` |
| `--color-danger-hover` | red-800 | 削除ボタンのホバー | — |
| `--color-info` / `-foreground` | blue-700 / white | 「デモです」表示などのお知らせ | `.bg-info` / `.text-info` |
| `--color-overlay` | ネイビー 60% 透過 | モーダル・ボトムシートの背面 | — |

> `.bg-*` クラスは、背景色とその上に載せる文字色（`-foreground`）を**同時に**当てる。片方だけ付け忘れてコントラストが足りなくなる事故を防ぐため。
> 警告色の文字クラス（`.text-warning`）は作っていない。黄色の文字は明るい背景の上で読めないため。

### メインカラーの決め方（コントラストのため）

ブランドのコーラル `#FF7A59` は白文字とのコントラスト比が **2.57:1** で、WCAG AA（4.5:1）を満たさない。
そこで役割を2つに分けた。

1. **ボタン地・リンク文字（`--color-primary`）は濃いコーラル `#C9401F`**：白文字で 4.96:1、ページ背景の上の文字としても 4.78:1 になる。「応募する」などの主要操作は白文字のまま読みやすくできる。
2. **ブランドの明るいコーラル（`--color-brand`）は装飾面に限定**し、上に文字を載せるときはネイビー（5.57:1）にする。明るく親しみやすい印象は、ヒーローやバッジでこの色を見せて保つ。

「primary をそのまま `#FF7A59` にして文字をネイビーにする」案も検討した。しかしその場合、`.text-primary`（明るい背景の上のコーラル文字）が 2.5:1 前後になり、リンク色として使えない。そのため上の分け方を採用した。

警告色は黄色系で白文字が読めないため、`--color-warning-foreground` だけネイビーにしている。

### コントラスト比（自動テストで検証済み）

| 背景 | 文字 | 比 | 基準 |
|---|---|---|---|
| background `#FFFAF7` | foreground `#1E2A44` | 13.79:1 | 4.5 |
| background | muted-foreground `#5A6478` | 5.74:1 | 4.5 |
| background | primary `#C9401F`（リンク） | 4.78:1 | 4.5 |
| card `#FFFFFF` | card-foreground | 14.29:1 | 4.5 |
| card | muted-foreground | 5.95:1 | 4.5 |
| muted `#F4F5F8` | muted-foreground | 5.46:1 | 4.5 |
| muted | foreground | 13.11:1 | 4.5 |
| primary `#C9401F` | primary-foreground `#FFFFFF` | 4.96:1 | 4.5 |
| primary-hover `#9E3418` | primary-foreground | 7.10:1 | 4.5 |
| brand `#FF7A59` | brand-foreground `#1E2A44` | 5.57:1 | 4.5 |
| secondary `#1E2A44` | secondary-foreground | 14.29:1 | 4.5 |
| secondary-hover `#2E3D5E` | secondary-foreground | 10.80:1 | 4.5 |
| accent `#FFE8E0` | accent-foreground | 12.16:1 | 4.5 |
| success `#1E7A46` | white | 5.35:1 | 4.5 |
| warning `#FFB020` | navy-900 | 7.81:1 | 4.5 |
| danger `#B42335` | white | 6.50:1 | 4.5 |
| danger-hover `#8F1C2A` | white | 8.87:1 | 4.5 |
| info `#2563B8` | white | 5.91:1 | 4.5 |
| background / card | ring `#C9401F` | 4.78 / 4.96:1 | 3（非テキスト） |
| card | input `#7D879B` | 3.61:1 | 3（非テキスト） |

`--color-border`（`#E3E6EC`）は装飾的な区切り線なので、3:1 の対象外。入力欄など操作部品の枠には、必ず `--color-input` を使う。

## 余白（4px 基準）

| トークン | 値 | 目安 |
|---|---|---|
| `--space-1` | 4px | アイコンと文字の間 |
| `--space-2` | 8px | タグ同士、ボタン内の上下 |
| `--space-3` | 12px | 入力欄の内側 |
| `--space-4` | 16px | カード内の要素間、スマホの左右余白（`--container-padding`） |
| `--space-5` | 20px | |
| `--space-6` | 24px | カードの内側余白 |
| `--space-8` | 32px | セクション内のブロック間 |
| `--space-10` | 40px | |
| `--space-12` | 48px | セクション同士（スマホ） |
| `--space-16` | 64px | セクション同士（PC） |

## 角丸

| トークン | 値 | 使う場面 |
|---|---|---|
| `--radius-sm` | 6px | 入力欄、小さなタグ |
| `--radius-md` | 12px | トースト、ドロップダウン |
| `--radius-lg` | 20px | **カード**、モーダル（写真を柔らかく見せるため大きめ） |
| `--radius-full` | 9999px | 丸ボタン、アバター、チップ |

## 影

| トークン | 使う場面 |
|---|---|
| `--shadow-sm` | 通常時のカード |
| `--shadow-md` | **カードのホバー時（浮き上がり）**、ドロップダウン、トースト |
| `--shadow-lg` | モーダル、ボトムシート |

## タイポグラフィ

| トークン | 値 | 使う場面 |
|---|---|---|
| `--font-family-base` | `"Noto Sans JP", sans-serif` | 全体 |
| `--font-size-xs` | 12px | バッジ、注記 |
| `--font-size-sm` | 14px | 補足テキスト、日付 |
| `--font-size-base` | 16px | 本文 |
| `--font-size-lg` | 18px | h3（スマホ）、リード文 |
| `--font-size-xl` | 20px | h2（スマホ）/ h3（640px〜） |
| `--font-size-2xl` | 24px | h1（スマホ）/ h2（640px〜） |
| `--font-size-3xl` | 32px | h1（640px〜） |
| `--line-height-tight` / `--line-height-normal` | 1.3 / 1.7 | 見出し / 本文（日本語は行間を広めにとる） |
| `--font-weight-normal` / `-medium` / `-bold` | 400 / 500 / 700 | 本文 / ボタン・ラベル / 見出し |

## モーション

| トークン | 値 | 使う場面 |
|---|---|---|
| `--duration-fast` | 150ms | ホバー時の色変化 |
| `--duration-normal` | 250ms | カードの浮き上がり、シート・モーダルの開閉 |
| `--duration-slow` | 1500ms | スケルトンの明滅（速い点滅は目障りなため） |
| `--easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` | 共通 |

OS で「視差効果を減らす」が有効な場合（`prefers-reduced-motion: reduce`）は、`reset.css` がアニメーションとトランジションを実質無効にする。

## レイヤー（z-index）

z-index には数値を直接書かず、必ず次のトークンを使う。

| トークン | 値 | 使う場面 |
|---|---|---|
| `--z-header` | 100 | 固定ヘッダー |
| `--z-sheet` | 200 | 検索フィルターのボトムシート |
| `--z-modal` | 300 | 応募ダイアログ |
| `--z-toast` | 400 | トースト通知、スキップリンク（常に最前面） |

## レイアウト

| トークン | 値 | 使う場面 |
|---|---|---|
| `--container-max` | 72rem（1152px） | `.container` の最大幅 |
| `--container-padding` | `--space-4` | `.container` の左右余白 |
| `--header-height` | 4rem（64px） | ヘッダーの高さ、アンカー移動時のずらし幅 |
| `--focus-ring-width` / `--focus-ring-offset` | 3px / 2px | フォーカスリングの太さと間隔 |

### 部品サイズ

| トークン | 値 | 使う場面 |
|---|---|---|
| `--toast-max-width` | 28rem | トーストの最大幅（PC で1〜2行に収める） |
| `--dialog-max-width` | 32rem | ダイアログの最大幅 |
| `--sheet-max-height` | 85dvh | ボトムシートの最大の高さ（背面を少し残す） |
| `--aspect-portrait` | 4 / 5 | タレント写真とそのスケルトンの縦横比 |

### レイアウト補助クラス

| クラス | 役割 | 調整 |
|---|---|---|
| `.container` | 最大幅＋中央寄せ＋左右余白 | — |
| `.stack` | 子要素を縦に並べて等間隔にする | `style="--stack-space: var(--space-8)"` |
| `.cluster` | 横に並べ、幅が足りなければ折り返す（タグ・ボタン群） | `--cluster-space` |

## アクセシビリティの共通部品（`base.css`）

- `:focus-visible`：キーボード操作のときだけ、`--color-ring` の 3px リングを表示する。
- `.visually-hidden`：見た目は隠し、スクリーンリーダーには読ませるテキスト。
- `.skip-link`：`<body>` の先頭に置く「本文へスキップ」。フォーカスされたときだけ表示される。
- リンクは色だけで区別させないよう、下線を残す。
