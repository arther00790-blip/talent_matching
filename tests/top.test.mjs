// #10 トップページのテスト
// jsdom 等を使わずに検証できるよう、DOM に触れない部分（注目タレント・新着案件の抽出、タブのキー操作の計算）と
// index.html の構造（セクション順・見出し・ランドマーク・リンク先・OGP）を対象にする。
// タブの実際のフォーカス移動や横スクロールの見た目はブラウザで確認する。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  selectFeaturedTalents, selectNewJobs, FEATURED_TALENT_LIMIT, NEW_JOB_LIMIT,
} from '../js/pages/top.js';
import { getNextTabIndex, TAB_KEYS } from '../js/components/tabs.js';
import { TALENTS } from '../js/data/talents.js';
import { JOBS } from '../js/data/jobs.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '');
const RAW_COLOR_PATTERN = /#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(/;
// 架空データの基準日（締切切れ判定を実行日に左右されないよう固定する）
const NOW = new Date('2026-11-03T12:00:00+09:00');

const job = (id, createdAt, extra = {}) => ({
  id, companyId: 'c001', title: id, status: 'open', deadline: '2026-12-31', createdAt, ...extra,
});

describe('注目のタレント（selectFeaturedTalents）', () => {
  test('isFeatured が true の人だけを元の順で返す', () => {
    const result = selectFeaturedTalents(TALENTS);
    const expected = TALENTS.filter((talent) => talent.isFeatured === true).map((talent) => talent.id);
    assert.ok(expected.length > 0, '架空データに注目タレントがいません');
    assert.deepEqual(result.map((talent) => talent.id), expected.slice(0, FEATURED_TALENT_LIMIT));
  });

  test('上限を超える場合は FEATURED_TALENT_LIMIT 件までにする', () => {
    const many = Array.from({ length: FEATURED_TALENT_LIMIT + 3 }, (_, i) => ({ id: `x${i}`, isFeatured: true }));
    assert.equal(selectFeaturedTalents(many).length, FEATURED_TALENT_LIMIT);
  });

  test('"true" などの文字列や不正な要素は注目扱いしない', () => {
    const list = [{ id: 'a', isFeatured: 'true' }, null, 1, { id: 'b', isFeatured: true }];
    assert.deepEqual(selectFeaturedTalents(list).map((talent) => talent.id), ['b']);
  });

  test('配列でなければ空配列（データ不備で画面が落ちないように）', () => {
    assert.deepEqual(selectFeaturedTalents(undefined), []);
    assert.deepEqual(selectFeaturedTalents({}), []);
  });
});

describe('新着案件（selectNewJobs）', () => {
  test('上限は要件 3.2 の「4〜6件」に収まる', () => {
    assert.ok(NEW_JOB_LIMIT >= 4 && NEW_JOB_LIMIT <= 6);
  });

  test('架空データから募集中の案件を新着順に NEW_JOB_LIMIT 件返す', () => {
    const result = selectNewJobs(JOBS, [], { now: NOW });
    assert.equal(result.length, NEW_JOB_LIMIT);
    for (let i = 1; i < result.length; i += 1) {
      assert.ok(Date.parse(result[i - 1].createdAt) >= Date.parse(result[i].createdAt), '新着順になっていません');
    }
    assert.ok(result.every((item) => item.status === 'open' && item.deadline >= '2026-11-03'));
  });

  test('募集終了・締切切れの案件は含めない', () => {
    const list = [
      job('closed', '2026-11-02T10:00:00+09:00', { status: 'closed' }),
      job('expired', '2026-11-02T09:00:00+09:00', { deadline: '2026-11-01' }),
      job('open', '2026-10-01T10:00:00+09:00'),
    ];
    assert.deepEqual(selectNewJobs(list, [], { now: NOW }).map((item) => item.id), ['open']);
  });

  test('デモで追加した案件（stagelink:jobs:added）も新着として先頭に並ぶ', () => {
    const added = [job('job-demo', '2026-11-03T09:00:00+09:00')];
    const result = selectNewJobs(JOBS, added, { now: NOW });
    assert.equal(result[0].id, 'job-demo');
    assert.equal(result.length, NEW_JOB_LIMIT);
  });

  test('追加案件が架空データと同じ id なら架空データを優先する（mergeJobs の方針と同じ）', () => {
    const fake = { ...JOBS[0], title: '上書き', createdAt: '2026-11-03T11:00:00+09:00' };
    const result = selectNewJobs(JOBS, [fake], { now: NOW });
    assert.ok(result.every((item) => item.title !== '上書き'));
  });

  test('件数が上限より少なければあるだけ返す', () => {
    const list = [job('a', '2026-10-01T10:00:00+09:00'), job('b', '2026-10-02T10:00:00+09:00')];
    assert.deepEqual(selectNewJobs(list, [], { now: NOW }).map((item) => item.id), ['b', 'a']);
  });

  test('保存値が壊れていても例外を出さない', () => {
    assert.deepEqual(selectNewJobs(null, 'broken', { now: NOW }), []);
    assert.equal(selectNewJobs(JOBS, { not: 'array' }, { now: NOW }).length, NEW_JOB_LIMIT);
  });

  test('元の配列を書き換えない', () => {
    const list = [job('a', '2026-10-01T10:00:00+09:00'), job('b', '2026-10-02T10:00:00+09:00')];
    const copy = list.map((item) => item.id);
    selectNewJobs(list, [], { now: NOW });
    assert.deepEqual(list.map((item) => item.id), copy);
  });
});

