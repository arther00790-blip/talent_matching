// #08 ステータス遷移（要件 6.3）とスカウト送信（B-03）のテスト
// 遷移の定義は js/lib/status.js の純粋関数、保存を伴う「次へ進める」処理は mypage-data.js の advanceStatus を対象にする。
// Node には localStorage が無いため、job-page.test.mjs と同じメモリ実装を globalThis に差し込む。
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  STATUS_KINDS, canTransition, getNextStatuses, resolveTransition, getStatusLabel, getStatusActionLabel,
} from '../js/lib/status.js';
import { advanceStatus } from '../js/lib/mypage-data.js';
import { submitScout, SCOUT_MESSAGE_MAX_LENGTH } from '../js/components/scout-dialog.js';
import { STORAGE_KEYS, getApplications, getScouts } from '../js/lib/storage.js';
import { APPLICATION_STATUSES, SCOUT_STATUSES } from '../js/data/master.js';
import { DEMO_COMPANY_ID } from '../js/data/companies.js';

class MemoryStorage {
  #items = new Map();
  get length() { return this.#items.size; }
  key(index) { return [...this.#items.keys()][index] ?? null; }
  getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
  clear() { this.#items.clear(); }
}

// 容量超過など、書き込みだけ失敗する状態を再現する
class ReadOnlyStorage extends MemoryStorage {
  setItem() { throw new Error('QuotaExceededError'); }
}

const installStorage = (storage) => {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
};

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

describe('応募ステータスの遷移（6.3）', () => {
  const { application } = STATUS_KINDS;

  test('applied → reviewing → accepted / declined だけを許す', () => {
    assert.equal(canTransition(application, 'applied', 'reviewing'), true);
    assert.equal(canTransition(application, 'reviewing', 'accepted'), true);
    assert.equal(canTransition(application, 'reviewing', 'declined'), true);
  });

  test('定義外の遷移（戻す・飛ばす・同じ状態・未知の値）は拒否する', () => {
    const rejected = [
      ['accepted', 'applied'], ['declined', 'reviewing'], ['reviewing', 'applied'],
      ['applied', 'accepted'], ['applied', 'declined'], ['applied', 'applied'],
      ['accepted', 'declined'], ['applied', 'hacked'], ['unknown', 'reviewing'], [undefined, 'reviewing'],
    ];
    for (const [from, to] of rejected) {
      assert.equal(canTransition(application, from, to), false, `${from} → ${to}`);
    }
  });

  test('次に進める先の一覧（終わった状態は空）', () => {
    assert.deepEqual(getNextStatuses(application, 'applied'), ['reviewing']);
    assert.deepEqual(getNextStatuses(application, 'reviewing'), ['accepted', 'declined']);
    assert.deepEqual(getNextStatuses(application, 'accepted'), []);
    assert.deepEqual(getNextStatuses(application, 'declined'), []);
    assert.deepEqual(getNextStatuses(application, 'nope'), []);
    assert.deepEqual(getNextStatuses('nope', 'applied'), []);
  });

  test('すべてのステータスにテキストのラベルがある（色だけで伝えない）', () => {
    for (const status of APPLICATION_STATUSES) {
      assert.ok(getStatusLabel(application, status), status);
    }
    assert.equal(getStatusLabel(application, 'applied'), '応募済');
    assert.equal(getStatusLabel(application, 'nope'), '');
    assert.equal(getStatusActionLabel(application, 'reviewing'), '選考中にする');
    assert.equal(getStatusActionLabel(application, 'accepted'), '採用する');
    assert.equal(getStatusActionLabel(application, 'declined'), '見送る');
  });
});

describe('スカウトステータスの遷移（6.3）', () => {
  const { scout } = STATUS_KINDS;

  test('sent → read → replied だけを許す', () => {
    assert.equal(canTransition(scout, 'sent', 'read'), true);
    assert.equal(canTransition(scout, 'read', 'replied'), true);
    for (const [from, to] of [['sent', 'replied'], ['read', 'sent'], ['replied', 'read'], ['replied', 'sent'], ['sent', 'applied']]) {
      assert.equal(canTransition(scout, from, to), false, `${from} → ${to}`);
    }
  });

  test('ラベルと操作名', () => {
    for (const status of SCOUT_STATUSES) assert.ok(getStatusLabel(scout, status), status);
    assert.equal(getStatusLabel(scout, 'sent'), '未読');
    assert.equal(getStatusLabel(scout, 'read'), '既読');
    assert.equal(getStatusLabel(scout, 'replied'), '返信済');
    assert.equal(getStatusActionLabel(scout, 'read'), '既読にする');
    assert.equal(getStatusActionLabel(scout, 'replied'), '返信済みにする');
  });

  test('応募とスカウトの遷移は混ざらない', () => {
    assert.equal(canTransition(STATUS_KINDS.application, 'sent', 'read'), false);
    assert.equal(canTransition(STATUS_KINDS.scout, 'applied', 'reviewing'), false);
  });
});

describe('resolveTransition（純粋関数）', () => {
  test('対象が無い・壊れている・定義外なら理由付きで拒否する', () => {
    const kind = STATUS_KINDS.application;
    assert.deepEqual(resolveTransition(kind, { id: 'a1', status: 'applied' }, 'reviewing'), { ok: true, status: 'reviewing' });
    assert.deepEqual(resolveTransition(kind, null, 'reviewing'), { ok: false, reason: 'not-found' });
    assert.deepEqual(resolveTransition(kind, 'a1', 'reviewing'), { ok: false, reason: 'not-found' });
    assert.deepEqual(resolveTransition(kind, { id: 'a1', status: 'accepted' }, 'applied'), { ok: false, reason: 'invalid-transition' });
  });
});

describe('advanceStatus（保存を伴う「次へ進める」）', () => {
  test('応募を applied → reviewing → accepted と進められる', () => {
    assert.deepEqual(advanceStatus(STATUS_KINDS.application, 'a001', 'reviewing'), { ok: true, status: 'reviewing' });
    assert.equal(getApplications().find((item) => item.id === 'a001').status, 'reviewing');
    assert.deepEqual(advanceStatus(STATUS_KINDS.application, 'a001', 'accepted'), { ok: true, status: 'accepted' });
    assert.equal(getApplications().find((item) => item.id === 'a001').status, 'accepted');
  });

  test('定義外の遷移は保存値を変えない（accepted → applied）', () => {
    // a004 は初期データで accepted
    const result = advanceStatus(STATUS_KINDS.application, 'a004', 'applied');
    assert.deepEqual(result, { ok: false, reason: 'invalid-transition' });
    assert.equal(getApplications().find((item) => item.id === 'a004').status, 'accepted');
    assert.equal(localStorage.getItem(STORAGE_KEYS.applications), null, '拒否したときは書き込まない');
  });

  test('存在しない ID は not-found', () => {
    assert.deepEqual(advanceStatus(STATUS_KINDS.application, 'missing', 'reviewing'), { ok: false, reason: 'not-found' });
    assert.deepEqual(advanceStatus(STATUS_KINDS.scout, 'missing', 'read'), { ok: false, reason: 'not-found' });
    assert.deepEqual(advanceStatus('unknown', 'a001', 'reviewing'), { ok: false, reason: 'not-found' });
  });

  test('スカウトを sent → read → replied と進められる', () => {
    assert.equal(advanceStatus(STATUS_KINDS.scout, 's001', 'read').ok, true);
    assert.equal(advanceStatus(STATUS_KINDS.scout, 's001', 'replied').ok, true);
    assert.equal(getScouts().find((item) => item.id === 's001').status, 'replied');
  });

  test('保存に失敗したら storage を返す', () => {
    installStorage(new ReadOnlyStorage());
    assert.deepEqual(advanceStatus(STATUS_KINDS.scout, 's001', 'read'), { ok: false, reason: 'storage' });
  });

  test('利用者が書き換えた不正なステータスは遷移元として扱わない', () => {
    localStorage.setItem(STORAGE_KEYS.scouts, JSON.stringify([{ id: 'sx', status: 'replied<script>', talentId: 't001', companyId: 'c001' }]));
    assert.deepEqual(advanceStatus(STATUS_KINDS.scout, 'sx', 'read'), { ok: false, reason: 'invalid-transition' });
  });
});

describe('スカウト送信（B-03）', () => {
  test('メッセージを添えて sent で保存される（前後の空白は落とす）', () => {
    const result = submitScout({ companyId: DEMO_COMPANY_ID, talentId: 't005', jobId: 'j001', message: '  ぜひご検討ください  ' });
    assert.equal(result.ok, true);
    assert.equal(result.scout.status, 'sent');
    assert.equal(result.scout.message, 'ぜひご検討ください');
    assert.equal(result.scout.jobId, 'j001');
    assert.ok(getScouts().some((item) => item.id === result.scout.id));
  });

  test('案件の指定は任意', () => {
    const result = submitScout({ companyId: DEMO_COMPANY_ID, talentId: 't005', jobId: '', message: 'よろしくお願いします' });
    assert.equal(result.ok, true);
    assert.equal(Object.hasOwn(result.scout, 'jobId'), false);
  });

  test('空・上限超えのメッセージは invalid', () => {
    const empty = submitScout({ companyId: DEMO_COMPANY_ID, talentId: 't005', message: '   ' });
    assert.equal(empty.ok, false);
    assert.equal(empty.reason, 'invalid');
    assert.ok(empty.errors.message);
    const long = submitScout({ companyId: DEMO_COMPANY_ID, talentId: 't005', message: 'あ'.repeat(SCOUT_MESSAGE_MAX_LENGTH + 1) });
    assert.equal(long.reason, 'invalid');
    assert.match(long.errors.message, new RegExp(`${SCOUT_MESSAGE_MAX_LENGTH}文字以内`));
    assert.equal(submitScout({ companyId: DEMO_COMPANY_ID, talentId: 't005', message: 'あ'.repeat(SCOUT_MESSAGE_MAX_LENGTH) }).ok, true);
  });

  test('送り先が不正なら invalid、保存に失敗したら storage', () => {
    assert.equal(submitScout({ companyId: DEMO_COMPANY_ID, talentId: '', message: 'a' }).reason, 'invalid');
    assert.equal(submitScout(null).reason, 'invalid');
    installStorage(new ReadOnlyStorage());
    assert.equal(submitScout({ companyId: DEMO_COMPANY_ID, talentId: 't005', message: 'よろしく' }).reason, 'storage');
  });
});
