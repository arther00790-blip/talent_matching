// #06 案件一覧・詳細・応募のテスト
// DOM を使わずに検証できるよう、URL⇔フィルター変換・一覧の組み立て・応募可否・応募データ生成は純粋関数（＋storage）を対象にする。
// Node には localStorage が無いため、storage.test.mjs と同じメモリ実装を globalThis に差し込む。
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EMPTY_JOB_FILTERS, MIN_REWARD_OPTIONS, parseJobFilters, jobFiltersToParams, isJobFilterEmpty, jobFilterFormHTML,
} from '../js/components/job-filter.js';
import { mergeJobs, resolveSortKey, buildJobResults, resolveDemoTalent, EDITABLE_PROFILE_FIELDS } from '../js/lib/job-list.js';
import { resolveJobDetail, toJobDetailView, favoriteButtonView, NOT_FOUND_MESSAGE } from '../js/components/job-detail.js';
import { getApplyState, submitApplication, APPLY_SUCCESS_MESSAGE } from '../js/components/apply-dialog.js';
import {
  STORAGE_KEYS, getApplications, hasApplied, getFavorites, toggleFavorite, getAddedJobs,
} from '../js/lib/storage.js';
import { APPLICATION_MESSAGE_MAX_LENGTH } from '../js/lib/validation.js';
import { JOB_SORT_KEYS } from '../js/lib/filters.js';
import { getQueryParams, buildQueryString } from '../js/lib/utils.js';
import { JOBS } from '../js/data/jobs.js';
import { COMPANIES } from '../js/data/companies.js';
import { TALENTS, DEMO_TALENT_ID } from '../js/data/talents.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const RAW_COLOR_PATTERN = /#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
// j003（11/12締切）・j008（11/15締切は当日なので募集中）・j009（11/8締切）の境目になる日。結果を実行日に依存させないため固定する
const NOW = new Date('2026-11-15T12:00:00+09:00');
const UNAPPLIED_JOB_ID = 'j002';

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

function installStorage(storage) {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
}

// 失敗時の console.warn はテスト出力を埋めるだけなので黙らせる
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

describe('応募データの生成', () => {
  test('Application 型どおり（status: "applied"、createdAt が ISO 文字列）で保存される', () => {
    const result = submitApplication({ jobId: UNAPPLIED_JOB_ID, talentId: DEMO_TALENT_ID, message: '  料理シーン得意です  ' });
    assert.equal(result.ok, true);
    const { application } = result;
    assert.deepEqual(Object.keys(application).sort(), ['createdAt', 'id', 'jobId', 'message', 'status', 'talentId']);
    assert.equal(application.status, 'applied');
    assert.match(application.createdAt, ISO_DATETIME);
    assert.ok(!Number.isNaN(Date.parse(application.createdAt)));
    assert.equal(typeof application.id, 'string');
    assert.equal(application.jobId, UNAPPLIED_JOB_ID);
    assert.equal(application.talentId, DEMO_TALENT_ID);
    // 前後の空白は落として保存する（マイページで余白が崩れないように）
    assert.equal(application.message, '料理シーン得意です');
    assert.ok(getApplications().some((item) => item.id === application.id));
  });

  test('同じ jobId で2回応募できない', () => {
    const first = submitApplication({ jobId: UNAPPLIED_JOB_ID, talentId: DEMO_TALENT_ID, message: 'よろしくお願いします' });
    const second = submitApplication({ jobId: UNAPPLIED_JOB_ID, talentId: DEMO_TALENT_ID, message: 'もう一度' });
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    assert.equal(second.reason, 'duplicate');
    assert.equal(getApplications().filter((item) => item.jobId === UNAPPLIED_JOB_ID && item.talentId === DEMO_TALENT_ID).length, 1);
  });

  test('初期データで応募済みの案件（j001）も重複扱い', () => {
    assert.equal(hasApplied('j001', DEMO_TALENT_ID), true);
    assert.equal(submitApplication({ jobId: 'j001', talentId: DEMO_TALENT_ID, message: 'こんにちは' }).reason, 'duplicate');
  });

  test('メッセージ未入力・上限超えは保存せずエラー文を返す', () => {
    const empty = submitApplication({ jobId: UNAPPLIED_JOB_ID, talentId: DEMO_TALENT_ID, message: '   ' });
    assert.equal(empty.ok, false);
    assert.equal(empty.reason, 'invalid');
    assert.ok(empty.errors.message);
    const tooLong = submitApplication({ jobId: UNAPPLIED_JOB_ID, talentId: DEMO_TALENT_ID, message: 'あ'.repeat(APPLICATION_MESSAGE_MAX_LENGTH + 1) });
    assert.equal(tooLong.reason, 'invalid');
    assert.equal(hasApplied(UNAPPLIED_JOB_ID, DEMO_TALENT_ID), false);
    const justMax = submitApplication({ jobId: UNAPPLIED_JOB_ID, talentId: DEMO_TALENT_ID, message: 'あ'.repeat(APPLICATION_MESSAGE_MAX_LENGTH) });
    assert.equal(justMax.ok, true);
  });

  test('localStorage に書けないときは storage エラーを返し、例外を出さない', () => {
    installStorage(new ReadOnlyStorage());
    const result = submitApplication({ jobId: UNAPPLIED_JOB_ID, talentId: DEMO_TALENT_ID, message: 'よろしくお願いします' });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'storage');
  });

  test('引数が不正でも落ちない', () => {
    assert.equal(submitApplication(null).ok, false);
    assert.equal(submitApplication({ message: 'x' }).ok, false);
  });

  test('完了トーストは要件 6.6 の励ましの文言', () => {
    assert.equal(APPLY_SUCCESS_MESSAGE, '応募しました！いい知らせが届きますように');
  });
});

