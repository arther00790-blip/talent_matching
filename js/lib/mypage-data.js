// マイページ・通知バッジで使うデータの組み立て（要件 T-06 / B-04 / M-02 / 4.5）。
// 一覧の抽出・通知件数は DOM に触れない純粋関数にし、保存を伴う処理（advanceStatus / resetAllDemoData）も
// 画面から切り離してテストできるようにする。
// localStorage は利用者が書き換えられるため、表示に使う前に id・ステータスの型を確かめ、不正な要素は無視する。
import { JOBS } from '../data/jobs.js';
import { DEMO_TALENT_ID } from '../data/talents.js';
import { DEMO_COMPANY_ID } from '../data/companies.js';
import {
  getApplications, getScouts, getAddedJobs, updateApplicationStatus, updateScoutStatus, resetDemoData,
} from './storage.js';
import { mergeJobs } from './job-list.js';
import { isJobOpen } from './filters.js';
import { STATUS_KINDS, STATUS_VALUES, resolveTransition } from './status.js';

/** 通知の対象：タレントは「まだ開いていないスカウト」、企業は「まだ選考を始めていない応募」 */
const UNREAD_SCOUT_STATUS = 'sent';
const UNHANDLED_APPLICATION_STATUS = 'applied';
const NOTIFICATION_LABELS = Object.freeze({
  talent: (count) => `未読のスカウト ${count}件`,
  company: (count) => `未対応の応募 ${count}件`,
});

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value !== '';

