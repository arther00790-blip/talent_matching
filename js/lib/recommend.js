// おすすめ案件（要件 T-07 / 6.4）。DOM に触れない純粋関数にして、並び順と除外条件をテストで確かめる。
// スコア計算は matching.js、募集中かどうかは filters.js を使い、ここでは「何を・何件・どの順で」だけを決める。
import { calcMatchScore } from './matching.js';
import { isJobOpen } from './filters.js';

/** マイページに並べる件数。多すぎると応募履歴やスカウトが画面の下に押し出されるため、1〜2行に収まる数にする */
export const RECOMMEND_LIMIT = 6;

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
// 締切の無い案件は比べようがないので、どの日付より後ろに来る値として扱う（filters.js と同じ考え方）
const NO_DEADLINE = '￿';
const deadlineOf = (job) => (typeof job.deadline === 'string' && job.deadline !== '' ? job.deadline : NO_DEADLINE);

/**
 * @param {unknown} jobs mergeJobs 済みの案件
 * @param {unknown} talent デモ用タレント本人（resolveDemoTalent の戻り値）
 * @param {{ now?: Date, excludeJobIds?: unknown, limit?: number }} [options]
 *   excludeJobIds：応募済みの案件など、勧めても意味が無いもの
 * @returns {{ job: object, matchScore: number }[]} マッチ度の高い順（同点は締切が近い順）
 */
export function getRecommendedJobs(jobs, talent, options = {}) {
  if (!Array.isArray(jobs) || !isRecord(talent)) return [];
  const { now = new Date(), excludeJobIds, limit = RECOMMEND_LIMIT } = isRecord(options) ? options : {};
  const excluded = new Set(Array.isArray(excludeJobIds) ? excludeJobIds : []);
  const max = Number.isInteger(limit) && limit > 0 ? limit : RECOMMEND_LIMIT;

  return jobs
    // 応募できない案件を勧めても行き止まりになるため、並べる前に除く（スコアが高くても出さない）
    .filter((job) => isRecord(job) && !excluded.has(job.id) && isJobOpen(job, now))
    .map((job) => ({ job, matchScore: calcMatchScore(talent, job) }))
    .sort((a, b) => (b.matchScore - a.matchScore) || deadlineOf(a.job).localeCompare(deadlineOf(b.job)))
    .slice(0, max);
}
