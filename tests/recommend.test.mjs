// #08 おすすめ案件（T-07）・マイページの一覧・通知件数（M-02）・デモリセット（4.5）のテスト
// どれも DOM を使わない関数（js/lib/recommend.js・js/lib/mypage-data.js）を対象にする。
// IndexedDB は Node に無いため、video-store.js の backend をメモリ実装に差し替えたストアで動画の削除を確かめる。
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { getRecommendedJobs, RECOMMEND_LIMIT } from '../js/lib/recommend.js';
import {
  countNotifications, getNotificationCount, getNotificationLabel, resetAllDemoData,
  selectTalentApplications, selectTalentScouts, selectCompanyApplications, selectCompanyScouts, selectCompanyJobs,
} from '../js/lib/mypage-data.js';
import { calcMatchScore } from '../js/lib/matching.js';
import { createVideoStore } from '../js/lib/video-store.js';
import { STORAGE_KEYS, setRole, addScout, addJob, saveProfile, toggleFavorite, saveContactDraft } from '../js/lib/storage.js';
import { JOBS } from '../js/data/jobs.js';
import { TALENTS, DEMO_TALENT_ID } from '../js/data/talents.js';
import { DEMO_COMPANY_ID } from '../js/data/companies.js';
import { SEED_APPLICATIONS, SEED_SCOUTS } from '../js/data/seeds.js';

// j013（10/31締切・closed）、j009（11/8締切）が締切切れになる日。結果を実行日に依存させないため固定する
const NOW = new Date('2026-11-10T12:00:00+09:00');
const demo = TALENTS.find((item) => item.id === DEMO_TALENT_ID);

