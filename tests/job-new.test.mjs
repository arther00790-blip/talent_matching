// #08 案件掲載フォーム（B-01）のテスト
// 画面の判断部分（ロールによる出し分け・フォーム値→Job 型の変換・保存）は js/lib/job-form.js の関数を対象にする。
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  JOB_POST_ROLE, JOB_POST_GATE_MESSAGES, JOB_POSTED_REDIRECT, getJobPostAccess, toJobInput, createJobPost,
} from '../js/lib/job-form.js';
import { getAddedJobs } from '../js/lib/storage.js';
import { DEMO_COMPANY_ID } from '../js/data/companies.js';

const NOW = new Date('2026-11-03T12:00:00+09:00');

class MemoryStorage {
  #items = new Map();
  getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
}
class ReadOnlyStorage extends MemoryStorage {
  setItem() { throw new Error('QuotaExceededError'); }
}
const installStorage = (storage) => {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
};

const validRaw = () => ({
  title: '  新作Web CM 出演者募集  ',
  genre: 'Web広告',
  requiredRoles: ['actor', 'model'],
  gender: '',
  ageRanges: ['20代前半'],
  area: '東京都',
  shootDates: '2026年12月上旬（1日）',
  rewardMin: '30000',
  rewardMax: '50000',
  rewardUnit: '日',
  requiredSkills: ['英語'],
  videoPreferred: true,
  description: '明るい雰囲気のCMです。',
  deadline: '2026-11-30',
});

let originalWarn;
beforeEach(() => {
  installStorage(new MemoryStorage());
  originalWarn = console.warn;
  console.warn = () => {};
});
afterEach(() => {
  delete globalThis.localStorage;
  console.warn = originalWarn;
});

describe('ロールによる出し分け', () => {
  test('企業だけフォームを出し、他のロールは理由をテキストで案内する', () => {
    assert.equal(JOB_POST_ROLE, 'company');
    assert.deepEqual(getJobPostAccess('company'), { canPost: true, message: '' });
    assert.deepEqual(getJobPostAccess('talent'), { canPost: false, message: JOB_POST_GATE_MESSAGES.talent });
    assert.deepEqual(getJobPostAccess('guest'), { canPost: false, message: JOB_POST_GATE_MESSAGES.guest });
    assert.deepEqual(getJobPostAccess('admin'), { canPost: false, message: JOB_POST_GATE_MESSAGES.guest });
    assert.match(JOB_POST_GATE_MESSAGES.talent, /企業に切り替える/);
  });
});

describe('フォーム値 → Job 型', () => {
  test('文字列は前後の空白を落とし、報酬は数値にし、性別の指定なしは持たせない', () => {
    const input = toJobInput(validRaw());
    assert.equal(input.title, '新作Web CM 出演者募集');
    assert.deepEqual(input.reward, { min: 30000, max: 50000, unit: '日' });
    assert.equal(Object.hasOwn(input, 'gender'), false);
    assert.equal(input.videoPreferred, true);
    assert.deepEqual(input.requiredRoles, ['actor', 'model']);
    assert.equal(toJobInput({ ...validRaw(), gender: 'female' }).gender, 'female');
  });

  test('配列以外・文字列以外の値は捨てる', () => {
    const input = toJobInput({ requiredRoles: 'actor', ageRanges: [1, '20代前半'], videoPreferred: 'yes' });
    assert.deepEqual(input.requiredRoles, []);
    assert.deepEqual(input.ageRanges, ['20代前半']);
    assert.equal(input.videoPreferred, false);
    assert.equal(input.title, '');
    assert.deepEqual(toJobInput(null).requiredSkills, []);
  });
});

describe('案件の掲載', () => {
  test('検証を通れば自社の案件として open で保存される', () => {
    const result = createJobPost(validRaw(), { now: NOW });
    assert.equal(result.ok, true);
    assert.equal(result.job.companyId, DEMO_COMPANY_ID);
    assert.equal(result.job.status, 'open');
    assert.equal(typeof result.job.createdAt, 'string');
    assert.equal(getAddedJobs().length, 1);
  });

  test('入力不備はエラー文を返して保存しない', () => {
    const result = createJobPost({ ...validRaw(), title: ' ', requiredRoles: [], rewardMin: '9', rewardMax: '1', deadline: '2026-11-01' }, { now: NOW });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid');
    for (const key of ['title', 'requiredRoles', 'reward', 'deadline']) assert.ok(result.errors[key], key);
    assert.equal(getAddedJobs().length, 0);
  });

  test('報酬が数字でなければ invalid', () => {
    const result = createJobPost({ ...validRaw(), rewardMin: 'abc' }, { now: NOW });
    assert.equal(result.reason, 'invalid');
    assert.ok(result.errors.reward);
  });

  test('保存に失敗したら storage', () => {
    installStorage(new ReadOnlyStorage());
    assert.deepEqual(createJobPost(validRaw(), { now: NOW }), { ok: false, reason: 'storage' });
  });

  test('掲載後の遷移先は入力値に依存しない固定の相対 URL', () => {
    assert.equal(JOB_POSTED_REDIRECT, 'jobs.html?sort=newest');
  });
});
