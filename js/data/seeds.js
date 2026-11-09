// 初期の応募・スカウト（要件 4.6）。
// localStorage にまだ何も無いときの初期状態として storage.js が返す。初回訪問でもマイページが空にならないようにするため。
import { deepFreeze } from './freeze.js';

/**
 * @typedef {Object} Application
 * @property {string} id
 * @property {string} jobId
 * @property {string} talentId
 * @property {string} message
 * @property {"applied"|"reviewing"|"accepted"|"declined"} status
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Scout
 * @property {string} id
 * @property {string} companyId
 * @property {string} talentId
 * @property {string} [jobId]
 * @property {string} message
 * @property {"sent"|"read"|"replied"} status
 * @property {string} createdAt
 */

/** @type {Readonly<Application[]>} */
export const SEED_APPLICATIONS = deepFreeze([
  { id: 'a001', jobId: 'j001', talentId: 't001', message: '朝のシーン、自然な笑顔でがんばります！', status: 'applied', createdAt: '2026-10-29T09:30:00+09:00' },
  { id: 'a002', jobId: 'j004', talentId: 't001', message: 'コメディが大好きです。よろしくお願いします。', status: 'reviewing', createdAt: '2026-10-26T20:15:00+09:00' },
  { id: 'a003', jobId: 'j013', talentId: 't007', message: '冬物の撮影経験があります。', status: 'declined', createdAt: '2026-10-05T12:00:00+09:00' },
  { id: 'a004', jobId: 'j003', talentId: 't010', message: '振付の覚えは早い方です！', status: 'accepted', createdAt: '2026-10-31T18:45:00+09:00' },
  { id: 'a005', jobId: 'j010', talentId: 't007', message: '英語のセリフに対応できます。', status: 'applied', createdAt: '2026-10-28T11:20:00+09:00' },
  { id: 'a006', jobId: 'j003', talentId: 't023', message: 'ミュージカルで鍛えたダンスをお見せします。', status: 'reviewing', createdAt: '2026-10-31T08:10:00+09:00' },
]);

/** @type {Readonly<Scout[]>} */
export const SEED_SCOUTS = deepFreeze([
  { id: 's001', companyId: 'c003', talentId: 't001', jobId: 'j004', message: '自己紹介動画を拝見しました。同僚役でぜひご検討ください。', status: 'sent', createdAt: '2026-10-30T15:00:00+09:00' },
  { id: 's002', companyId: 'c005', talentId: 't001', jobId: 'j006', message: '朗読劇へのご出演に興味はありませんか。', status: 'read', createdAt: '2026-10-21T10:30:00+09:00' },
  { id: 's003', companyId: 'c001', talentId: 't004', jobId: 'j015', message: '声の幅広さに惹かれました。', status: 'replied', createdAt: '2026-10-27T13:00:00+09:00' },
  { id: 's004', companyId: 'c001', talentId: 't005', jobId: 'j003', message: 'MVのダンサーとしてお声がけしました。', status: 'sent', createdAt: '2026-10-31T17:20:00+09:00' },
  { id: 's005', companyId: 'c006', talentId: 't009', message: '今後の北海道ロケ案件でご相談させてください。', status: 'read', createdAt: '2026-10-18T09:00:00+09:00' },
  { id: 's006', companyId: 'c001', talentId: 't002', jobId: 'j010', message: '観光PR動画の旅行者役でいかがでしょうか。', status: 'sent', createdAt: '2026-11-01T11:00:00+09:00' },
]);
