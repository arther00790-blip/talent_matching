// 案件掲載フォーム（要件 B-01）の判断部分。DOM に触れない関数にして、ページ JS（job-new.js）と切り離してテストする。
// 入力チェックそのものは validation.js の validateJob、保存は storage.js の addJob に任せる。
import { DEMO_COMPANY_ID } from '../data/companies.js';
import { validateJob } from './validation.js';
import { addJob } from './storage.js';

/** 掲載できるのは企業として見ているときだけ（デモでは DEMO_COMPANY_ID の案件として保存する） */
export const JOB_POST_ROLE = 'company';
export const JOB_POST_GATE_MESSAGES = Object.freeze({
  guest: 'ゲストのままでは案件を掲載できません。画面上部の「表示」で企業に切り替えると掲載できます',
  talent: 'タレントとして閲覧中のため案件を掲載できません。画面上部の「表示」で企業に切り替えると掲載できます',
});
/** 掲載後の行き先。入力値から URL を組み立てると遷移先を操作されうるため、固定の相対 URL にする（新着順で先頭に出る） */
export const JOB_POSTED_REDIRECT = 'jobs.html?sort=newest';

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);

/** 空欄は '' のまま残し、validateJob に「入力してください」と言わせる。数字でない文字は NaN にしてエラーにする */
function toAmount(value) {
  const trimmed = text(value);
  return trimmed === '' ? '' : Number(trimmed);
}

/** @param {unknown} role @returns {{ canPost: boolean, message: string }} */
export function getJobPostAccess(role) {
  if (role === JOB_POST_ROLE) return { canPost: true, message: '' };
  return { canPost: false, message: role === 'talent' ? JOB_POST_GATE_MESSAGES.talent : JOB_POST_GATE_MESSAGES.guest };
}

/**
 * フォームから読んだ値を 4.4 の Job 型の形にする。
 * @param {unknown} raw { title, genre, requiredRoles[], gender, ageRanges[], area, shootDates, rewardMin, rewardMax, rewardUnit,
 *   requiredSkills[], videoPreferred, description, deadline }
 * @returns {Record<string, unknown>}
 */
export function toJobInput(raw) {
  const form = isRecord(raw) ? raw : {};
  const gender = text(form.gender);
  return {
    title: text(form.title),
    genre: text(form.genre),
    requiredRoles: strings(form.requiredRoles),
    // 4.4 で gender は「省略時は性別不問」。空文字を残すとマッチ度計算で不一致扱いになりうるため、キーごと持たせない
    ...(gender === '' ? {} : { gender }),
    ageRanges: strings(form.ageRanges),
    area: text(form.area),
    shootDates: text(form.shootDates),
    reward: { min: toAmount(form.rewardMin), max: toAmount(form.rewardMax), unit: text(form.rewardUnit) },
    requiredSkills: strings(form.requiredSkills),
    videoPreferred: form.videoPreferred === true,
    description: text(form.description),
    deadline: text(form.deadline),
  };
}

/**
 * 変換 → 入力チェック → 保存。例外は出さず、画面が出し分けられる理由を返す。
 * @param {unknown} raw
 * @param {{ now?: Date, companyId?: string }} [options]
 * @returns {{ ok: true, job: object } | { ok: false, reason: 'invalid', errors: Record<string, string> } | { ok: false, reason: 'storage' }}
 */
export function createJobPost(raw, { now = new Date(), companyId = DEMO_COMPANY_ID } = {}) {
  const input = toJobInput(raw);
  const { valid, errors } = validateJob(input, { now });
  if (!valid) return { ok: false, reason: 'invalid', errors };
  const job = addJob({ ...input, companyId });
  return job ? { ok: true, job } : { ok: false, reason: 'storage' };
}
