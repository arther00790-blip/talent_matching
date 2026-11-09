// #07 自己紹介動画の保存（IndexedDB）のテスト
// Node には IndexedDB が無く、外部ライブラリ（fake-indexeddb 等）も使わない方針のため、
// video-store.js の「保存先（backend）」を差し替えられるようにし、メモリ実装・失敗する実装でふるまいを確かめる。
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createVideoStore, createIndexedDBBackend, VIDEO_DB_NAME, VIDEO_STORE_NAME, VIDEO_STORE_UNAVAILABLE_MESSAGE,
} from '../js/lib/video-store.js';

const TALENT_ID = 't001';
const blob = new Blob(['dummy video'], { type: 'video/mp4' });

function memoryBackend() {
  const items = new Map();
  return {
    items,
    get: async (key) => items.get(key),
    put: async (key, value) => { items.set(key, value); },
    delete: async (key) => { items.delete(key); },
    clear: async () => { items.clear(); },
  };
}

const failingBackend = () => {
  const fail = async () => { throw new Error('QuotaExceededError'); };
  return { get: fail, put: fail, delete: fail, clear: fail };
};

// 失敗時の console.warn はテスト出力を埋めるだけなので黙らせる
let originalWarn;
beforeEach(() => {
  originalWarn = console.warn;
  console.warn = () => {};
});
afterEach(() => {
  console.warn = originalWarn;
});

describe('保存先の名前', () => {
  test('DB は stagelink、ストアは videos', () => {
    assert.equal(VIDEO_DB_NAME, 'stagelink');
    assert.equal(VIDEO_STORE_NAME, 'videos');
  });
});

describe('保存 → 取得 → 削除の往復', () => {
  test('保存した Blob と付帯情報を取り出せ、削除すると null になる', async () => {
    const backend = memoryBackend();
    const store = createVideoStore({ backend });

    const saved = await store.saveVideo(TALENT_ID, { blob, caption: 'よろしくお願いします', duration: 28 });
    assert.equal(saved.ok, true);

    const record = await store.getVideo(TALENT_ID);
    assert.equal(record.blob, blob);
    assert.equal(record.caption, 'よろしくお願いします');
    assert.equal(record.duration, 28);
    assert.equal(record.talentId, TALENT_ID);
    assert.equal(record.type, 'video/mp4');
    assert.equal(record.size, blob.size);
    assert.ok(!Number.isNaN(Date.parse(record.updatedAt)));

    assert.deepEqual(await store.deleteVideo(TALENT_ID), { ok: true });
    assert.equal(await store.getVideo(TALENT_ID), null);
  });

  test('1人1本：同じタレントで保存し直すと差し替えになる', async () => {
    const backend = memoryBackend();
    const store = createVideoStore({ backend });
    await store.saveVideo(TALENT_ID, { blob, caption: '1本目', duration: 10 });
    const second = new Blob(['second'], { type: 'video/webm' });
    await store.saveVideo(TALENT_ID, { blob: second, caption: '2本目', duration: 20 });
    assert.equal(backend.items.size, 1);
    const record = await store.getVideo(TALENT_ID);
    assert.equal(record.blob, second);
    assert.equal(record.caption, '2本目');
  });

  test('一言説明は前後の空白を落として保存する', async () => {
    const store = createVideoStore({ backend: memoryBackend() });
    await store.saveVideo(TALENT_ID, { blob, caption: '  こんにちは  ', duration: 5 });
    assert.equal((await store.getVideo(TALENT_ID)).caption, 'こんにちは');
  });

  test('未保存なら null', async () => {
    const store = createVideoStore({ backend: memoryBackend() });
    assert.equal(await store.getVideo(TALENT_ID), null);
  });

  test('壊れた保存値（Blob が無い）は null として扱う', async () => {
    const backend = memoryBackend();
    backend.items.set(TALENT_ID, { caption: 'x' });
    assert.equal(await createVideoStore({ backend }).getVideo(TALENT_ID), null);
  });

  test('clearVideos で全件消える（デモリセット用）', async () => {
    const backend = memoryBackend();
    const store = createVideoStore({ backend });
    await store.saveVideo(TALENT_ID, { blob, duration: 3 });
    assert.deepEqual(await store.clearVideos(), { ok: true });
    assert.equal(backend.items.size, 0);
  });
});

describe('入力の検証', () => {
  test('ID や Blob が不正なら保存せず invalid を返す', async () => {
    const backend = memoryBackend();
    const store = createVideoStore({ backend });
    assert.deepEqual(await store.saveVideo('', { blob }), { ok: false, reason: 'invalid' });
    assert.deepEqual(await store.saveVideo(TALENT_ID, { blob: 'not a blob' }), { ok: false, reason: 'invalid' });
    assert.deepEqual(await store.saveVideo(TALENT_ID, null), { ok: false, reason: 'invalid' });
    assert.equal(backend.items.size, 0);
  });
});

describe('失敗してもページを壊さない', () => {
  test('保存先が例外を出しても、どの操作も例外を外に出さない', async () => {
    const store = createVideoStore({ backend: failingBackend() });
    assert.deepEqual(await store.saveVideo(TALENT_ID, { blob, duration: 3 }), { ok: false, reason: 'error' });
    assert.equal(await store.getVideo(TALENT_ID), null);
    assert.deepEqual(await store.deleteVideo(TALENT_ID), { ok: false, reason: 'error' });
    assert.deepEqual(await store.clearVideos(), { ok: false, reason: 'error' });
  });
});

describe('IndexedDB 非対応時は「保存不可」', () => {
  test('indexedDB が無ければ backend を作らない', () => {
    assert.equal(createIndexedDBBackend(undefined), null);
    assert.equal(createIndexedDBBackend({}), null);
  });

  test('保存不可の状態と案内文を返し、操作は unavailable で失敗する', async () => {
    const store = createVideoStore({ backend: null });
    assert.deepEqual(await store.checkAvailability(), { available: false, message: VIDEO_STORE_UNAVAILABLE_MESSAGE });
    assert.equal(VIDEO_STORE_UNAVAILABLE_MESSAGE, 'このブラウザでは動画を保存できません');
    assert.deepEqual(await store.saveVideo(TALENT_ID, { blob }), { ok: false, reason: 'unavailable' });
    assert.equal(await store.getVideo(TALENT_ID), null);
    assert.deepEqual(await store.deleteVideo(TALENT_ID), { ok: false, reason: 'unavailable' });
  });

  test('グローバルに indexedDB が無い環境（Node）の既定ストアも保存不可になる', async () => {
    const store = createVideoStore();
    assert.equal((await store.checkAvailability()).available, false);
  });

  test('indexedDB.open が例外を出す環境（プライベートブラウズ等）も保存不可', async () => {
    const throwing = { open: () => { throw new Error('SecurityError'); } };
    const store = createVideoStore({ backend: createIndexedDBBackend(throwing) });
    assert.equal((await store.checkAvailability()).available, false);
    assert.deepEqual(await store.saveVideo(TALENT_ID, { blob }), { ok: false, reason: 'error' });
  });

  test('open の要求が error になる環境も保存不可', async () => {
    const erroring = {
      open: () => {
        const request = { error: new Error('InvalidStateError') };
        queueMicrotask(() => request.onerror?.());
        return request;
      },
    };
    const store = createVideoStore({ backend: createIndexedDBBackend(erroring) });
    assert.equal((await store.checkAvailability()).available, false);
  });

  test('使える保存先なら available: true', async () => {
    const store = createVideoStore({ backend: memoryBackend() });
    assert.deepEqual(await store.checkAvailability(), { available: true, message: '' });
  });
});
