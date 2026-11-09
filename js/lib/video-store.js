// 自己紹介動画の保存（要件 6.7）。IndexedDB（DB "stagelink" / ストア "videos"）に、タレントID をキーに1人1本で保存する。
// localStorage ではなく IndexedDB を使うのは、数十MB の Blob をそのまま保存でき、容量上限も大きいため。
// 実際の読み書きは「backend」（get / put / delete / clear）に任せ、テストではメモリ実装に差し替える。
// どの操作も例外を外に出さず、失敗理由を返す（プライベートブラウズ等で保存できなくても、ページは表示を続ける）。

export const VIDEO_DB_NAME = 'stagelink';
export const VIDEO_STORE_NAME = 'videos';
export const VIDEO_STORE_UNAVAILABLE_MESSAGE = 'このブラウザでは動画を保存できません';
// ストア構成を変えたらここを上げ、onupgradeneeded で作り直す
const VIDEO_DB_VERSION = 1;
// 保存できるかの確認用。実在しないキーを読むだけなので、保存済みのデータには触れない
const PROBE_KEY = '__availability__';

const isNonEmptyString = (value) => typeof value === 'string' && value !== '';
const isBlob = (value) => typeof Blob !== 'undefined' && value instanceof Blob;

/**
 * IndexedDB のリクエスト／トランザクションを Promise にした backend。
 * @param {IDBFactory|undefined|null} factory 通常は globalThis.indexedDB
 * @returns {{ get: Function, put: Function, delete: Function, clear: Function } | null} 使えない環境では null
 */
export function createIndexedDBBackend(factory) {
  if (!factory || typeof factory.open !== 'function') return null;
  let dbPromise = null;

  const openDB = () => {
    if (dbPromise) return dbPromise;
    // open() 自体が例外を投げる環境（一部のプライベートブラウズ）も、executor 内なら reject として扱える
    dbPromise = new Promise((resolve, reject) => {
      const request = factory.open(VIDEO_DB_NAME, VIDEO_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(VIDEO_STORE_NAME)) db.createObjectStore(VIDEO_STORE_NAME);
      };
      request.onsuccess = () => {
        const db = request.result;
        // 別タブで新しい版に上げるとき、この接続が残っていると相手の更新が止まってしまうため閉じる
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB を開けませんでした'));
    });
    // 一度失敗しても、次の操作でもう一度開けるようにする
    dbPromise.catch(() => { dbPromise = null; });
    return dbPromise;
  };

  const run = async (mode, operate) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(VIDEO_STORE_NAME, mode);
      const request = operate(transaction.objectStore(VIDEO_STORE_NAME));
      let result;
      request.onsuccess = () => { result = request.result; };
      // 書き込みが確定するのは complete の時点なので、request ではなく transaction の完了を待つ
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error ?? request.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB の処理が中断されました'));
    });
  };

  return {
    get: (key) => run('readonly', (store) => store.get(key)),
    put: (key, value) => run('readwrite', (store) => store.put(value, key)),
    delete: (key) => run('readwrite', (store) => store.delete(key)),
    clear: () => run('readwrite', (store) => store.clear()),
  };
}

/** 保存値が壊れていても再生処理まで持ち込まないよう、Blob を持つものだけを動画として扱う */
function toRecord(value) {
  return typeof value === 'object' && value !== null && isBlob(value.blob) ? value : null;
}

/**
 * @typedef {Object} StoredVideo
 * @property {string} talentId
 * @property {Blob} blob
 * @property {string} caption
 * @property {number|undefined} duration 秒
 * @property {string} name
 * @property {string} type
 * @property {number} size
 * @property {string} updatedAt ISO 8601
 */

/**
 * @param {{ backend?: ReturnType<typeof createIndexedDBBackend> }} [options]
 *   backend を省略するとブラウザの IndexedDB を使う。null を渡すと「保存できない環境」として振る舞う
 */
export function createVideoStore(options = {}) {
  let backend = 'backend' in options ? options.backend : undefined;
  // 既定の IndexedDB は使うときに初めて見る（Node でこのファイルを読み込んでも失敗させないため）
  const getBackend = () => {
    if (backend === undefined) backend = createIndexedDBBackend(globalThis.indexedDB);
    return backend;
  };

  const attempt = async (label, operate) => {
    const target = getBackend();
    if (!target) return { ok: false, reason: 'unavailable' };
    try {
      await operate(target);
      return { ok: true };
    } catch (error) {
      console.warn(`自己紹介動画を${label}できませんでした`, error);
      return { ok: false, reason: 'error' };
    }
  };

  return {
    /** @returns {Promise<{ available: boolean, message: string }>} */
    async checkAvailability() {
      const target = getBackend();
      if (!target) return { available: false, message: VIDEO_STORE_UNAVAILABLE_MESSAGE };
      try {
        await target.get(PROBE_KEY);
        return { available: true, message: '' };
      } catch (error) {
        console.warn('IndexedDB を使えないため、動画はこのページを開いている間だけ表示します', error);
        return { available: false, message: VIDEO_STORE_UNAVAILABLE_MESSAGE };
      }
    },

    /**
     * 1人1本なので、同じタレントIDで保存すると前の動画を上書き（差し替え）する。
     * @param {string} talentId
     * @param {{ blob: Blob, caption?: string, duration?: number }} input
     * @returns {Promise<{ ok: true } | { ok: false, reason: 'invalid'|'unavailable'|'error' }>}
     */
    async saveVideo(talentId, input) {
      if (!isNonEmptyString(talentId) || typeof input !== 'object' || input === null || !isBlob(input.blob)) {
        return { ok: false, reason: 'invalid' };
      }
      const { blob } = input;
      /** @type {StoredVideo} */
      const record = {
        talentId,
        blob,
        caption: typeof input.caption === 'string' ? input.caption.trim() : '',
        duration: Number.isFinite(input.duration) ? input.duration : undefined,
        name: typeof blob.name === 'string' ? blob.name : '',
        type: blob.type,
        size: blob.size,
        updatedAt: new Date().toISOString(),
      };
      return attempt('保存', (target) => target.put(talentId, record));
    },

    /** @param {string} talentId @returns {Promise<StoredVideo|null>} 未保存・失敗時は null */
    async getVideo(talentId) {
      const target = getBackend();
      if (!target || !isNonEmptyString(talentId)) return null;
      try {
        return toRecord(await target.get(talentId));
      } catch (error) {
        console.warn('自己紹介動画を読み込めませんでした', error);
        return null;
      }
    },

    /** @param {string} talentId */
    deleteVideo(talentId) {
      if (!isNonEmptyString(talentId)) return Promise.resolve({ ok: false, reason: 'invalid' });
      return attempt('削除', (target) => target.delete(talentId));
    },

    /** デモリセット用：保存した動画をすべて消す */
    clearVideos() {
      return attempt('削除', (target) => target.clear());
    },
  };
}

/** ページから使う既定のストア（ブラウザの IndexedDB） */
export const videoStore = createVideoStore();
