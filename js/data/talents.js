// 架空タレントデータ（要件 4.4 / 4.6）。
// 名前・作品名はすべて架空。電話番号・住所・生年月日は持たない（要件 5.2）。
// 写真は未用意のため images は空配列（カードはシルエットのプレースホルダーを出す）。
// SNS は実在アカウントに誤ってリンクしないよう、example.com（予約ドメイン）を使う。
import { deepFreeze } from './freeze.js';

/**
 * @typedef {"actor"|"model"|"voice"|"dancer"|"other"} TalentRole
 * @typedef {"female"|"male"|"other"|"unspecified"} Gender
 */

/**
 * @typedef {Object} IntroVideo
 * @property {string} src          サンプル動画のパス（例 "assets/videos/t001.webm"）
 * @property {string} poster       サムネイル画像のパス
 * @property {number} duration     秒
 * @property {string} [caption]    動画の一言説明
 */

/**
 * @typedef {Object} Talent
 * @property {string} id
 * @property {string} displayName       架空の芸名
 * @property {TalentRole[]} roles
 * @property {Gender} gender
 * @property {string} ageRange          例 "20代前半"（生年月日は持たない）
 * @property {string} area              都道府県
 * @property {number} [height]
 * @property {string[]} skills          例 ["殺陣", "英語", "ダンス"]
 * @property {string[]} genres          例 ["CM", "舞台", "MV"]
 * @property {string} bio
 * @property {{year:number,title:string,type:string}[]} career
 * @property {string[]} images
 * @property {IntroVideo} [introVideo]  自己紹介動画（任意）
 * @property {{instagram?:string,x?:string}} [sns]
 * @property {boolean} isFeatured
 */

/** デモで「ログイン中のタレント本人」として扱う人（プロフィール編集・マイページ・おすすめ案件の基準） */
export const DEMO_TALENT_ID = 't001';

/** @param {string} id @param {number} duration @param {string} caption @returns {IntroVideo} */
const video = (id, duration, caption) => ({
  // サンプル素材は依存パッケージなしで生成できる WebM(VP8)。主要ブラウザ（Safari 含む）で再生できる
  src: `assets/videos/${id}.webm`,
  poster: `assets/images/videos/${id}.jpg`,
  duration,
  caption,
});

