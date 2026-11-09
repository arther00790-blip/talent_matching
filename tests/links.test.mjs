// #10 リンク切れ・<head> の共通設定・静的ページの中身のテスト
// 公開後に気づきにくい「存在しないファイルへのリンク」や「ページごとの <head> の抜け漏れ」を、
// ブラウザで全ページを開かなくても機械的に検出できるようにする。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS_DIR = join(ROOT, 'js');
const PAGE_BASE_PATH = join(ROOT, 'docs', 'templates', 'page-base.html');
// 要件 3.1 の画面一覧（16 ファイル）。増減したら一覧の更新漏れに気づけるよう件数を固定する
const EXPECTED_PAGE_COUNT = 16;
const MIN_FAQ_ITEMS = 5;

// ユーザー承認済みの CSP（#10）。全ページで同じ値にそろえ、1か所だけ緩むことを防ぐ
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";
const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
const OGP_PROPERTIES = ['og:title', 'og:description', 'og:type', 'og:site_name', 'og:locale'];
const STATIC_PAGES = ['about.html', 'faq.html', 'terms.html', 'privacy.html', '404.html'];
// スキーム付き（https: / mailto: / tel: / data: など）と // 始まりは外部またはファイル以外なので対象外
const NON_FILE_REF = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

/** @param {string} path */
function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`ファイルを読み込めません: ${relative(ROOT, path)} (${error.message})`);
  }
}

const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '');
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** @returns {string[]} ルート直下の HTML ファイル名（docs/ 配下の開発用ページは含めない） */
function listPages() {
  return readdirSync(ROOT).filter((name) => name.endsWith('.html')).sort();
}

/** @param {string} dir @returns {string[]} */
function listJsFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listJsFiles(full);
    return name.endsWith('.js') ? [full] : [];
  });
}

