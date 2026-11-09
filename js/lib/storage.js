// ブラウザ保存の窓口（要件 4.5）。localStorage / sessionStorage の読み書きはすべてここを経由する。
// どの関数も例外を外に出さず、失敗時は既定値（または false / null）を返して画面を壊さない。
import { SEED_APPLICATIONS, SEED_SCOUTS } from '../data/seeds.js';
import { APPLICATION_STATUSES, SCOUT_STATUSES } from '../data/master.js';
import {
  getWebStorage, readJSON, writeJSON, removeKeys, isPlainObject, isNonEmptyString, createId,
} from './storage-core.js';

/** 4.5 の保存キー。キー文字列を各所に書くと打ち間違いで別キーに保存してしまうため、ここだけで定義する */
export const STORAGE_KEYS = Object.freeze({
  role: 'stagelink:role',
  applications: 'stagelink:applications',
  scouts: 'stagelink:scouts',
  addedJobs: 'stagelink:jobs:added',
  favorites: 'stagelink:favorites',
  profile: 'stagelink:profile',
  contact: 'stagelink:contact',
});

const LOCAL = 'localStorage';
const SESSION = 'sessionStorage';
const ID_PREFIX = Object.freeze({ application: 'a', scout: 's', job: 'j-added' });

/* ---------- ロール（#03 から利用） ---------- */

export const ROLES = Object.freeze(['guest', 'talent', 'company']);
export const DEFAULT_ROLE = 'guest';

/**
 * 保存値が壊れていても画面が崩れないよう、知らない値はゲストに倒す。
 * @param {unknown} role
 * @returns {'guest'|'talent'|'company'}
 */
export function normalizeRole(role) {
  return ROLES.includes(role) ? role : DEFAULT_ROLE;
}

/** @returns {'guest'|'talent'|'company'} */
export function getRole() {
  // ロールは JSON ではなく素の文字列で保存している（#03 で保存済みの値と互換を保つため）
  const storage = getWebStorage(LOCAL);
  if (!storage) return DEFAULT_ROLE;
  try {
    return normalizeRole(storage.getItem(STORAGE_KEYS.role));
  } catch (error) {
    console.warn('ロールを読み込めませんでした。ゲストとして表示します', error);
    return DEFAULT_ROLE;
  }
}

/**
 * @param {unknown} role
 * @returns {boolean} 保存できたか（失敗しても画面はそのロールで表示を続けられる）
 */
export function setRole(role) {
  if (!ROLES.includes(role)) {
    console.warn(`setRole: 未知のロールです: ${String(role)}`);
    return false;
  }
  const storage = getWebStorage(LOCAL);
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEYS.role, role);
    return true;
  } catch (error) {
    console.warn('ロールを保存できませんでした（再読み込みすると元に戻ります）', error);
    return false;
  }
}

/* ---------- 配列データ共通 ---------- */

/** 配列であることだけを確認し、壊れた要素（オブジェクト以外）は読み込み後に取り除く */
function readObjectList(key, fallback) {
  return readJSON(LOCAL, key, fallback, Array.isArray).filter(isPlainObject);
}

function updateStatusIn(key, fallback, id, status, allowedStatuses) {
  if (!allowedStatuses.includes(status)) return false;
  const list = readObjectList(key, fallback);
  const target = list.find((item) => item.id === id);
  if (!target) return false;
  target.status = status;
  return writeJSON(LOCAL, key, list);
}

const nowISO = () => new Date().toISOString();

/* ---------- 応募 ---------- */

/** @returns {import('../data/seeds.js').Application[]} 未保存なら初期データ */
export function getApplications() {
  return readObjectList(STORAGE_KEYS.applications, SEED_APPLICATIONS);
}

/** @param {unknown} jobId @param {unknown} talentId */
export function hasApplied(jobId, talentId) {
  return getApplications().some((item) => item.jobId === jobId && item.talentId === talentId);
}

/**
 * @param {{ jobId: string, talentId: string, message?: string }} input
 * @returns {import('../data/seeds.js').Application|null} 保存できなければ null（重複応募も null）
 */
export function addApplication(input) {
  if (!isPlainObject(input) || !isNonEmptyString(input.jobId) || !isNonEmptyString(input.talentId)) return null;
  const list = getApplications();
  if (list.some((item) => item.jobId === input.jobId && item.talentId === input.talentId)) return null;
  const application = {
    id: createId(ID_PREFIX.application),
    jobId: input.jobId,
    talentId: input.talentId,
    message: String(input.message ?? ''),
    status: 'applied',
    createdAt: nowISO(),
  };
  return writeJSON(LOCAL, STORAGE_KEYS.applications, [...list, application]) ? application : null;
}

/** @param {string} id @param {string} status 6.3 の応募ステータス @returns {boolean} */
export function updateApplicationStatus(id, status) {
  return updateStatusIn(STORAGE_KEYS.applications, SEED_APPLICATIONS, id, status, APPLICATION_STATUSES);
}

