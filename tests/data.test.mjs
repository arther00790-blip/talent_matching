// #04 架空データ（js/data/*）のテスト
// 件数（要件 4.6）・マスタとの整合・ID の参照整合・個人情報を持たないこと（要件 5.2）を確認する。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import {
  TALENT_ROLES, GENDERS, AGE_RANGES, REGIONS, PREFECTURES, GENRES, SKILL_TAGS,
  CONTACT_CATEGORIES, COMPANY_TYPES, APPLICATION_STATUSES, SCOUT_STATUSES, REWARD_UNITS, JOB_STATUSES,
  getRegionOf,
} from '../js/data/master.js';
import { TALENTS, DEMO_TALENT_ID } from '../js/data/talents.js';
import { JOBS } from '../js/data/jobs.js';
import { COMPANIES, DEMO_COMPANY_ID } from '../js/data/companies.js';
import { SEED_APPLICATIONS, SEED_SCOUTS } from '../js/data/seeds.js';

const PREFECTURE_COUNT = 47;
const REGION_COUNT = 8;
// 生年月日・電話番号・住所は架空データでも持たない（要件 5.2）
const FORBIDDEN_KEYS = ['birthday', 'birthDate', 'dateOfBirth', 'phone', 'tel', 'phoneNumber', 'address'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const values = (list) => list.map((item) => item.value);
const inRange = (count, min, max) => count >= min && count <= max;

function collectKeys(value, keys = new Set()) {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, keys));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

function assertUniqueIds(list) {
  const ids = list.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, `ID が重複しています: ${ids}`);
}

describe('master', () => {
  test('職種・性別は 4.4 の型どおり', () => {
    assert.deepEqual(values(TALENT_ROLES), ['actor', 'model', 'voice', 'dancer', 'other']);
    assert.deepEqual(values(GENDERS), ['female', 'male', 'other', 'unspecified']);
  });

  test('都道府県は47、地方は8つで、すべての都道府県がどこか1つの地方に属する', () => {
    assert.equal(PREFECTURES.length, PREFECTURE_COUNT);
    assert.equal(new Set(PREFECTURES).size, PREFECTURE_COUNT);
    assert.equal(REGIONS.length, REGION_COUNT);
    for (const prefecture of PREFECTURES) assert.ok(getRegionOf(prefecture), prefecture);
  });

  test('getRegionOf は地方名を返し、未知の値は null', () => {
    assert.equal(getRegionOf('東京都'), '関東');
    assert.equal(getRegionOf('神奈川県'), '関東');
    assert.equal(getRegionOf('沖縄県'), '九州・沖縄');
    assert.equal(getRegionOf('架空県'), null);
    assert.equal(getRegionOf(undefined), null);
  });

  test('問い合わせ種別は 2.5 の4種類', () => {
    assert.deepEqual(CONTACT_CATEGORIES.map((item) => item.label),
      ['タレント登録について', '案件掲載について', '取材・提携', 'その他']);
  });

  test('ステータス・報酬単位は 4.4 / 6.3 どおり', () => {
    assert.deepEqual([...APPLICATION_STATUSES], ['applied', 'reviewing', 'accepted', 'declined']);
    assert.deepEqual([...SCOUT_STATUSES], ['sent', 'read', 'replied']);
    assert.deepEqual([...REWARD_UNITS], ['日', '案件']);
    assert.deepEqual([...JOB_STATUSES], ['open', 'closed']);
    assert.deepEqual(values(COMPANY_TYPES), ['advertising', 'video_production', 'other']);
  });

  test('マスタは書き換えられない', () => {
    assert.ok(Object.isFrozen(PREFECTURES));
    assert.ok(Object.isFrozen(GENRES));
    assert.ok(Object.isFrozen(SKILL_TAGS));
    assert.ok(Object.isFrozen(AGE_RANGES));
  });
});

