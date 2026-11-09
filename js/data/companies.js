// 架空企業データ（要件 4.4 / 4.6）。社名・制作実績はすべて架空。
import { deepFreeze } from './freeze.js';

/**
 * @typedef {Object} Company
 * @property {string} id
 * @property {string} name              架空の社名
 * @property {"advertising"|"video_production"|"other"} type
 * @property {string} description
 * @property {string[]} works
 */

/** デモで「ログイン中の企業」として扱う会社（案件掲載・応募者一覧・スカウト送信の主体） */
export const DEMO_COMPANY_ID = 'c001';

/** @type {Readonly<Company[]>} */
export const COMPANIES = deepFreeze([
  {
    id: 'c001', name: '株式会社ひだまりフィルムワークス', type: 'video_production',
    description: 'Web CM・企業VP・MVを手がける映像制作会社。少人数で企画から撮影・編集まで一貫して担当します。',
    works: ['飲料ブランド（架空）Web CM', '地域観光PR動画（架空）', 'インディーズバンドMV（架空）'],
  },
  {
    id: 'c002', name: '株式会社ソラアオ広告', type: 'advertising',
    description: '食品・日用品メーカーの広告を中心に、テレビCMからSNS広告まで企画する広告会社です。',
    works: ['調味料メーカー（架空）テレビCM', 'ドラッグストア（架空）チラシ・Web広告'],
  },
  {
    id: 'c003', name: '合同会社トモシビ制作所', type: 'video_production',
    description: 'ショートドラマと再現ドラマが得意な制作会社。新人の起用にも積極的です。',
    works: ['縦型ショートドラマ『となりの席の佐倉さん』（架空）', '情報番組 再現VTR（架空）'],
  },
  {
    id: 'c004', name: '株式会社ナミノリ・クリエイティブ', type: 'advertising',
    description: 'アパレル・コスメブランドのビジュアル制作を担う広告制作会社です。',
    works: ['コスメブランド（架空）春のキャンペーン', 'アパレル通販（架空）カタログ撮影'],
  },
  {
    id: 'c005', name: '株式会社こもれび舞台企画', type: 'other',
    description: '朗読劇・小劇場公演・イベントステージを企画する舞台制作会社です。',
    works: ['朗読劇『星の手紙』（架空）', '商業施設（架空）周年イベント'],
  },
  {
    id: 'c006', name: '株式会社ミナモ映像社', type: 'video_production',
    description: '映画・ドラマの撮影現場を支える制作プロダクション。地方ロケの実績が豊富です。',
    works: ['自主映画『雪原のポストマン』（架空）', '自治体（架空）移住促進ドラマ'],
  },
]);