/** 内部リンクならクエリ・ハッシュを除いたパスを、対象外なら null を返す @param {string} ref */
function toLocalPath(ref) {
  const value = ref.trim();
  if (value === '' || value.startsWith('#') || NON_FILE_REF.test(value)) return null;
  const path = value.split(/[?#]/)[0];
  return path === '' ? null : path;
}

/** @param {string} html @returns {string[]} href / src の値 */
function extractRefs(html) {
  return [...stripComments(html).matchAll(/\s(?:href|src)="([^"]*)"/g)].map((match) => match[1]);
}

/** @param {string} html @returns {string} <head> の中身 */
function headOf(html) {
  return stripComments(html).match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
}

/** @param {string} html @returns {string} <main> 要素 */
function mainOf(html) {
  return stripComments(html).match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';
}

/** @param {string} fromFile ルートからの相対パス @param {string} path */
function existsFrom(fromFile, path) {
  const target = path.startsWith('/') ? path.slice(1) : posix.join(posix.dirname(fromFile), path);
  const full = join(ROOT, target);
  if (!existsSync(full)) return false;
  return statSync(full).isDirectory() ? existsSync(join(full, 'index.html')) : true;
}

const pages = listPages();
const readPage = (page) => read(join(ROOT, page));

describe('対象ページ', () => {
  test(`ルート直下に ${EXPECTED_PAGE_COUNT} ページある`, () => {
    assert.equal(pages.length, EXPECTED_PAGE_COUNT, pages.join(', '));
  });
});

describe('toLocalPath（リンクの判定）', () => {
  test('外部 URL・アンカー・mailto/tel は対象外', () => {
    for (const ref of ['https://fonts.googleapis.com', '//example.com/a.css', '#main', 'mailto:a@example.com', 'tel:0000', '']) {
      assert.equal(toLocalPath(ref), null, ref);
    }
  });

  test('クエリとハッシュを除く', () => {
    assert.equal(toLocalPath('talent.html?id=t001'), 'talent.html');
    assert.equal(toLocalPath('faq.html#video'), 'faq.html');
    assert.equal(toLocalPath('css/pages/static.css'), 'css/pages/static.css');
  });
});

describe('内部リンク切れ', () => {
  for (const page of pages) {
    test(`${page} の href / src が存在するファイルを指す`, () => {
      const missing = extractRefs(readPage(page))
        .map(toLocalPath)
        .filter((path) => path !== null && !existsFrom(page, path));
      assert.deepEqual(missing, []);
    });
  }

  test('JS が組み立てる「xxx.html」へのリンクも存在する', () => {
    // ヘッダー・フッター・カード等のリンクは JS 側にあり、HTML を見るだけでは検出できないため
    const missing = listJsFiles(JS_DIR).flatMap((file) => (
      [...read(file).matchAll(/['"`]([\w-]+\.html)(?=[?#'"`])/g)]
        .map((match) => match[1])
        .filter((name) => !existsSync(join(ROOT, name)))
        .map((name) => `${relative(ROOT, file)} → ${name}`)
    ));
    assert.deepEqual(missing, []);
  });
});

describe('全ページ共通の <head> と骨格', () => {
  for (const page of pages) {
    describe(page, () => {
      const html = readPage(page);
      const head = headOf(html);

      test('フッターの差し込み先（#site-footer）がある', () => {
        assert.match(stripComments(html), /<div id="site-footer"><\/div>/);
      });

      test('meta description がある', () => {
        assert.match(head, /<meta name="description" content="[^"]+">/);
      });

      test('CSP の meta が承認済みの値で、viewport の直後にある', () => {
        assert.ok(head.includes(CSP_META), 'CSP の値が承認済みのものと一致しません');
        assert.match(head, /<meta name="viewport"[^>]*>\s*<meta http-equiv="Content-Security-Policy"/);
      });

      test('OGP（og:image / og:url 以外）がある', () => {
        for (const property of OGP_PROPERTIES) {
          assert.match(head, new RegExp(`<meta property="${property}" content="[^"]+">`), property);
        }
      });

      test('og:title は <title> と、og:description は meta description と一致する', () => {
        const title = head.match(/<title>([^<]+)<\/title>/)?.[1];
        const description = head.match(/<meta name="description" content="([^"]+)">/)?.[1];
        assert.ok(title && description);
        assert.match(head, new RegExp(`<meta property="og:title" content="${escapeRegExp(title)}">`));
        assert.match(head, new RegExp(`<meta property="og:description" content="${escapeRegExp(description)}">`));
      });

      test('h1 は 1 つだけ', () => {
        assert.equal((stripComments(html).match(/<h1[\s>]/g) ?? []).length, 1);
      });

      test('インラインの style 属性・script・イベント属性が無い（CSP で止まるため）', () => {
        const source = stripComments(html);
        assert.doesNotMatch(source, /\sstyle="/);
        assert.doesNotMatch(source, /<script(?![^>]*\ssrc=)[^>]*>/);
        assert.doesNotMatch(source, /\son[a-z]+="/);
      });
    });
  }

  test('page-base.html にも同じ CSP がある', () => {
    assert.ok(headOf(read(PAGE_BASE_PATH)).includes(CSP_META));
  });
});

describe('静的ページの中身', () => {
  test('静的ページは static.css レイアウトとページ固有 CSS を読み込む', () => {
    for (const page of STATIC_PAGES) {
      const head = headOf(readPage(page));
      assert.match(head, /<link rel="stylesheet" href="css\/layouts\/static\.css">/, page);
      assert.match(head, /<link rel="stylesheet" href="css\/pages\/static\.css">/, page);
    }
  });

  test('About：タレント向け・企業向けの利用ステップがある', () => {
    const main = mainOf(readPage('about.html'));
    assert.match(main, /<h2[^>]*>[^<]*タレント/);
    assert.match(main, /<h2[^>]*>[^<]*企業/);
    assert.ok((main.match(/<ol[\s>]/g) ?? []).length >= 2, '利用ステップの番号付きリストが2つありません');
  });

  test('FAQ：details / summary のアコーディオンで、JS を使わない', () => {
    const html = readPage('faq.html');
    const main = mainOf(html);
    const details = (main.match(/<details[\s>]/g) ?? []).length;
    assert.ok(details >= MIN_FAQ_ITEMS, `質問が少なすぎます（${details}件）`);
    assert.equal((main.match(/<summary[\s>]/g) ?? []).length, details);
    assert.doesNotMatch(stripComments(html), /js\/pages\//);
  });

  test('利用規約・プライバシー：冒頭でダミー文面と明記する', () => {
    for (const page of ['terms.html', 'privacy.html']) {
      const main = mainOf(readPage(page));
      const notice = main.indexOf('ダミー');
      assert.ok(notice >= 0, `${page} にダミー文面の注記がありません`);
      assert.ok(notice < main.indexOf('<h2'), `${page} の注記が冒頭（最初の h2 より前）にありません`);
    }
  });

  test('プライバシー：外部へ送信せずブラウザ内にのみ保存すると明記する（要件 5.2）', () => {
    const main = mainOf(readPage('privacy.html'));
    for (const word of ['localStorage', 'sessionStorage', 'IndexedDB', '外部へ送信', 'ブラウザ内']) {
      assert.ok(main.includes(word), word);
    }
  });

  test('404：トップ・タレント一覧・案件一覧への導線がある', () => {
    const main = mainOf(readPage('404.html'));
    for (const href of ['index.html', 'talents.html', 'jobs.html']) {
      assert.match(main, new RegExp(`href="${escapeRegExp(href)}"`), href);
    }
  });
});
