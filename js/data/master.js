// 検索フォームの選択肢・データの検証・マッチ度計算で共有するマスタ。
// 画面ごとに選択肢を書くと、片方だけ値がずれて「選べるのに1件も出ない」状態になるため、ここに1か所でまとめる。

/** @template T @param {T[]} list @returns {Readonly<T[]>} 要素ごと凍結（画面側の誤操作でマスタが変わらないように） */
const freezeList = (list) => Object.freeze(list.map((item) => (typeof item === 'object' ? Object.freeze(item) : item)));

/** 4.4 の TalentRole */
export const TALENT_ROLES = freezeList([
  { value: 'actor', label: '俳優' },
  { value: 'model', label: 'モデル' },
  { value: 'voice', label: '声優' },
  { value: 'dancer', label: 'ダンサー' },
  { value: 'other', label: 'その他' },
]);

/** 4.4 の Gender */
export const GENDERS = freezeList([
  { value: 'female', label: '女性' },
  { value: 'male', label: '男性' },
  { value: 'other', label: 'その他' },
  { value: 'unspecified', label: '回答しない' },
]);

// 生年月日を持たない代わりに、年齢は幅で扱う（要件 4.4 / 5.2）
export const AGE_RANGES = freezeList([
  '10代', '20代前半', '20代後半', '30代前半', '30代後半', '40代', '50代以上',
]);

// マッチ度の「同一地方」判定（要件 6.4）に使うため、都道府県は地方ごとに持つ
export const REGIONS = freezeList([
  { name: '北海道', prefectures: Object.freeze(['北海道']) },
  { name: '東北', prefectures: Object.freeze(['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県']) },
  { name: '関東', prefectures: Object.freeze(['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県']) },
  { name: '中部', prefectures: Object.freeze(['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県']) },
  { name: '近畿', prefectures: Object.freeze(['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県']) },
  { name: '中国', prefectures: Object.freeze(['鳥取県', '島根県', '岡山県', '広島県', '山口県']) },
  { name: '四国', prefectures: Object.freeze(['徳島県', '香川県', '愛媛県', '高知県']) },
  { name: '九州・沖縄', prefectures: Object.freeze(['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県']) },
]);

export const PREFECTURES = Object.freeze(REGIONS.flatMap((region) => region.prefectures));

const REGION_BY_PREFECTURE = new Map(
  REGIONS.flatMap((region) => region.prefectures.map((prefecture) => [prefecture, region.name])),
);

/**
 * @param {unknown} prefecture 都道府県名
 * @returns {string|null} 地方名。未知の値は null
 */
export function getRegionOf(prefecture) {
  return REGION_BY_PREFECTURE.get(prefecture) ?? null;
}

/** 案件ジャンル（4.4 Job.genre）。タレントの「出演経験ジャンル」と同じ語彙にして一致判定できるようにする */
export const GENRES = freezeList([
  'CM', 'Web広告', '映画', 'ドラマ', 'MV', '舞台', '雑誌', 'イベント', 'ナレーション', 'アニメ',
]);

export const SKILL_TAGS = freezeList([
  '殺陣', 'アクション', 'ダンス', '歌', '英語', '韓国語', '中国語', '関西弁', '博多弁',
  'ピアノ', 'ギター', '乗馬', '水泳', '書道', '料理', 'ウォーキング', 'ナレーション', 'ボイストレーニング',
  'ヨガ', '車の運転', 'ポージング', '即興演技',
]);

/** 2.5 の問い合わせ種別 */
export const CONTACT_CATEGORIES = freezeList([
  { value: 'talent-registration', label: 'タレント登録について' },
  { value: 'job-posting', label: '案件掲載について' },
  { value: 'press', label: '取材・提携' },
  { value: 'other', label: 'その他' },
]);

/** 4.4 の Company.type */
export const COMPANY_TYPES = freezeList([
  { value: 'advertising', label: '広告' },
  { value: 'video_production', label: '映像制作' },
  { value: 'other', label: 'その他' },
]);

/** 6.3 のステータス遷移の順 */
export const APPLICATION_STATUSES = freezeList(['applied', 'reviewing', 'accepted', 'declined']);
export const SCOUT_STATUSES = freezeList(['sent', 'read', 'replied']);

export const REWARD_UNITS = freezeList(['日', '案件']);
export const JOB_STATUSES = freezeList(['open', 'closed']);
