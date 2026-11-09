// タレント検索・案件検索・並び替え（要件 6.5）。
// 条件はクエリ文字列から復元されることが多いので、文字列の "1" や数字文字列もそのまま受け付ける。
// どの関数も元の配列を書き換えず、新しい配列を返す。
import { calcMatchScore } from './matching.js';
import { toDateKey } from './utils.js';
import { REGIONS, TALENT_ROLES, getRegionOf } from '../data/master.js';

const REGION_NAMES = new Set(REGIONS.map((region) => region.name));
const ROLE_LABELS = new Map(TALENT_ROLES.map((role) => [role.value, role.label]));
// チェックボックスの値は URL 上では "1"（utils.js の buildQueryString）になる
const TRUE_FLAGS = new Set([true, '1', 'true']);
const KEYWORD_SEPARATOR = /\s+/;

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const asArray = (value) => (Array.isArray(value) ? value : []);
const hasValue = (value) => typeof value === 'string' && value.trim() !== '';

/** @param {unknown} value 文字列1つ、または文字列の配列 @returns {string[]} */
function toList(value) {
  if (Array.isArray(value)) return value.filter(hasValue);
  return hasValue(value) ? [value] : [];
}

// 全角英数・全角スペース・大文字小文字の違いで検索漏れが起きないようにそろえる
const normalizeText = (value) => String(value ?? '').normalize('NFKC').toLowerCase();

/** @param {unknown} value @returns {number|null} 数値にできなければ null（＝条件なし） */
function toAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (!hasValue(value)) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * 地域条件は都道府県名でも地方名（"関東" など）でもよい。
 * @param {unknown} prefecture データ側の都道府県
 * @param {unknown} area 検索条件
 */
function matchesArea(prefecture, area) {
  if (!hasValue(area)) return true;
  if (REGION_NAMES.has(area)) return getRegionOf(prefecture) === area;
  return prefecture === area;
}

function talentSearchText(talent) {
  return normalizeText([
    talent.displayName,
    talent.bio,
    ...asArray(talent.roles).map((role) => ROLE_LABELS.get(role) ?? role),
    ...asArray(talent.skills),
    ...asArray(talent.genres),
    ...asArray(talent.career).map((item) => (isRecord(item) ? item.title : '')),
  ].join('\n'));
}

/**
 * @typedef {Object} TalentCriteria
 * @property {string} [role]
 * @property {string} [gender]
 * @property {string} [ageRange]
 * @property {string} [area]              都道府県または地方名
 * @property {string|string[]} [skills]   すべて持つ人だけ（AND）
 * @property {string} [keyword]           空白区切りで AND
 * @property {boolean|string} [videoOnly] 自己紹介動画ありのみ
 */

/**
 * @param {unknown} talents
 * @param {TalentCriteria} [criteria]
 * @returns {import('../data/talents.js').Talent[]}
 */
export function filterTalents(talents, criteria = {}) {
  if (!Array.isArray(talents)) return [];
  const { role, gender, ageRange, area, skills, keyword, videoOnly } = isRecord(criteria) ? criteria : {};
  const requiredSkills = toList(skills);
  const keywords = normalizeText(keyword).split(KEYWORD_SEPARATOR).filter(Boolean);
  const videoRequired = TRUE_FLAGS.has(videoOnly);

  return talents.filter(isRecord).filter((talent) => {
    if (hasValue(role) && !asArray(talent.roles).includes(role)) return false;
    if (hasValue(gender) && talent.gender !== gender) return false;
    if (hasValue(ageRange) && talent.ageRange !== ageRange) return false;
    if (!matchesArea(talent.area, area)) return false;
    if (!requiredSkills.every((skill) => asArray(talent.skills).includes(skill))) return false;
    if (videoRequired && !talent.introVideo) return false;
    if (keywords.length > 0) {
      const text = talentSearchText(talent);
      if (!keywords.every((word) => text.includes(word))) return false;
    }
    return true;
  });
}