describe('応募ボタンの状態', () => {
  const open = { role: 'talent', applied: false, open: true };

  test('タレントで未応募・募集中なら押せる', () => {
    assert.deepEqual(getApplyState(open), { enabled: true, label: 'この案件に応募する', reason: '' });
  });

  test('ゲスト・企業は理由を添えて無効', () => {
    for (const role of ['guest', 'company', 'unknown']) {
      const state = getApplyState({ ...open, role });
      assert.equal(state.enabled, false, role);
      assert.match(state.reason, /タレントに切り替えると応募できます/, role);
    }
  });

  test('応募済みなら「応募済み」表示で無効', () => {
    const state = getApplyState({ ...open, applied: true });
    assert.equal(state.enabled, false);
    assert.equal(state.label, '応募済み');
    assert.ok(state.reason);
  });

  test('募集終了なら「募集終了」表示で無効。応募済みの表示を優先する', () => {
    const state = getApplyState({ ...open, open: false });
    assert.equal(state.enabled, false);
    assert.equal(state.label, '募集終了');
    assert.equal(getApplyState({ ...open, open: false, applied: true }).label, '応募済み');
  });
});

describe('お気に入り', () => {
  test('トグルで追加・削除される', () => {
    assert.deepEqual(getFavorites(), []);
    assert.equal(toggleFavorite('j005'), true);
    assert.deepEqual(getFavorites(), ['j005']);
    assert.equal(toggleFavorite('j005'), false);
    assert.deepEqual(getFavorites(), []);
  });

  // トグルボタンは状態で名前を変えると「押されている」の読み上げと矛盾するため、名前は固定し aria-pressed と記号で伝える
  test('ボタンは aria-pressed で状態を伝え、名前は変えない', () => {
    assert.equal(favoriteButtonView(true).pressed, 'true');
    assert.equal(favoriteButtonView(false).pressed, 'false');
    assert.equal(favoriteButtonView(true).text, favoriteButtonView(false).text);
    assert.notEqual(favoriteButtonView(true).icon, favoriteButtonView(false).icon);
  });
});