describe('件数（要件 4.6）', () => {
  test('タレント 20〜30件、うち自己紹介動画あり 5〜8件', () => {
    assert.ok(inRange(TALENTS.length, 20, 30), `タレント ${TALENTS.length}件`);
    const withVideo = TALENTS.filter((talent) => talent.introVideo).length;
    assert.ok(inRange(withVideo, 5, 8), `動画あり ${withVideo}件`);
  });

  test('案件 15〜20件、うち videoPreferred が数件（2件以上）', () => {
    assert.ok(inRange(JOBS.length, 15, 20), `案件 ${JOBS.length}件`);
    const preferred = JOBS.filter((job) => job.videoPreferred === true).length;
    assert.ok(preferred >= 2 && preferred < JOBS.length, `videoPreferred ${preferred}件`);
  });

  test('企業 5〜8社', () => {
    assert.ok(inRange(COMPANIES.length, 5, 8), `企業 ${COMPANIES.length}社`);
  });

  test('初期の応募・スカウト 各5〜10件', () => {
    assert.ok(inRange(SEED_APPLICATIONS.length, 5, 10), `応募 ${SEED_APPLICATIONS.length}件`);
    assert.ok(inRange(SEED_SCOUTS.length, 5, 10), `スカウト ${SEED_SCOUTS.length}件`);
  });
});

describe('タレント', () => {
  test('ID が一意で、デモ用タレントが存在する', () => {
    assertUniqueIds(TALENTS);
    assert.ok(TALENTS.some((talent) => talent.id === DEMO_TALENT_ID));
  });

  test('職種・性別・年齢帯・地域・ジャンル・スキルがマスタの値', () => {
    for (const talent of TALENTS) {
      assert.ok(talent.roles.length > 0, talent.id);
      for (const role of talent.roles) assert.ok(values(TALENT_ROLES).includes(role), `${talent.id} ${role}`);
      assert.ok(values(GENDERS).includes(talent.gender), talent.id);
      assert.ok(AGE_RANGES.includes(talent.ageRange), talent.id);
      assert.ok(PREFECTURES.includes(talent.area), talent.id);
      for (const genre of talent.genres) assert.ok(GENRES.includes(genre), `${talent.id} ${genre}`);
      for (const skill of talent.skills) assert.ok(SKILL_TAGS.includes(skill), `${talent.id} ${skill}`);
    }
  });

  test('必須項目の型が 4.4 どおり', () => {
    for (const talent of TALENTS) {
      assert.equal(typeof talent.displayName, 'string', talent.id);
      assert.equal(typeof talent.bio, 'string', talent.id);
      assert.ok(Array.isArray(talent.images), talent.id);
      assert.ok(Array.isArray(talent.career), talent.id);
      assert.equal(typeof talent.isFeatured, 'boolean', talent.id);
      for (const item of talent.career) {
        assert.ok(Number.isInteger(item.year) && typeof item.title === 'string' && typeof item.type === 'string', talent.id);
      }
    }
  });

  test('自己紹介動画は src / poster / duration を持つ', () => {
    for (const talent of TALENTS.filter((item) => item.introVideo)) {
      const { src, poster, duration } = talent.introVideo;
      assert.match(src, /^assets\/videos\/.+\.(mp4|webm)$/, talent.id);
      assert.equal(typeof poster, 'string', talent.id);
      assert.ok(Number.isFinite(duration) && duration > 0, talent.id);
    }
  });

  // 素材が無いと詳細ページで404・コンソールエラーになるため、参照先の実在を保証する
  test('自己紹介動画の src / poster のファイルが assets/ に実在する', () => {
    for (const talent of TALENTS.filter((item) => item.introVideo)) {
      const { src, poster } = talent.introVideo;
      for (const relPath of [src, poster].filter(Boolean)) {
        assert.ok(existsSync(new URL(`../${relPath}`, import.meta.url)), `${talent.id}: ${relPath}`);
      }
    }
  });

  test('職種・地域・年齢帯がばらけている', () => {
    const distinct = (key) => new Set(TALENTS.map((talent) => talent[key])).size;
    assert.equal(new Set(TALENTS.flatMap((talent) => talent.roles)).size, TALENT_ROLES.length);
    assert.ok(distinct('area') >= 10);
    assert.ok(distinct('ageRange') >= 5);
  });
});

