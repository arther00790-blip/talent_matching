// #01 デザインシステムの検証テスト
// 目視レビューだけだと「生の色の直書き」や「コントラスト不足」が後から紛れ込むため、
// チケット #01 の完了条件を機械的に確認できるようにしている。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_DIR = join(ROOT, 'css');
const VARIABLES_PATH = join(CSS_DIR, 'variables.css');
const PAGE_BASE_PATH = join(ROOT, 'docs', 'templates', 'page-base.html');
const PREVIEW_PATH = join(ROOT, 'docs', 'design-tokens-preview.html');
const TOKENS_DOC_PATH = join(ROOT, 'docs', 'design-tokens.md');

// WCAG 2.x の基準値
const WCAG_AA_TEXT = 4.5;
const WCAG_AA_NON_TEXT = 3;
const MAX_VAR_DEPTH = 10;
// ブレークポイントの注記は「冒頭コメント」にある必要があるため、先頭からこの文字数だけを見る
const HEADER_COMMENT_SCAN_LENGTH = 2000;

const RAW_COLOR_PATTERN = /#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(/;

/** @param {string} path */
function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`ファイルを読み込めません: ${relative(ROOT, path)} (${error.message})`);
  }
}

/** @param {string} dir @returns {string[]} */
function listCssFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listCssFiles(full);
    return name.endsWith('.css') ? [full] : [];
  });
}

/** @param {string} source */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
}

/** variables.css からカスタムプロパティを抽出する @returns {Map<string,string>} */
function parseVariables() {
  const source = stripComments(read(VARIABLES_PATH));
  const vars = new Map();
  for (const match of source.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    vars.set(match[1], match[2].trim());
  }
  return vars;
}

/** var() を再帰的に解決する */
function resolve(vars, name, depth = 0) {
  if (depth > MAX_VAR_DEPTH) throw new Error(`var() の参照が深すぎます（循環の可能性）: ${name}`);
  const value = vars.get(name);
  if (value === undefined) throw new Error(`未定義のトークン: ${name}`);
  const ref = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return ref ? resolve(vars, ref[1], depth + 1) : value;
}