describe('一覧の組み立て', () => {
  const talent = resolveDemoTalent(TALENTS, null);
  const build = (sort, role = 'talent') => buildJobResults(JOBS, { ...EMPTY_JOB_FILTERS, sort }, { role, talent, now: NOW });

  test('締切が近い順：募集中を締切の昇順、募集終了は後ろ', () => {
    const results = build(JOB_SORT_KEYS.deadline);
    const openItems = results.filter((item) => !item.closed);
    const closedItems = results.filter((item) => item.closed);
    assert.deepEqual(results.slice(0, openItems.length), openItems);
    const deadlines = openItems.map((item) => item.job.deadline);
    assert.deepEqual(deadlines, [...deadlines].sort());
    assert.equal(openItems[0].job.id, 'j008');
    assert.deepEqual(closedItems.map((item) => item.job.id).sort(), ['j003', 'j009', 'j013', 'j017']);
  });

  test('新着順：createdAt の降順', () => {
    const results = build(JOB_SORT_KEYS.newest);
    const times = results.map((item) => Date.parse(item.job.createdAt));
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
    assert.equal(results[0].job.id, 'j015');
  });

  test('マッチ度順：スコアの降順。タレントのときだけ相性スコアを持つ', () => {
    const scores = build(JOB_SORT_KEYS.match).map((item) => item.matchScore);
    assert.ok(scores.every((score) => Number.isInteger(score)));
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
    assert.ok(build(JOB_SORT_KEYS.deadline, 'guest').every((item) => item.matchScore === undefined));
  });

  test('マッチ度順はタレント以外では締切が近い順に倒す', () => {
    assert.equal(resolveSortKey(JOB_SORT_KEYS.match, 'talent'), JOB_SORT_KEYS.match);
    assert.equal(resolveSortKey(JOB_SORT_KEYS.match, 'guest'), JOB_SORT_KEYS.deadline);
    assert.equal(resolveSortKey(JOB_SORT_KEYS.match, 'company'), JOB_SORT_KEYS.deadline);
    assert.equal(resolveSortKey('bogus', 'talent'), JOB_SORT_KEYS.deadline);
    assert.deepEqual(
      build(JOB_SORT_KEYS.match, 'guest').map((item) => item.job.id),
      build(JOB_SORT_KEYS.deadline, 'guest').map((item) => item.job.id),
    );
  });

  test('絞り込み条件が効く', () => {
    const results = buildJobResults(JOBS, { ...EMPTY_JOB_FILTERS, role: 'dancer', area: '関東' }, { role: 'guest', now: NOW });
    assert.ok(results.length > 0);
    assert.ok(results.every((item) => item.job.requiredRoles.includes('dancer')));
  });

  test('デモで追加した案件（stagelink:jobs:added）を合わせ、同じ id は重ねない', () => {
    const added = {
      id: 'j-added-1', companyId: 'c001', title: '追加案件', genre: 'CM', requiredRoles: ['actor'], ageRanges: [], area: '東京都',
      reward: { min: 1, max: 2, unit: '日' }, requiredSkills: [], description: '', deadline: '2026-12-31', status: 'open', createdAt: '2026-11-10T00:00:00Z',
    };
    localStorage.setItem(STORAGE_KEYS.addedJobs, JSON.stringify([added, { ...JOBS[0] }]));
    const merged = mergeJobs(JOBS, getAddedJobs());
    assert.equal(merged.length, JOBS.length + 1);
    assert.ok(merged.some((job) => job.id === 'j-added-1'));
    assert.deepEqual(mergeJobs(null, 'x'), []);
  });

  test('デモ用タレントは保存済みプロフィールで上書きされるが id は変わらない', () => {
    const base = TALENTS.find((item) => item.id === DEMO_TALENT_ID);
    const talentWithProfile = resolveDemoTalent(TALENTS, { id: 'hack', area: '大阪府', bio: '更新した自己紹介', skills: ['英語'] });
    assert.equal(talentWithProfile.id, DEMO_TALENT_ID);
    assert.equal(talentWithProfile.bio, '更新した自己紹介');
    assert.deepEqual(talentWithProfile.skills, ['英語']);
    // 編集画面に無い項目は localStorage を書き換えても反映しない
    assert.equal(talentWithProfile.area, base.area);
    assert.equal(resolveDemoTalent([], null), null);
  });

  // localStorage は利用者が自由に書き換えられるため、編集できる項目だけを、正しい型のときだけ重ねる
  test('デモ用タレントに重ねるプロフィールは編集可能項目（bio / skills）だけ', () => {
    assert.deepEqual([...EDITABLE_PROFILE_FIELDS], ['bio', 'skills']);
    const base = TALENTS.find((item) => item.id === DEMO_TALENT_ID);
    const tampered = {
      introVideo: { src: 'https://evil.example/x.webm' },
      sns: { x: 'javascript:alert(1)' },
      displayName: '<img src=x onerror=alert(1)>',
      images: ['https://evil.example/a.jpg'],
    };
    const talent = resolveDemoTalent(TALENTS, tampered);
    assert.deepEqual(talent.introVideo, base.introVideo);
    assert.deepEqual(talent.sns, base.sns);
    assert.equal(talent.displayName, base.displayName);
    assert.deepEqual(talent.images, base.images);
  });

  test('型が不正な bio / skills は無視して元の値を使う', () => {
    const base = TALENTS.find((item) => item.id === DEMO_TALENT_ID);
    const talent = resolveDemoTalent(TALENTS, { bio: { html: '<b>x</b>' }, skills: 'ダンス' });
    assert.equal(talent.bio, base.bio);
    assert.deepEqual(talent.skills, base.skills);
    const mixed = resolveDemoTalent(TALENTS, { skills: ['英語', 42, null] });
    assert.deepEqual(mixed.skills, ['英語']);
  });
});