describe('タブのキー操作（getNextTabIndex）', () => {
  test('→ は次のタブ、最後なら先頭に戻る', () => {
    assert.equal(getNextTabIndex(TAB_KEYS.next, 0, 2), 1);
    assert.equal(getNextTabIndex(TAB_KEYS.next, 1, 2), 0);
  });

  test('← は前のタブ、先頭なら最後へ回る', () => {
    assert.equal(getNextTabIndex(TAB_KEYS.previous, 1, 3), 0);
    assert.equal(getNextTabIndex(TAB_KEYS.previous, 0, 3), 2);
  });

  test('Home は先頭、End は最後', () => {
    assert.equal(getNextTabIndex(TAB_KEYS.first, 2, 3), 0);
    assert.equal(getNextTabIndex(TAB_KEYS.last, 0, 3), 2);
  });

  test('対象外のキー（Tab・Enter・↑↓）は null を返し、既定の動作を妨げない', () => {
    for (const key of ['Tab', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'a']) {
      assert.equal(getNextTabIndex(key, 0, 2), null, key);
    }
  });

  test('タブ数や現在位置が不正なら null', () => {
    assert.equal(getNextTabIndex(TAB_KEYS.next, 0, 0), null);
    assert.equal(getNextTabIndex(TAB_KEYS.next, -1, 2), null);
    assert.equal(getNextTabIndex(TAB_KEYS.next, 5, 2), null);
    assert.equal(getNextTabIndex(TAB_KEYS.next, 0.5, 2), null);
  });
});

describe('index.html の構造', () => {
  const html = stripComments(read('index.html'));
  const main = html.split(/<main[^>]*>/)[1]?.split('</main>')[0] ?? '';

  test('h1 は1つだけ', () => {
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
  });

  test('要件 3.2 の7セクションがこの順で並び、それぞれ見出しで名前が付いている', () => {
    const order = ['hero', 'features', 'featured-talents', 'new-jobs', 'steps', 'voices', 'contact-cta'];
    const found = [...main.matchAll(/<section[^>]*data-top-section="([\w-]+)"[^>]*>/g)];
    assert.deepEqual(found.map((match) => match[1]), order);
    for (const [tag] of found) assert.match(tag, /aria-labelledby="[\w-]+"/, tag);
  });

  test('ヒーローに「タレントとして登録」「案件を探す」の2つの CTA がある', () => {
    assert.match(main, /<a[^>]+href="contact\.html\?category=talent-registration"[^>]*>タレントとして登録<\/a>/);
    assert.match(main, /<a[^>]+href="jobs\.html"[^>]*>案件を探す<\/a>/);
  });

  test('サービスの特徴に「動画で伝わる」があり、SVG アイコンは装飾として読み上げから外す', () => {
    assert.match(main, /動画で伝わる/);
    const svgs = [...main.matchAll(/<svg[^>]*>/g)].map((match) => match[0]);
    assert.ok(svgs.length >= 3, 'アイコンが3つ以上ありません');
    for (const svg of svgs) {
      assert.match(svg, /aria-hidden="true"/, svg);
      assert.match(svg, /focusable="false"/, svg);
    }
    assert.doesNotMatch(main, RAW_COLOR_PATTERN, 'SVG に色を直書きせず currentColor を使う');
  });

  test('注目のタレントの横スクロール領域は、キーボードで届くラベル付き region', () => {
    assert.match(main, /<div[^>]+role="region"[^>]+aria-label="[^"]+"[^>]+tabindex="0"[^>]*data-featured-talents/);
  });

  test('利用ステップは WAI-ARIA Tabs の構造（tablist / tab / tabpanel）', () => {
    assert.match(main, /role="tablist"/);
    const tabs = [...main.matchAll(/<button[^>]+role="tab"[^>]*>/g)].map((match) => match[0]);
    assert.equal(tabs.length, 2);
    for (const tab of tabs) {
      const controls = tab.match(/aria-controls="([\w-]+)"/)?.[1];
      assert.ok(controls, tab);
      assert.match(main, new RegExp(`id="${controls}"[^>]*role="tabpanel"|role="tabpanel"[^>]*id="${controls}"`));
    }
    assert.equal((main.match(/aria-selected="true"/g) ?? []).length, 1);
  });

  test('利用者の声は「※サンプルです」と明示する', () => {
    assert.match(main, /※サンプルです/);
  });

  test('ページ内のリンク先ファイルがすべて存在する', () => {
    const hrefs = [...main.matchAll(/href="([^"#?]+)/g)].map((match) => match[1]);
    assert.ok(hrefs.length > 0);
    for (const href of hrefs) assert.ok(existsSync(join(ROOT, href)), `${href} がありません`);
  });

  test('meta description を維持したまま OGP を持つ', () => {
    assert.match(html, /<meta name="description" content="[^"]+">/);
    for (const property of ['og:title', 'og:description', 'og:type', 'og:site_name', 'og:locale']) {
      assert.match(html, new RegExp(`<meta property="${property}" content="[^"]+">`), property);
    }
  });

  test('ページ固有の CSS と JS を読み込む', () => {
    assert.match(html, /<link rel="stylesheet" href="css\/pages\/top\.css">/);
    assert.match(html, /<script type="module" src="js\/pages\/top\.js"><\/script>/);
  });
});

describe('top.css', () => {
  const css = read('css/pages/top.css');

  test('生の色値を使わない', () => {
    assert.doesNotMatch(css, RAW_COLOR_PATTERN);
    assert.doesNotMatch(css, /--palette-/);
  });

  test('横スクロールはスクロールスナップで止まり、動きを減らす設定に配慮する', () => {
    assert.match(css, /scroll-snap-type:\s*x/);
    assert.match(css, /prefers-reduced-motion/);
  });
});
