// js/lib/filters.js のテスト（要件 6.5）
// 各条件単独・組み合わせ・条件なし・0件を、件数の少ない合成データで確かめる。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { filterTalents, filterJobs, sortJobs, isJobOpen, JOB_SORT_KEYS } from '../js/lib/filters.js';
import { TALENTS } from '../js/data/talents.js';
import { JOBS } from '../js/data/jobs.js';

const VIDEO = Object.freeze({ src: 'assets/videos/x.mp4', poster: 'x.jpg', duration: 20 });

const talents = Object.freeze([
  { id: 'a', displayName: '春風 みなみ', roles: ['actor'], gender: 'female', ageRange: '20代前半', area: '東京都',
    skills: ['英語', 'ダンス'], genres: ['CM'], bio: '笑顔が自慢です', career: [{ year: 2025, title: '架空ドラマ『夜明けの坂』', type: 'ドラマ' }], introVideo: VIDEO },
  { id: 'b', displayName: '灯野 そら', roles: ['model', 'actor'], gender: 'female', ageRange: '20代後半', area: '神奈川県',
    skills: ['英語'], genres: ['雑誌'], bio: 'ＭＶ出演が目標', career: [] },
  { id: 'c', displayName: '鷹宮 ジン', roles: ['dancer'], gender: 'male', ageRange: '20代前半', area: '福岡県',
    skills: ['ダンス', 'アクション'], genres: ['MV'], bio: 'ストリートダンス歴10年', career: [] },
]);
const ids = (list) => list.map((item) => item.id);

describe('filterTalents', () => {
  test('条件なし（undefined / 空オブジェクト / 空の値）なら全件を元の順で返す', () => {
    assert.deepEqual(ids(filterTalents(talents)), ['a', 'b', 'c']);
    assert.deepEqual(ids(filterTalents(talents, {})), ['a', 'b', 'c']);
    assert.deepEqual(ids(filterTalents(talents, { role: '', gender: '', skills: [], keyword: '  ', videoOnly: false })), ['a', 'b', 'c']);
  });

  test('職種（複数職種のタレントも含む）', () => {
    assert.deepEqual(ids(filterTalents(talents, { role: 'actor' })), ['a', 'b']);
  });

  test('性別', () => {
    assert.deepEqual(ids(filterTalents(talents, { gender: 'male' })), ['c']);
  });

  test('年齢帯', () => {
    assert.deepEqual(ids(filterTalents(talents, { ageRange: '20代前半' })), ['a', 'c']);
  });

  test('地域：都道府県名で一致、地方名ならその地方の都道府県すべて', () => {
    assert.deepEqual(ids(filterTalents(talents, { area: '東京都' })), ['a']);
    assert.deepEqual(ids(filterTalents(talents, { area: '関東' })), ['a', 'b']);
  });

  test('スキルは複数指定で AND（すべて持つ人だけ）。1つなら文字列でもよい', () => {
    assert.deepEqual(ids(filterTalents(talents, { skills: ['英語', 'ダンス'] })), ['a']);
    assert.deepEqual(ids(filterTalents(talents, { skills: 'ダンス' })), ['a', 'c']);
  });

  test('キーワード：名前・自己紹介・スキル・ジャンル・実績を対象に、全角半角・大小文字を区別しない', () => {
    assert.deepEqual(ids(filterTalents(talents, { keyword: 'みなみ' })), ['a']);
    assert.deepEqual(ids(filterTalents(talents, { keyword: 'mv' })), ['b', 'c']);
    assert.deepEqual(ids(filterTalents(talents, { keyword: '夜明け' })), ['a']);
    assert.deepEqual(ids(filterTalents(talents, { keyword: 'アクション' })), ['c']);
  });

  test('キーワードは空白区切りで AND', () => {
    assert.deepEqual(ids(filterTalents(talents, { keyword: '英語　笑顔' })), ['a']);
  });

  test('動画ありのみ（クエリ由来の "1" / "true" も受け付ける）', () => {
    assert.deepEqual(ids(filterTalents(talents, { videoOnly: true })), ['a']);
    assert.deepEqual(ids(filterTalents(talents, { videoOnly: '1' })), ['a']);
    assert.deepEqual(ids(filterTalents(talents, { videoOnly: 'true' })), ['a']);
  });

  test('組み合わせ', () => {
    assert.deepEqual(ids(filterTalents(talents, { role: 'actor', area: '関東', skills: ['英語'] })), ['a', 'b']);
    assert.deepEqual(ids(filterTalents(talents, { role: 'actor', gender: 'female', videoOnly: true })), ['a']);
  });

  test('一致しなければ0件（空配列）', () => {
    assert.deepEqual(filterTalents(talents, { role: 'voice' }), []);
    assert.deepEqual(filterTalents(talents, { area: '北海道' }), []);
  });

  test('配列以外・壊れた要素でも落ちない', () => {
    assert.deepEqual(filterTalents(null, { role: 'actor' }), []);
    assert.deepEqual(ids(filterTalents([null, { id: 'x' }], {})), ['x']);
    assert.deepEqual(filterTalents([{ id: 'x' }], { role: 'actor', keyword: 'a' }), []);
  });

  test('元の配列を書き換えない', () => {
    const list = [...talents];
    filterTalents(list, { role: 'actor' });
    assert.deepEqual(ids(list), ['a', 'b', 'c']);
  });

  test('架空データ全件にも使える', () => {
    assert.equal(filterTalents(TALENTS).length, TALENTS.length);
    assert.equal(filterTalents(TALENTS, { videoOnly: true }).length, TALENTS.filter((talent) => talent.introVideo).length);
  });
});

