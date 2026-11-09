// #10 仕上げ：コントラスト比（WCAG AA）と色の直書きの最終確認
// design-system.test.mjs は「トークンの定義どうしの組」を見ている。ここでは
//   1. 文字色トークン × 面（背景）トークンの総当たり
//   2. 実際の CSS ルールで同時に指定されている「背景 × 文字」の組
//   3. HTML・JS も含めた生の色値 / gray-* の不在
// を確認し、ページを作る過程で AA を割る組み合わせが紛れ込んでいないかを機械的に検出する。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_DIR = join(ROOT, 'css');
const JS_DIR = join(ROOT, 'js');
const VARIABLES_PATH = join(CSS_DIR, 'variables.css');

// WCAG 2.x 1.4.3（通常文字）と、大きい文字（18pt 以上 / 14pt 太字以上）の基準
const WCAG_AA_TEXT = 4.5;
const WCAG_AA_LARGE_TEXT = 3;
const MAX_VAR_DEPTH = 10;
const SRGB_LINEAR_THRESHOLD = 0.03928;

const RAW_COLOR_PATTERN = /#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(/;
const GRAY_PATTERN = /gr[ae]y/i;

// 面の上に直接置く文字色（*-foreground のうち、対になる色面の上でだけ使うものは除く）
const TEXT_TOKENS = [
  'foreground', 'card-foreground', 'muted-foreground', 'accent-foreground',
  'primary', 'primary-hover', 'secondary', 'danger', 'success', 'info',
];
// ページ・カード・セクション・ホバーの面として使う背景
const SURFACE_TOKENS = ['background', 'card', 'muted', 'accent'];

// 通常文字では AA に届かないため、デザイン上「使わない」と決めている組。
// accent 面での primary 文字は 4.2:1 なので、components.css の .button--outline:hover と同様に primary-hover を使う
const AVOIDED_PAIRS = Object.freeze([
  { surface: 'accent', text: 'primary' },
]);

// 同じルールで背景と文字色を指定していても、文字として読まれないもの。
// アイコン（currentColor の SVG）は文字ではないので、非テキストの基準（WCAG 1.4.11 の 3:1）で見る
const ICON_SELECTORS = Object.freeze([
  '.top-feature__icon', // トップの特徴アイコン（aria-hidden。見出しと本文で意味は伝わる）
]);
// 背景がグラデーションで単色の面ではなく、中身も aria-hidden のシルエットだけのもの
const EXCLUDED_SELECTORS = Object.freeze([
  '.talent-card__placeholder',
]);
const WCAG_AA_NON_TEXT = 3;

/** @param {string} path */
function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`ファイルを読み込めません: ${relative(ROOT, path)} (${error.message})`);
  }
}

const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');

/** @param {string} dir @param {string} ext @returns {string[]} */
function listFiles(dir, ext) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listFiles(full, ext);
    return name.endsWith(ext) ? [full] : [];
  });
}

