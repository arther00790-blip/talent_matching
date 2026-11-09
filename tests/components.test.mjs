// #02 共通UIコンポーネントのテスト
// jsdom 等を使わずに検証できるよう、描画は「エスケープ済み HTML 文字列を返す純粋関数」を対象にする。
// DOM を触る部分（トースト・ダイアログ・シートの開閉）は docs/components.html で目視確認する。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { talentCardHTML, renderTalentCard } from '../js/components/talent-card.js';
import { jobCardHTML, renderJobCard } from '../js/components/job-card.js';
import { emptyStateHTML, renderEmptyState } from '../js/components/empty-state.js';
import { skeletonHTML, renderSkeleton, DEFAULT_SKELETON_COUNT, MAX_SKELETON_COUNT } from '../js/components/skeleton.js';
import { statusBadgeHTML, toSafeHref } from '../js/components/html-parts.js';
import { showToast, resolveToastOptions, TOAST_DURATION_MS, TOAST_TYPES } from '../js/components/toast.js';
import { openModal, resolveModalOptions } from '../js/components/modal.js';
import { createBottomSheet, BOTTOM_SHEET_DESKTOP_QUERY } from '../js/components/bottom-sheet.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS_CSS = join(ROOT, 'css', 'components.css');
const COMPONENTS_JS_DIR = join(ROOT, 'js', 'components');
const DOCS_HTML = join(ROOT, 'docs', 'components.html');
const DOCS_JS = join(ROOT, 'docs', 'components.js');

// #01 のテストと同じ判定にそろえる（基準が2つあると、片方だけ通る状態が生まれるため）
const RAW_COLOR_PATTERN = /#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(/;

const read = (path) => readFileSync(path, 'utf8');
const countOf = (text, needle) => text.split(needle).length - 1;

/** 4.4 の Talent 型に合わせた最小のサンプル */
function makeTalent(overrides = {}) {
  return {
    id: 't001',
    displayName: '春風 みなみ',
    roles: ['actor'],
    gender: 'female',
    ageRange: '20代前半',
    area: '東京都',
    skills: ['殺陣', '英語'],
    genres: ['CM'],
    bio: '',
    career: [],
    images: [],
    isFeatured: false,
    ...overrides,
  };
}

/** 4.4 の Job 型に合わせた最小のサンプル */
function makeJob(overrides = {}) {
  return {
    id: 'j001',
    companyId: 'c001',
    title: '飲料CMの出演者募集',
    genre: 'CM',
    requiredRoles: ['actor'],
    ageRanges: ['20代前半'],
    area: '東京都',
    shootDates: '2026年11月中旬（2日間）',
    reward: { min: 30000, max: 50000, unit: '日' },
    requiredSkills: [],
    description: '',
    deadline: '2026-11-30',
    status: 'open',
    ...overrides,
  };
}

describe('タレントカード', () => {
  test('<script> を含む名前を渡しても、タグとして解釈されない', () => {
    const html = talentCardHTML(makeTalent({ displayName: '<script>alert(1)</script>' }));
    assert.ok(!html.includes('<script'), 'script タグがそのまま出力されています');
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  });

  test('スキル・地域・画像パスもエスケープされる', () => {
    const html = talentCardHTML(makeTalent({
      skills: ['<img src=x onerror=alert(1)>'],
      area: '"><b>',
      images: ['a.jpg" onerror="alert(1)'],
    }));
    assert.ok(!html.includes('<img src=x'));
    assert.ok(!html.includes('"><b>'));
    assert.ok(!html.includes('" onerror="'));
  });

  test('introVideo があるときだけ「動画あり」バッジが出る', () => {
    const withVideo = talentCardHTML(makeTalent({
      introVideo: { src: 'assets/videos/t001.mp4', poster: 'assets/images/t001.jpg', duration: 20 },
    }));
    const withoutVideo = talentCardHTML(makeTalent());
    assert.ok(withVideo.includes('動画あり'));
    assert.ok(withVideo.includes('badge--video'));
    assert.ok(!withoutVideo.includes('動画あり'));
    assert.ok(!withoutVideo.includes('badge--video'));
  });

  test('詳細ページへのリンクは id を URL エンコードする', () => {
    const html = talentCardHTML(makeTalent({ id: 't"1&x' }));
    assert.ok(html.includes('href="talent.html?id=t%221%26x"'));
  });

  test('画像が無いときはプレースホルダー、あるときは代替テキスト付きの img', () => {
    assert.ok(talentCardHTML(makeTalent()).includes('talent-card__placeholder'));
    const html = talentCardHTML(makeTalent({ images: ['assets/images/t001.jpg'] }));
    assert.match(html, /<img[^>]+alt="春風 みなみさんのプロフィール写真"/);
  });

  test('職種は日本語ラベルで表示する', () => {
    assert.ok(talentCardHTML(makeTalent({ roles: ['actor', 'dancer'] })).includes('俳優・ダンサー'));
  });

  test('不正な引数でも例外を投げず空文字を返す', () => {
    assert.equal(talentCardHTML(null), '');
    assert.equal(talentCardHTML(undefined), '');
  });
});