const jobs = Object.freeze([
  { id: 'j1', title: 'A', genre: 'CM', requiredRoles: ['actor'], ageRanges: ['20代前半'], area: '東京都',
    reward: { min: 30000, max: 50000, unit: '日' }, requiredSkills: [], deadline: '2026-11-20', status: 'open', createdAt: '2026-10-01T09:00:00+09:00' },
  { id: 'j2', title: 'B', genre: 'MV', requiredRoles: ['dancer', 'actor'], ageRanges: ['20代前半'], area: '大阪府',
    reward: { min: 10000, max: 20000, unit: '日' }, requiredSkills: ['ダンス'], deadline: '2026-11-10', status: 'open', createdAt: '2026-10-15T09:00:00+09:00' },
  { id: 'j3', title: 'C', genre: 'CM', requiredRoles: ['model'], ageRanges: ['20代後半'], area: '神奈川県',
    reward: { min: 80000, max: 100000, unit: '案件' }, requiredSkills: ['英語'], videoPreferred: true, deadline: '2026-12-01', status: 'open', createdAt: '2026-10-20T09:00:00+09:00' },
  { id: 'j4', title: 'D', genre: '舞台', requiredRoles: ['actor'], ageRanges: ['20代前半'], area: '東京都',
    reward: { min: 5000, max: 5000, unit: '日' }, requiredSkills: [], deadline: '2026-10-30', status: 'open', createdAt: '2026-09-01T09:00:00+09:00' },
  { id: 'j5', title: 'E', genre: 'CM', requiredRoles: ['actor'], ageRanges: ['20代前半'], area: '東京都',
    reward: { min: 40000, max: 40000, unit: '日' }, requiredSkills: [], deadline: '2026-11-05', status: 'closed', createdAt: '2026-10-10T09:00:00+09:00' },
]);
// 締切判定を固定するため「今日」を渡す（j4 は締切切れ、j5 は募集終了）
const NOW = new Date(2026, 10, 2, 12, 0);

