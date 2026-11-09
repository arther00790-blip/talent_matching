// js/lib/matching.js のテスト（getMatchLabel は #02、calcMatchScore は #04 で追加）
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMatchLabel, calcMatchScore, MATCH_POINTS, MATCH_SCORE_MAX, MATCH_GREAT_MIN, MATCH_GOOD_MIN,
} from '../js/lib/matching.js';
import { TALENTS } from '../js/data/talents.js';
import { JOBS } from '../js/data/jobs.js';

// 全項目が一致するタレントと案件
const fullTalent = () => ({
  roles: ['actor'],
  ageRange: '20代前半',
  gender: 'female',
  area: '東京都',
  skills: ['英語', 'ダンス', '殺陣'],
  genres: ['CM', '舞台'],
  introVideo: { src: 'assets/videos/x.mp4', poster: 'x.jpg', duration: 30 },
});
const fullJob = () => ({
  requiredRoles: ['actor', 'model'],
  ageRanges: ['20代前半', '20代後半'],
  gender: 'female',
  area: '東京都',
  requiredSkills: ['英語', 'ダンス'],
  genre: 'CM',
});

// どの項目も一致しない組み合わせ（ここから1項目ずつ一致させて配点を確かめる）
const zeroTalent = () => ({
  roles: ['voice'],
  ageRange: '50代以上',
  gender: 'male',
  area: '沖縄県',
  skills: [],
  genres: ['舞台'],
});
const zeroJob = () => ({
  requiredRoles: ['actor'],
  ageRanges: ['20代前半'],
  gender: 'female',
  area: '東京都',
  requiredSkills: ['英語', 'ダンス'],
  genre: 'CM',
});

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('calcMatchScore（要件 6.4）', () => {
  test('配点は 6.4 の表どおりで、合計が上限 100', () => {
    assert.deepEqual({ ...MATCH_POINTS }, {
      role: 30, ageRange: 20, gender: 10, sameArea: 15, sameRegion: 8, skills: 10, genre: 10, video: 5, videoPreferredBonus: 5,
    });
    const { role, ageRange, gender, sameArea, skills, genre, video } = MATCH_POINTS;
    assert.equal(role + ageRange + gender + sameArea + skills + genre + video, MATCH_SCORE_MAX);
    assert.equal(MATCH_SCORE_MAX, 100);
  });

  test('全項目一致で100点', () => {
    assert.equal(calcMatchScore(fullTalent(), fullJob()), 100);
  });

  test('一致なしで0点', () => {
    assert.equal(calcMatchScore(zeroTalent(), zeroJob()), 0);
  });

  test('職種のみ一致で30点', () => {
    assert.equal(calcMatchScore({ ...zeroTalent(), roles: ['voice', 'actor'] }, zeroJob()), 30);
  });

  test('年齢帯のみ一致で20点', () => {
    assert.equal(calcMatchScore({ ...zeroTalent(), ageRange: '20代前半' }, zeroJob()), 20);
  });

  test('性別：一致で10点、案件が指定なしでも10点', () => {
    assert.equal(calcMatchScore({ ...zeroTalent(), gender: 'female' }, zeroJob()), 10);
    const jobWithoutGender = zeroJob();
    delete jobWithoutGender.gender;
    assert.equal(calcMatchScore(zeroTalent(), jobWithoutGender), 10);
  });

  test('地域：同一都道府県で15点、同一地方で8点', () => {
    assert.equal(calcMatchScore({ ...zeroTalent(), area: '東京都' }, zeroJob()), 15);
    assert.equal(calcMatchScore({ ...zeroTalent(), area: '神奈川県' }, zeroJob()), 8);
  });

  test('スキル：必須スキルの一致割合 × 10', () => {
    assert.equal(calcMatchScore({ ...zeroTalent(), skills: ['英語'] }, zeroJob()), 5);
    assert.equal(calcMatchScore({ ...zeroTalent(), skills: ['ダンス', '英語'] }, zeroJob()), 10);
  });

  test('スキル：必須スキルが無い案件は満点（求める条件を満たしているため）', () => {
    assert.equal(calcMatchScore(zeroTalent(), { ...zeroJob(), requiredSkills: [] }), 10);
  });

  test('スキル：端数が出ても合計は整数に丸める', () => {
    const job = { ...zeroJob(), requiredSkills: ['英語', 'ダンス', '殺陣'] };
    assert.equal(calcMatchScore({ ...zeroTalent(), skills: ['英語'] }, job), 3);
    assert.equal(calcMatchScore({ ...zeroTalent(), skills: ['英語', 'ダンス'] }, job), 7);
  });

  test('ジャンル経験で10点', () => {
    assert.equal(calcMatchScore({ ...zeroTalent(), genres: ['CM'] }, zeroJob()), 10);
  });

  test('自己紹介動画ありで5点、videoPreferred の案件ではさらに＋5点', () => {
    const talent = { ...zeroTalent(), introVideo: fullTalent().introVideo };
    assert.equal(calcMatchScore(talent, zeroJob()), 5);
    assert.equal(calcMatchScore(talent, { ...zeroJob(), videoPreferred: true }), 10);
    assert.equal(calcMatchScore(zeroTalent(), { ...zeroJob(), videoPreferred: true }), 0);
  });

  test('videoPreferred ボーナスがあっても100点を超えない', () => {
    assert.equal(calcMatchScore(fullTalent(), { ...fullJob(), videoPreferred: true }), 100);
  });

  test('同じ入力で同じ結果になり、引数を書き換えない', () => {
    const talent = deepFreeze(fullTalent());
    const job = deepFreeze({ ...zeroJob(), videoPreferred: true });
    const first = calcMatchScore(talent, job);
    assert.equal(calcMatchScore(talent, job), first);
    assert.equal(calcMatchScore(talent, job), first);
  });

  test('不正な引数・欠けた項目では落ちずに数値を返す', () => {
    assert.equal(calcMatchScore(null, fullJob()), 0);
    assert.equal(calcMatchScore(fullTalent(), undefined), 0);
    assert.equal(calcMatchScore({}, {}), MATCH_POINTS.gender + MATCH_POINTS.skills);
  });

  test('架空データのすべての組み合わせで 0〜100 の整数になる', () => {
    for (const talent of TALENTS) {
      for (const job of JOBS) {
        const score = calcMatchScore(talent, job);
        assert.ok(Number.isInteger(score) && score >= 0 && score <= 100, `${talent.id} × ${job.id}: ${score}`);
      }
    }
  });
});

describe('getMatchLabel', () => {
  test('しきい値は 70 / 50（要件定義書 6.4）', () => {
    assert.equal(MATCH_GREAT_MIN, 70);
    assert.equal(MATCH_GOOD_MIN, 50);
  });

  test('70 以上は "great"', () => {
    assert.equal(getMatchLabel(70), 'great');
    assert.equal(getMatchLabel(100), 'great');
  });

  test('50〜69 は "good"', () => {
    assert.equal(getMatchLabel(50), 'good');
    assert.equal(getMatchLabel(69), 'good');
    assert.equal(getMatchLabel(69.9), 'good');
  });

  test('49 以下は null', () => {
    assert.equal(getMatchLabel(49), null);
    assert.equal(getMatchLabel(0), null);
  });

  test('数値でない値は null（誤ってバッジを出さない）', () => {
    assert.equal(getMatchLabel(undefined), null);
    assert.equal(getMatchLabel(null), null);
    assert.equal(getMatchLabel(Number.NaN), null);
    assert.equal(getMatchLabel('80'), null);
  });
});