describe('案件カード', () => {
  test('matchScore 70以上→「相性◎」', () => {
    for (const score of [70, 85, 100]) {
      const html = jobCardHTML(makeJob(), { matchScore: score });
      assert.ok(html.includes('相性◎'), `${score} 点で相性◎が出ていません`);
      assert.ok(html.includes('badge--match-great'));
      assert.ok(!html.includes('相性○'));
    }
  });

  test('matchScore 50〜69→「相性○」', () => {
    for (const score of [50, 69]) {
      const html = jobCardHTML(makeJob(), { matchScore: score });
      assert.ok(html.includes('相性○'), `${score} 点で相性○が出ていません`);
      assert.ok(html.includes('badge--match-good'));
      assert.ok(!html.includes('相性◎'));
    }
  });

  test('matchScore 49以下・未指定→バッジ無し（枠だけ残る）', () => {
    for (const options of [{ matchScore: 49 }, { matchScore: 0 }, {}, undefined]) {
      const html = jobCardHTML(makeJob(), options);
      assert.ok(!html.includes('相性'), `${JSON.stringify(options)} でバッジが出ています`);
      assert.ok(html.includes('job-card__match'), '相性バッジの枠がありません');
    }
  });

  test('タイトル・会社名がエスケープされる', () => {
    const html = jobCardHTML(makeJob({ title: '<script>x</script>' }), { companyName: '"A&B"' });
    assert.ok(!html.includes('<script'));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('&quot;A&amp;B&quot;'));
  });

  test('報酬は円表記、動画歓迎・募集終了はテキストで示す', () => {
    const html = jobCardHTML(makeJob({ videoPreferred: true, status: 'closed' }));
    assert.ok(html.includes('30,000〜50,000円／日'));
    assert.ok(html.includes('動画歓迎'));
    assert.ok(html.includes('募集終了'));
  });

  test('不正な引数でも例外を投げず空文字を返す', () => {
    assert.equal(jobCardHTML(null), '');
  });
});

describe('バッジ・リンクの共通部品', () => {
  test('ステータスは色だけでなくテキストを併記する', () => {
    assert.ok(statusBadgeHTML('applied').includes('応募済'));
    assert.ok(statusBadgeHTML('reviewing').includes('選考中'));
    assert.ok(statusBadgeHTML('accepted').includes('採用'));
    assert.ok(statusBadgeHTML('declined').includes('見送り'));
    assert.equal(statusBadgeHTML('unknown'), '');
  });

  test('javascript: など危険なスキームの URL は # に置き換える', () => {
    assert.equal(toSafeHref('javascript:alert(1)'), '#');
    assert.equal(toSafeHref(' JavaScript:alert(1)'), '#');
    assert.equal(toSafeHref('data:text/html,x'), '#');
    assert.equal(toSafeHref('talents.html?area=東京都'), 'talents.html?area=東京都');
    assert.equal(toSafeHref('#main'), '#main');
    assert.equal(toSafeHref('https://example.com/'), 'https://example.com/');
    assert.equal(toSafeHref(undefined), '#');
  });
});

describe('空状態', () => {
  test('文言をエスケープし、リンク先があればボタン風リンクを出す', () => {
    const html = emptyStateHTML({ message: '<b>0件</b>', actionLabel: '条件をゆるめる', actionHref: 'talents.html' });
    assert.ok(html.includes('&lt;b&gt;0件&lt;/b&gt;'));
    assert.match(html, /<a class="button button--primary" href="talents\.html">条件をゆるめる<\/a>/);
  });

  test('リンク先が無くラベルだけなら button 要素にする（フィルター解除などの操作用）', () => {
    const html = emptyStateHTML({ message: '0件', actionLabel: '条件をゆるめて探す' });
    assert.match(html, /<button type="button"[^>]*data-empty-state-action[^>]*>条件をゆるめて探す<\/button>/);
  });

  test('ラベルが無ければ行動ボタンを出さない', () => {
    const html = emptyStateHTML({ message: '0件' });
    assert.ok(!html.includes('<a '));
    assert.ok(!html.includes('<button'));
  });

  test('危険な href は # に置き換える', () => {
    const html = emptyStateHTML({ message: 'x', actionLabel: 'go', actionHref: 'javascript:alert(1)' });
    assert.ok(!html.includes('javascript:'));
  });
});