/**
 * @typedef {Object} JobCriteria
 * @property {string} [role]
 * @property {string} [genre]
 * @property {string} [area]                都道府県または地方名
 * @property {number|string} [minReward]    報酬の上限額がこの額以上の案件（＝この額以上もらえる可能性がある案件）
 */

/**
 * @param {unknown} jobs
 * @param {JobCriteria} [criteria]
 * @returns {import('../data/jobs.js').Job[]}
 */
export function filterJobs(jobs, criteria = {}) {
  if (!Array.isArray(jobs)) return [];
  const { role, genre, area, minReward } = isRecord(criteria) ? criteria : {};
  const minimum = toAmount(minReward);

  return jobs.filter(isRecord).filter((job) => {
    if (hasValue(role) && !asArray(job.requiredRoles).includes(role)) return false;
    if (hasValue(genre) && job.genre !== genre) return false;
    if (!matchesArea(job.area, area)) return false;
    if (minimum !== null) {
      const max = isRecord(job.reward) ? job.reward.max : undefined;
      if (!Number.isFinite(max) || max < minimum) return false;
    }
    return true;
  });
}

/**
 * 募集中か（status が closed でなく、締切日を過ぎていない）。締切当日は募集中として扱う。
 * @param {unknown} job
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isJobOpen(job, now = new Date()) {
  if (!isRecord(job) || job.status === 'closed') return false;
  if (typeof job.deadline !== 'string' || job.deadline === '') return true;
  // 締切は "YYYY-MM-DD" なので、今日も同じ形の文字列にすれば辞書順で比較できる
  return job.deadline >= toDateKey(now);
}

export const JOB_SORT_KEYS = Object.freeze({ deadline: 'deadline', newest: 'newest', match: 'match' });

// 締切の無い案件は比較できないので、どの日付より後ろに来る値として扱う
const NO_DEADLINE = '￿';

function byDeadline(now) {
  return (a, b) => {
    const openDiff = Number(isJobOpen(b, now)) - Number(isJobOpen(a, now));
    if (openDiff !== 0) return openDiff;
    const deadlineA = typeof a.deadline === 'string' ? a.deadline : NO_DEADLINE;
    const deadlineB = typeof b.deadline === 'string' ? b.deadline : NO_DEADLINE;
    return deadlineA.localeCompare(deadlineB);
  };
}

function createdTime(job) {
  const time = Date.parse(job.createdAt);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

function byNewest(a, b) {
  const timeA = createdTime(a);
  const timeB = createdTime(b);
  // -Infinity 同士の引き算は NaN になり並びが不定になるため、等しい場合は明示的に 0 を返す
  if (timeA === timeB) return 0;
  return timeB > timeA ? 1 : -1;
}

/**
 * @param {unknown} jobs
 * @param {string} sortKey JOB_SORT_KEYS のいずれか。未知の値なら元の順
 * @param {{ talent?: unknown, now?: Date }} [options] マッチ度順には talent が必要（無ければ締切が近い順）
 * @returns {import('../data/jobs.js').Job[]}
 */
export function sortJobs(jobs, sortKey, options = {}) {
  const list = Array.isArray(jobs) ? jobs.filter(isRecord) : [];
  const { talent, now = new Date() } = isRecord(options) ? options : {};
  const deadlineOrder = byDeadline(now);

  switch (sortKey) {
    case JOB_SORT_KEYS.deadline:
      return list.sort(deadlineOrder);
    case JOB_SORT_KEYS.newest:
      return list.sort(byNewest);
    case JOB_SORT_KEYS.match: {
      if (!isRecord(talent)) return list.sort(deadlineOrder);
      // 並び替え中に何度も計算しないよう、先にスコアを求めておく
      const scores = new Map(list.map((job) => [job, calcMatchScore(talent, job)]));
      return list.sort((a, b) => (scores.get(b) - scores.get(a)) || deadlineOrder(a, b));
    }
    default:
      return list;
  }
}