/* ---------- スカウト ---------- */

/** @returns {import('../data/seeds.js').Scout[]} 未保存なら初期データ */
export function getScouts() {
  return readObjectList(STORAGE_KEYS.scouts, SEED_SCOUTS);
}

/**
 * @param {{ companyId: string, talentId: string, jobId?: string, message?: string }} input
 * @returns {import('../data/seeds.js').Scout|null}
 */
export function addScout(input) {
  if (!isPlainObject(input) || !isNonEmptyString(input.companyId) || !isNonEmptyString(input.talentId)) return null;
  const scout = {
    id: createId(ID_PREFIX.scout),
    companyId: input.companyId,
    talentId: input.talentId,
    // 4.4 で jobId は任意項目。空のキーを残すと「案件あり」と誤判定されやすいので、無いときは持たせない
    ...(isNonEmptyString(input.jobId) ? { jobId: input.jobId } : {}),
    message: String(input.message ?? ''),
    status: 'sent',
    createdAt: nowISO(),
  };
  return writeJSON(LOCAL, STORAGE_KEYS.scouts, [...getScouts(), scout]) ? scout : null;
}

/** @param {string} id @param {string} status 6.3 のスカウトステータス @returns {boolean} */
export function updateScoutStatus(id, status) {
  return updateStatusIn(STORAGE_KEYS.scouts, SEED_SCOUTS, id, status, SCOUT_STATUSES);
}

/* ---------- デモで追加した案件 ---------- */

/** @returns {import('../data/jobs.js').Job[]} */
export function getAddedJobs() {
  return readObjectList(STORAGE_KEYS.addedJobs, []);
}

/**
 * 入力値の検証は validation.js の validateJob で済ませてから呼ぶ前提。ここでは ID・状態・作成日時だけを補う。
 * @param {Partial<import('../data/jobs.js').Job>} job
 * @returns {import('../data/jobs.js').Job|null}
 */
export function addJob(job) {
  if (!isPlainObject(job)) return null;
  const created = { ...job, id: createId(ID_PREFIX.job), status: 'open', createdAt: nowISO() };
  return writeJSON(LOCAL, STORAGE_KEYS.addedJobs, [...getAddedJobs(), created]) ? created : null;
}

/* ---------- お気に入り ---------- */

/** @returns {string[]} お気に入り案件ID */
export function getFavorites() {
  return readJSON(LOCAL, STORAGE_KEYS.favorites, [], Array.isArray).filter(isNonEmptyString);
}

/**
 * @param {string} jobId
 * @returns {boolean} 操作後にお気に入りかどうか（保存に失敗したら操作前の状態を返し、ボタン表示と保存値をずらさない）
 */
export function toggleFavorite(jobId) {
  if (!isNonEmptyString(jobId)) return false;
  const favorites = getFavorites();
  const wasFavorite = favorites.includes(jobId);
  const next = wasFavorite ? favorites.filter((id) => id !== jobId) : [...favorites, jobId];
  return writeJSON(LOCAL, STORAGE_KEYS.favorites, next) ? !wasFavorite : wasFavorite;
}

/* ---------- プロフィール（デモ用タレント本人の編集内容） ---------- */

/** @returns {Record<string, unknown>|null} 未保存なら null（呼び出し側で架空データの元プロフィールを使う） */
export function getProfile() {
  return readJSON(LOCAL, STORAGE_KEYS.profile, null, isPlainObject);
}

/** @param {Record<string, unknown>} profile @returns {boolean} */
export function saveProfile(profile) {
  return isPlainObject(profile) && writeJSON(LOCAL, STORAGE_KEYS.profile, profile);
}

/* ---------- 問い合わせの下書き（sessionStorage：タブを閉じたら消えてよい一時データ） ---------- */

/** @returns {Record<string, unknown>|null} */
export function getContactDraft() {
  return readJSON(SESSION, STORAGE_KEYS.contact, null, isPlainObject);
}

/** @param {Record<string, unknown>} draft @returns {boolean} */
export function saveContactDraft(draft) {
  return isPlainObject(draft) && writeJSON(SESSION, STORAGE_KEYS.contact, draft);
}

/** @returns {boolean} */
export function clearContactDraft() {
  return getWebStorage(SESSION) !== null && removeKeys(SESSION, [STORAGE_KEYS.contact]);
}

/* ---------- デモデータのリセット ---------- */

/**
 * 4.5 のキーをすべて削除する（IndexedDB の動画は video-store.js 側で消す）。
 * localStorage.clear() を使わないのは、同じオリジンの別アプリのデータまで消さないため。
 * @returns {boolean} すべて削除できたか
 */
export function resetDemoData() {
  const localKeys = Object.values(STORAGE_KEYS).filter((key) => key !== STORAGE_KEYS.contact);
  const localCleared = removeKeys(LOCAL, localKeys);
  const sessionCleared = removeKeys(SESSION, [STORAGE_KEYS.contact]);
  return localCleared && sessionCleared;
}