describe('スケルトン', () => {
  test('指定した数だけスケルトンカードを出す', () => {
    assert.equal(countOf(skeletonHTML(3), 'class="skeleton-card"'), 3);
  });

  test('不正な数は既定値、上限を超える数は上限に丸める', () => {
    assert.equal(countOf(skeletonHTML(), 'class="skeleton-card"'), DEFAULT_SKELETON_COUNT);
    assert.equal(countOf(skeletonHTML(-1), 'class="skeleton-card"'), DEFAULT_SKELETON_COUNT);
    assert.equal(countOf(skeletonHTML('abc'), 'class="skeleton-card"'), DEFAULT_SKELETON_COUNT);
    assert.equal(countOf(skeletonHTML(MAX_SKELETON_COUNT + 10), 'class="skeleton-card"'), MAX_SKELETON_COUNT);
  });

  test('装飾は読み上げから隠し、読み込み中であることはテキストで伝える', () => {
    const html = skeletonHTML(2);
    assert.ok(html.includes('aria-hidden="true"'));
    assert.ok(html.includes('読み込み中'));
  });
});

describe('トースト', () => {
  test('表示時間は定数で、既定の種類は info', () => {
    assert.equal(typeof TOAST_DURATION_MS, 'number');
    assert.ok(TOAST_DURATION_MS > 0);
    assert.deepEqual(resolveToastOptions(), { type: 'info', duration: TOAST_DURATION_MS });
  });

  test('success / error / info を受け付け、未知の種類は info にする', () => {
    assert.deepEqual([...TOAST_TYPES].sort(), ['error', 'info', 'success']);
    assert.equal(resolveToastOptions({ type: 'success' }).type, 'success');
    assert.equal(resolveToastOptions({ type: 'error' }).type, 'error');
    assert.equal(resolveToastOptions({ type: 'warning' }).type, 'info');
  });

  test('表示時間に不正な値を渡すと既定値にする', () => {
    assert.equal(resolveToastOptions({ duration: -5 }).duration, TOAST_DURATION_MS);
    assert.equal(resolveToastOptions({ duration: 'x' }).duration, TOAST_DURATION_MS);
    assert.equal(resolveToastOptions({ duration: 1000 }).duration, 1000);
  });
});

describe('ダイアログ・ボトムシート', () => {
  test('ダイアログのボタン文言には既定値がある', () => {
    const options = resolveModalOptions({ title: '応募の確認' });
    assert.equal(options.title, '応募の確認');
    assert.equal(options.confirmLabel, 'OK');
    assert.equal(options.cancelLabel, 'キャンセル');
    assert.equal(resolveModalOptions().title, '');
  });

  test('ボトムシートの切替幅は 640px（variables.css のブレークポイント sm）', () => {
    assert.equal(BOTTOM_SHEET_DESKTOP_QUERY, '(min-width: 640px)');
  });
});

describe('DOM が無い環境でも画面を壊さない', () => {
  // ブラウザ以外（Node）や要素の取り違えで呼ばれても、例外で後続処理を止めないことを確認する
  test('DOM 依存の関数は例外を投げず null を返す', () => {
    assert.equal(showToast('保存しました'), null);
    assert.equal(openModal({ title: 'x' }), null);
    assert.equal(createBottomSheet(null, null), null);
    assert.equal(renderTalentCard(makeTalent()), null);
    assert.equal(renderJobCard(makeJob(), { matchScore: 80 }), null);
    assert.equal(renderEmptyState({ message: '0件' }), null);
    assert.equal(renderSkeleton(3), null);
  });
});

