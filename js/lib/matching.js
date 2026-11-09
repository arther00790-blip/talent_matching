// マッチ度（相性）に関するロジック（要件 6.4）。すべて引数だけで結果が決まる副作用なしの関数。
// getMatchLabel は #02 の案件カードのために先行実装し、calcMatchScore は #04 で追加した。
import { getRegionOf } from '../data/master.js';

// 要件定義書 6.4：70点以上で「相性◎」、50〜69点で「相性○」
export const MATCH_GREAT_MIN = 70;
export const MATCH_GOOD_MIN = 50;

/**
 * @typedef {"great"|"good"} MatchLabel
 */

/**
 * スコアをバッジの種類に変換する。表示文言（◎/○）は見た目側の責務なので、ここでは種類だけを返す。
 * @param {unknown} score 0〜100 のマッチ度
 * @returns {MatchLabel|null}
 */
export function getMatchLabel(score) {
  // 文字列や NaN を数値として扱うと、データの不備で誤ったバッジが出るため数値以外は対象外にする
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  if (score >= MATCH_GREAT_MIN) return 'great';
  if (score >= MATCH_GOOD_MIN) return 'good';
  return null;
}

/** 6.4 の配点表 */
export const MATCH_POINTS = Object.freeze({
  role: 30,
  ageRange: 20,
  gender: 10,
  sameArea: 15,
  sameRegion: 8,
  skills: 10,
  genre: 10,
  video: 5,
  videoPreferredBonus: 5,
});

export const MATCH_SCORE_MAX = 100;

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const asArray = (value) => (Array.isArray(value) ? value : []);

function areaPoints(talentArea, jobArea) {
  if (typeof jobArea !== 'string' || jobArea === '') return 0;
  if (talentArea === jobArea) return MATCH_POINTS.sameArea;
  const region = getRegionOf(jobArea);
  return region !== null && region === getRegionOf(talentArea) ? MATCH_POINTS.sameRegion : 0;
}

function skillPoints(talentSkills, requiredSkills) {
  // 必須スキルが無い案件は「求める条件をすべて満たしている」とみなす（性別の「指定なし」と同じ考え方）
  if (requiredSkills.length === 0) return MATCH_POINTS.skills;
  const matched = requiredSkills.filter((skill) => talentSkills.includes(skill)).length;
  return (matched / requiredSkills.length) * MATCH_POINTS.skills;
}

function videoPoints(talent, job) {
  if (!talent.introVideo) return 0;
  return MATCH_POINTS.video + (job.videoPreferred === true ? MATCH_POINTS.videoPreferredBonus : 0);
}

/**
 * タレントと案件の相性を 0〜100 の整数で返す（要件 6.4）。
 * デモ用タレント本人が IndexedDB に動画を登録している場合は、呼び出し側で introVideo を持たせた talent を渡す。
 * @param {Partial<import('../data/talents.js').Talent>} talent
 * @param {Partial<import('../data/jobs.js').Job>} job
 * @returns {number}
 */
export function calcMatchScore(talent, job) {
  if (!isRecord(talent) || !isRecord(job)) return 0;
  const talentRoles = asArray(talent.roles);
  const total = [
    asArray(job.requiredRoles).some((role) => talentRoles.includes(role)) ? MATCH_POINTS.role : 0,
    asArray(job.ageRanges).includes(talent.ageRange) ? MATCH_POINTS.ageRange : 0,
    job.gender === undefined || job.gender === '' || job.gender === talent.gender ? MATCH_POINTS.gender : 0,
    areaPoints(talent.area, job.area),
    skillPoints(asArray(talent.skills), asArray(job.requiredSkills)),
    asArray(talent.genres).includes(job.genre) ? MATCH_POINTS.genre : 0,
    videoPoints(talent, job),
  ].reduce((sum, points) => sum + points, 0);
  // スキルの割合で端数が出るため整数に丸め、動画ボーナスで上限を超えた分は切り捨てる
  return Math.min(MATCH_SCORE_MAX, Math.round(total));
}
