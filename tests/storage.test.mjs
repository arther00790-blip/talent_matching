// js/lib/storage.js のテスト
// Node には localStorage / sessionStorage が無いため、Web Storage と同じ形のメモリ実装を globalThis に差し込む。
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  STORAGE_KEYS,
  getRole, setRole,
  getApplications, addApplication, updateApplicationStatus, hasApplied,
  getScouts, addScout, updateScoutStatus,
  getAddedJobs, addJob,
  getFavorites, toggleFavorite,
  getProfile, saveProfile,
  getContactDraft, saveContactDraft, clearContactDraft,
  resetDemoData,
} from '../js/lib/storage.js';
import { SEED_APPLICATIONS, SEED_SCOUTS } from '../js/data/seeds.js';

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

class MemoryStorage {
  #items = new Map();
  get length() { return this.#items.size; }
  key(index) { return [...this.#items.keys()][index] ?? null; }
  getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
  clear() { this.#items.clear(); }
}

// 容量超過やストレージ無効化を再現する（すべての操作が例外を投げる）
class BrokenStorage {
  getItem() { throw new Error('denied'); }
  setItem() { throw new Error('QuotaExceededError'); }
  removeItem() { throw new Error('denied'); }
}

function installStorage(name, storage) {
  Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true });
}

function uninstallStorage(name) {
  delete globalThis[name];
}

// 失敗時の console.warn はテスト出力を埋めるだけなので黙らせる（呼ばれたことは別途確認する）
let originalWarn;
let warnCount;

beforeEach(() => {
  installStorage('localStorage', new MemoryStorage());
  installStorage('sessionStorage', new MemoryStorage());
  originalWarn = console.warn;
  warnCount = 0;
  console.warn = () => { warnCount += 1; };
});

afterEach(() => {
  uninstallStorage('localStorage');
  uninstallStorage('sessionStorage');
  console.warn = originalWarn;
});

describe('保存キー（要件 4.5）', () => {
  test('キーは 4.5 の表どおりに一元管理されている', () => {
    assert.deepEqual({ ...STORAGE_KEYS }, {
      role: 'stagelink:role',
      applications: 'stagelink:applications',
      scouts: 'stagelink:scouts',
      addedJobs: 'stagelink:jobs:added',
      favorites: 'stagelink:favorites',
      profile: 'stagelink:profile',
      contact: 'stagelink:contact',
    });
    assert.ok(Object.isFrozen(STORAGE_KEYS));
  });
});

describe('ロール', () => {
  test('保存→取得の往復', () => {
    assert.equal(getRole(), 'guest');
    assert.equal(setRole('company'), true);
    assert.equal(getRole(), 'company');
    assert.equal(localStorage.getItem('stagelink:role'), 'company');
  });
});

describe('応募', () => {
  test('未保存なら初期データ（seeds）を返し、返り値を書き換えても初期データは変わらない', () => {
    const applications = getApplications();
    assert.deepEqual(applications, SEED_APPLICATIONS);
    applications[0].status = 'declined';
    applications.push({ id: 'x' });
    assert.deepEqual(getApplications(), SEED_APPLICATIONS);
  });

  test('addApplication は Application 型どおりの値を保存して返す', () => {
    const created = addApplication({ jobId: 'j010', talentId: 't001', message: 'よろしくお願いします' });
    assert.ok(created);
    assert.equal(typeof created.id, 'string');
    assert.equal(created.jobId, 'j010');
    assert.equal(created.talentId, 't001');
    assert.equal(created.message, 'よろしくお願いします');
    assert.equal(created.status, 'applied');
    assert.match(created.createdAt, ISO_DATETIME);
    const stored = getApplications();
    assert.equal(stored.length, SEED_APPLICATIONS.length + 1);
    assert.deepEqual(stored.at(-1), created);
    assert.deepEqual(JSON.parse(localStorage.getItem('stagelink:applications')), stored);
  });

  test('同じタレントが同じ案件に2回応募できない', () => {
    assert.ok(addApplication({ jobId: 'j010', talentId: 't001', message: '1回目' }));
    assert.equal(hasApplied('j010', 't001'), true);
    assert.equal(addApplication({ jobId: 'j010', talentId: 't001', message: '2回目' }), null);
    assert.equal(getApplications().filter((item) => item.jobId === 'j010' && item.talentId === 't001').length, 1);
    assert.equal(hasApplied('j010', 't002'), false);
  });

  test('jobId / talentId が無い応募は保存しない', () => {
    assert.equal(addApplication({ jobId: '', talentId: 't001', message: 'x' }), null);
    assert.equal(addApplication(null), null);
  });

  test('updateApplicationStatus はステータスを更新し、未知のID・ステータスでは false', () => {
    const [first] = SEED_APPLICATIONS;
    assert.equal(updateApplicationStatus(first.id, 'reviewing'), true);
    assert.equal(getApplications().find((item) => item.id === first.id).status, 'reviewing');
    assert.equal(updateApplicationStatus(first.id, 'hired'), false);
    assert.equal(updateApplicationStatus('no-such-id', 'accepted'), false);
  });
});

describe('スカウト', () => {
  test('未保存なら初期データを返す', () => {
    assert.deepEqual(getScouts(), SEED_SCOUTS);
  });

  test('addScout は status "sent" で保存し、updateScoutStatus で進められる', () => {
    const created = addScout({ companyId: 'c001', talentId: 't003', jobId: 'j001', message: 'ぜひご検討ください' });
    assert.ok(created);
    assert.equal(created.status, 'sent');
    assert.equal(created.jobId, 'j001');
    assert.match(created.createdAt, ISO_DATETIME);
    assert.equal(updateScoutStatus(created.id, 'read'), true);
    assert.equal(getScouts().find((item) => item.id === created.id).status, 'read');
    assert.equal(updateScoutStatus(created.id, 'accepted'), false);
  });

  test('案件を指定しないスカウトは jobId を持たない', () => {
    const created = addScout({ companyId: 'c001', talentId: 't003', message: 'x' });
    assert.ok(created);
    assert.equal('jobId' in created, false);
  });

  test('companyId / talentId が無いスカウトは保存しない', () => {
    assert.equal(addScout({ companyId: 'c001', message: 'x' }), null);
  });
});

describe('追加した案件', () => {
  test('未保存なら空配列、addJob で ID・status・createdAt を補って保存する', () => {
    assert.deepEqual(getAddedJobs(), []);
    const created = addJob({ companyId: 'c001', title: 'テスト案件', genre: 'CM' });
    assert.ok(created);
    assert.equal(typeof created.id, 'string');
    assert.equal(created.status, 'open');
    assert.match(created.createdAt, ISO_DATETIME);
    assert.equal(created.title, 'テスト案件');
    assert.deepEqual(getAddedJobs(), [created]);
  });

  test('2件追加しても ID が重複しない', () => {
    const first = addJob({ companyId: 'c001', title: 'A' });
    const second = addJob({ companyId: 'c001', title: 'B' });
    assert.notEqual(first.id, second.id);
  });

  test('オブジェクト以外は保存しない', () => {
    assert.equal(addJob('job'), null);
    assert.deepEqual(getAddedJobs(), []);
  });
});

describe('お気に入り', () => {
  test('toggleFavorite で追加・削除され、現在の状態を返す', () => {
    assert.deepEqual(getFavorites(), []);
    assert.equal(toggleFavorite('j001'), true);
    assert.equal(toggleFavorite('j002'), true);
    assert.deepEqual(getFavorites(), ['j001', 'j002']);
    assert.equal(toggleFavorite('j001'), false);
    assert.deepEqual(getFavorites(), ['j002']);
  });

  test('文字列以外の値・壊れた配列要素は無視する', () => {
    localStorage.setItem('stagelink:favorites', JSON.stringify(['j001', 3, null]));
    assert.deepEqual(getFavorites(), ['j001']);
    assert.equal(toggleFavorite(''), false);
  });
});

describe('プロフィール', () => {
  test('未保存なら null、保存→取得の往復', () => {
    assert.equal(getProfile(), null);
    assert.equal(saveProfile({ bio: 'こんにちは', skills: ['英語'] }), true);
    assert.deepEqual(getProfile(), { bio: 'こんにちは', skills: ['英語'] });
  });

  test('オブジェクト以外は保存しない', () => {
    assert.equal(saveProfile(['bio']), false);
    assert.equal(getProfile(), null);
  });
});

describe('問い合わせの下書き（sessionStorage）', () => {
  test('保存→取得→削除の往復。localStorage には書かない', () => {
    const draft = { name: '山田', email: 'a@example.com', category: 'other', body: '1234567890', agree: true };
    assert.equal(getContactDraft(), null);
    assert.equal(saveContactDraft(draft), true);
    assert.deepEqual(getContactDraft(), draft);
    assert.ok(sessionStorage.getItem('stagelink:contact'));
    assert.equal(localStorage.getItem('stagelink:contact'), null);
    assert.equal(clearContactDraft(), true);
    assert.equal(getContactDraft(), null);
  });
});

describe('壊れた保存値・ストレージ障害', () => {
  test('壊れたJSONが入っていても既定値が返る', () => {
    for (const key of ['applications', 'scouts', 'addedJobs', 'favorites', 'profile']) {
      localStorage.setItem(STORAGE_KEYS[key], '{broken');
    }
    sessionStorage.setItem(STORAGE_KEYS.contact, 'not json');
    assert.deepEqual(getApplications(), SEED_APPLICATIONS);
    assert.deepEqual(getScouts(), SEED_SCOUTS);
    assert.deepEqual(getAddedJobs(), []);
    assert.deepEqual(getFavorites(), []);
    assert.equal(getProfile(), null);
    assert.equal(getContactDraft(), null);
  });

  test('型が違う値（配列のはずがオブジェクト等）でも既定値が返る', () => {
    localStorage.setItem(STORAGE_KEYS.applications, JSON.stringify({ id: 'a' }));
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify('text'));
    assert.deepEqual(getApplications(), SEED_APPLICATIONS);
    assert.equal(getProfile(), null);
  });

  test('配列内のオブジェクトでない要素は取り除く', () => {
    localStorage.setItem(STORAGE_KEYS.scouts, JSON.stringify([{ id: 's1' }, 'x', null]));
    assert.deepEqual(getScouts(), [{ id: 's1' }]);
  });

  test('ストレージが例外を投げても既定値・false を返し、例外を外に出さない', () => {
    installStorage('localStorage', new BrokenStorage());
    installStorage('sessionStorage', new BrokenStorage());
    assert.deepEqual(getApplications(), SEED_APPLICATIONS);
    assert.equal(addApplication({ jobId: 'j010', talentId: 't001', message: 'x' }), null);
    assert.equal(updateScoutStatus(SEED_SCOUTS[0].id, 'read'), false);
    assert.equal(addJob({ title: 'x' }), null);
    assert.deepEqual(getFavorites(), []);
    assert.equal(toggleFavorite('j001'), false);
    assert.equal(saveProfile({ bio: 'x' }), false);
    assert.equal(saveContactDraft({ name: 'x' }), false);
    assert.equal(clearContactDraft(), false);
    assert.equal(resetDemoData(), false);
    assert.ok(warnCount > 0, '失敗は console.warn で知らせる');
  });

  test('ストレージ自体が無い環境でも既定値を返す', () => {
    uninstallStorage('localStorage');
    uninstallStorage('sessionStorage');
    assert.equal(getRole(), 'guest');
    assert.deepEqual(getScouts(), SEED_SCOUTS);
    assert.equal(getContactDraft(), null);
    assert.equal(saveProfile({ bio: 'x' }), false);
  });
});

describe('resetDemoData', () => {
  test('4.5 の全キーが消え、初期状態に戻る', () => {
    setRole('talent');
    addApplication({ jobId: 'j010', talentId: 't001', message: 'x' });
    addScout({ companyId: 'c001', talentId: 't003', message: 'x' });
    addJob({ companyId: 'c001', title: 'x' });
    toggleFavorite('j001');
    saveProfile({ bio: 'x' });
    saveContactDraft({ name: 'x' });
    localStorage.setItem('other-app:key', 'keep');

    assert.equal(resetDemoData(), true);

    for (const key of Object.values(STORAGE_KEYS)) {
      assert.equal(localStorage.getItem(key), null, key);
      assert.equal(sessionStorage.getItem(key), null, key);
    }
    assert.equal(localStorage.getItem('other-app:key'), 'keep', '他サイトのキーは消さない');
    assert.equal(getRole(), 'guest');
    assert.deepEqual(getApplications(), SEED_APPLICATIONS);
    assert.deepEqual(getFavorites(), []);
  });
});