class MemoryStorage {
  #items = new Map();
  get length() { return this.#items.size; }
  key(index) { return [...this.#items.keys()][index] ?? null; }
  getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
  clear() { this.#items.clear(); }
  keys() { return [...this.#items.keys()]; }
}

const install = (name, storage) => {
  Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true });
};

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

let originalWarn;
beforeEach(() => {
  install('localStorage', new MemoryStorage());
  install('sessionStorage', new MemoryStorage());
  originalWarn = console.warn;
  console.warn = () => {};
});
afterEach(() => {
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
  console.warn = originalWarn;
});

describe('おすすめ案件（T-07）', () => {
  test('マッチ度の降順に並び、各要素にスコアを持つ', () => {
    const result = getRecommendedJobs(JOBS, demo, { now: NOW, limit: JOBS.length });
    assert.ok(result.length > 0);
    for (const item of result) assert.equal(item.matchScore, calcMatchScore(demo, item.job));
    for (let i = 1; i < result.length; i += 1) {
      assert.ok(result[i - 1].matchScore >= result[i].matchScore, `${i - 1} と ${i} の並び`);
    }
  });

  test('closed と締切切れは除外する', () => {
    const ids = getRecommendedJobs(JOBS, demo, { now: NOW, limit: JOBS.length }).map((item) => item.job.id);
    assert.ok(!ids.includes('j013'), 'closed');
    assert.ok(!ids.includes('j017'), 'closed');
    assert.ok(!ids.includes('j009'), '締切切れ');
    assert.ok(ids.includes('j008'), '締切前');
  });

  test('高スコアでも closed なら出さない（並び替えより除外が優先）', () => {
    const perfect = { ...JOBS[0], id: 'x-closed', status: 'closed' };
    const ids = getRecommendedJobs([perfect, JOBS[0]], demo, { now: NOW }).map((item) => item.job.id);
    assert.deepEqual(ids, ['j001']);
  });

  test('同点なら締切が近い順、応募済みの案件は除き、上限件数で切る', () => {
    const a = { id: 'a', status: 'open', deadline: '2026-12-20' };
    const b = { id: 'b', status: 'open', deadline: '2026-11-20' };
    const c = { id: 'c', status: 'open', deadline: '2026-11-30' };
    assert.deepEqual(getRecommendedJobs([a, b, c], {}, { now: NOW }).map((item) => item.job.id), ['b', 'c', 'a']);
    assert.deepEqual(getRecommendedJobs([a, b, c], {}, { now: NOW, excludeJobIds: ['b'] }).map((item) => item.job.id), ['c', 'a']);
    assert.equal(getRecommendedJobs(JOBS, demo, { now: NOW }).length, RECOMMEND_LIMIT);
    assert.equal(getRecommendedJobs([a, b, c], {}, { now: NOW, limit: 1 }).length, 1);
  });

  test('不正な引数でも落ちない', () => {
    assert.deepEqual(getRecommendedJobs(null, demo), []);
    assert.deepEqual(getRecommendedJobs(JOBS, null), []);
    assert.deepEqual(getRecommendedJobs([null, 'x', 1], demo, { now: NOW }), []);
  });
});

describe('マイページの一覧', () => {
  test('タレント：本人の応募・スカウトだけを新しい順で', () => {
    const applications = selectTalentApplications(SEED_APPLICATIONS, DEMO_TALENT_ID);
    assert.deepEqual(applications.map((item) => item.id), ['a001', 'a002']);
    const scouts = selectTalentScouts(SEED_SCOUTS, DEMO_TALENT_ID);
    assert.deepEqual(scouts.map((item) => item.id), ['s001', 's002']);
  });

  test('企業：自社案件への応募・自社のスカウト・自社の掲載中案件', () => {
    const applications = selectCompanyApplications(SEED_APPLICATIONS, JOBS, DEMO_COMPANY_ID);
    // c001 の案件は j001 / j003 / j010 / j016
    assert.deepEqual(applications.map((item) => item.id), ['a004', 'a006', 'a001', 'a005']);
    const scouts = selectCompanyScouts(SEED_SCOUTS, DEMO_COMPANY_ID);
    assert.deepEqual(scouts.map((item) => item.id), ['s006', 's004', 's003']);
    const jobs = selectCompanyJobs(JOBS, DEMO_COMPANY_ID, NOW);
    assert.ok(jobs.length > 0);
    assert.ok(jobs.every((job) => job.companyId === DEMO_COMPANY_ID));
  });

  test('書き換えられた不正な要素（ステータス外・id 無し・型違い）は無視する', () => {
    const tampered = [
      { id: 'ok', jobId: 'j001', talentId: DEMO_TALENT_ID, status: 'applied', createdAt: '2026-11-01T00:00:00Z' },
      { id: 'bad-status', jobId: 'j001', talentId: DEMO_TALENT_ID, status: '<img src=x>', createdAt: '2026-11-01T00:00:00Z' },
      { jobId: 'j001', talentId: DEMO_TALENT_ID, status: 'applied' },
      { id: 1, jobId: 'j001', talentId: DEMO_TALENT_ID, status: 'applied' },
      null, 'x',
    ];
    assert.deepEqual(selectTalentApplications(tampered, DEMO_TALENT_ID).map((item) => item.id), ['ok']);
    assert.deepEqual(selectTalentApplications('not array', DEMO_TALENT_ID), []);
  });
});

describe('通知件数（M-02）', () => {
  test('タレント＝未読（sent）のスカウト件数、企業＝未対応（applied）の応募件数、ゲスト＝0', () => {
    const data = { applications: SEED_APPLICATIONS, scouts: SEED_SCOUTS, jobs: JOBS };
    // t001 宛は s001(sent) / s002(read)
    assert.equal(countNotifications('talent', data), 1);
    // c001 の案件への応募で applied は a001 / a005
    assert.equal(countNotifications('company', data), 2);
    assert.equal(countNotifications('guest', data), 0);
    assert.equal(countNotifications('admin', data), 0);
    assert.equal(countNotifications('talent', {}), 0);
  });

  test('保存データから数える（スカウトが届くと増え、既読で減る）', () => {
    assert.equal(getNotificationCount('talent'), 1);
    addScout({ companyId: 'c002', talentId: DEMO_TALENT_ID, message: 'こんにちは' });
    assert.equal(getNotificationCount('talent'), 2);
    assert.equal(getNotificationCount('company'), 2);
  });

  test('読み上げ用の文言（0件は空）', () => {
    assert.equal(getNotificationLabel('talent', 3), '未読のスカウト 3件');
    assert.equal(getNotificationLabel('company', 1), '未対応の応募 1件');
    assert.equal(getNotificationLabel('talent', 0), '');
    assert.equal(getNotificationLabel('guest', 5), '');
  });
});

describe('デモデータのリセット（4.5）', () => {
  async function seedEverything(store) {
    setRole('company');
    addScout({ companyId: DEMO_COMPANY_ID, talentId: 't005', message: 'a' });
    addJob({ title: 'x' });
    toggleFavorite('j001');
    saveProfile({ bio: 'b' });
    saveContactDraft({ name: 'n' });
    localStorage.setItem(STORAGE_KEYS.applications, '[]');
    await store.saveVideo(DEMO_TALENT_ID, { blob: new Blob(['v'], { type: 'video/mp4' }) });
  }

  test('すべての stagelink:* キーが空になり、動画も削除される', async () => {
    const backend = memoryBackend();
    const store = createVideoStore({ backend });
    await seedEverything(store);
    localStorage.setItem('other-app:key', 'keep');
    assert.ok(localStorage.keys().filter((key) => key.startsWith('stagelink:')).length >= 6);
    assert.equal(backend.items.size, 1);

    const result = await resetAllDemoData({ store });
    assert.deepEqual(result, { ok: true, storage: true, videos: true });
    assert.deepEqual(localStorage.keys().filter((key) => key.startsWith('stagelink:')), []);
    assert.deepEqual(sessionStorage.keys().filter((key) => key.startsWith('stagelink:')), []);
    assert.equal(backend.items.size, 0);
    // 同じオリジンの別アプリのデータは消さない
    assert.equal(localStorage.getItem('other-app:key'), 'keep');
  });

  test('動画を消せなくても保存データは消し、失敗を返す', async () => {
    const fail = async () => { throw new Error('blocked'); };
    const store = createVideoStore({ backend: { get: fail, put: fail, delete: fail, clear: fail } });
    setRole('talent');
    const result = await resetAllDemoData({ store });
    assert.deepEqual(result, { ok: false, storage: true, videos: false });
    assert.equal(localStorage.getItem(STORAGE_KEYS.role), null);
  });

  test('IndexedDB が無い環境では消す動画が無いので成功とみなす', async () => {
    const result = await resetAllDemoData({ store: createVideoStore({ backend: null }) });
    assert.deepEqual(result, { ok: true, storage: true, videos: true });
  });
});