describe('filterJobs', () => {
  test('条件なしなら全件', () => {
    assert.deepEqual(ids(filterJobs(jobs)), ['j1', 'j2', 'j3', 'j4', 'j5']);
    assert.deepEqual(ids(filterJobs(jobs, { role: '', genre: '', area: '', minReward: '' })), ['j1', 'j2', 'j3', 'j4', 'j5']);
  });

  test('職種', () => {
    assert.deepEqual(ids(filterJobs(jobs, { role: 'dancer' })), ['j2']);
  });

  test('ジャンル', () => {
    assert.deepEqual(ids(filterJobs(jobs, { genre: 'CM' })), ['j1', 'j3', 'j5']);
  });

  test('地域：都道府県・地方', () => {
    assert.deepEqual(ids(filterJobs(jobs, { area: '大阪府' })), ['j2']);
    assert.deepEqual(ids(filterJobs(jobs, { area: '関東' })), ['j1', 'j3', 'j4', 'j5']);
  });

  test('報酬下限：報酬の上限額が指定額以上の案件（クエリ由来の文字列も可）', () => {
    assert.deepEqual(ids(filterJobs(jobs, { minReward: 40000 })), ['j1', 'j3', 'j5']);
    assert.deepEqual(ids(filterJobs(jobs, { minReward: '50000' })), ['j1', 'j3']);
    assert.deepEqual(ids(filterJobs(jobs, { minReward: 'abc' })), ['j1', 'j2', 'j3', 'j4', 'j5'], '数値でなければ条件なし');
  });

  test('組み合わせ', () => {
    assert.deepEqual(ids(filterJobs(jobs, { role: 'actor', genre: 'CM', minReward: 45000 })), ['j1']);
  });

  test('一致しなければ0件', () => {
    assert.deepEqual(filterJobs(jobs, { genre: '映画' }), []);
    assert.deepEqual(filterJobs(jobs, { minReward: 1000000 }), []);
  });

  test('配列以外でも落ちない', () => {
    assert.deepEqual(filterJobs(undefined, {}), []);
  });
});

describe('isJobOpen', () => {
  test('締切当日までは募集中、締切切れ・closed は募集終了', () => {
    assert.equal(isJobOpen(jobs[0], NOW), true);
    assert.equal(isJobOpen({ ...jobs[0], deadline: '2026-11-02' }, NOW), true);
    assert.equal(isJobOpen(jobs[3], NOW), false);
    assert.equal(isJobOpen(jobs[4], NOW), false);
    assert.equal(isJobOpen(null, NOW), false);
  });
});

describe('sortJobs', () => {
  test('並び替えの種類は 締切が近い順／新着順／マッチ度順', () => {
    assert.deepEqual({ ...JOB_SORT_KEYS }, { deadline: 'deadline', newest: 'newest', match: 'match' });
  });

  test('締切が近い順：募集中を締切の早い順に並べ、締切切れ・募集終了は後ろに回す', () => {
    assert.deepEqual(ids(sortJobs(jobs, 'deadline', { now: NOW })), ['j2', 'j1', 'j3', 'j4', 'j5']);
  });

  test('新着順：createdAt の新しい順', () => {
    assert.deepEqual(ids(sortJobs(jobs, 'newest')), ['j3', 'j2', 'j5', 'j1', 'j4']);
  });

  test('新着順：createdAt が無い案件は最後', () => {
    const list = [{ id: 'x' }, jobs[0], jobs[2]];
    assert.deepEqual(ids(sortJobs(list, 'newest')), ['j3', 'j1', 'x']);
  });

  test('マッチ度順：calcMatchScore の高い順、同点は締切が近い順', () => {
    // スコア：j1=95 / j5=95（募集終了）/ j4=85 / j2=60 / j3=28
    const talent = { roles: ['actor'], gender: 'female', ageRange: '20代前半', area: '東京都', skills: [], genres: ['CM'] };
    assert.deepEqual(ids(sortJobs(jobs, 'match', { talent, now: NOW })), ['j1', 'j5', 'j4', 'j2', 'j3']);
  });

  test('マッチ度順でタレントが無ければ締切が近い順にする（ゲスト・企業ロール向け）', () => {
    assert.deepEqual(ids(sortJobs(jobs, 'match', { now: NOW })), ids(sortJobs(jobs, 'deadline', { now: NOW })));
  });

  test('未知の並び替えキーは元の順', () => {
    assert.deepEqual(ids(sortJobs(jobs, 'unknown')), ['j1', 'j2', 'j3', 'j4', 'j5']);
  });

  test('元の配列を書き換えない', () => {
    const list = [...jobs];
    sortJobs(list, 'newest');
    assert.deepEqual(ids(list), ['j1', 'j2', 'j3', 'j4', 'j5']);
  });

  test('架空データ全件で3種とも件数が変わらない', () => {
    for (const key of Object.values(JOB_SORT_KEYS)) {
      assert.equal(sortJobs(JOBS, key, { talent: TALENTS[0] }).length, JOBS.length, key);
    }
  });
});