/** @returns {Map<string, string>} */
function parseVariables() {
  const source = stripComments(read(VARIABLES_PATH));
  return new Map([...source.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
}

/** var() を再帰的に解決して HEX を返す */
function resolveColor(vars, name, depth = 0) {
  if (depth > MAX_VAR_DEPTH) throw new Error(`var() の参照が深すぎます（循環の可能性）: ${name}`);
  const value = vars.get(name);
  if (value === undefined) throw new Error(`未定義のトークン: ${name}`);
  const ref = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return ref ? resolveColor(vars, ref[1], depth + 1) : value;
}

/** @param {string} hex */
function relativeLuminance(hex) {
  const digits = hex.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(digits)) throw new Error(`不透明な6桁 HEX ではありません: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= SRGB_LINEAR_THRESHOLD ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @param {string} hexA @param {string} hexB */
function contrastRatio(hexA, hexB) {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * CSS からルール単位で「背景トークン × 文字色トークン」の組を取り出す。
 * @returns {{ file: string, selector: string, surface: string, text: string }[]}
 */
function collectRulePairs() {
  return listFiles(CSS_DIR, '.css').filter((file) => file !== VARIABLES_PATH).flatMap((file) => {
    const css = stripComments(read(file));
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selector, body]) => {
      const surface = body.match(/background(?:-color)?\s*:\s*var\(--color-([\w-]+)\)\s*;/)?.[1];
      const text = body.match(/(?:^|[;\s])color\s*:\s*var\(--color-([\w-]+)\)\s*;/)?.[1];
      if (!surface || !text) return [];
      return [{ file: relative(ROOT, file).replaceAll('\\', '/'), selector: selector.trim(), surface, text }];
    });
  });
}

const vars = parseVariables();
const ratioOf = (surface, text) => contrastRatio(resolveColor(vars, `--color-${surface}`), resolveColor(vars, `--color-${text}`));
const isAvoided = (surface, text) => AVOIDED_PAIRS.some((pair) => pair.surface === surface && pair.text === text);

describe('contrastRatio', () => {
  test('白と黒は 21:1、同色は 1:1', () => {
    assert.equal(contrastRatio('#FFFFFF', '#000000').toFixed(2), '21.00');
    assert.equal(contrastRatio('#1E2A44', '#1E2A44'), 1);
  });
});

describe('文字色トークン × 面トークン（総当たり）', () => {
  for (const surface of SURFACE_TOKENS) {
    for (const text of TEXT_TOKENS) {
      if (isAvoided(surface, text)) {
        test(`${surface} × ${text} は通常文字では使わない組（大きい文字の ${WCAG_AA_LARGE_TEXT}:1 は満たす）`, () => {
          assert.ok(ratioOf(surface, text) >= WCAG_AA_LARGE_TEXT);
        });
        continue;
      }
      test(`${surface} × ${text} が ${WCAG_AA_TEXT}:1 以上`, () => {
        const ratio = ratioOf(surface, text);
        assert.ok(ratio >= WCAG_AA_TEXT, `コントラスト比 ${ratio.toFixed(2)}:1`);
      });
    }
  }
});

describe('CSS ルールで同時に指定された背景 × 文字色', () => {
  const pairs = collectRulePairs();

  test('組が抽出できている（抽出処理の壊れ検知）', () => {
    assert.ok(pairs.length > 0);
  });

  test(`文字は ${WCAG_AA_TEXT}:1 以上、アイコンは ${WCAG_AA_NON_TEXT}:1 以上`, () => {
    const failures = pairs
      .filter((pair) => !EXCLUDED_SELECTORS.includes(pair.selector))
      .map((pair) => ({ ...pair, ratio: ratioOf(pair.surface, pair.text) }))
      .filter((pair) => pair.ratio < (ICON_SELECTORS.includes(pair.selector) ? WCAG_AA_NON_TEXT : WCAG_AA_TEXT))
      .map((pair) => `${pair.file} ${pair.selector}: ${pair.surface} × ${pair.text} = ${pair.ratio.toFixed(2)}:1`);
    assert.deepEqual(failures, []);
  });

  test('避けると決めた組が文字のルールに無い', () => {
    const used = pairs.filter((pair) => !ICON_SELECTORS.includes(pair.selector) && isAvoided(pair.surface, pair.text))
      .map((pair) => `${pair.file} ${pair.selector}`);
    assert.deepEqual(used, []);
  });
});

describe('色の直書きの最終確認（HTML・JS を含む）', () => {
  const pages = readdirSync(ROOT).filter((name) => name.endsWith('.html')).map((name) => join(ROOT, name));
  const targets = [
    ...listFiles(CSS_DIR, '.css').filter((file) => file !== VARIABLES_PATH),
    ...listFiles(JS_DIR, '.js'),
    ...pages,
  ];

  test('variables.css 以外の css / js / html に生の HEX・rgb()・hsl() が無い', () => {
    // HTML の href="#add" などのアンカーを HEX と誤検出しないよう、HTML は style と色属性だけを見る
    const offenders = targets.filter((file) => {
      const source = stripComments(read(file));
      if (!file.endsWith('.html')) return RAW_COLOR_PATTERN.test(source);
      const styles = [...source.matchAll(/style="([^"]*)"|<style[^>]*>([\s\S]*?)<\/style>/g)]
        .map((match) => match[1] ?? match[2]).join('\n');
      return RAW_COLOR_PATTERN.test(styles) || /\s(?:fill|stroke|color)="(?:#|rgb|hsl)/i.test(source);
    }).map((file) => relative(ROOT, file));
    assert.deepEqual(offenders, []);
  });

  test('gray / grey を含むクラス名・変数名が無い', () => {
    const offenders = targets.filter((file) => GRAY_PATTERN.test(stripComments(read(file))))
      .map((file) => relative(ROOT, file));
    assert.deepEqual(offenders, []);
  });
});