/** @param {string} hex @returns {number[]} 0-255 の RGB */
function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9A-Fa-f]{6}$/.test(h)) throw new Error(`不透明な HEX 色ではありません: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function luminance([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(hexA, hexB) {
  const a = luminance(hexToRgb(hexA));
  const b = luminance(hexToRgb(hexB));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const SEMANTIC_COLORS = [
  'background', 'foreground',
  'card', 'card-foreground',
  'muted', 'muted-foreground',
  'primary', 'primary-foreground',
  'secondary', 'secondary-foreground',
  'accent', 'accent-foreground',
  'border', 'input', 'ring',
  'success', 'success-foreground',
  'warning', 'warning-foreground',
  'danger', 'danger-foreground',
  'info', 'info-foreground',
  'overlay',
].map((n) => `--color-${n}`);

const OTHER_TOKENS = [
  '--space-1', '--space-2', '--space-3', '--space-4', '--space-6', '--space-8', '--space-12', '--space-16',
  '--radius-sm', '--radius-md', '--radius-lg', '--radius-full',
  '--shadow-sm', '--shadow-md', '--shadow-lg',
  '--font-family-base',
  '--font-size-xs', '--font-size-sm', '--font-size-base', '--font-size-lg', '--font-size-xl', '--font-size-2xl', '--font-size-3xl',
  '--line-height-tight', '--line-height-normal',
  '--font-weight-normal', '--font-weight-bold',
  '--duration-fast', '--duration-normal', '--duration-slow', '--easing-standard',
  '--z-header', '--z-sheet', '--z-modal', '--z-toast',
  '--container-max', '--header-height',
  '--toast-max-width', '--dialog-max-width', '--sheet-max-height', '--aspect-portrait',
];

// [背景, 文字] の組。文字として読まれる組はすべて AA(4.5) を要求する
const TEXT_PAIRS = [
  ['background', 'foreground'],
  ['background', 'muted-foreground'],
  ['background', 'primary'],
  ['card', 'card-foreground'],
  ['card', 'muted-foreground'],
  ['muted', 'muted-foreground'],
  ['muted', 'foreground'],
  ['primary', 'primary-foreground'],
  ['primary-hover', 'primary-foreground'],
  ['brand', 'brand-foreground'],
  ['secondary','secondary-foreground'],
  ['secondary-hover', 'secondary-foreground'],
  ['accent', 'accent-foreground'],
  ['success', 'success-foreground'],
  ['warning', 'warning-foreground'],
  ['danger', 'danger-foreground'],
  ['danger-hover', 'danger-foreground'],
  ['info', 'info-foreground'],
];

// フォーカスリング・入力欄枠は文字ではないので WCAG 1.4.11 の 3:1 を要求する
const NON_TEXT_PAIRS = [
  ['background', 'ring'],
  ['card', 'ring'],
  ['card', 'input'],
];

describe('色の直書き禁止', () => {
  test('css/ 配下に CSS ファイルが存在する', () => {
    const names = listCssFiles(CSS_DIR).map((f) => relative(CSS_DIR, f).replaceAll('\\', '/'));
    for (const required of ['reset.css', 'variables.css', 'base.css', 'utilities.css']) {
      assert.ok(names.includes(required), `css/${required} がありません`);
    }
  });

  test('variables.css 以外に HEX / rgb() / hsl() が無い', () => {
    const offenders = listCssFiles(CSS_DIR)
      .filter((f) => f !== VARIABLES_PATH)
      .filter((f) => RAW_COLOR_PATTERN.test(read(f)))
      .map((f) => relative(ROOT, f));
    assert.deepEqual(offenders, [], `生の色値が見つかりました: ${offenders.join(', ')}`);
  });

  test('テンプレート・見本 HTML にも生の色値が無い', () => {
    for (const path of [PAGE_BASE_PATH, PREVIEW_PATH]) {
      assert.ok(!RAW_COLOR_PATTERN.test(read(path)), `${relative(ROOT, path)} に生の色値があります`);
    }
  });

  test('--palette-* は variables.css 以外から参照されない', () => {
    const files = [...listCssFiles(CSS_DIR).filter((f) => f !== VARIABLES_PATH), PAGE_BASE_PATH, PREVIEW_PATH];
    const offenders = files.filter((f) => /--palette-/.test(read(f))).map((f) => relative(ROOT, f));
    assert.deepEqual(offenders, []);
  });

  test('gray / grey を含むクラス名・変数名が無い', () => {
    const files = [...listCssFiles(CSS_DIR), PAGE_BASE_PATH, PREVIEW_PATH];
    const offenders = files.filter((f) => /gr[ae]y/i.test(stripComments(read(f)))).map((f) => relative(ROOT, f));
    assert.deepEqual(offenders, []);
  });
});

describe('トークン定義（variables.css）', () => {
  test('セマンティックカラーがすべて定義されている', () => {
    const vars = parseVariables();
    const missing = SEMANTIC_COLORS.filter((n) => !vars.has(n));
    assert.deepEqual(missing, []);
  });

  test('余白・角丸・影・フォント・モーション・レイヤー・レイアウトのトークンが定義されている', () => {
    const vars = parseVariables();
    const missing = OTHER_TOKENS.filter((n) => !vars.has(n));
    assert.deepEqual(missing, []);
  });

  test('ブランド色のプリミティブが定義されている', () => {
    const vars = parseVariables();
    assert.equal(vars.get('--palette-coral-500')?.toUpperCase(), '#FF7A59');
    assert.equal(vars.get('--palette-navy-900')?.toUpperCase(), '#1E2A44');
  });

  test('セマンティックカラーはプリミティブ（var()）経由で定義されている', () => {
    const vars = parseVariables();
    const direct = SEMANTIC_COLORS.filter((n) => n !== '--color-overlay' && !/^var\(/.test(vars.get(n) ?? ''));
    assert.deepEqual(direct, [], 'セマンティックカラーに生の値が直接書かれています');
  });

  test('font-family-base は Noto Sans JP', () => {
    assert.match(parseVariables().get('--font-family-base') ?? '', /"Noto Sans JP"/);
  });

  test('ブレークポイントが冒頭コメントに明記されている', () => {
    const head = read(VARIABLES_PATH).slice(0, HEADER_COMMENT_SCAN_LENGTH);
    assert.match(head, /640px/);
    assert.match(head, /1024px/);
  });
});

describe('WCAG コントラスト', () => {
  for (const [bg, fg] of TEXT_PAIRS) {
    test(`${bg} × ${fg} が ${WCAG_AA_TEXT}:1 以上`, () => {
      const vars = parseVariables();
      const ratio = contrast(resolve(vars, `--color-${bg}`), resolve(vars, `--color-${fg}`));
      assert.ok(ratio >= WCAG_AA_TEXT, `コントラスト比 ${ratio.toFixed(2)}:1`);
    });
  }
  for (const [bg, fg] of NON_TEXT_PAIRS) {
    test(`${bg} × ${fg} が ${WCAG_AA_NON_TEXT}:1 以上（非テキスト）`, () => {
      const vars = parseVariables();
      const ratio = contrast(resolve(vars, `--color-${bg}`), resolve(vars, `--color-${fg}`));
      assert.ok(ratio >= WCAG_AA_NON_TEXT, `コントラスト比 ${ratio.toFixed(2)}:1`);
    });
  }
});

describe('ベース・ユーティリティ', () => {
  test('reset.css が prefers-reduced-motion に対応している', () => {
    assert.match(read(join(CSS_DIR, 'reset.css')), /prefers-reduced-motion:\s*reduce/);
  });

  test('base.css に body のトークン指定・:focus-visible・.visually-hidden・スキップリンクがある', () => {
    const css = read(join(CSS_DIR, 'base.css'));
    assert.match(css, /background-color:\s*var\(--color-background\)/);
    assert.match(css, /color:\s*var\(--color-foreground\)/);
    assert.match(css, /font-family:\s*var\(--font-family-base\)/);
    assert.match(css, /:focus-visible[\s\S]*?var\(--color-ring\)/);
    assert.match(css, /\.visually-hidden\s*[,{]/);
    assert.match(css, /\.skip-link/);
  });

  test('utilities.css にトークンと1対1の色クラスとレイアウト補助がある', () => {
    const css = read(join(CSS_DIR, 'utilities.css'));
    const required = [
      ['.bg-background', '--color-background'],
      ['.bg-card', '--color-card'],
      ['.bg-muted', '--color-muted'],
      ['.bg-primary', '--color-primary'],
      ['.bg-secondary', '--color-secondary'],
      ['.text-foreground', '--color-foreground'],
      ['.text-muted-foreground', '--color-muted-foreground'],
      ['.text-primary', '--color-primary'],
    ];
    for (const [cls, token] of required) {
      const re = new RegExp(`\\${cls}\\s*\\{[^}]*var\\(${token}\\)`);
      assert.match(css, re, `${cls} が ${token} を参照していません`);
    }
    for (const cls of ['.container', '.stack', '.cluster']) {
      assert.match(css, new RegExp(`\\${cls}\\s*[{>]`), `${cls} がありません`);
    }
  });
});

describe('共通HTML骨格（page-base.html）', () => {
  test('lang="ja"・charset・viewport がある', () => {
    const html = read(PAGE_BASE_PATH);
    assert.match(html, /<html[^>]*\blang="ja"/);
    assert.match(html, /<meta\s+charset="utf-8"/i);
    assert.match(html, /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1"/);
  });

  test('Noto Sans JP を preconnect と link で読み込む', () => {
    const html = read(PAGE_BASE_PATH);
    assert.match(html, /<link\s+rel="preconnect"\s+href="https:\/\/fonts\.googleapis\.com"/);
    assert.match(html, /<link\s+rel="preconnect"\s+href="https:\/\/fonts\.gstatic\.com"\s+crossorigin/);
    assert.match(html, /<link\s+rel="stylesheet"\s+href="https:\/\/fonts\.googleapis\.com\/css2\?family=Noto\+Sans\+JP/);
  });

  test('CSS が reset → variables → base → utilities の順で読み込まれる', () => {
    const html = stripComments(read(PAGE_BASE_PATH));
    const order = [...html.matchAll(/<link[^>]+href="[^"]*css\/([\w-]+)\.css"/g)].map((m) => m[1]);
    assert.deepEqual(order, ['reset', 'variables', 'base', 'utilities']);
  });

  test('#02 以降の CSS・JS 読み込み枠がコメントで示されている', () => {
    const html = read(PAGE_BASE_PATH);
    assert.match(html, /components\.css/);
    assert.match(html, /layouts\//);
    assert.match(html, /pages\//);
    assert.match(html, /type="module"/);
  });

  test('body・ヘッダー・main・フッター・スキップリンクがある', () => {
    const html = read(PAGE_BASE_PATH);
    assert.match(html, /<body[^>]*class="[^"]*\bbg-background\b[^"]*\btext-foreground\b[^"]*"/);
    assert.match(html, /<div id="site-header"/);
    assert.match(html, /<main id="main"/);
    assert.match(html, /<div id="site-footer"/);
    assert.match(html, /<a[^>]+href="#main"[^>]*class="[^"]*skip-link/);
  });

  test('スキップリンクは body の最初の要素', () => {
    const html = stripComments(read(PAGE_BASE_PATH));
    const afterBody = html.split(/<body[^>]*>/)[1] ?? '';
    assert.match(afterBody.trimStart(), /^<a[^>]+skip-link/);
  });

  test('先頭コメントに「編集しない」旨と理由がある', () => {
    const html = read(PAGE_BASE_PATH);
    assert.match(html, /編集しない/);
    assert.match(html, /<main>/);
  });
});

describe('ドキュメント', () => {
  test('design-tokens.md に主要トークンと使い分けが書かれている', () => {
    const md = read(TOKENS_DOC_PATH);
    for (const token of ['--color-primary', '--color-primary-foreground', '--color-muted-foreground', '--space-4', '--radius-lg', '--z-modal']) {
      assert.ok(md.includes(token), `${token} の記載がありません`);
    }
    assert.match(md, /コントラスト/);
  });
});
