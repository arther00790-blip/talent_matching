// 案件一覧の組み立て（要件 T-03 / 6.4 / 6.5）。DOM に触れない純粋関数だけを置き、テストで並び順を確かめられるようにする。
// 絞り込み・並び替え・マッチ度の計算そのものは filters.js / matching.js を使い、ここでは組み合わせ方だけを決める。
import { filterJobs, sortJobs, isJobOpen, JOB_SORT_KEYS } from './filters.js';
import { calcMatchScore } from './matching.js';
import { DEMO_TALENT_ID } from '../data/talents.js';

/** マッチ度はデモ用タレント本人との相性なので、タレントとして見ているときだけ意味がある */
export const MATCH_ROLE = 'talent';

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const SORT_VALUES = new Set(Object.values(JOB_SORT_KEYS));

/**
 * 架空データとデモで追加した案件（stagelink:jobs:added）を1つの配列にする。
 * 同じ id が両方にあれば架空データを優先する（保存値が壊れていても既存案件の内容を上書きさせない）。
 * @param {unknown} baseJobs
 * @param {unknown} addedJobs
 * @returns {object[]}
 */
export function mergeJobs(baseJobs, addedJobs) {
  const merged = [];
  const seen = new Set();
  for (const list of [baseJobs, addedJobs]) {
    if (!Array.isArray(list)) continue;
    for (const job of list) {
      if (!isRecord(job) || typeof job.id !== 'string' || seen.has(job.id)) continue;
      seen.add(job.id);
      merged.push(job);
    }
  }
  return merged;
}

/**
 * タレント以外が「マッチ度順」を指定しても、比べる相手がいないので締切が近い順に倒す。
 * @param {unknown} sort
 * @param {unknown} role
 * @returns {string}
 */
export function resolveSortKey(sort, role) {
  if (!SORT_VALUES.has(sort)) return JOB_SORT_KEYS.deadline;
  if (sort === JOB_SORT_KEYS.match && role !== MATCH_ROLE) return JOB_SORT_KEYS.deadline;
  return sort;
}

/**
 * デモ用タレント本人（t001）に、マイページで編集したプロフィールを重ねる。
 * id だけは上書きさせない（別人のデータとして応募が保存されるのを防ぐ）。
 * @param {unknown} talents
 * @param {unknown} profile storage.js の getProfile() の戻り値
 * @returns {object|null}
 */
export function resolveDemoTalent(talents, profile) {
  const base = Array.isArray(talents) ? talents.find((item) => isRecord(item) && item.id === DEMO_TALENT_ID) : undefined;
  if (!base) return null;
  return isRecord(profile) ? { ...base, ...pickEditableProfile(profile) } : base;
}

/**
 * プロフィール編集画面で変更できる項目。
 * localStorage は利用者が自由に書き換えられるため、ここに無い項目（動画URL・SNS・名前など）は重ねない。
 */
export const EDITABLE_PROFILE_FIELDS = Object.freeze(['bio', 'skills']);

const PROFILE_FIELD_GUARDS = Object.freeze({
  bio: (value) => (typeof value === 'string' ? value : undefined),
  skills: (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : undefined),
});

/** @param {Record<string, unknown>} profile @returns {Record<string, unknown>} 型の正しい編集可能項目だけ */
function pickEditableProfile(profile) {
  const picked = {};
  for (const key of EDITABLE_PROFILE_FIELDS) {
    if (!Object.hasOwn(profile, key)) continue;
    const value = PROFILE_FIELD_GUARDS[key](profile[key]);
    if (value !== undefined) picked[key] = value;
  }
  return picked;
}

/**
 * @typedef {Object} JobResult
 * @property {object} job
 * @property {boolean} closed            締切切れ、または status が closed
 * @property {number} [matchScore]       タレントとして見ているときだけ
 */

/**
 * @param {unknown} jobs
 * @param {{ role?: string, genre?: string, area?: string, minReward?: string, sort?: string }} state job-filter.js の状態
 * @param {{ role?: string, talent?: object|null, now?: Date }} [context]
 * @returns {JobResult[]}
 */
export function buildJobResults(jobs, state, context = {}) {
  const { role, talent, now = new Date() } = isRecord(context) ? context : {};
  const criteria = isRecord(state) ? state : {};
  const sortKey = resolveSortKey(criteria.sort, role);
  const withMatch = role === MATCH_ROLE && isRecord(talent);
  const sorted = sortJobs(filterJobs(jobs, criteria), sortKey, { talent: withMatch ? talent : undefined, now });
  return sorted.map((job) => ({
    job,
    closed: !isJobOpen(job, now),
    ...(withMatch ? { matchScore: calcMatchScore(talent, job) } : {}),
  }));
}