function createdTime(item) {
  const time = Date.parse(item.createdAt);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/** 新しい順。日時の無い（壊れた）要素は末尾に寄せる */
function byNewest(a, b) {
  const timeA = createdTime(a);
  const timeB = createdTime(b);
  if (timeA === timeB) return 0;
  return timeB > timeA ? 1 : -1;
}

/** 画面に出してよい要素だけを残す（id が文字列で、ステータスが 6.3 の値） */
function validItems(list, kind) {
  if (!Array.isArray(list)) return [];
  const allowed = STATUS_VALUES[kind];
  return list.filter((item) => isRecord(item) && isNonEmptyString(item.id) && allowed.includes(item.status));
}

/* ---------- タレント ---------- */

/** @param {unknown} applications @param {string} talentId @returns {object[]} 本人の応募（新しい順） */
export function selectTalentApplications(applications, talentId) {
  return validItems(applications, STATUS_KINDS.application).filter((item) => item.talentId === talentId).sort(byNewest);
}

/** @param {unknown} scouts @param {string} talentId @returns {object[]} 本人宛のスカウト（新しい順） */
export function selectTalentScouts(scouts, talentId) {
  return validItems(scouts, STATUS_KINDS.scout).filter((item) => item.talentId === talentId).sort(byNewest);
}

/* ---------- 企業 ---------- */

/** @param {unknown} jobs @param {string} companyId @returns {Set<string>} 自社案件の ID */
function companyJobIds(jobs, companyId) {
  const list = Array.isArray(jobs) ? jobs : [];
  return new Set(list.filter((job) => isRecord(job) && job.companyId === companyId).map((job) => job.id));
}

/** @param {unknown} applications @param {unknown} jobs @param {string} companyId @returns {object[]} 自社案件への応募（新しい順） */
export function selectCompanyApplications(applications, jobs, companyId) {
  const ids = companyJobIds(jobs, companyId);
  return validItems(applications, STATUS_KINDS.application).filter((item) => ids.has(item.jobId)).sort(byNewest);
}

/** @param {unknown} scouts @param {string} companyId @returns {object[]} 自社が送ったスカウト（新しい順） */
export function selectCompanyScouts(scouts, companyId) {
  return validItems(scouts, STATUS_KINDS.scout).filter((item) => item.companyId === companyId).sort(byNewest);
}

/** @param {unknown} jobs @param {string} companyId @param {Date} [now] @returns {object[]} 自社の募集中の案件（新しい順） */
export function selectCompanyJobs(jobs, companyId, now = new Date()) {
  const list = Array.isArray(jobs) ? jobs : [];
  return list.filter((job) => isRecord(job) && job.companyId === companyId && isJobOpen(job, now)).sort(byNewest);
}

/* ---------- 通知バッジ（M-02） ---------- */

/**
 * @param {unknown} role
 * @param {{ applications?: unknown, scouts?: unknown, jobs?: unknown }} data
 * @returns {number} ゲスト・未知のロールは 0
 */
export function countNotifications(role, data) {
  const { applications, scouts, jobs } = isRecord(data) ? data : {};
  if (role === 'talent') {
    return selectTalentScouts(scouts, DEMO_TALENT_ID).filter((item) => item.status === UNREAD_SCOUT_STATUS).length;
  }
  if (role === 'company') {
    return selectCompanyApplications(applications, jobs, DEMO_COMPANY_ID)
      .filter((item) => item.status === UNHANDLED_APPLICATION_STATUS).length;
  }
  return 0;
}

/** @param {unknown} role @returns {number} 保存データ（無ければ初期データ）から数える */
export function getNotificationCount(role) {
  return countNotifications(role, {
    applications: getApplications(),
    scouts: getScouts(),
    jobs: mergeJobs(JOBS, getAddedJobs()),
  });
}

/** @param {unknown} role @param {number} count @returns {string} 読み上げ用の文言。0件・通知の無いロールは空文字 */
export function getNotificationLabel(role, count) {
  if (!Number.isInteger(count) || count <= 0 || typeof role !== 'string' || !Object.hasOwn(NOTIFICATION_LABELS, role)) return '';
  return NOTIFICATION_LABELS[role](count);
}

/* ---------- ステータスを進める ---------- */

const STATUS_STORES = Object.freeze({
  application: { read: getApplications, update: updateApplicationStatus },
  scout: { read: getScouts, update: updateScoutStatus },
});

/**
 * 遷移表（status.js）で許される場合だけ保存する。ボタンを二重に押した・別タブで先に進めた場合も、ここで弾く。
 * @param {unknown} kind STATUS_KINDS のいずれか
 * @param {unknown} id
 * @param {unknown} to
 * @returns {{ ok: true, status: string } | { ok: false, reason: 'not-found'|'invalid-transition'|'storage' }}
 */
export function advanceStatus(kind, id, to) {
  const store = typeof kind === 'string' && Object.hasOwn(STATUS_STORES, kind) ? STATUS_STORES[kind] : null;
  if (!store || !isNonEmptyString(id)) return { ok: false, reason: 'not-found' };
  const item = store.read().find((entry) => entry.id === id);
  const result = resolveTransition(kind, item, to);
  if (!result.ok) return result;
  return store.update(id, result.status) ? result : { ok: false, reason: 'storage' };
}

/* ---------- デモデータのリセット（4.5） ---------- */

/**
 * localStorage / sessionStorage の stagelink:* と、IndexedDB の動画をすべて消す。
 * 片方が失敗しても、もう片方は必ず実行する（中途半端に残ったデータで次の操作が混乱しないように）。
 * @param {{ store?: { clearVideos?: () => Promise<{ ok: boolean, reason?: string }> } }} options video-store.js のストア
 * @returns {Promise<{ ok: boolean, storage: boolean, videos: boolean }>}
 */
export async function resetAllDemoData({ store } = {}) {
  const storage = resetDemoData();
  let videos = false;
  if (store && typeof store.clearVideos === 'function') {
    try {
      const result = await store.clearVideos();
      // IndexedDB が使えない環境には消す動画がそもそも無いので、成功として扱う
      videos = Boolean(result?.ok) || result?.reason === 'unavailable';
    } catch (error) {
      console.warn('保存した動画を削除できませんでした', error);
    }
  }
  return { ok: storage && videos, storage, videos };
}
