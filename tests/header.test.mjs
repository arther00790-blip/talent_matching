// #03 ページレイアウトのテスト
// ヘッダー・フッター・サイドバーは「エスケープ済み HTML 文字列を返す純粋関数」を対象にし、
// DOM を触る部分（メニュー開閉・ロール切替時の再描画）は Live Server で目視確認する。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { headerHTML, getNavItems, getCurrentPage } from '../js/components/header.js';
import { footerHTML, DEMO_NOTICE } from '../js/components/footer.js';
import { sidebarHTML } from '../js/components/sidebar.js';
import { normalizeRole, ROLES, DEFAULT_ROLE } from '../js/lib/storage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAYOUTS_DIR = join(ROOT, 'css', 'layouts');

// #01 / #02 のテストと同じ判定にそろえる
const RAW_COLOR_PATTERN = /#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(/;

// チケット #03「ページとレイアウトの対応」表そのもの
const PAGE_LAYOUTS = Object.freeze({
  'index.html': null,
  'talents.html': 'list',
  'jobs.html': 'list',
  'talent.html': 'detail',
  'job.html': 'detail',
  'profile-edit.html': 'form',
  'job-new.html': 'form',
  'contact.html': 'form',
  'contact-confirm.html': 'form',
  'contact-complete.html': 'form',
  'mypage.html': 'dashboard',
  'about.html': 'static',
  'faq.html': 'static',
  'terms.html': 'static',
  'privacy.html': 'static',
  '404.html': 'static',
});
const PAGE_COUNT = 16;

const read = (path) => readFileSync(path, 'utf8');
const stripComments = (source) => source.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const navLabels = (role) => getNavItems(role).map((item) => item.label);

describe('ロール', () => {
  test('ゲスト／タレント／企業の3種類', () => {
    assert.deepEqual([...ROLES], ['guest', 'talent', 'company']);
    assert.equal(DEFAULT_ROLE, 'guest');
  });

  test('未知の値はゲストとして扱う（壊れた保存値で画面が崩れないように）', () => {
    assert.equal(normalizeRole('company'), 'company');
    assert.equal(normalizeRole('admin'), 'guest');
    assert.equal(normalizeRole(null), 'guest');
    assert.equal(normalizeRole(undefined), 'guest');
  });
});

describe('ヘッダーのナビ', () => {
  test('ロールが company のときだけ「案件掲載」が出る', () => {
    assert.ok(navLabels('company').includes('案件掲載'));
    assert.ok(!navLabels('talent').includes('案件掲載'));
    assert.ok(!navLabels('guest').includes('案件掲載'));
    assert.match(headerHTML({ role: 'company', currentPage: 'index.html' }), /href="job-new\.html"/);
    assert.doesNotMatch(headerHTML({ role: 'guest', currentPage: 'index.html' }), /href="job-new\.html"/);
  });

  test('ロールが talent のときだけ「プロフィール編集」が出る', () => {
    assert.ok(navLabels('talent').includes('プロフィール編集'));
    assert.ok(!navLabels('company').includes('プロフィール編集'));
    assert.ok(!navLabels('guest').includes('プロフィール編集'));
    assert.match(headerHTML({ role: 'talent', currentPage: 'index.html' }), /href="profile-edit\.html"/);
    assert.doesNotMatch(headerHTML({ role: 'company', currentPage: 'index.html' }), /href="profile-edit\.html"/);
  });

  test('どのロールでもタレント・案件の一覧へ行ける', () => {
    for (const role of ROLES) {
      const hrefs = getNavItems(role).map((item) => item.href);
      assert.ok(hrefs.includes('talents.html'), role);
      assert.ok(hrefs.includes('jobs.html'), role);
    }
  });

  test('現在ページのナビリンクにだけ aria-current="page" が付く', () => {
    const html = headerHTML({ role: 'guest', currentPage: 'jobs.html' });
    assert.match(html, /<a[^>]+href="jobs\.html"[^>]*aria-current="page"/);
    assert.equal(html.split('aria-current="page"').length - 1, 1);
  });

  test('ナビに無いページでは aria-current を付けない', () => {
    const html = headerHTML({ role: 'guest', currentPage: 'faq.html' });
    assert.doesNotMatch(html, /aria-current/);
  });

  test('<header> と aria-label="グローバル" の <nav> を持つ', () => {
    const html = headerHTML({ role: 'guest', currentPage: 'index.html' });
    assert.match(html, /<header[\s>]/);
    assert.match(html, /<nav[^>]+aria-label="グローバル"/);
  });

  test('ロール切替の選択肢は3つで、現在のロールが選択済み', () => {
    const html = headerHTML({ role: 'talent', currentPage: 'index.html' });
    assert.equal(html.split('<option').length - 1, ROLES.length);
    assert.match(html, /<option value="talent" selected>/);
    // ラベルが無いとスクリーンリーダーで何の選択肢か分からない
    assert.match(html, /<label[^>]*>[\s\S]*<select/);
  });

  test('未知のロールはゲストとして描画する', () => {
    const html = headerHTML({ role: 'hacker', currentPage: 'index.html' });
    assert.match(html, /<option value="guest" selected>/);
  });

  test('メニューボタンは aria-expanded="false" で始まり、ナビを aria-controls で指す', () => {
    const html = headerHTML({ role: 'guest', currentPage: 'index.html' });
    const navId = html.match(/<nav[^>]+id="([^"]+)"/)?.[1];
    assert.ok(navId, 'nav に id がない');
    assert.match(html, new RegExp(`<button[^>]+aria-expanded="false"[^>]+aria-controls="${navId}"`));
  });
});