describe('フィルター状態 ⇔ クエリ文字列', () => {
  const roundTrip = (state) => parseJobFilters(getQueryParams(buildQueryString(jobFiltersToParams(state))));

  test('条件なし・既定の並び替えはクエリが空', () => {
    assert.equal(buildQueryString(jobFiltersToParams(EMPTY_JOB_FILTERS)), '');
    assert.ok(isJobFilterEmpty(parseJobFilters(getQueryParams(''))));
    assert.equal(EMPTY_JOB_FILTERS.sort, JOB_SORT_KEYS.deadline);
  });

  test('全項目を指定した状態が往復で一致する', () => {
    const state = { role: 'actor', genre: 'CM', area: '東京都', minReward: String(MIN_REWARD_OPTIONS[1]), sort: JOB_SORT_KEYS.newest };
    assert.deepEqual(roundTrip(state), state);
    assert.equal(isJobFilterEmpty(state), false);
  });

  test('並び替えだけでは「条件あり」にしない', () => {
    assert.equal(isJobFilterEmpty({ ...EMPTY_JOB_FILTERS, sort: JOB_SORT_KEYS.newest }), true);
  });

  test('マスタ・選択肢に無い値は捨てる', () => {
    const state = parseJobFilters(getQueryParams('?role=hacker&genre=<b>&area=火星&minReward=123&sort=random'));
    assert.deepEqual(state, { ...EMPTY_JOB_FILTERS });
    assert.deepEqual(parseJobFilters(null), { ...EMPTY_JOB_FILTERS });
  });

  test('フォームに職種・ジャンル・地域・報酬下限があり、ラベルが結び付いている', () => {
    const html = jobFilterFormHTML();
    for (const name of ['role', 'genre', 'area', 'minReward']) assert.match(html, new RegExp(`name="${name}"`), name);
    for (const id of ['job-filter-role', 'job-filter-genre', 'job-filter-area', 'job-filter-reward']) {
      assert.match(html, new RegExp(`for="${id}"`), id);
      assert.match(html, new RegExp(`id="${id}"`), id);
    }
  });
});

describe('詳細ページの表示内容', () => {
  test('存在しない ID はエラー表示用の状態', () => {
    assert.equal(resolveJobDetail('j001', JOBS).status, 'ok');
    for (const id of ['j999', '', undefined, ['j001']]) {
      const detail = resolveJobDetail(id, JOBS);
      assert.equal(detail.status, 'not-found');
      assert.equal(detail.message, NOT_FOUND_MESSAGE);
    }
    assert.equal(resolveJobDetail('j001', null).status, 'not-found');
  });

  test('募集要項・条件・スケジュール・報酬・企業名・向いている人をそろえる', () => {
    const job = JOBS.find((item) => item.id === 'j001');
    const view = toJobDetailView(job, { companies: COMPANIES, now: NOW });
    assert.equal(view.title, job.title);
    assert.equal(view.companyName, COMPANIES.find((company) => company.id === job.companyId).name);
    assert.equal(view.description, job.description);
    assert.equal(view.reward, '30,000〜50,000円／日');
    assert.ok(view.conditions.some((item) => item.label === '職種' && item.value === '俳優'));
    assert.ok(view.schedule.some((item) => item.label === '撮影日' && item.value === job.shootDates));
    assert.ok(view.suitableFor.length > 0);
    assert.equal(view.videoWelcome, '自己紹介動画ありを歓迎');
    assert.equal(view.open, true);
  });

  test('videoPreferred でない・締切切れ・企業不明でも落ちない', () => {
    const view = toJobDetailView(JOBS.find((item) => item.id === 'j003'), { companies: [], now: NOW });
    assert.equal(view.open, false);
    assert.equal(view.companyName, '掲載企業');
    assert.equal(toJobDetailView(JOBS.find((item) => item.id === 'j002'), { companies: COMPANIES, now: NOW }).videoWelcome, '');
    assert.equal(toJobDetailView(null), null);
  });
});

describe('ページのマークアップ・スタイル', () => {
  test('一覧・詳細ともページ固有の CSS と JS を読み込む', () => {
    assert.match(read('jobs.html'), /href="css\/pages\/jobs\.css"/);
    assert.match(read('jobs.html'), /src="js\/pages\/jobs\.js"/);
    assert.match(read('job.html'), /href="css\/pages\/job\.css"/);
    assert.match(read('job.html'), /src="js\/pages\/job\.js"/);
  });

  test('一覧は件数を aria-live で知らせ、並び替え3種を選べる', () => {
    const html = read('jobs.html');
    assert.match(html, /aria-live="polite"/);
    for (const key of Object.values(JOB_SORT_KEYS)) assert.match(html, new RegExp(`value="${key}"`), key);
  });

  test('ページ固有の CSS・JS に生の色値が無い', () => {
    const files = [
      'css/pages/jobs.css', 'css/pages/job.css', 'js/pages/jobs.js', 'js/pages/job.js',
      'js/components/job-filter.js', 'js/components/job-detail.js', 'js/components/apply-dialog.js', 'js/lib/job-list.js',
    ];
    for (const file of files) assert.doesNotMatch(read(file), RAW_COLOR_PATTERN, file);
  });

  test('詳細・応募まわりの JS は innerHTML を使わない', () => {
    for (const file of ['js/pages/job.js', 'js/components/job-detail.js', 'js/components/apply-dialog.js']) {
      assert.doesNotMatch(read(file), /innerHTML/, file);
    }
  });
});
