// 架空案件データ（要件 4.4 / 4.6）。案件名・商品名はすべて架空。
import { deepFreeze } from './freeze.js';

/**
 * @typedef {import('./talents.js').TalentRole} TalentRole
 * @typedef {import('./talents.js').Gender} Gender
 */

/**
 * @typedef {Object} Job
 * @property {string} id
 * @property {string} companyId
 * @property {string} title
 * @property {string} genre             CM / 映画 / MV / Web広告 / 舞台 など
 * @property {TalentRole[]} requiredRoles
 * @property {Gender} [gender]          省略時は性別不問
 * @property {string[]} ageRanges
 * @property {string} area
 * @property {string} shootDates        例 "2026年11月中旬（2日間）"
 * @property {{min:number,max:number,unit:"日"|"案件"}} reward
 * @property {string[]} requiredSkills
 * @property {boolean} [videoPreferred] 自己紹介動画ありを歓迎
 * @property {string} description
 * @property {string} deadline          ISO日付
 * @property {"open"|"closed"} status
 * @property {string} createdAt         ISO日時。4.4 には無いが「新着順」（要件 6.5）の並び替えに必要なため追加
 */

/** @type {Readonly<Job[]>} */
export const JOBS = deepFreeze([
  {
    id: 'j001', companyId: 'c001', title: '飲料ブランドWeb CM「朝の一杯」出演者募集', genre: 'Web広告',
    requiredRoles: ['actor'], gender: 'female', ageRanges: ['20代前半', '20代後半'], area: '東京都',
    shootDates: '2026年12月上旬（1日）', reward: { min: 30000, max: 50000, unit: '日' }, requiredSkills: ['即興演技'], videoPreferred: true,
    description: '朝の通勤シーンを自然な表情で演じていただきます。セリフは少なめです。', deadline: '2026-11-20', status: 'open', createdAt: '2026-10-28T10:00:00+09:00',
  },
  {
    id: 'j002', companyId: 'c002', title: '調味料メーカー テレビCM 家族役（父・母）', genre: 'CM',
    requiredRoles: ['actor'], ageRanges: ['30代後半', '40代'], area: '大阪府',
    shootDates: '2026年12月中旬（2日間）', reward: { min: 80000, max: 120000, unit: '案件' }, requiredSkills: ['料理'],
    description: '食卓を囲む家族のCMです。料理をする手元のカットがあります。', deadline: '2026-11-25', status: 'open', createdAt: '2026-10-20T10:00:00+09:00',
  },
  {
    id: 'j003', companyId: 'c001', title: 'インディーズバンドMV ダンサー募集', genre: 'MV',
    requiredRoles: ['dancer'], ageRanges: ['10代', '20代前半', '20代後半'], area: '東京都',
    shootDates: '2026年11月下旬（1日）', reward: { min: 20000, max: 30000, unit: '日' }, requiredSkills: ['ダンス'], videoPreferred: true,
    description: 'アップテンポな楽曲に合わせて踊っていただきます。振付は事前に共有します。', deadline: '2026-11-12', status: 'open', createdAt: '2026-10-30T10:00:00+09:00',
  },
  {
    id: 'j004', companyId: 'c003', title: '縦型ショートドラマ 主人公の同僚役', genre: 'ドラマ',
    requiredRoles: ['actor'], ageRanges: ['20代前半', '20代後半'], area: '神奈川県',
    shootDates: '2026年12月（3日間）', reward: { min: 15000, max: 25000, unit: '日' }, requiredSkills: [],
    description: 'SNS配信のショートドラマ。オフィスを舞台にしたコメディです。', deadline: '2026-11-30', status: 'open', createdAt: '2026-10-25T10:00:00+09:00',
  },
  {
    id: 'j005', companyId: 'c004', title: 'コスメブランド 春のキャンペーンビジュアル', genre: 'Web広告',
    requiredRoles: ['model'], ageRanges: ['20代前半', '20代後半', '30代前半'], area: '東京都',
    shootDates: '2027年1月中旬（1日）', reward: { min: 100000, max: 150000, unit: '案件' }, requiredSkills: ['ポージング'],
    description: '肌の質感を大切にしたスチール撮影です。ジェンダーを問わず募集します。', deadline: '2026-12-10', status: 'open', createdAt: '2026-10-31T10:00:00+09:00',
  },
  {
    id: 'j006', companyId: 'c005', title: '朗読劇『冬の灯台』出演者', genre: '舞台',
    requiredRoles: ['voice', 'actor'], ageRanges: ['20代前半', '20代後半', '30代前半'], area: '東京都',
    shootDates: '2027年2月（稽古5日・本番2日）', reward: { min: 60000, max: 90000, unit: '案件' }, requiredSkills: ['ナレーション'], videoPreferred: true,
    description: '小劇場での朗読劇です。声の表現力を重視します。', deadline: '2026-12-15', status: 'open', createdAt: '2026-10-18T10:00:00+09:00',
  },
  {
    id: 'j007', companyId: 'c006', title: '自治体 移住促進ドラマ 地元の青年役', genre: 'ドラマ',
    requiredRoles: ['actor'], gender: 'male', ageRanges: ['20代前半', '20代後半'], area: '北海道',
    shootDates: '2027年1月下旬（4日間・宿泊あり）', reward: { min: 25000, max: 35000, unit: '日' }, requiredSkills: ['車の運転'],
    description: '雪国の町で働く青年の役です。運転シーンがあります。', deadline: '2026-12-05', status: 'open', createdAt: '2026-10-22T10:00:00+09:00',
  },
  {
    id: 'j008', companyId: 'c002', title: 'ドラッグストア チラシ・Web広告モデル', genre: '雑誌',
    requiredRoles: ['model'], ageRanges: ['30代前半', '30代後半', '40代'], area: '埼玉県',
    shootDates: '2026年11月下旬（半日）', reward: { min: 20000, max: 20000, unit: '案件' }, requiredSkills: [],
    description: '日用品を手に取る自然なカットを撮影します。', deadline: '2026-11-15', status: 'open', createdAt: '2026-10-15T10:00:00+09:00',
  },
  {
    id: 'j009', companyId: 'c003', title: '情報番組 再現VTR 店員役', genre: 'ドラマ',
    requiredRoles: ['actor'], ageRanges: ['20代後半', '30代前半', '30代後半', '40代'], area: '大阪府',
    shootDates: '2026年11月中旬（1日）', reward: { min: 15000, max: 15000, unit: '日' }, requiredSkills: ['関西弁'],
    description: '関西の商店街が舞台の再現VTRです。関西弁のセリフがあります。', deadline: '2026-11-08', status: 'open', createdAt: '2026-10-10T10:00:00+09:00',
  },
  {
    id: 'j010', companyId: 'c001', title: '地域観光PR動画 旅行者役', genre: 'Web広告',
    requiredRoles: ['actor', 'model'], ageRanges: ['20代前半', '20代後半'], area: '京都府',
    shootDates: '2026年12月中旬（2日間）', reward: { min: 30000, max: 40000, unit: '日' }, requiredSkills: ['英語'],
    description: '海外向けのPR動画です。英語で短いセリフがあります。', deadline: '2026-11-28', status: 'open', createdAt: '2026-10-27T10:00:00+09:00',
  },
  {
    id: 'j011', companyId: 'c005', title: '商業施設 周年イベント ステージダンサー', genre: 'イベント',
    requiredRoles: ['dancer'], ageRanges: ['10代', '20代前半', '20代後半'], area: '福岡県',
    shootDates: '2026年12月20日（1日）', reward: { min: 25000, max: 30000, unit: '日' }, requiredSkills: ['ダンス'],
    description: '屋内ステージで2回公演します。リハーサルは前日に行います。', deadline: '2026-11-30', status: 'open', createdAt: '2026-10-24T10:00:00+09:00',
  },
  {
    id: 'j012', companyId: 'c006', title: '短編映画『港の見える坂道』 祖父役', genre: '映画',
    requiredRoles: ['actor'], gender: 'male', ageRanges: ['50代以上'], area: '兵庫県',
    shootDates: '2027年1月（3日間）', reward: { min: 40000, max: 60000, unit: '日' }, requiredSkills: [],
    description: '孫との交流を描く短編映画です。穏やかな語り口の方を求めています。', deadline: '2026-12-20', status: 'open', createdAt: '2026-10-29T10:00:00+09:00',
  },
  {
    id: 'j013', companyId: 'c004', title: 'アパレル通販 カタログ撮影（メンズ）', genre: '雑誌',
    requiredRoles: ['model'], gender: 'male', ageRanges: ['20代後半', '30代前半'], area: '東京都',
    shootDates: '2026年11月中旬（1日）', reward: { min: 35000, max: 45000, unit: '日' }, requiredSkills: ['ウォーキング'],
    description: '冬物アウターのカタログ撮影です。', deadline: '2026-10-31', status: 'closed', createdAt: '2026-10-01T10:00:00+09:00',
  },
  {
    id: 'j014', companyId: 'c002', title: 'ラジオCM ナレーター募集', genre: 'ナレーション',
    requiredRoles: ['voice'], ageRanges: ['20代後半', '30代前半', '30代後半'], area: '大阪府',
    shootDates: '2026年11月下旬（収録2時間）', reward: { min: 20000, max: 30000, unit: '案件' }, requiredSkills: ['ナレーション'],
    description: '地域の家電量販店（架空）のラジオCMです。', deadline: '2026-11-18', status: 'open', createdAt: '2026-10-26T10:00:00+09:00',
  },
  {
    id: 'j015', companyId: 'c003', title: 'アニメ風ショート動画 キャラクターボイス', genre: 'アニメ',
    requiredRoles: ['voice'], ageRanges: ['10代', '20代前半'], area: '東京都',
    shootDates: '2026年12月上旬（収録1日）', reward: { min: 15000, max: 25000, unit: '案件' }, requiredSkills: ['ボイストレーニング'], videoPreferred: true,
    description: '少年キャラクターの声を担当していただきます。', deadline: '2026-11-22', status: 'open', createdAt: '2026-11-01T10:00:00+09:00',
  },
  {
    id: 'j016', companyId: 'c001', title: '飲料ブランド イベントMC', genre: 'イベント',
    requiredRoles: ['other'], ageRanges: ['20代前半', '20代後半', '30代前半'], area: '新潟県',
    shootDates: '2026年12月（土日2日間）', reward: { min: 30000, max: 30000, unit: '日' }, requiredSkills: ['即興演技'],
    description: '試飲イベントの司会進行です。来場者とのやり取りを楽しめる方歓迎。', deadline: '2026-11-26', status: 'open', createdAt: '2026-10-19T10:00:00+09:00',
  },
  {
    id: 'j017', companyId: 'c006', title: '時代劇ドラマ 殺陣ができる剣士役', genre: 'ドラマ',
    requiredRoles: ['actor'], gender: 'male', ageRanges: ['20代後半', '30代前半', '40代'], area: '京都府',
    shootDates: '2026年11月上旬（2日間）', reward: { min: 50000, max: 70000, unit: '日' }, requiredSkills: ['殺陣', 'アクション'],
    description: '撮影所での立ち回りシーンです。', deadline: '2026-10-25', status: 'closed', createdAt: '2026-09-28T10:00:00+09:00',
  },
  {
    id: 'j018', companyId: 'c004', title: 'スポーツウェア Web広告 ヨガインストラクター役', genre: 'Web広告',
    requiredRoles: ['model', 'dancer'], gender: 'female', ageRanges: ['20代後半', '30代前半'], area: '愛知県',
    shootDates: '2026年12月中旬（1日）', reward: { min: 40000, max: 60000, unit: '案件' }, requiredSkills: ['ヨガ'],
    description: 'ヨガのポーズを取りながらウェアを見せる撮影です。', deadline: '2026-12-01', status: 'open', createdAt: '2026-10-23T10:00:00+09:00',
  },
]);