describe('現在ページの判定', () => {
  test('パスの末尾のファイル名を返す', () => {
    assert.equal(getCurrentPage('/jobs.html'), 'jobs.html');
    assert.equal(getCurrentPage('/talent_matching/talents.html'), 'talents.html');
  });

  test('ディレクトリ（末尾 /）はトップページとみなす', () => {
    assert.equal(getCurrentPage('/'), 'index.html');
    assert.equal(getCurrentPage(''), 'index.html');
    assert.equal(getCurrentPage('/talent_matching/'), 'index.html');
  });
});

describe('フッター', () => {
  test('デモ注記の文言が含まれる', () => {
    const expected = 'これはデモサイトです。掲載情報はすべて架空です。アップロードした動画はこのブラウザ内にのみ保存され、外部には送信されません';
    assert.ok(DEMO_NOTICE.includes(expected));
    assert.ok(footerHTML().includes(expected));
  });

  test('<footer> と規約・プライバシー・お問い合わせへのリンクを持つ', () => {
    const html = footerHTML();
    assert.match(html, /<footer[\s>]/);
    for (const href of ['terms.html', 'privacy.html', 'contact.html']) {
      assert.match(html, new RegExp(`href="${href.replace('.', '\\.')}"`));
    }
  });
});

describe('サイドバー（検索フィルター枠）', () => {
  test('ボトムシートの開閉ボタン・閉じるボタン・中身の差し込み口を持つ', () => {
    const html = sidebarHTML({ id: 'talent-filter', title: '絞り込み' });
    assert.match(html, /class="[^"]*\bbottom-sheet__trigger\b/);
    assert.match(html, /<aside[^>]+class="[^"]*\bbottom-sheet\b[^"]*"[^>]+id="talent-filter"/);
    assert.match(html, /aria-labelledby="talent-filter-title"/);
    assert.match(html, /data-bottom-sheet-close/);
    assert.match(html, /data-filter-body/);
  });

  test('タイトルと id はエスケープする', () => {
    const html = sidebarHTML({ id: 'x"><script>', title: '<b>絞り込み</b>' });
    assert.doesNotMatch(html, /<script>|<b>/);
  });
});