describe('色・命名ルール（components.css / JS / 見本ページ）', () => {
  const jsFiles = existsSync(COMPONENTS_JS_DIR)
    ? readdirSync(COMPONENTS_JS_DIR).filter((n) => n.endsWith('.js')).map((n) => join(COMPONENTS_JS_DIR, n))
    : [];
  const targets = [
    COMPONENTS_CSS,
    ...jsFiles,
    join(ROOT, 'js', 'lib', 'utils.js'),
    join(ROOT, 'js', 'lib', 'matching.js'),
    DOCS_HTML,
    DOCS_JS,
  ];

  test('チケット記載の JS ファイルがそろっている', () => {
    const names = jsFiles.map((f) => relative(COMPONENTS_JS_DIR, f));
    for (const required of ['toast.js', 'modal.js', 'bottom-sheet.js', 'talent-card.js', 'job-card.js', 'empty-state.js', 'skeleton.js']) {
      assert.ok(names.includes(required), `js/components/${required} がありません`);
    }
  });

  test('生の HEX / rgb() / hsl() が無い', () => {
    const offenders = targets.filter((f) => RAW_COLOR_PATTERN.test(read(f))).map((f) => relative(ROOT, f));
    assert.deepEqual(offenders, []);
  });

  test('gray / grey を含む名前が無い', () => {
    const offenders = targets.filter((f) => /gr[ae]y/i.test(read(f))).map((f) => relative(ROOT, f));
    assert.deepEqual(offenders, []);
  });

  test('--palette-* を参照していない', () => {
    const offenders = targets.filter((f) => /--palette-/.test(read(f))).map((f) => relative(ROOT, f));
    assert.deepEqual(offenders, []);
  });

  test('JS で var 宣言を使っていない', () => {
    const offenders = targets.filter((f) => f.endsWith('.js') && /\bvar\s+[A-Za-z_$]/.test(read(f))).map((f) => relative(ROOT, f));
    assert.deepEqual(offenders, []);
  });
});

describe('components.css の構成', () => {
  test('チケット記載のブロックがすべてある', () => {
    const css = read(COMPONENTS_CSS);
    const selectors = [
      '.button', '.button--primary', '.button--secondary', '.button--outline', '.button--ghost', '.button--danger',
      '.button--sm', '.button--lg', '.card', '.badge', '.badge--video', '.badge--match-great', '.badge--match-good',
      '.badge--applied', '.badge--reviewing', '.badge--accepted', '.badge--declined',
      '.form-field', '.form-field__error', '.chip', '.toast', '.dialog', '.bottom-sheet', '.skeleton', '.empty-state',
    ];
    for (const selector of selectors) {
      assert.ok(new RegExp(`\\${selector}[\\s,{:.\\[]`).test(css), `${selector} がありません`);
    }
  });

  test('カードは card 色・大きい角丸・ホバーで影と transform', () => {
    const css = read(COMPONENTS_CSS);
    assert.match(css, /\.card\s*\{[^}]*background-color:\s*var\(--color-card\)/);
    assert.match(css, /\.card\s*\{[^}]*border-radius:\s*var\(--radius-lg\)/);
    assert.match(css, /\.card:hover[^{]*\{[^}]*transform:[^}]*box-shadow:\s*var\(--shadow-md\)/);
  });

  test('secondary / danger ボタンのホバーは専用のホバー色トークンを使う', () => {
    const css = read(COMPONENTS_CSS);
    assert.match(css, /\.button--secondary:hover\s*\{[^}]*background-color:\s*var\(--color-secondary-hover\)/);
    assert.match(css, /\.button--danger:hover\s*\{[^}]*background-color:\s*var\(--color-danger-hover\)/);
  });

  test('部品サイズ・遅いモーションは直書きせずトークンを使う', () => {
    const css = read(COMPONENTS_CSS);
    for (const raw of [/28rem/, /85dvh/, /aspect-ratio:\s*4\s*\/\s*5/, /--duration-normal\)\s*\*/]) {
      assert.doesNotMatch(css, raw, `${raw} が直書きされています`);
    }
    for (const token of ['--toast-max-width', '--dialog-max-width', '--sheet-max-height', '--aspect-portrait', '--duration-slow']) {
      assert.ok(css.includes(`var(${token})`), `${token} が使われていません`);
    }
  });

  test('ダイアログの背面は --color-overlay、エラー文は --color-danger', () => {
    const css = read(COMPONENTS_CSS);
    assert.match(css, /\.dialog::backdrop\s*\{[^}]*var\(--color-overlay\)/);
    assert.match(css, /\.form-field__error\s*\{[^}]*var\(--color-danger\)/);
  });

  test('prefers-reduced-motion でスケルトンの点滅を止める', () => {
    const css = read(COMPONENTS_CSS);
    assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*\.skeleton[\s\S]*animation:\s*none/);
  });

  test('見本ページは reset → variables → base → utilities → components の順で読み込む', () => {
    const html = read(DOCS_HTML).replace(/<!--[\s\S]*?-->/g, '');
    const order = [...html.matchAll(/<link[^>]+href="[^"]*css\/([\w-]+)\.css"/g)].map((m) => m[1]);
    assert.deepEqual(order, ['reset', 'variables', 'base', 'utilities', 'components']);
    assert.match(html, /<script type="module" src="components\.js"><\/script>/);
  });
});
