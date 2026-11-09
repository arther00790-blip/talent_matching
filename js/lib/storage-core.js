// storage.js の下回り：Web Storage への安全なアクセスと JSON の読み書き。
// 画面からは直接使わず、必ず storage.js の公開関数を経由する（保存キーと失敗時の扱いを1か所に保つため）。

/** @typedef {'localStorage'|'sessionStorage'} StorageArea */

/**
 * プライベートブラウズやストレージ無効化では、localStorage へのアクセス自体が例外を投げることがある。
 * @param {StorageArea} area
 * @returns {Storage|null}
 */
export function getWebStorage(area) {
  try {
    return globalThis[area] ?? null;
  } catch {
    return null;
  }
}

// 既定値（凍結された初期データ）をそのまま返すと、呼び出し側の push などで例外になるため複製して返す
const cloneValue = (value) => (value === null || typeof value !== 'object' ? value : structuredClone(value));

/**
 * @template T
 * @param {StorageArea} area
 * @param {string} key
 * @param {T} fallback 未保存・壊れている・型が違うときに返す値
 * @param {(value: unknown) => boolean} isValid
 * @returns {T}
 */
export function readJSON(area, key, fallback, isValid) {
  const storage = getWebStorage(area);
  if (!storage) return cloneValue(fallback);
  try {
    const raw = storage.getItem(key);
    if (raw === null) return cloneValue(fallback);
    const parsed = JSON.parse(raw);
    return isValid(parsed) ? parsed : cloneValue(fallback);
  } catch (error) {
    console.warn(`保存データ（${key}）を読み込めませんでした。初期状態で表示します`, error);
    return cloneValue(fallback);
  }
}

/**
 * @param {StorageArea} area
 * @param {string} key
 * @param {unknown} value
 * @returns {boolean} 保存できたか
 */
export function writeJSON(area, key, value) {
  const storage = getWebStorage(area);
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`データ（${key}）を保存できませんでした（再読み込みすると元に戻ります）`, error);
    return false;
  }
}

/**
 * @param {StorageArea} area
 * @param {string[]} keys
 * @returns {boolean} すべて削除できたか（ストレージが無い環境は消すものが無いので true）
 */
export function removeKeys(area, keys) {
  const storage = getWebStorage(area);
  if (!storage) return true;
  let succeeded = true;
  for (const key of keys) {
    try {
      storage.removeItem(key);
    } catch (error) {
      console.warn(`データ（${key}）を削除できませんでした`, error);
      succeeded = false;
    }
  }
  return succeeded;
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
export const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** @param {unknown} value @returns {value is string} */
export const isNonEmptyString = (value) => typeof value === 'string' && value !== '';

// randomUUID が無い古い環境・非セキュアコンテキスト向けの予備。デモ内で重複しなければ十分なので時刻＋乱数にする
const ID_RADIX = 36;
const ID_RANDOM_SLICE_START = 2;

/** @param {string} prefix @returns {string} */
export function createId(prefix) {
  const unique = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(ID_RADIX)}${Math.random().toString(ID_RADIX).slice(ID_RANDOM_SLICE_START)}`;
  return `${prefix}-${unique}`;
}
