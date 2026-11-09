# #04 データ・ロジック層（架空データ・storage・utils・filters・matching・validation）

## 概要
画面から独立した「データ」と「純粋なロジック」をまとめて作る。DOMに依存しないため、TDDで先に固める。

- 対象要件：4.4 データモデル / 4.5 保存キー / 4.6 データ規模 / 4.7 セキュリティ / 6.4 マッチ度 / 6.5 検索条件 / 2.5 バリデーション
- 依存：#01（ディレクトリ構成のみ）

## 作成・編集するファイル
| ファイル | 内容 |
|---|---|
| `js/data/master.js` | 職種・性別・年齢帯・都道府県・地方・ジャンル・スキルタグのマスタ |
| `js/data/talents.js` | JSDoc型定義＋架空タレント20〜30件（うち5〜8件に `introVideo`） |
| `js/data/jobs.js` | 架空案件15〜20件（数件を `videoPreferred: true`） |
| `js/data/companies.js` | 架空企業5〜8社 |
| `js/data/seeds.js` | 初期の応募・スカウト各5〜10件 |
| `js/lib/storage.js` | localStorage / sessionStorage の読み書き（キーは 4.5 に準拠） |
| `js/lib/utils.js` | クエリ取得・更新、日付整形、HTMLエスケープ、秒→「1分24秒」整形 |
| `js/lib/filters.js` | タレント検索・案件検索・並び替え |
| `js/lib/matching.js` | マッチ度スコア計算（副作用なし） |
| `js/lib/validation.js` | 問い合わせ・応募・案件掲載・動画メタの入力チェック |
| `tests/*.test.mjs` | 各libのテスト |

## 実装タスク
- [ ] **データ**：実在の人物名・社名・作品名を使わない。電話番号・住所・生年月日は持たない
- [ ] **storage.js**
  - [ ] キーは定数で一元管理（`stagelink:role` など 4.5 の表どおり）
  - [ ] `getRole` / `setRole`、`getApplications` / `addApplication` / `updateApplicationStatus`、`getScouts` / `addScout` / `updateScoutStatus`、`getAddedJobs` / `addJob`、`getFavorites` / `toggleFavorite`、`getProfile` / `saveProfile`、`getContactDraft` / `saveContactDraft` / `clearContactDraft`、`resetDemoData`
  - [ ] すべて `try/catch`。失敗時は既定値を返し、画面を壊さない
- [ ] **utils.js**：`escapeHTML`、`getQueryParams` / `setQueryParams`（`history.replaceState`）、`formatDate`、`formatDuration`
- [ ] **filters.js**
  - [ ] タレント：職種・性別・年齢帯・地域・スキル（複数AND）・キーワード・動画ありのみ
  - [ ] 案件：職種・ジャンル・地域・報酬下限、並び替え（締切が近い順／新着順／マッチ度順）
- [ ] **matching.js**：`calcMatchScore(talent, job)` を 6.4 の配点表どおり実装。配点は定数化。上限100点
- [ ] **matching.js**：`getMatchLabel(score)` → `"great"`（70〜）/ `"good"`（50〜69）/ `null`
- [ ] **validation.js**：エラー文は具体的に（例「メールアドレスの形式が正しくありません」）

## テスト（先に書く）
- [ ] storage：保存→取得の往復、壊れたJSONが入っていても既定値が返る、`resetDemoData` で全キーが消える
- [ ] utils：`escapeHTML('<script>')` がエスケープされる、`formatDuration(84)` が「1分24秒」
- [ ] filters：各条件単独・組み合わせ・条件なし・0件
- [ ] matching：全項目一致で100点、職種のみ一致で30点、同一地方で8点、`videoPreferred` ボーナスで100点を超えない、同じ入力で同じ結果
- [ ] validation：本文9文字・10文字・1000文字・1001文字の境界値、メール形式

## 完了条件
- [ ] `node --test "tests/**/*.test.mjs"` がすべて通る
- [ ] データ件数が 4.6 を満たす（件数チェックもテストで確認）
- [ ] ブラウザで各モジュールを読み込んでもコンソールエラーが出ない