describe('全ページのHTML', () => {
  test(`${PAGE_COUNT}ページすべてが存在する`, () => {
    assert.equal(Object.keys(PAGE_LAYOUTS).length, PAGE_COUNT);
    for (const page of Object.keys(PAGE_LAYOUTS)) {
      assert.ok(existsSync(join(ROOT, page)), `${page} がありません`);
    }
  });

  for (const [page, layout] of Object.entries(PAGE_LAYOUTS)) {
    test(`${page}：骨格・レイアウトCSS・共通JSがそろっている`, () => {
      const html = stripComments(read(join(ROOT, page)));
      assert.match(html, /<html lang="ja">/);
      assert.match(html, /<title>[^<]+ \| StageLink<\/title>/);
      assert.match(html, /<div id="site-header"><\/div>/);
      assert.match(html, /<div id="site-footer"><\/div>/);
      assert.match(html, /<main id="main"[\s\S]*<h1[\s>]/);
      assert.match(html, /<script type="module" src="js\/common\.js"><\/script>/);
      assert.match(html, /href="css\/components\.css"/);
      assert.match(html, /href="css\/layouts\/site\.css"/);
      // テンプレートの "../../" を外し忘れると、Live Server でCSSが読めず崩れる
      assert.doesNotMatch(html, /\.\.\//);

      const layouts = [...html.matchAll(/href="css\/layouts\/([\w-]+)\.css"/g)].map((m) => m[1]);
      const expected = layout ? ['site', layout] : ['site'];
      assert.deepEqual(layouts, expected);
    });
  }

  test('CSS は reset → variables → base → utilities → components → layouts の順に読む', () => {
    const order = ['reset', 'variables', 'base', 'utilities', 'components', 'layouts/site'];
    for (const page of Object.keys(PAGE_LAYOUTS)) {
      const html = stripComments(read(join(ROOT, page)));
      const positions = order.map((name) => html.indexOf(`css/${name}.css`));
      assert.ok(positions.every((pos) => pos >= 0), `${page}: CSS が足りません`);
      assert.deepEqual([...positions].sort((a, b) => a - b), positions, `${page}: 読み込み順が違います`);
    }
  });
});

describe('レイアウトCSS', () => {
  const expectedFiles = ['site', 'list', 'detail', 'form', 'dashboard', 'static'];

  test('6つのレイアウトファイルがある', () => {
    for (const name of expectedFiles) {
      assert.ok(existsSync(join(LAYOUTS_DIR, `${name}.css`)), `${name}.css がありません`);
    }
  });

  test('生の色を直書きしない（セマンティックトークンのみ）', () => {
    const files = existsSync(LAYOUTS_DIR)
      ? readdirSync(LAYOUTS_DIR).filter((name) => statSync(join(LAYOUTS_DIR, name)).isFile())
      : [];
    for (const name of files) {
      const css = stripComments(read(join(LAYOUTS_DIR, name)));
      assert.doesNotMatch(css, RAW_COLOR_PATTERN, `${name} に生の色があります`);
      assert.doesNotMatch(css, /--palette-/, `${name} がパレットを直接参照しています`);
    }
  });
});

// #08 通知バッジ（M-02）。件数は aria-label で読み上げ、数字のバッジ自体は読み上げから外す（二重に読まれないように）
describe('通知バッジ', () => {
  test('タレントは未読スカウト件数をマイページのリンクに出し、aria-label で読み上げる', () => {
    const html = headerHTML({ role: 'talent', currentPage: 'index.html', notificationCount: 2 });
    assert.match(html, /<a[^>]+href="mypage\.html"[^>]+aria-label="マイページ（未読のスカウト 2件）"/);
    assert.match(html, /<span class="site-header__badge" aria-hidden="true">2<\/span>/);
  });

  test('企業は未対応の応募件数', () => {
    const html = headerHTML({ role: 'company', currentPage: 'index.html', notificationCount: 1 });
    assert.match(html, /aria-label="マイページ（未対応の応募 1件）"/);
  });

  test('スマホ幅ではナビが隠れるので、メニューボタンにも件数を出す', () => {
    const html = headerHTML({ role: 'company', currentPage: 'index.html', notificationCount: 3 });
    assert.match(html, /data-menu-badge[^>]*>3</);
    assert.match(html, /メニュー（未対応の応募 3件）/);
  });

  test('0件・ゲスト・不正な値ではバッジを出さない', () => {
    for (const options of [
      { role: 'talent', notificationCount: 0 },
      { role: 'guest', notificationCount: 5 },
      { role: 'talent', notificationCount: '<b>3</b>' },
      { role: 'talent' },
    ]) {
      const html = headerHTML({ ...options, currentPage: 'index.html' });
      assert.doesNotMatch(html, /site-header__badge"/, JSON.stringify(options));
      assert.doesNotMatch(html, /aria-label="マイページ/, JSON.stringify(options));
    }
  });
});