describe('案件・企業', () => {
  test('ID が一意', () => {
    assertUniqueIds(JOBS);
    assertUniqueIds(COMPANIES);
  });

  test('案件の値がマスタ・型どおりで、企業IDが実在する', () => {
    const companyIds = COMPANIES.map((company) => company.id);
    for (const job of JOBS) {
      assert.ok(companyIds.includes(job.companyId), job.id);
      assert.ok(GENRES.includes(job.genre), job.id);
      assert.ok(job.requiredRoles.length > 0, job.id);
      for (const role of job.requiredRoles) assert.ok(values(TALENT_ROLES).includes(role), job.id);
      if (job.gender !== undefined) assert.ok(values(GENDERS).includes(job.gender), job.id);
      for (const age of job.ageRanges) assert.ok(AGE_RANGES.includes(age), job.id);
      assert.ok(PREFECTURES.includes(job.area), job.id);
      for (const skill of job.requiredSkills) assert.ok(SKILL_TAGS.includes(skill), job.id);
      assert.ok(job.reward.min <= job.reward.max && REWARD_UNITS.includes(job.reward.unit), job.id);
      assert.match(job.deadline, ISO_DATE, job.id);
      assert.ok(JOB_STATUSES.includes(job.status), job.id);
      assert.ok(!Number.isNaN(Date.parse(job.createdAt)), job.id);
    }
  });

  test('企業の種別がマスタの値で、デモ用企業が存在する', () => {
    for (const company of COMPANIES) assert.ok(values(COMPANY_TYPES).includes(company.type), company.id);
    assert.ok(COMPANIES.some((company) => company.id === DEMO_COMPANY_ID));
  });
});

describe('初期の応募・スカウト', () => {
  const talentIds = TALENTS.map((talent) => talent.id);
  const jobIds = JOBS.map((job) => job.id);
  const companyIds = COMPANIES.map((company) => company.id);

  test('応募は実在の案件・タレントを指し、ステータスが 6.3 の値', () => {
    assertUniqueIds(SEED_APPLICATIONS);
    for (const application of SEED_APPLICATIONS) {
      assert.ok(jobIds.includes(application.jobId), application.id);
      assert.ok(talentIds.includes(application.talentId), application.id);
      assert.ok(APPLICATION_STATUSES.includes(application.status), application.id);
      assert.ok(!Number.isNaN(Date.parse(application.createdAt)), application.id);
    }
  });

  test('同じタレントが同じ案件に重複応募していない', () => {
    const pairs = SEED_APPLICATIONS.map((item) => `${item.talentId}:${item.jobId}`);
    assert.equal(new Set(pairs).size, pairs.length);
  });

  test('スカウトは実在の企業・タレント（・案件）を指し、ステータスが 6.3 の値', () => {
    assertUniqueIds(SEED_SCOUTS);
    for (const scout of SEED_SCOUTS) {
      assert.ok(companyIds.includes(scout.companyId), scout.id);
      assert.ok(talentIds.includes(scout.talentId), scout.id);
      if (scout.jobId !== undefined) assert.ok(jobIds.includes(scout.jobId), scout.id);
      assert.ok(SCOUT_STATUSES.includes(scout.status), scout.id);
      assert.ok(!Number.isNaN(Date.parse(scout.createdAt)), scout.id);
    }
  });

  test('デモ用タレント本人にも応募・スカウトがあり、マイページが空にならない', () => {
    assert.ok(SEED_APPLICATIONS.some((item) => item.talentId === DEMO_TALENT_ID));
    assert.ok(SEED_SCOUTS.some((item) => item.talentId === DEMO_TALENT_ID));
  });
});

describe('個人情報・書き換え防止', () => {
  test('電話番号・住所・生年月日を持たない', () => {
    const keys = collectKeys([TALENTS, JOBS, COMPANIES, SEED_APPLICATIONS, SEED_SCOUTS]);
    for (const key of FORBIDDEN_KEYS) assert.ok(!keys.has(key), key);
  });

  test('架空データは凍結されていて、画面側の操作で元データが壊れない', () => {
    for (const list of [TALENTS, JOBS, COMPANIES, SEED_APPLICATIONS, SEED_SCOUTS]) {
      assert.ok(Object.isFrozen(list));
      assert.ok(Object.isFrozen(list[0]));
    }
  });
});