/** @type {Readonly<Talent[]>} */
export const TALENTS = deepFreeze([
  {
    id: 't001', displayName: '春風 みなみ', roles: ['actor'], gender: 'female', ageRange: '20代前半', area: '東京都', height: 158,
    skills: ['英語', 'ダンス', '即興演技'], genres: ['CM', 'ドラマ', '舞台'],
    bio: '小劇場を中心に活動中。明るい役もシリアスな役も挑戦したいです。',
    career: [{ year: 2024, title: '舞台『はるかぜ通りの午後』', type: '舞台' }, { year: 2025, title: 'Web CM「朝のひとくちヨーグルト」', type: 'CM' }],
    images: [], introVideo: video('t001', 28, '30秒で自己紹介します！'), sns: { instagram: 'https://example.com/sns/harukaze_minami' }, isFeatured: true,
  },
  {
    id: 't002', displayName: '灯野 そら', roles: ['model'], gender: 'female', ageRange: '20代後半', area: '大阪府', height: 168,
    skills: ['ウォーキング', 'ポージング', '関西弁'], genres: ['雑誌', 'Web広告', 'CM'],
    bio: 'アパレル通販のモデル経験多数。関西弁のナチュラルな掛け合いも得意です。',
    career: [{ year: 2023, title: '架空誌『週末さんぽ』秋号', type: '雑誌' }, { year: 2025, title: 'アパレル通販サイト 春夏ビジュアル', type: 'Web広告' }],
    images: [], introVideo: video('t002', 24, 'ウォーキングと自己紹介'), isFeatured: true,
  },
  {
    id: 't003', displayName: '晴海 リク', roles: ['actor'], gender: 'male', ageRange: '20代前半', area: '神奈川県', height: 176,
    skills: ['殺陣', 'アクション', '水泳'], genres: ['ドラマ', '映画'],
    bio: 'アクション養成所出身。体を張るシーンもお任せください。',
    career: [{ year: 2025, title: '自主映画『波打ち際の約束』', type: '映画' }],
    images: [], isFeatured: false,
  },
  {
    id: 't004', displayName: '小町 ひより', roles: ['voice'], gender: 'female', ageRange: '10代', area: '埼玉県',
    skills: ['ナレーション', 'ボイストレーニング', '歌'], genres: ['アニメ', 'ナレーション'],
    bio: '声優養成所に在籍中。元気な少年役から落ち着いたナレーションまで。',
    career: [{ year: 2025, title: '架空アニメ『ほしふる町のパン屋さん』端役', type: 'アニメ' }],
    images: [], introVideo: video('t004', 20, 'いろいろな声で自己紹介'), isFeatured: true,
  },
  {
    id: 't005', displayName: '鷹宮 ジン', roles: ['dancer'], gender: 'male', ageRange: '20代後半', area: '福岡県', height: 172,
    skills: ['ダンス', 'アクション', '博多弁'], genres: ['MV', 'イベント'],
    bio: 'ストリートダンス歴12年。振付の提案もできます。',
    career: [{ year: 2024, title: '架空バンド「ルミナス坂」MV', type: 'MV' }, { year: 2025, title: '商業施設オープニングイベント', type: 'イベント' }],
    images: [], isFeatured: false,
  },
  {
    id: 't006', displayName: '白砂 ことね', roles: ['actor'], gender: 'female', ageRange: '30代前半', area: '京都府', height: 162,
    skills: ['書道', '関西弁', '料理'], genres: ['ドラマ', 'CM'],
    bio: '着物での所作に自信があります。母親役・会社員役の経験多数。',
    career: [{ year: 2022, title: '架空ドラマ『町家の灯り』', type: 'ドラマ' }, { year: 2024, title: '調味料メーカー テレビCM', type: 'CM' }],
    images: [], isFeatured: false,
  },
  {
    id: 't007', displayName: '朝凪 ユウト', roles: ['model', 'actor'], gender: 'male', ageRange: '20代前半', area: '東京都', height: 181,
    skills: ['ウォーキング', '英語', 'ギター'], genres: ['雑誌', 'MV', 'Web広告'],
    bio: '大学で英語を専攻。海外向け広告にも対応できます。',
    career: [{ year: 2025, title: '架空誌『STREET NOTE』', type: '雑誌' }],
    images: [], introVideo: video('t007', 30, '英語と日本語で自己紹介'), sns: { x: 'https://example.com/sns/asanagi_yuto' }, isFeatured: true,
  },
  {
    id: 't008', displayName: '栞田 まひる', roles: ['actor'], gender: 'female', ageRange: '20代後半', area: '愛知県', height: 155,
    skills: ['即興演技', 'ピアノ'], genres: ['舞台', 'Web広告'],
    bio: '劇団で8年活動。ピアノの弾き語りシーンにも対応できます。',
    career: [{ year: 2023, title: '舞台『灯台守の娘』', type: '舞台' }],
    images: [], isFeatured: false,
  },
  {
    id: 't009', displayName: '千歳 ケンタ', roles: ['actor'], gender: 'male', ageRange: '30代後半', area: '北海道', height: 178,
    skills: ['車の運転', '乗馬', '料理'], genres: ['映画', 'ドラマ', 'CM'],
    bio: '父親役・上司役が得意。北海道ロケの案件はぜひ。',
    career: [{ year: 2021, title: '架空映画『雪原のポストマン』', type: '映画' }, { year: 2024, title: '乳業メーカー Web CM', type: 'CM' }],
    images: [], isFeatured: false,
  },
  {
    id: 't010', displayName: '鈴鳴 ルナ', roles: ['dancer'], gender: 'female', ageRange: '20代前半', area: '東京都', height: 160,
    skills: ['ダンス', '歌', 'ヨガ'], genres: ['MV', 'イベント', 'CM'],
    bio: 'ジャズとヒップホップが得意。歌って踊れるのが強みです。',
    career: [{ year: 2025, title: '架空アイドル「ミントリボン」MV バックダンサー', type: 'MV' }],
    images: [], introVideo: video('t010', 25, 'ダンスを少しだけ'), isFeatured: true,
  },
  {
    id: 't011', displayName: '青葉台 しずく', roles: ['voice'], gender: 'female', ageRange: '20代後半', area: '東京都',
    skills: ['ナレーション', '英語'], genres: ['ナレーション', 'Web広告'],
    bio: '企業VPやeラーニングのナレーションを担当しています。',
    career: [{ year: 2024, title: '架空企業 会社紹介動画ナレーション', type: 'ナレーション' }],
    images: [], isFeatured: false,
  },
  {
    id: 't012', displayName: '汐見 タクマ', roles: ['actor'], gender: 'male', ageRange: '40代', area: '大阪府', height: 174,
    skills: ['関西弁', '殺陣'], genres: ['舞台', '映画'],
    bio: '時代劇の経験が豊富。コミカルな役も好きです。',
    career: [{ year: 2020, title: '舞台『浪花ちょうちん横丁』', type: '舞台' }],
    images: [], isFeatured: false,
  },
  {
    id: 't013', displayName: '若菜 こはる', roles: ['model'], gender: 'female', ageRange: '10代', area: '千葉県', height: 163,
    skills: ['ポージング', '水泳'], genres: ['雑誌', 'CM'],
    bio: '高校生モデル。学生役・制服の撮影に対応できます。',
    career: [{ year: 2025, title: '学習塾 チラシ・Web広告', type: 'Web広告' }],
    images: [], isFeatured: false,
  },
  {
    id: 't014', displayName: '宵川 レン', roles: ['voice', 'actor'], gender: 'male', ageRange: '20代前半', area: '宮城県', height: 170,
    skills: ['ナレーション', '歌', 'ボイストレーニング'], genres: ['アニメ', 'ナレーション', '舞台'],
    bio: '低音ボイスが武器。朗読劇にも出演しています。',
    career: [{ year: 2024, title: '朗読劇『星の手紙』', type: '舞台' }],
    images: [], introVideo: video('t014', 18, '朗読を少し聞いてください'), isFeatured: false,
  },
  {
    id: 't015', displayName: '野々花 えま', roles: ['actor'], gender: 'female', ageRange: '30代後半', area: '広島県', height: 160,
    skills: ['料理', '車の運転'], genres: ['CM', 'ドラマ'],
    bio: '主婦役・店員役の再現ドラマに多数出演。',
    career: [{ year: 2023, title: '再現ドラマ（架空情報番組内）', type: 'ドラマ' }],
    images: [], isFeatured: false,
  },
  {
    id: 't016', displayName: '岬野 ダイチ', roles: ['dancer'], gender: 'male', ageRange: '10代', area: '沖縄県', height: 166,
    skills: ['ダンス', '水泳'], genres: ['イベント', 'MV'],
    bio: 'ブレイクダンスの大会で入賞経験あり。',
    career: [{ year: 2025, title: '地域フェスティバル ステージ出演', type: 'イベント' }],
    images: [], isFeatured: false,
  },
  {
    id: 't017', displayName: '柚木坂 なぎ', roles: ['model', 'other'], gender: 'other', ageRange: '20代後半', area: '東京都', height: 170,
    skills: ['ウォーキング', '韓国語', 'ヨガ'], genres: ['雑誌', 'Web広告'],
    bio: 'ジェンダーレスなスタイリングが得意。イベントMCもしています。',
    career: [{ year: 2024, title: 'コスメブランド Web広告', type: 'Web広告' }],
    images: [], isFeatured: true,
  },
  {
    id: 't018', displayName: '遠峰 コウ', roles: ['actor'], gender: 'male', ageRange: '50代以上', area: '兵庫県', height: 172,
    skills: ['書道', '乗馬'], genres: ['映画', 'ドラマ', 'CM'],
    bio: '祖父役・社長役などを中心に活動。落ち着いた語りが持ち味です。',
    career: [{ year: 2019, title: '架空映画『港町の時計店』', type: '映画' }],
    images: [], isFeatured: false,
  },
  {
    id: 't019', displayName: '夕凪 ちさと', roles: ['actor'], gender: 'female', ageRange: '40代', area: '福岡県', height: 157,
    skills: ['博多弁', '料理'], genres: ['CM', '舞台'],
    bio: '地元企業のCMに多数出演。温かい雰囲気の役が得意です。',
    career: [{ year: 2022, title: '地方銀行（架空）テレビCM', type: 'CM' }],
    images: [], isFeatured: false,
  },
  {
    id: 't020', displayName: '唐草 ヒナタ', roles: ['other'], gender: 'female', ageRange: '20代前半', area: '新潟県',
    skills: ['料理', '即興演技'], genres: ['イベント', 'Web広告'],
    bio: 'イベントMC・リポーターとして活動中。食レポが得意です。',
    career: [{ year: 2025, title: '地域情報Web番組 リポーター', type: 'Web広告' }],
    images: [], isFeatured: false,
  },
  {
    id: 't021', displayName: '杜若 リョウ', roles: ['model'], gender: 'male', ageRange: '30代前半', area: '東京都', height: 183,
    skills: ['ウォーキング', '中国語'], genres: ['雑誌', 'CM'],
    bio: 'メンズファッション誌・時計広告のモデル経験あり。',
    career: [{ year: 2023, title: '架空誌『MONOCHROME MEN』', type: '雑誌' }],
    images: [], isFeatured: false,
  },
  {
    id: 't022', displayName: '風早 みのり', roles: ['voice'], gender: 'female', ageRange: '30代前半', area: '大阪府',
    skills: ['ナレーション', '関西弁', '歌'], genres: ['ナレーション', 'アニメ'],
    bio: 'ラジオCMの声を多数担当。やわらかい声質です。',
    career: [{ year: 2024, title: '架空ラジオ局 番組ジングル', type: 'ナレーション' }],
    images: [], isFeatured: false,
  },
  {
    id: 't023', displayName: '稲穂 ショウ', roles: ['actor', 'dancer'], gender: 'male', ageRange: '20代後半', area: '静岡県', height: 175,
    skills: ['ダンス', '殺陣', 'ギター'], genres: ['舞台', 'MV'],
    bio: 'ミュージカル出身。歌・ダンス・芝居をバランスよく。',
    career: [{ year: 2024, title: 'ミュージカル『茶畑のうた』', type: '舞台' }],
    images: [], isFeatured: false,
  },
  {
    id: 't024', displayName: '澄川 あかね', roles: ['dancer'], gender: 'unspecified', ageRange: '20代後半', area: '愛媛県', height: 158,
    skills: ['ダンス', 'ヨガ'], genres: ['イベント', 'CM'],
    bio: 'コンテンポラリーダンサー。体の線を生かした表現が得意です。',
    career: [{ year: 2025, title: '架空飲料ブランド イベント出演', type: 'イベント' }],
    images: [], isFeatured: false,
  },
]);
